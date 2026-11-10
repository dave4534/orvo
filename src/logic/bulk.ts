import type { ActionInput } from "./actions";
import { formatUsd } from "./format";
import type { LocalClaim } from "./local";
import { needsFinance } from "./policy";
import { recommendationFor } from "./recommendations";

/**
 * Bulk actions on the claims list. They show only when two or more claims are selected and every selected claim
 * can take the action, so a button never skips anything silently.
 */
export type BulkActionId = "approve" | "decline";

export type BulkAction = {
  id: BulkActionId;
  label: string;
  input: ActionInput;
  destructive?: boolean;
};

/** Approve when the recommended step is a plain approval of the full amount that does not need Finance. */
const canApprove = (claim: LocalClaim, all: LocalClaim[]): boolean => {
  if (claim.status !== "waiting_on_noa") return false;
  if (needsFinance(claim, claim.amount.usd_claimed, all)) return false;
  return recommendationFor(claim, all).recommended?.id === "approve";
};

const canDecline = (claim: LocalClaim): boolean => claim.status === "waiting_on_noa";

const plural = (n: number) => `${n} claim${n === 1 ? "" : "s"}`;

export function bulkActionsFor(selected: LocalClaim[], all: LocalClaim[] = selected): BulkAction[] {
  if (selected.length < 2) return [];
  const actions: BulkAction[] = [];
  if (selected.every((c) => canApprove(c, all))) actions.push({ id: "approve", label: `Approve ${plural(selected.length)}`, input: { id: "approve" } });
  if (selected.every(canDecline)) actions.push({ id: "decline", label: `Decline ${plural(selected.length)}`, input: { id: "decline" }, destructive: true });
  return actions;
}

/** Plain sentence for the confirmation notice after a bulk action. */
export function bulkSummary(id: BulkActionId, claims: LocalClaim[]): string {
  const total = formatUsd(claims.reduce((sum, c) => sum + c.amount.usd_claimed, 0));
  return `${id === "approve" ? "Approved" : "Declined"} ${plural(claims.length)}, ${total} in all`;
}
