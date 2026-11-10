import { NOW } from "@/data";
import type { ActionId, ActionInput } from "./actions";
import { firstName } from "./actions";
import { noWineAmount } from "./comparison";
import { formatUsd } from "./format";
import { isWaitOver, MEAL_CAP, RECEIPT_LIMIT, type LocalClaim } from "./local";
import { FINANCE_LIMIT, FINANCE_NUDGE_WORKING_DAYS, fxFacts, receiptException, waitDays, weeklyFacts } from "./policy";

/**
 * The one table that turns a claim into actions and reasons (PRD 9). The facts come from `policy.ts`, which reads every limit from the
 * dataset. The table is authored by reason type, and for each one gives the recommended action, the other actions, the gap to the policy,
 * and the reasoning: why the recommended action is the right one and why each other action is weaker. The triage note, the Policy tab and
 * the assistant all read this, so they always say the same thing. It never reads the dataset's answer key.
 *
 * The rule behind the table: approval is only recommended when every policy check passes. When one fails, the recommended action is the
 * one that fixes it (get the receipt, send to Finance, pay the amount the policy supports), never an approval that skips the check.
 */
export type ActionSpec = {
  id: ActionId;
  label: string;
  input: ActionInput;
  /** Needs the preview dialog. A one-tap action applies at once and relies on undo (PRD 8.4). */
  confirm: boolean;
  /** Collects a typed amount in the dialog. */
  askAmount?: boolean;
  /** Collects a message in the dialog. */
  askMessage?: "decline" | "ask" | "wait";
  /** Visual weight of a destructive choice. */
  destructive?: boolean;
};

export type Recommendation = {
  recommended: ActionSpec | null;
  secondary: ActionSpec[];
  more: ActionSpec[];
};

export type Assessment = {
  recommendation: Recommendation;
  /** The gap between the claim and the policy, in at most 8 words. */
  gap: string;
  /** Why the claim sits where it does, in at most 8 words, for the triage note. */
  short: string;
  /** Why the recommended action is the right one. Empty when there is no recommendation. */
  why: string;
  /** Why each other action is weaker, by button label. */
  others: { label: string; why: string }[];
};

const approve = (claim: LocalClaim, amount = claim.amount.usd_claimed, label?: string, oneTap = false): ActionSpec => ({
  id: amount === claim.amount.usd_claimed ? "approve" : "approve_amount",
  label: label ?? `Approve ${formatUsd(amount)}`,
  input: { id: amount === claim.amount.usd_claimed ? "approve" : "approve_amount", amount },
  confirm: !oneTap,
});

const exception = (amount: number, label: string, reason: string): ActionSpec => ({
  id: "exception",
  label,
  input: { id: "exception", amount, reason },
  confirm: true,
});

const decline = (): ActionSpec => ({ id: "decline", label: "Decline claim", input: { id: "decline" }, confirm: true, askMessage: "decline", destructive: true });

const ask = (claim: LocalClaim): ActionSpec => ({
  id: "ask",
  label: `Ask ${firstName(claim)} a question`,
  input: { id: "ask" },
  confirm: true,
  askMessage: "ask",
});

/** Parks the claim for the wait window of its reason type, then it returns to the queue. */
const wait = (claim: LocalClaim, more = false): ActionSpec => {
  const days = waitDays(claim.agent.reason_type, "wait");
  return { id: "wait", label: `Wait ${days}${more ? " more" : ""} days for receipt`, input: { id: "wait" }, confirm: true, askMessage: "wait" };
};

const otherAmount = (): ActionSpec => ({
  id: "approve_amount",
  label: "Approve a different amount",
  input: { id: "approve_amount" },
  confirm: true,
  askAmount: true,
});

const toFinance = (label = "Send to Finance"): ActionSpec => ({ id: "to_finance", label, input: { id: "to_finance" }, confirm: true });

const toFinanceBoth = (): ActionSpec => ({ id: "to_finance_both", label: "Send both claims to Finance", input: { id: "to_finance_both" }, confirm: true });


const extendWait = (): ActionSpec => ({
  id: "extend_wait",
  label: `Wait ${FINANCE_NUDGE_WORKING_DAYS} more working days`,
  input: { id: "extend_wait" },
  confirm: false,
});

const limit = formatUsd(FINANCE_LIMIT);
const upper = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** The assessment of a claim that needs a decision: waiting on the manager, or back in her queue after a wait. Pure. */
export function assess(claim: LocalClaim, all: LocalClaim[] = [], now: Date = NOW): Assessment {
  const claimed = claim.amount.usd_claimed;
  const name = firstName(claim);
  const reason = claim.agent.reason_type;
  const week = weeklyFacts(claim, all);
  const wallet = claim.local?.wait;
  const waitedOut = isWaitOver(claim, now);

  const make = (a: Omit<Assessment, "others"> & { others?: Assessment["others"] }): Assessment => ({ others: [], ...a });

  // A wait that ended: the claim is back in the queue and the manager decides.
  if (waitedOut && wallet?.kind === "finance") {
    return make({
      recommendation: { recommended: extendWait(), secondary: [], more: [] },
      gap: "With Finance, no decision yet",
      short: "Finance has not decided yet",
      why: `${FINANCE_NUDGE_WORKING_DAYS} working days have passed since it went to Finance. Waiting longer keeps the Finance approval the policy requires.`,
    });
  }
  if (waitedOut && (reason === "receipt_missing" || reason === "receipt_missing_unresolved" || reason === "receipt_unreadable")) {
    const days = wallet?.days ?? waitDays(reason, "wait");
    const ex = receiptException(claim);
    const secondary = [...(ex.allowed ? [exception(claimed, "Approve with card statement", "card statement instead of a receipt")] : []), wait(claim, true)];
    return make({
      recommendation: { recommended: decline(), secondary, more: [otherAmount()] },
      gap: `${formatUsd(Math.max(0, claimed - RECEIPT_LIMIT))} over the no-receipt limit`,
      short: `No receipt after ${days} days`,
      why: `The ${days}-day wait ended without a receipt, and policy needs one above ${formatUsd(RECEIPT_LIMIT)}. Declining is the outcome the policy allows.`,
      others: [
        { label: secondary[secondary.length - 1].label, why: `${days} days have already passed, so waiting again only delays the answer.` },
        ...(ex.allowed ? [{ label: "Approve with card statement", why: `Allowed up to ${formatUsd(ex.ceiling)}, but it skips the receipt the policy requires.` }] : []),
      ],
    });
  }

  switch (reason) {
    case "over_finance_threshold": {
      const rec = approve(claim, claimed, "Approve and send to Finance");
      return make({
        recommendation: { recommended: { ...rec, confirm: true }, secondary: [decline(), ask(claim)], more: [otherAmount()] },
        gap: `${formatUsd(claimed - FINANCE_LIMIT)} over the Finance limit`,
        short: "Valid claim, only Finance sign-off needed",
        why: `Every other check passes. Only Finance can clear the ${limit} limit, so approving sends it there.`,
        others: [
          { label: "Decline claim", why: "The claim is valid, so declining rejects a good claim." },
          { label: ask(claim).label, why: "Nothing is unclear, so a question only delays Finance." },
        ],
      });
    }

    case "unusual_amount": {
      const doc = claim.receipt.document;
      const supported = claim.receipt.status === "attached" && doc?.total != null && Math.abs(doc.total - claimed) < 0.005;
      const usual = Number((claim.agent.facts.find((f) => /median/i.test(f.label))?.value ?? "").replace(/[^0-9.]/g, "")) || 0;
      const gap = usual ? `${formatUsd(claimed - usual)} above a usual ride` : "Higher than a usual ride";
      if (supported) {
        return make({
          recommendation: { recommended: approve(claim, claimed, `Approve ${formatUsd(claimed)}`, true), secondary: [decline(), ask(claim)], more: [otherAmount()] },
          gap,
          short: "Higher than usual, receipt supports it",
          why: `The receipt supports ${formatUsd(claimed)} and no policy limit applies.`,
          others: [
            { label: "Decline claim", why: "No rule is broken, so there is no ground to decline." },
            { label: ask(claim).label, why: "The receipt already answers the question." },
          ],
        });
      }
      return make({
        recommendation: { recommended: ask(claim), secondary: [decline()], more: [approve(claim), otherAmount()] },
        gap,
        short: "Higher than usual, nothing supports it yet",
        why: "The amount can't be matched to a receipt yet, so a question comes first.",
        others: [
          { label: `Approve ${formatUsd(claimed)}`, why: "Nothing supports the higher amount yet." },
          { label: "Decline claim", why: "No rule is broken, so there is no ground to decline." },
        ],
      });
    }

    case "currency_mismatch": {
      const fx = fxFacts(claim);
      const receiptAmount = fx?.receiptUsd ?? claimed;
      if (fx?.within) {
        return make({
          recommendation: { recommended: approve(claim, claimed), secondary: [ask(claim)], more: [decline(), otherAmount()] },
          gap: `Within the ${fx.tolerancePct}% currency tolerance`,
          short: "Within tolerance, receipt supports it",
          why: `The claim is ${fx.gapPct}% above the receipt, inside the ${fx.tolerancePct}% tolerance.`,
          others: [{ label: ask(claim).label, why: "The gap is inside the tolerance, so nothing needs confirming." }],
        });
      }
      const tolerance = fx ? `${fx.tolerancePct}%` : "the";
      return make({
        recommendation: {
          recommended: { ...approve(claim, receiptAmount, `Approve ${formatUsd(receiptAmount)}, receipt amount`), confirm: true },
          secondary: [exception(claimed, `Approve ${formatUsd(claimed)} with card fees`, `currency gap above the ${tolerance} tolerance`), ask(claim)],
          more: [decline(), otherAmount()],
        },
        gap: `${formatUsd(claimed - receiptAmount)} above the receipt amount`,
        short: "Receipt supports the exchange-rate amount",
        why: `The receipt supports ${formatUsd(receiptAmount)} at the exchange rate${fx ? `, and the ${fx.gapPct}% gap is above the ${fx.tolerancePct}% tolerance` : ""}.`,
        others: [
          { label: `Approve ${formatUsd(claimed)} with card fees`, why: "Pays card fees that are not on the receipt." },
          { label: ask(claim).label, why: "Only needed if the card fee is disputed, so it comes second." },
          { label: "Decline claim", why: "The spend is real, so declining is too strict." },
        ],
      });
    }

    case "possible_split": {
      const claimedLabel = formatUsd(claimed);
      if (week.over) {
        return make({
          recommendation: { recommended: toFinanceBoth(), secondary: [ask(claim), decline()], more: [approve(claim, claimed, `Approve ${claimedLabel} and send to Finance`)] },
          gap: `Week totals ${formatUsd(week.total)}, over ${formatUsd(week.limit)}`,
          short: "Week total needs Finance approval",
          why: `${name}'s claims over ${week.days} days total ${formatUsd(week.total)}, above the ${formatUsd(week.limit)} weekly limit, so Finance has to approve. Whether it was one purchase does not change that.`,
          others: [
            { label: ask(claim).label, why: "Finance has to approve either way, so a question only delays it." },
            { label: "Decline claim", why: "The claim has a receipt and nothing else is wrong." },
            { label: `Approve ${claimedLabel} and send to Finance`, why: "Sends only this claim and leaves the earlier one out of the Finance review." },
          ],
        });
      }
      return make({
        recommendation: { recommended: approve(claim, claimed), secondary: [ask(claim)], more: [decline()] },
        gap: "Two claims, week inside the limit",
        short: "Week total is inside the limit",
        why: `${name}'s claims over ${week.days} days total ${formatUsd(week.total)}, inside the ${formatUsd(week.limit)} weekly limit.`,
        others: [{ label: ask(claim).label, why: "Nothing is unclear, so a question only delays it." }],
      });
    }

    case "receipt_missing_unresolved":
    case "receipt_missing": {
      const days = waitDays(reason, "wait");
      const ex = receiptException(claim);
      const waitSpec = wait(claim);
      const exSpec = exception(claimed, "Approve with card statement", "card statement instead of a receipt");
      return make({
        recommendation: { recommended: waitSpec, secondary: [...(ex.allowed ? [exSpec] : []), decline()], more: [otherAmount()] },
        gap: reason === "receipt_missing" ? `${formatUsd(claimed)} claimed, no receipt` : `${formatUsd(claimed - RECEIPT_LIMIT)} over the no-receipt limit`,
        short: reason === "receipt_missing" ? `Policy needs a receipt above ${formatUsd(RECEIPT_LIMIT)}` : "Policy needs a receipt, one may still arrive",
        why: `Policy needs a receipt above ${formatUsd(RECEIPT_LIMIT)}, so approving now would break it. ${days} days gives ${name} time to send one, then the claim returns to the queue.`,
        others: [
          ...(ex.allowed
            ? [{ label: exSpec.label, why: `The statement shows the spend, but policy asks for a receipt. It stays an exception, allowed up to ${formatUsd(ex.ceiling)}.` }]
            : []),
          { label: "Decline claim", why: "The spend is documented and a receipt may still arrive, so declining is too strict." },
        ],
      });
    }

    case "receipt_unreadable": {
      const days = waitDays(reason, "wait");
      return make({
        recommendation: { recommended: wait(claim), secondary: [decline()], more: [otherAmount()] },
        gap: "Receipt image can't be read",
        short: "Amounts can't be checked from the image",
        why: `The receipt exists, but its amount can't be checked against the claim. ${days} days gives ${name} time to send a clearer copy.`,
        others: [
          { label: `Approve ${formatUsd(claimed)}`, why: "The amount can't be verified from the image." },
          { label: "Decline claim", why: `${name} has a receipt to send, so declining is too strict.` },
        ],
      });
    }

    case "no_matching_rule": {
      const askSpec = ask(claim);
      const finance = week.over ? ` Approving also sends it to Finance, since the week totals ${formatUsd(week.total)}.` : "";
      return make({
        recommendation: { recommended: askSpec, secondary: [decline()], more: [approve(claim), otherAmount()] },
        gap: "No policy rule covers this spend",
        short: "Unclear if agreed in advance, ask first",
        why: `No rule covers this, so it can't be checked against policy. Whether it was agreed in advance settles it.${finance}`,
        others: [
          { label: `Approve ${formatUsd(claimed)}`, why: "No rule allows it yet, so approval would be a guess." },
          { label: "Decline claim", why: "Declining before asking may reject an event that was agreed." },
        ],
      });
    }

    case "over_meal_cap": {
      const people = claim.receipt.document?.covers ?? claim.attendees.count;
      const cap = MEAL_CAP * people;
      const noWine = noWineAmount(claim);
      return make({
        recommendation: {
          recommended: { ...approve(claim, cap, `Approve ${formatUsd(cap)}, the cap`), confirm: true },
          secondary: [exception(claimed, `Approve ${formatUsd(claimed)} as an exception`, "over the meal cap"), ask(claim)],
          more: [...(noWine ? [approve(claim, noWine, `Approve ${formatUsd(noWine)} without wine`)] : []), decline()],
        },
        gap: `${formatUsd(claimed - cap)} over the meal cap`,
        short: "Policy allows the cap, not the excess",
        why: `The policy allows ${formatUsd(MEAL_CAP)} per person, so ${formatUsd(cap)} is the most that passes. The ${formatUsd(claimed - cap)} above it does not.`,
        others: [
          { label: `Approve ${formatUsd(claimed)} as an exception`, why: "Pays the part above the cap, which the policy does not allow." },
          { label: ask(claim).label, why: "The bill is clear, so a question only delays the decision." },
          { label: "Decline claim", why: "Declining the whole bill rejects the part that passes." },
        ],
      });
    }

    case "possible_duplicate": {
      return make({
        recommendation: { recommended: ask(claim), secondary: [decline()], more: [approve(claim), otherAmount()] },
        gap: "Looks like a duplicate claim",
        short: "Fare and route match another claim",
        why: `The claim matches another one, so a question to ${name} settles whether it is the same trip.`,
        others: [
          { label: `Approve ${formatUsd(claimed)}`, why: "It may pay the same trip twice." },
          { label: "Decline claim", why: "It may be a second, real trip." },
        ],
      });
    }

    case "unusual_pattern":
      return make({
        recommendation: { recommended: null, secondary: [approve(claim), decline(), ask(claim)], more: [otherAmount()] },
        gap: "Unusual pattern, no limit broken",
        short: "Pattern flagged, no rule broken",
        why: "",
      });

    default:
      return make({
        recommendation: { recommended: null, secondary: [approve(claim), decline(), ask(claim)], more: [otherAmount()] },
        gap: "None, every check passed",
        short: "All checks passed",
        why: "",
      });
  }
}

/** Actions for a claim that needs a decision. PRD 8.3. */
export const recommendationFor = (claim: LocalClaim, all: LocalClaim[] = [], now: Date = NOW): Recommendation => assess(claim, all, now).recommendation;

/** The reasoning as plain text: why the recommended action is right, then why each other action is weaker. For the Policy tab and the assistant. */
export function reasoningText(a: Assessment): string {
  if (!a.recommendation.recommended) return a.why;
  return [a.why, ...a.others.map((o) => `${o.label}: ${upper(o.why)}`)].join("\n");
}

/** Every action offered for a claim that needs a decision: the buttons and the entries in More options. */
export function allActionsFor(claim: LocalClaim, all: LocalClaim[] = [], now: Date = NOW): ActionSpec[] {
  const rec = recommendationFor(claim, all, now);
  const shown = [rec.recommended, ...rec.secondary].filter((s): s is ActionSpec => Boolean(s));
  return [...shown, ...rec.more, ...moreOptionsFor(claim, [...shown, ...rec.more])];
}

/** Menu entries for the "More options" menu that are not already shown as buttons. */
export function moreOptionsFor(claim: LocalClaim, shown: ActionSpec[]): ActionSpec[] {
  const base: ActionSpec[] = [otherAmount(), ask(claim), toFinance()];
  return base.filter((a) => !shown.some((s) => s.id === a.id && s.label === a.label));
}
