import type { PersonId } from "@/data/types";
import { personById } from "./claims";
import { displayName, formatUsd } from "./format";
import { NOW } from "@/data";
import { isAgentDecided, type ClaimWait, type LocalClaim, type LocalEvent } from "./local";
import { FINANCE_LIMIT, FINANCE_NUDGE_WORKING_DAYS, needsFinance, waitDays, weeklyFacts } from "./policy";
import { addDays, addWorkingDays, dayCount, formatDay, isoLocal } from "./time";

export { isoLocal } from "./time";

export type ActionId =
  | "approve"
  | "approve_amount"
  | "exception"
  | "decline"
  | "ask"
  | "wait"
  | "extend_wait"
  | "to_finance"
  | "to_finance_both"
  | "decide_now"
  | "confirm"
  | "correct";

export type ActionInput = {
  id: ActionId;
  /** USD amount to pay. Defaults to the claimed amount. */
  amount?: number;
  /** Message to the employee, for decline and ask. */
  message?: string;
  /** Correction outcome, for "correct". */
  to?: "approved" | "declined" | "ask";
  /** What went wrong, for "correct". Null means the manager opted out of recording it. */
  feedback?: { option: string; text?: string } | null;
  /** Claim to link this one to, for "to_finance_both". Defaults to the claim's related claims. */
  linkTo?: string;
  /** Short description for the event log, for example the cited rule when approving an exception. */
  reason?: string;
};

export type ActionResult = {
  /** Every claim that changed, including linked ones. */
  changed: LocalClaim[];
  /** Plain sentence for the confirmation toast. */
  summary: string;
};

export const firstName = (claim: LocalClaim): string => {
  const person = personById(claim.employee_id as PersonId);
  return person ? displayName(person).split(" ")[0] : claim.employee_id;
};

const setChain = (claim: LocalClaim, noa: string, finance: string) => {
  claim.approval_chain = claim.approval_chain.map((s) =>
    s.step === "noa"
      ? { ...s, state: noa as typeof s.state }
      : s.step === "finance"
        ? { ...s, state: finance as typeof s.state }
        : s,
  );
};

const event = (at: string, type: LocalEvent["type"], text: string): LocalEvent => ({ at, actor: "noa", type, text });

const addToThread = (claim: LocalClaim, at: string, text?: string) => {
  if (!text?.trim()) return;
  claim.local = { ...claim.local, thread: [...(claim.local?.thread ?? []), { at, from: "manager", text: text.trim() }] };
};

/** Parks the claim until `until`, then it returns to the manager's queue. A wait set again after one ended counts as an extension. */
function setWait(claim: LocalClaim, at: string, kind: "employee" | "finance", previous: ClaimWait | null | undefined, action: "wait" | "ask" = "wait") {
  const from = new Date(at);
  const days = kind === "finance" ? FINANCE_NUDGE_WORKING_DAYS : previous && action === "wait" && previous.kind === "employee" && previous.days ? previous.days : waitDays(claim.agent.reason_type, action);
  const until = isoLocal(kind === "finance" ? addWorkingDays(from, days) : addDays(from, days));
  claim.local = { ...claim.local, wait: { since: at, until, days, kind, extensions: previous ? previous.extensions + 1 : 0 } };
  return until;
}

function approveClaim(claim: LocalClaim, amount: number, at: string, overrode: boolean, note: string, all: LocalClaim[], previousWait: ClaimWait | null | undefined) {
  const needs = needsFinance(claim, amount, all);
  claim.status = needs ? "waiting_on_finance" : "approved_by_noa";
  claim.awaiting = needs ? "finance" : null;
  setChain(claim, "done", needs ? "waiting" : "not_needed");
  claim.noa = {
    decision: "approved",
    decided_at: at,
    note,
    approved_amount_usd: amount,
    overrode_agent: overrode,
  };
  if (needs) setWait(claim, at, "finance", previousWait);
  return needs;
}

/** Why a claim has to go to Finance, in a few words: over the single limit, or the week adds up past the weekly limit. Empty when it does not. */
export function financeReason(claim: LocalClaim, amount: number, all: LocalClaim[]): string {
  if (amount > FINANCE_LIMIT) return `it is over ${formatUsd(FINANCE_LIMIT).replace(".00", "")}`;
  const week = weeklyFacts(claim, all, amount);
  return week.over ? `the week's claims total ${formatUsd(week.total)}, over ${formatUsd(week.limit).replace(".00", "")}` : "";
}

/** Pure: returns changed copies and leaves the input array untouched. PRD 4.2 and 8.2. */
export function applyAction(all: LocalClaim[], claimId: string, input: ActionInput, now: Date): ActionResult {
  const original = all.find((c) => c.id === claimId);
  if (!original) throw new Error(`Unknown claim ${claimId}`);
  const claim = structuredClone(original);
  const at = isoLocal(now);
  const name = firstName(claim);
  const claimed = claim.amount.usd_claimed;
  const wasAgent = isAgentDecided(claim);
  const changed: LocalClaim[] = [claim];
  // A decision ends any wait. A new wait set below counts the old one as an extension.
  const previousWait = claim.local?.wait ?? null;
  if (input.id !== "confirm" && input.id !== "extend_wait") claim.local = { ...claim.local, wait: null };

  switch (input.id) {
    case "approve":
    case "approve_amount":
    case "exception": {
      const amount = input.amount ?? claimed;
      const why = financeReason(claim, amount, all);
      const toFinance = approveClaim(claim, amount, at, wasAgent, input.reason ?? "", all, previousWait);
      const diff = amount < claimed ? `, ${formatUsd(claimed - amount)} less than claimed` : "";
      const text =
        input.id === "exception"
          ? `Approved ${formatUsd(amount)} as an exception${input.reason ? `: ${input.reason}` : ""}`
          : `Approved ${formatUsd(amount)}${diff}`;
      claim.events.push(event(at, toFinance ? "noa_routed_finance" : "noa_decision", toFinance ? `${text}. Sent to Finance${why ? `, because ${why}` : ""}.` : text));
      return {
        changed,
        summary: toFinance
          ? `Approved ${formatUsd(amount)} for ${name} and sent to Finance`
          : `Approved ${formatUsd(amount)} for ${name}`,
      };
    }
    case "decline": {
      claim.status = "declined_by_noa";
      claim.awaiting = null;
      setChain(claim, "done", "skipped");
      claim.noa = { decision: "declined", decided_at: at, note: input.message ?? "", approved_amount_usd: 0, overrode_agent: wasAgent };
      claim.events.push(event(at, "noa_decision", `Declined ${formatUsd(claimed)}${input.message ? `: ${input.message}` : ""}`));
      addToThread(claim, at, input.message);
      return { changed, summary: `Declined ${formatUsd(claimed)} for ${name}` };
    }
    case "ask":
    case "wait": {
      claim.status = "waiting_on_employee";
      claim.awaiting = "employee";
      setChain(claim, "waiting", claim.approval_chain.find((s) => s.step === "finance")?.state ?? "not_needed");
      const until = setWait(claim, at, "employee", previousWait, input.id);
      const days = claim.local?.wait?.days ?? waitDays(claim.agent.reason_type, input.id);
      if (input.id === "wait") {
        // Waiting writes nothing to the employee. The agent keeps asking for the receipt while the claim is parked.
        claim.events.push(event(at, "noa_asked", `Waiting ${dayCount(days)} for a receipt. The agent keeps asking ${name}.`));
        return { changed, summary: `Waiting ${dayCount(days)} for ${name}'s receipt. Back in the queue ${formatDay(until)}` };
      }
      claim.events.push(event(at, "noa_asked", `Asked ${name}: ${input.message ?? ""}`.trim() + ` Waiting ${dayCount(days)}.`));
      addToThread(claim, at, input.message);
      return { changed, summary: `Asked ${name}. Back in the queue ${formatDay(until)}` };
    }
    case "extend_wait": {
      const current = claim.local?.wait;
      if (!current) return { changed, summary: `No wait to extend for ${name}` };
      const until = setWait(claim, at, current.kind, current);
      claim.events.push(event(at, "noa_asked", `Kept waiting. Back in the queue ${formatDay(until)}.`));
      return { changed, summary: `Kept waiting on ${current.kind === "finance" ? "Finance" : name}. Back in the queue ${formatDay(until)}` };
    }
    case "to_finance":
    case "to_finance_both": {
      claim.status = "waiting_on_finance";
      claim.awaiting = "finance";
      setChain(claim, "done", "waiting");
      claim.noa = { decision: "approved", decided_at: at, note: "", approved_amount_usd: claimed, overrode_agent: wasAgent };
      setWait(claim, at, "finance", previousWait);
      claim.events.push(event(at, "noa_routed_finance", `Sent ${formatUsd(claimed)} to Finance`));
      if (input.id === "to_finance_both") {
        for (const relatedId of input.linkTo ? [input.linkTo] : claim.agent.related_claim_ids) {
          const other = all.find((c) => c.id === relatedId);
          if (!other || other.status === "waiting_on_finance") continue;
          const copy = structuredClone(other);
          // Reopens an agent approval that has not been paid: recorded as a correction (PRD 8.3).
          copy.status = "waiting_on_finance";
          copy.awaiting = "finance";
          setChain(copy, "done", "waiting");
          copy.noa = {
            decision: "approved",
            decided_at: at,
            note: "",
            approved_amount_usd: copy.amount.usd_claimed,
            overrode_agent: isAgentDecided(other),
          };
          setWait(copy, at, "finance", copy.local?.wait);
          copy.events.push(event(at, "noa_correction", `Reopened the automatic approval and sent ${formatUsd(copy.amount.usd_claimed)} to Finance with ${claim.id}`));
          changed.push(copy);
        }
      }
      return {
        changed,
        summary: input.id === "to_finance_both" && changed.length > 1 ? `Sent both claims to Finance` : `Sent ${name}'s claim to Finance`,
      };
    }
    case "decide_now": {
      claim.status = "waiting_on_noa";
      claim.awaiting = "noa";
      setChain(claim, "waiting", claim.approval_chain.find((s) => s.step === "finance")?.state ?? "not_needed");
      claim.events.push(event(at, "noa_decision", "Decided by manager, chase stopped"));
      return { changed, summary: `Took over ${name}'s claim` };
    }
    case "confirm": {
      claim.local = { ...claim.local, spot_checked: true };
      return { changed, summary: `Confirmed the automatic decision for ${name}` };
    }
    case "correct": {
      const outcome = input.to ?? "approved";
      const amount = input.amount ?? claimed;
      const was = claim.status === "declined_by_agent" ? "the automatic decline" : wasAgent ? `the automatic approval of ${formatUsd(claimed)}` : "the decision";
      if (outcome === "approved") {
        const toFinance = approveClaim(claim, amount, at, wasAgent, input.reason ?? "", all, previousWait);
        claim.events.push(event(at, "noa_correction", `Corrected ${was} to ${formatUsd(amount)}${toFinance ? ". Sent to Finance." : ""}`));
      } else if (outcome === "declined") {
        claim.status = "declined_by_noa";
        claim.awaiting = null;
        setChain(claim, "done", "skipped");
        claim.noa = { decision: "declined", decided_at: at, note: input.message ?? "", approved_amount_usd: 0, overrode_agent: wasAgent };
        claim.events.push(event(at, "noa_correction", `Corrected ${was} to a decline`));
        addToThread(claim, at, input.message);
      } else {
        claim.status = "waiting_on_employee";
        claim.awaiting = "employee";
        setChain(claim, "waiting", "not_needed");
        setWait(claim, at, "employee", previousWait, "ask");
        claim.events.push(event(at, "noa_correction", `Reopened ${was} and asked ${name}: ${input.message ?? ""}`.trim()));
        addToThread(claim, at, input.message);
      }
      if (input.feedback) {
        claim.local = {
          ...claim.local,
          feedback: [...(claim.local?.feedback ?? []), { ...input.feedback, at }],
        };
        claim.events.push(event(at, "agent_feedback", `Recorded what went wrong: ${input.feedback.option}${input.feedback.text ? `. ${input.feedback.text}` : ""}`));
      }
      return {
        changed,
        summary:
          outcome === "approved"
            ? `Corrected to ${formatUsd(amount)} for ${name}`
            : outcome === "declined"
              ? `Corrected to a decline for ${name}`
              : `Reopened and asked ${name}`,
      };
    }
  }
}

export type Preview = { summary: string };

/** Plain-language impact of an action, shown before it is confirmed. PRD 8.4. */
export function actionPreview(claim: LocalClaim, input: ActionInput, all: LocalClaim[]): Preview {
  const name = firstName(claim);
  const claimed = claim.amount.usd_claimed;
  const amount = input.amount ?? claimed;
  const toldInChat = (text: string) => `${name} is told in the claim chat ${text}.`;
  const backOn = (days: number, working = false) => formatDay(working ? addWorkingDays(NOW, days) : addDays(NOW, days));

  switch (input.id) {
    case "approve":
    case "approve_amount":
    case "exception":
    case "correct": {
      if (input.id === "correct" && input.to === "declined") {
        return { summary: `${name} is not paid. ${toldInChat("that the claim is declined")}` };
      }
      if (input.id === "correct" && input.to === "ask") {
        return { summary: `Nothing is paid yet. ${toldInChat("with your question")}` };
      }
      const why = input.id === "correct" && input.to !== "approved" ? "" : financeReason(claim, amount, all);
      const paid =
        why
          ? `${name} is paid ${formatUsd(amount)} after Finance approves it, because ${why}.`
          : amount < claimed
            ? `${name} is paid ${formatUsd(amount)}, ${formatUsd(claimed - amount)} less than claimed.`
            : `${name} is paid ${formatUsd(amount)} in full.`;
      const receiptTotal = claim.receipt.document?.total;
      const told =
        amount < claimed
          ? input.id === "correct" && receiptTotal === amount
            ? toldInChat("with the receipt total")
            : toldInChat("with the amount and why it differs")
          : input.id === "exception"
            ? toldInChat("that it is approved as an exception")
            : toldInChat("that it is approved");
      return { summary: `${paid} ${told}` };
    }
    case "decline":
      return { summary: `${name} is not paid. ${toldInChat(`that the claim is declined${input.message ? ", with your note" : ""}`)}` };
    case "ask":
      return { summary: `Nothing is paid yet. ${toldInChat("with your question")} The claim returns to the queue on ${backOn(waitDays(claim.agent.reason_type, "ask"))}.` };
    case "wait":
      return { summary: `Nothing is paid until a receipt arrives. The agent keeps asking ${name}. The claim returns to the queue on ${backOn(waitDays(claim.agent.reason_type, "wait"))}.` };
    case "extend_wait":
      return { summary: `Nothing changes except the date. The claim returns to the queue on ${backOn(FINANCE_NUDGE_WORKING_DAYS, true)}.` };
    case "to_finance":
      return { summary: `${name} is paid nothing until Finance approves ${formatUsd(claimed)}. ${toldInChat("that it is with Finance")} The claim returns to the queue on ${backOn(FINANCE_NUDGE_WORKING_DAYS, true)} to check on Finance.` };
    case "to_finance_both": {
      const linkIds = input.linkTo ? [input.linkTo] : claim.agent.related_claim_ids;
      const others = linkIds.map((id) => all.find((c) => c.id === id)).filter((c): c is LocalClaim => Boolean(c));
      if (others.length === 0) return { summary: "Choose the claim to link this one to." };
      const total = claimed + others.reduce((sum, c) => sum + c.amount.usd_claimed, 0);
      const ids = [claim.id, ...others.map((c) => c.id)].join(" and ");
      return {
        summary: `${ids} go to Finance together. ${name} is paid nothing until Finance approves ${formatUsd(total)}. ${toldInChat("that both claims are with Finance")} They return to the queue on ${backOn(FINANCE_NUDGE_WORKING_DAYS, true)} to check on Finance.`,
      };
    }
    default:
      return { summary: "" };
  }
}
