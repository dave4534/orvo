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
  // Each line names where its rule comes from: the approval chain, the policy, or the agent's own settings.
  if (isWaitOver(claim, now)) {
    return claim.local?.wait?.kind === "finance"
      ? "Chain: Finance follows Noa. No Finance decision in two days, so Noa follows up."
      : "Agent settings: 1-day wait. No receipt came back, so Noa decides the next step.";
  }
  switch (claim.agent.reason_type) {
    case "over_finance_threshold":
      return `Chain: agent, then Noa, then Finance. Over ${money(FINANCE_LIMIT)}, the agent can't approve.`;
    case "receipt_missing":
    case "receipt_missing_unresolved": {
      const replied = (claim.agent.chase?.attempts ?? []).some((a) => a.reply);
      return replied
        ? "Policy: receipt needed over $25. The employee can't supply one, so Noa decides."
        : "Policy: receipt needed over $25. The agent's requests got none, so Noa decides.";
    }
    case "receipt_unreadable":
      return "Agent settings: the agent can't read the total. Noa asks for a clearer copy.";
    case "over_meal_cap":
      return `Policy: ${money(MEAL_CAP)} per person per meal. The agent can't pay the excess, so Noa chooses.`;
    case "currency_mismatch":
      return `Agent settings: ${FX_TOLERANCE_PCT}% tolerance. Beyond it, the agent can't pick. Noa decides.`;
    case "possible_split":
      return weeklyFacts(claim, all).over
        ? `Policy: over ${money(FINANCE_LIMIT)} in a week needs Finance. Noa decides first.`
        : "Policy: $1,000 a week needs Finance. The agent can't tell one purchase or two.";
    case "possible_duplicate":
      return "Agent check: same route and fare as another claim. Noa decides if it's repeated.";
    default:
      return "Agent settings: the agent can't settle this itself. Noa decides.";
  }
}

export function whyNoaSees(claim: LocalClaim, all: LocalClaim[] = [], now: Date = NOW): string {
  return clipTo(reason(claim, all, now), WHY_NOA_MAX);
}
