import type { ReasonType } from "@/data/types";
import type { LocalClaim } from "./local";
import { NOW } from "@/data";
import { daysOverTarget, WAIT_TARGET_DAYS } from "./wait";

// UI-layer fixture (PRD 9.1): reasons where Orvo's evidence points to a routine approval.
// Everything else is a judgment call.
const QUICK_APPROVAL_REASONS: ReasonType[] = ["over_finance_threshold", "unusual_amount"];

const RECEIPT_REASONS: ReasonType[] = ["receipt_missing", "receipt_unreadable", "receipt_missing_unresolved"];

export type DailyBrief = {
  dateLabel: string;
  needsYou: number;
  quick: number;
  judgment: number;
  approvedByOrvo: number;
  chasing: number;
  chasingReceipts: boolean;
  /** Open claims waiting on Noa that are already past the approval target. */
  pastTarget: number;
};

/** Counts for the daily brief. Derived from the claims, never typed. */
export function buildDailyBrief(claims: LocalClaim[], now: Date = NOW): DailyBrief {
  const needs = claims.filter((c) => c.status === "waiting_on_noa");
  const quick = needs.filter((c) => QUICK_APPROVAL_REASONS.includes(c.agent.reason_type)).length;
  const chasing = claims.filter((c) => c.status === "waiting_on_employee");
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .format(now)
    .replace(",", "");
  return {
    dateLabel,
    needsYou: needs.length,
    quick,
    judgment: needs.length - quick,
    approvedByOrvo: claims.filter((c) => c.status === "approved_by_agent").length,
    chasing: chasing.length,
    chasingReceipts: chasing.length > 0 && chasing.every((c) => RECEIPT_REASONS.includes(c.agent.reason_type)),
    pastTarget: needs.filter((c) => daysOverTarget(c, now) > 0).length,
  };
}

export type DoneBrief = {
  dateLabel: string;
  done: number;
  approvedByOrvo: number;
  declinedByOrvo: number;
  decidedByYou: number;
};

/** Counts for the Done brief. Derived from the claims, never typed. */
export function buildDoneBrief(claims: LocalClaim[], now: Date = NOW): DoneBrief {
  const done = claims.filter((c) =>
    ["approved_by_agent", "approved_by_noa", "declined_by_agent", "declined_by_noa"].includes(c.status),
  );
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .format(now)
    .replace(",", "");
  return {
    dateLabel,
    done: done.length,
    approvedByOrvo: done.filter((c) => c.status === "approved_by_agent").length,
    declinedByOrvo: done.filter((c) => c.status === "declined_by_agent").length,
    decidedByYou: done.filter((c) => c.status === "approved_by_noa" || c.status === "declined_by_noa").length,
  };
}

export function doneBriefSentence(b: DoneBrief): string {
  if (b.done === 0) return "Nothing is done yet.";
  return `${b.done} ${b.done === 1 ? "claim is" : "claims are"} done. I approved ${b.approvedByOrvo} on my own and declined ${b.declinedByOrvo} automatically, and ${b.decidedByYou} ${b.decidedByYou === 1 ? "was" : "were"} decided by hand.`;
}

export function briefSentence(b: DailyBrief): string {
  const parts: string[] = [];
  if (b.needsYou === 0) {
    parts.push("Nothing needs review.");
  } else {
    const split =
      b.quick > 0 && b.judgment > 0
        ? `: ${b.quick} quick ${b.quick === 1 ? "approval" : "approvals"} and ${b.judgment} judgment ${b.judgment === 1 ? "call" : "calls"}`
        : "";
    parts.push(`${b.needsYou} ${b.needsYou === 1 ? "claim needs" : "claims need"} review${split}.`);
    if (b.pastTarget > 0) parts.push(`${b.pastTarget} of ${b.needsYou} are past the ${WAIT_TARGET_DAYS}-day target.`);
  }
  const did = `I approved ${b.approvedByOrvo} on my own`;
  const chase = b.chasing > 0 ? ` and am chasing ${b.chasing} ${b.chasingReceipts ? "receipts" : "claims"}` : "";
  parts.push(`${did}${chase}.`);
  return parts.join(" ");
}
