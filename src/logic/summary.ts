import { employeeName } from "./comparison";
import { formatUsd, claimStatusLabel } from "./format";
import { FINANCE_LIMIT, MEAL_CAP, RECEIPT_LIMIT, type LocalClaim } from "./local";
import { recommendationFor } from "./recommendations";

export type TriageNote = {
  /** Who and which claim the note is about. */
  heading: string;
  /** Three short lines, each at most 8 words after its label. */
  text: string;
  /** Label of the recommended button. The chat shows it as a button under the text. */
  suggest: string | null;
};

const parseUsd = (value: string | undefined) => {
  const n = Number(value?.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && value ? n : 0;
};

/** The gap between the claim and the policy, in at most 8 words. */
function policyGap(claim: LocalClaim): string {
  const claimed = claim.amount.usd_claimed;
  switch (claim.agent.reason_type) {
    case "over_finance_threshold":
      return `${formatUsd(claimed - FINANCE_LIMIT)} over the Finance limit`;
    case "unusual_amount": {
      const usual = parseUsd(claim.agent.facts.find((f) => /median/i.test(f.label))?.value);
      return usual ? `${formatUsd(claimed - usual)} above a usual ride` : "Higher than a usual ride";
    }
    case "currency_mismatch": {
      const receipt = claim.amount.fx?.usd_computed ?? claimed;
      return `${formatUsd(claimed - receipt)} above the receipt amount`;
    }
    case "possible_split":
      return "Two claims may be one purchase";
    case "receipt_missing_unresolved":
      return `${formatUsd(claimed - RECEIPT_LIMIT)} over the no-receipt limit`;
    case "no_matching_rule":
      return "No policy rule covers this spend";
    case "over_meal_cap": {
      const people = claim.receipt.document?.covers ?? claim.attendees.count;
      return `${formatUsd(claimed - MEAL_CAP * people)} over the meal cap`;
    }
    case "possible_duplicate":
      return "Looks like a duplicate claim";
    case "receipt_missing":
      return `${formatUsd(claimed)} claimed, no receipt`;
    case "receipt_unreadable":
      return "Receipt image can't be read";
    case "unusual_pattern":
      return "Unusual pattern, no limit broken";
    default:
      return "None, every check passed";
  }
}

/** Why the claim sits where it does, in at most 8 words. */
function reasoning(claim: LocalClaim): string {
  switch (claim.agent.reason_type) {
    case "over_finance_threshold":
      return "Valid claim, only Finance sign-off needed";
    case "unusual_amount":
      return "Higher than usual, but no rule broken";
    case "currency_mismatch":
      return "Receipt supports the exchange-rate amount";
    case "possible_split":
      return "Receipts read as separate purchases";
    case "receipt_missing_unresolved":
      return "Statement proves the spend, reminder already sent";
    case "no_matching_rule":
      return "Close call, depends on advance approval";
    case "over_meal_cap":
      return "Policy allows the cap, not the excess";
    case "possible_duplicate":
      return "Fare and route match another claim";
    case "receipt_missing":
      return `Policy needs a receipt above ${formatUsd(RECEIPT_LIMIT)}`;
    case "receipt_unreadable":
      return "Amounts can't be checked from the image";
    case "unusual_pattern":
      return "Pattern flagged, no rule broken";
    default:
      return "All checks passed";
  }
}

const line = (label: string, value: string) => `**${label}:** ${value}`;

/**
 * The note the chat posts each time a new claim comes up. Three lines of at most 8 words each (policy gap, recommendation or
 * decision, reasoning), so it can be read at a glance. The recommended button shows below it. Pure.
 */
export function triageNote(claim: LocalClaim): TriageNote {
  const heading = `${employeeName(claim)}, ${claim.id}`;
  if (claim.status === "waiting_on_noa") {
    const label = recommendationFor(claim).recommended?.label ?? null;
    return {
      heading,
      text: [line("Policy gap", policyGap(claim)), line("Recommendation", label ?? "None, it is a close call"), line("Why I recommend this", reasoning(claim))].join("\n\n"),
      suggest: label,
    };
  }
  return {
    heading,
    text: [line("Policy gap", policyGap(claim)), line("Decision", claimStatusLabel(claim)), line("Why it was decided", reasoning(claim))].join("\n\n"),
    suggest: null,
  };
}
