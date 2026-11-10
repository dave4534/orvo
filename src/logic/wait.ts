import { dataset } from "@/data";
import type { LocalClaim } from "./local";

/** The approval target from the data (6Qs: 9 days now, goal 2). Read, never typed here. */
export const WAIT_TARGET_DAYS: number = dataset.meta.baseline.goal_days_to_approval;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "3 days", "10 hours", "4 minutes". Plain terms, no colour or urgency. */
export function formatDuration(ms: number): string {
  if (ms < HOUR) return plural(Math.max(1, Math.floor(ms / 60000)), "minute");
  if (ms < DAY) return plural(Math.floor(ms / HOUR), "hour");
  return plural(Math.floor(ms / DAY), "day");
}

/** Time from submission to `at`, as text. */
export function elapsed(from: string, to: Date): number {
  return to.getTime() - new Date(from).getTime();
}

/** How long a claim has been open at `now`. */
export const waitingFor = (claim: LocalClaim, now: Date) => formatDuration(elapsed(claim.submitted_at, now));

/** The time it took from submission to Orvo's or Noa's decision. */
export function timeToDecision(claim: LocalClaim): string | null {
  const decided = claim.noa?.decided_at ?? (claim.status.endsWith("_by_agent") ? claim.agent.decided_at : null);
  return decided ? formatDuration(elapsed(claim.submitted_at, new Date(decided))) : null;
}

/** Days past the target for an open claim, or 0 when it is inside the target. */
export function daysOverTarget(claim: LocalClaim, now: Date): number {
  const over = elapsed(claim.submitted_at, now) - WAIT_TARGET_DAYS * DAY;
  return over > 0 ? Math.floor(over / DAY) || 1 : 0;
}

export const isOpen = (claim: LocalClaim) =>
  claim.status === "waiting_on_noa" || claim.status === "waiting_on_employee" || claim.status === "waiting_on_finance";
