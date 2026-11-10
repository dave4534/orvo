import { dataset } from "@/data";
import type { PersonId } from "@/data/types";
import { formatUsd } from "./format";
import type { ClaimFlag, FlagType, LocalClaim } from "./local";
import { dailyFacts, FLAG_DISPLAY_DAYS, FLAG_REMOVAL_DAYS, MEAL_CAP, weeklyFacts } from "./policy";
import { DAY_MS } from "./time";

/**
 * Flags: one mark on a claim for something that counts toward an employee's pattern. The agent's flags are derived from the claims here,
 * so a flag disappears when the thing behind it is corrected. The manager's flags are kept on the claim (`local.flags`).
 * No count of flags triggers anything. They are shown where the manager looks at a claim or an employee. Pure.
 */

export const flagLabel = (type: FlagType): string => dataset.enums.flag_type[type] ?? type;

const agentFlag = (claim: LocalClaim, type: FlagType, note: string, at = claim.agent.decided_at): ClaimFlag => ({
  id: `${claim.id}:${type}`,
  type,
  claimId: claim.id,
  employeeId: claim.employee_id,
  by: "agent",
  at,
  note,
});

/** The flags the agent raises on one claim, from its own checks and the policy facts. */
export function agentFlags(claim: LocalClaim, all: LocalClaim[]): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  const reason = claim.agent.reason_type;
  const claimed = claim.amount.usd_claimed;
  const declined = claim.status === "declined_by_agent" || claim.status === "declined_by_noa";

  if (reason === "receipt_missing_unresolved" || (reason === "receipt_missing" && claim.agent.chase?.status === "unresolved")) {
    flags.push(agentFlag(claim, "missing_receipt", `${formatUsd(claimed)} claimed, receipt still missing after the requests`));
  }
  if (reason === "over_meal_cap") {
    const people = claim.receipt.document?.covers ?? claim.attendees.count;
    flags.push(agentFlag(claim, "over_meal_cap", `${formatUsd(claimed - MEAL_CAP * people)} over the meal cap`));
  }
  if (reason === "unusual_amount") flags.push(agentFlag(claim, "unusual_amount", `${formatUsd(claimed)} is above a usual amount`));
  // A duplicate flag stands only while the decline does. If the manager reverses the decline, the flag goes with it.
  if (reason === "possible_duplicate" && claim.status === "declined_by_agent") {
    flags.push(agentFlag(claim, "possible_duplicate", "Declined as a possible duplicate"));
  }
  if (reason === "unusual_pattern") flags.push(agentFlag(claim, "unusual_pattern", claim.agent.headline));

  if (!declined) {
    const week = weeklyFacts(claim, all);
    if (week.over) flags.push(agentFlag(claim, "weekly_over_limit", `${formatUsd(week.total)} in ${week.days} days, over ${formatUsd(week.limit)}`));
    const day = dailyFacts(claim, all);
    if (day.over) flags.push(agentFlag(claim, "same_day_over_allowance", `${formatUsd(day.total)} per person in one day, over ${formatUsd(day.allowance)}`));
  }
  return flags;
}

/** Every flag on a claim: the agent's, then the manager's. */
export const flagsOnClaim = (claim: LocalClaim, all: LocalClaim[]): ClaimFlag[] => [...agentFlags(claim, all), ...(claim.local?.flags ?? [])];

/** An employee's flags in the display window, newest first. */
export function flagsForEmployee(all: LocalClaim[], employeeId: PersonId, now: Date): ClaimFlag[] {
  const since = now.getTime() - FLAG_DISPLAY_DAYS * DAY_MS;
  return all
    .filter((c) => c.employee_id === employeeId)
    .flatMap((c) => flagsOnClaim(c, all))
    .filter((f) => new Date(f.at).getTime() >= since)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/** The manager can remove a flag she added for a while, in case it was a mistake or she learned more. The agent's flags are not hers to remove. */
export const canRemoveFlag = (flag: ClaimFlag, now: Date): boolean =>
  flag.by === "noa" && now.getTime() - new Date(flag.at).getTime() <= FLAG_REMOVAL_DAYS * DAY_MS;

export const FLAG_REMOVAL_WINDOW_DAYS = FLAG_REMOVAL_DAYS;
