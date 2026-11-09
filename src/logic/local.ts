import type { Claim, ClaimEvent } from "@/data/types";
import { dataset } from "@/data";

// Local overlay on top of the immutable dataset (PRD 3.2). The dataset types close the event type union,
// so the overlay widens it for the actions Noa can take.
export type LocalEventType =
  | ClaimEvent["type"]
  | "noa_asked"
  | "noa_routed_finance"
  | "noa_correction"
  | "agent_feedback"
  | "undo";

export type LocalEvent = Omit<ClaimEvent, "type"> & { type: LocalEventType };

export type ThreadMessage = { at: string; from: "manager"; text: string };

export type LocalClaim = Omit<Claim, "events"> & {
  events: LocalEvent[];
  local?: {
    spot_checked?: boolean;
    feedback?: { option: string; text?: string; at: string }[];
    /** Messages the manager sent to the employee from this claim. Kept locally, in the claim chat. */
    thread?: ThreadMessage[];
  };
};

export const initialClaims = (): LocalClaim[] => structuredClone(dataset.claims) as unknown as LocalClaim[];

/**
 * Spot checks are driven by `agent.audit_sample` in the dataset. The current dataset does not carry it
 * (see ../Data Generation/README.md), so no claim is a spot check until the data gets the marker back.
 */
export const isSpotCheck = (claim: LocalClaim): boolean =>
  (claim.agent as { audit_sample?: boolean }).audit_sample === true;

export const isAgentDecided = (claim: LocalClaim): boolean =>
  claim.status === "approved_by_agent" || claim.status === "declined_by_agent";

export const FINANCE_LIMIT =
  dataset.policy.rules.find((r) => r.id === "finance_over_1000")?.threshold_usd ?? 1000;

export const MEAL_CAP =
  dataset.policy.rules.find((r) => r.id === "meal_cap")?.limit_usd ?? 60;

export const RECEIPT_LIMIT =
  dataset.policy.rules.find((r) => r.id === "receipt_required")?.threshold_usd ?? 25;
