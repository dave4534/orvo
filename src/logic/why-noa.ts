import { NOW } from "@/data";
import { formatUsd } from "./format";
import { isWaitOver, MEAL_CAP, RECEIPT_LIMIT, FINANCE_LIMIT, type LocalClaim } from "./local";
import { FX_TOLERANCE_PCT, weeklyFacts } from "./policy";

/**
 * The line at the bottom of a Needs review card: why Noa is seeing this claim, why it needs her input, and why the agent could not do it
 * itself. Twenty words at most. Pure.
 */
const money = (n: number) => formatUsd(n).replace(".00", "");

export function whyNoaSees(claim: LocalClaim, all: LocalClaim[] = [], now: Date = NOW): string {
  if (isWaitOver(claim, now)) {
    return claim.local?.wait?.kind === "finance"
      ? "Finance has not decided after two working days. The agent can't chase Finance, so Noa follows up."
      : "The wait ended without the receipt. The agent can't decide that a receipt is never coming, so Noa does.";
  }
  switch (claim.agent.reason_type) {
    case "over_finance_threshold":
      return `Over ${money(FINANCE_LIMIT)}, so the policy needs Noa's approval before Finance. The agent can't approve it alone.`;
    case "receipt_missing":
    case "receipt_missing_unresolved": {
      const replied = (claim.agent.chase?.attempts ?? []).some((a) => a.reply);
      return replied
        ? "Employee says the receipt can't be supplied. Policy needs one over $25, so only Noa can accept a substitute."
        : `No receipt after the agent's daily requests. Policy needs one over ${money(RECEIPT_LIMIT)}, so Noa decides.`;
    }
    case "receipt_unreadable":
      return "The agent can't read the receipt total, so it can't confirm the amount. Noa asks for a clearer copy.";
    case "over_meal_cap":
      return `Over the ${money(MEAL_CAP)}-per-person meal cap, so the agent can't pay the excess. Noa chooses what to pay.`;
    case "currency_mismatch":
      return `More than the ${FX_TOLERANCE_PCT}% tolerance above the receipt, so the agent can't pick an amount. Noa decides.`;
    case "possible_split":
      return weeklyFacts(claim, all).over
        ? `This week's claims total over ${money(FINANCE_LIMIT)}, so Finance must approve. The agent can't tell if it's one purchase.`
        : "Two claims may be one purchase. The agent can't tell, so Noa decides whether to send them to Finance.";
    case "possible_duplicate":
      return "The ride matches another claim, and the agent can't tell if it's a second trip. Noa decides.";
    default:
      return "The agent can't settle this itself. Noa decides.";
  }
}
