import { NOW } from "@/data";
import { formatUsd } from "./format";
import { isWaitOver, MEAL_CAP, FINANCE_LIMIT, type LocalClaim } from "./local";
import { FX_TOLERANCE_PCT, weeklyFacts } from "./policy";
import { clipTo, WHY_NOA_MAX } from "./limits";

/**
 * The line at the bottom of a Needs review card: why Noa is seeing this claim, why her input is needed, and why the agent could not do it
 * itself. Eighty characters at most, and never more than twenty words. Pure.
 */
const money = (n: number) => formatUsd(n).replace(".00", "");

function reason(claim: LocalClaim, all: LocalClaim[], now: Date): string {
  if (isWaitOver(claim, now)) {
    return claim.local?.wait?.kind === "finance"
      ? "No Finance decision in two working days. The agent can't chase it, so Noa does."
      : "The wait ended with no receipt. The agent can't close that, so Noa decides.";
  }
  switch (claim.agent.reason_type) {
    case "over_finance_threshold":
      return `Over ${money(FINANCE_LIMIT)}: Noa approves first, then Finance. The agent can't approve it alone.`;
    case "receipt_missing":
    case "receipt_missing_unresolved": {
      const replied = (claim.agent.chase?.attempts ?? []).some((a) => a.reply);
      return replied
        ? "Employee says the receipt can't be supplied. Only Noa can accept a substitute."
        : `No receipt after the agent's daily requests. Policy needs one, so Noa decides.`;
    }
    case "receipt_unreadable":
      return "The agent can't read the receipt total. Noa asks for a clearer copy.";
    case "over_meal_cap":
      return `Over the ${money(MEAL_CAP)} per-person cap. The agent can't pay the excess, so Noa chooses.`;
    case "currency_mismatch":
      return `More than ${FX_TOLERANCE_PCT}% above the receipt. The agent can't pick an amount, so Noa decides.`;
    case "possible_split":
      return weeklyFacts(claim, all).over
        ? `Week's claims total over ${money(FINANCE_LIMIT)}, so Finance must approve. Noa decides first.`
        : "Two claims may be one purchase. The agent can't tell, so Noa decides on Finance.";
    case "possible_duplicate":
      return "Ride matches another claim. The agent can't tell if it's repeated. Noa decides.";
    default:
      return "The agent can't settle this itself. Noa decides.";
  }
}

export function whyNoaSees(claim: LocalClaim, all: LocalClaim[] = [], now: Date = NOW): string {
  return clipTo(reason(claim, all, now), WHY_NOA_MAX);
}
