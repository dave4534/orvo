import type { ReasonType } from "@/data/types";
import type { LocalClaim } from "./local";
import { NOW } from "@/data";

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
  };
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
  }
  const did = `I approved ${b.approvedByOrvo} on my own`;
  const chase = b.chasing > 0 ? ` and am chasing ${b.chasing} ${b.chasingReceipts ? "receipts" : "claims"}` : "";
  parts.push(`${did}${chase}.`);
  return parts.join(" ");
}
