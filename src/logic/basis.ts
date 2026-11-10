import { dataset } from "@/data";
import type { Check, ReasonType } from "@/data/types";
import type { LocalClaim } from "./local";

/**
 * The "basis" pill on decided claims (Done and All tabs): one short label that says why the claim was decided,
 * and a one-line tooltip (80 characters at most) with the detail. Everything is derived from `agent.checks`,
 * so nothing here is claim-specific. The sparkle is always shown, because Orvo's checks produced the basis,
 * including for claims Noa decided after Orvo escalated them.
 */
export type Basis = {
  label: string;
  tooltip: string;
};

export const TOOLTIP_MAX = 80;

const clip = (text: string) => (text.length <= TOOLTIP_MAX ? text : `${text.slice(0, TOOLTIP_MAX - 1).trimEnd()}…`);

const firstCheck = (checks: Check[], pick: (c: Check) => boolean) => checks.find(pick);

/** Short pill wording for a claim decided because of a problem. Falls back to the dataset's own label. */
const REASON_LABEL: Partial<Record<ReasonType, string>> = {
  possible_duplicate: "Duplicate",
  over_meal_cap: "Over meal cap",
};

const reasonLabel = (reason: ReasonType) => REASON_LABEL[reason] ?? dataset.enums.reason_type[reason] ?? "Reviewed";

/** The check that explains an approval, most specific first. */
function approvalCheck(checks: Check[]): Check | undefined {
  return (
    firstCheck(checks, (c) => c.id === "meal_cap" && c.result === "pass") ??
    firstCheck(checks, (c) => c.id === "fx_match" && c.result === "pass") ??
    firstCheck(checks, (c) => c.id === "receipt_present" && c.result === "skipped") ??
    firstCheck(checks, (c) => c.id === "amount_match" && c.result === "pass")
  );
}

/** The check that explains a decline or an escalation: the first one that did not pass. */
const problemCheck = (checks: Check[]) => firstCheck(checks, (c) => c.result === "fail" || c.result === "flag" || c.result === "unsure");

/** Null for claims that are still open (Needs review, Waiting): they have no decision to explain yet. */
export function basisFor(claim: LocalClaim): Basis | null {
  const { checks, reason_type } = claim.agent;

  if (claim.status === "approved_by_agent") {
    const check = approvalCheck(checks);
    // The currency tolerance is Orvo's own setting, not company policy, so it gets its own wording.
    if (check?.id === "fx_match") return { label: "Within tolerance", tooltip: clip(check.detail) };
    return { label: "Policy match", tooltip: clip(check ? `Within policy. ${check.detail}` : "Within policy.") };
  }

  if (claim.status === "declined_by_agent") {
    const check = problemCheck(checks);
    return { label: reasonLabel(reason_type), tooltip: clip(check?.detail ?? claim.agent.headline) };
  }

  if (claim.status === "approved_by_noa" || claim.status === "declined_by_noa") {
    const check = problemCheck(checks);
    return { label: reasonLabel(reason_type), tooltip: clip(check?.detail ?? claim.agent.headline) };
  }

  return null;
}
