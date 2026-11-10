import type { ActionId, ActionInput } from "./actions";
import { firstName } from "./actions";
import { noWineAmount } from "./comparison";
import { formatUsd } from "./format";
import { MEAL_CAP, type LocalClaim } from "./local";

/**
 * UI-layer fixture (PRD 9). The dataset has no recommended action, so this table is authored by reason type.
 * Labels are built from live values. It never reads the dataset's answer key.
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
  askMessage?: "decline" | "ask" | "hold";
  /** Visual weight of a destructive choice. */
  destructive?: boolean;
};

export type Recommendation = {
  recommended: ActionSpec | null;
  secondary: ActionSpec[];
  more: ActionSpec[];
};

const approve = (claim: LocalClaim, amount = claim.amount.usd_claimed, label?: string, oneTap = false): ActionSpec => ({
  id: amount === claim.amount.usd_claimed ? "approve" : "approve_amount",
  label: label ?? `Approve ${formatUsd(amount)}`,
  input: { id: amount === claim.amount.usd_claimed ? "approve" : "approve_amount", amount },
  confirm: !oneTap,
});

const exception = (claim: LocalClaim, amount: number, label: string, reason: string): ActionSpec => ({
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

const otherAmount = (): ActionSpec => ({
  id: "approve_amount",
  label: "Approve a different amount",
  input: { id: "approve_amount" },
  confirm: true,
  askAmount: true,
});

const toFinance = (label = "Send to Finance"): ActionSpec => ({ id: "to_finance", label, input: { id: "to_finance" }, confirm: true });

/** Actions for a claim that is waiting on Noa. PRD 8.3. */
export function recommendationFor(claim: LocalClaim): Recommendation {
  const claimed = claim.amount.usd_claimed;
  switch (claim.agent.reason_type) {
    case "over_finance_threshold":
      return {
        recommended: { ...approve(claim, claimed, "Approve and send to Finance"), confirm: true },
        secondary: [decline(), ask(claim)],
        more: [otherAmount()],
      };
    case "unusual_amount":
      return { recommended: approve(claim, claimed, `Approve ${formatUsd(claimed)}`, true), secondary: [decline(), ask(claim)], more: [otherAmount()] };
    case "currency_mismatch": {
      const receiptAmount = claim.amount.fx?.usd_computed ?? claimed;
      return {
        recommended: { ...approve(claim, receiptAmount, `Approve ${formatUsd(receiptAmount)}, receipt amount`), confirm: true },
        secondary: [exception(claim, claimed, `Approve ${formatUsd(claimed)} with card fees`, "currency gap above the 3% tolerance"), ask(claim)],
        more: [decline(), otherAmount()],
      };
    }
    case "possible_split":
      return {
        recommended: { ...approve(claim, claimed, "Approve as separate workshops"), confirm: true },
        secondary: [{ id: "to_finance_both", label: "Send both to Finance", input: { id: "to_finance_both" }, confirm: true }, ask(claim)],
        more: [decline()],
      };
    case "receipt_missing_unresolved":
      return {
        recommended: exception(claim, claimed, "Approve with card statement", "card statement instead of a receipt"),
        secondary: [{ id: "hold", label: "Hold until receipt arrives", input: { id: "hold" }, confirm: true, askMessage: "hold" }, decline()],
        more: [otherAmount()],
      };
    case "no_matching_rule":
      return { recommended: null, secondary: [approve(claim), decline(), ask(claim)], more: [otherAmount()] };
    case "over_meal_cap": {
      const people = claim.receipt.document?.covers ?? claim.attendees.count;
      const cap = MEAL_CAP * people;
      const noWine = noWineAmount(claim);
      return {
        recommended: { ...approve(claim, cap, `Approve ${formatUsd(cap)}, the cap`), confirm: true },
        secondary: [exception(claim, claimed, `Approve ${formatUsd(claimed)} as an exception`, "over the meal cap"), ask(claim)],
        more: [...(noWine ? [approve(claim, noWine, `Approve ${formatUsd(noWine)} without wine`)] : []), decline()],
      };
    }
    default:
      return {
        recommended: null,
        secondary: [approve(claim), decline(), ask(claim)],
        more: [otherAmount()],
      };
  }
}

/**
 * Why the recommended action is recommended, and why the other options make less sense. Plain text for the chat note that is posted when
 * a claim opens. When there is no recommended action, it says the choice is close and what it depends on. Pure.
 */
export function recommendationReason(claim: LocalClaim): { text: string; tossUp: boolean } {
  const claimed = formatUsd(claim.amount.usd_claimed);
  switch (claim.agent.reason_type) {
    case "over_finance_threshold":
      return { text: "the claim itself is fine and only the amount needs Finance after this decision. Declining would reject a valid claim, and asking would only slow it down.", tossUp: false };
    case "unusual_amount":
      return { text: "the amount is higher than usual but nothing breaks the policy. Asking is the careful second choice, and there is no ground to decline.", tossUp: false };
    case "currency_mismatch": {
      const receiptAmount = formatUsd(claim.amount.fx?.usd_computed ?? claim.amount.usd_claimed);
      return { text: `the receipt supports ${receiptAmount} at the exchange rate. Paying ${claimed} only makes sense if the card fee is confirmed, so asking comes second.`, tossUp: false };
    }
    case "possible_split":
      return { text: "the two receipts read as separate purchases. Sending both to Finance or asking adds a step without a clear reason to doubt them.", tossUp: false };
    case "receipt_missing_unresolved":
      return { text: `the card statement shows ${claimed} was spent and a reminder is already out. Holding waits for a receipt that may not come, and declining is harsh for a documented spend.`, tossUp: false };
    case "over_meal_cap":
      return { text: "the cap is the most the policy allows for this meal. Approving everything needs an exception, and declining the whole bill is too strict.", tossUp: false };
    default:
      return { text: "approving, declining and asking are all reasonable. It comes down to whether the spend was agreed in advance, so a short question to the employee is the easiest way to settle it.", tossUp: true };
  }
}

/** Every action offered for a claim that is waiting for review: the buttons and the entries in More options. */
export function allActionsFor(claim: LocalClaim): ActionSpec[] {
  const rec = recommendationFor(claim);
  const shown = [rec.recommended, ...rec.secondary].filter((s): s is ActionSpec => Boolean(s));
  return [...shown, ...rec.more, ...moreOptionsFor(claim, [...shown, ...rec.more])];
}

/** Menu entries for the "More options" menu that are not already shown as buttons. */
export function moreOptionsFor(claim: LocalClaim, shown: ActionSpec[]): ActionSpec[] {
  const base: ActionSpec[] = [otherAmount(), ask(claim), toFinance()];
  return base.filter((a) => !shown.some((s) => s.id === a.id && s.label === a.label));
}
