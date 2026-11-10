import type { Claim, ClaimEvent, PersonId } from "@/data/types";
import { dataset } from "@/data";

// The policy limits now live in policy.ts. They are re-exported so existing imports keep working.
export { FINANCE_LIMIT, MEAL_CAP, RECEIPT_LIMIT } from "./policy";

// Local overlay on top of the immutable dataset (PRD 3.2). The dataset types close the event type union,
// so the overlay widens it for the actions Noa can take.
export type LocalEventType =
  | ClaimEvent["type"]
  | "noa_asked"
  | "noa_routed_finance"
  | "noa_correction"
  | "noa_flagged"
  | "noa_unflagged"
  | "agent_feedback"
  | "undo";

export type LocalEvent = Omit<ClaimEvent, "type"> & { type: LocalEventType };

export type ThreadMessage = { at: string; from: "manager"; text: string };

/** The kinds of flag. The labels are `enums.flag_type` in the dataset. */
export type FlagType =
  | "missing_receipt"
  | "over_meal_cap"
  | "weekly_over_limit"
  | "same_day_over_allowance"
  | "unusual_amount"
  | "possible_duplicate"
  | "unusual_pattern"
  | "manager";

/** A mark on a claim that counts toward the employee's pattern. The agent's flags are derived from the claims; the manager's are kept here. */
export type ClaimFlag = {
  id: string;
  type: FlagType;
  claimId: string;
  employeeId: PersonId;
  by: "agent" | "noa";
  /** When it was raised. */
  at: string;
  /** One line of why. */
  note: string;
};

/** A claim parked while it waits on someone. It returns to the manager's queue at `until`. */
export type ClaimWait = {
  since: string;
  until: string;
  days: number;
  /** The employee owes a receipt or an answer, or Finance owes a decision. */
  kind: "employee" | "finance";
  /** How many times the wait was extended after it ended, so an endless loop is visible. */
  extensions: number;
};

export type LocalClaim = Omit<Claim, "events"> & {
  events: LocalEvent[];
  local?: {
    spot_checked?: boolean;
    feedback?: { option: string; text?: string; at: string }[];
    /** Messages the manager sent to the employee from this claim. Kept locally, in the claim chat. */
    thread?: ThreadMessage[];
    /** Flags the manager added to this claim. The agent's flags are derived (see flags.ts). */
    flags?: ClaimFlag[];
    /** Set while the claim waits on the employee or Finance. */
    wait?: ClaimWait | null;
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

/** The wait ended and the claim is still with the employee or Finance: it belongs back in the manager's queue. */
export const isWaitOver = (claim: LocalClaim, now: Date): boolean =>
  Boolean(claim.local?.wait) &&
  (claim.status === "waiting_on_employee" || claim.status === "waiting_on_finance") &&
  new Date(claim.local!.wait!.until).getTime() <= now.getTime();
