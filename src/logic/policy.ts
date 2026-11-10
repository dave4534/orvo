import { dataset } from "@/data";
import type { ReasonType } from "@/data/types";
import type { LocalClaim } from "./local";
import { DAY_MS } from "./time";

/**
 * The one place the policy numbers and the rules built on them live. Every limit is read from the dataset
 * (`policy.rules` for the assignment's three rules, `policy.agent_settings` for our assumptions), never typed here.
 * `recommendations.ts` is the one table that turns these facts into actions and reasons, and everything that shows a
 * limit, a gap, a check or a recommendation reads from these two files. Pure: no React, no clock.
 */

type AgentSettings = {
  fx_tolerance_pct: number;
  unusual_amount_multiple_of_median: number;
  finance_nudge_working_days: number;
  wait_days: Record<string, number>;
};

const settings = dataset.policy.agent_settings as unknown as AgentSettings;

const ruleValue = (id: string, key: "limit_usd" | "threshold_usd" | "window_days" | "exception_ceiling_usd"): number => {
  const value = dataset.policy.rules.find((r) => r.id === id)?.[key];
  if (typeof value !== "number") throw new Error(`Policy rule ${id} has no ${key} in the dataset`);
  return value;
};

// The assignment's three rules.
export const MEAL_CAP = ruleValue("meal_cap", "limit_usd");
export const RECEIPT_LIMIT = ruleValue("receipt_required", "threshold_usd");
export const FINANCE_LIMIT = ruleValue("finance_over_1000", "threshold_usd");

// Our two readings of the rules, on the rules themselves: the Finance rule is added up per employee over a rolling window, and the
// manager can approve up to a ceiling without a receipt. The weekly limit is the Finance limit, not a fourth number.
export const WEEKLY_WINDOW_DAYS = ruleValue("finance_over_1000", "window_days");
export const WEEKLY_LIMIT = FINANCE_LIMIT;
export const EXCEPTION_CEILING = ruleValue("receipt_required", "exception_ceiling_usd");

// How the agent behaves around the rules, in policy.agent_settings. None of it is a policy.
export const FX_TOLERANCE_PCT = settings.fx_tolerance_pct;
export const FINANCE_NUDGE_WORKING_DAYS = settings.finance_nudge_working_days;

export type PolicyId = "meal_cap" | "receipt_required" | "finance_over_1000";

/** The one of the three policies a claim is read against, by why it came to review. Null for reasons that no policy covers. */
const POLICY_BY_REASON: Partial<Record<ReasonType, PolicyId>> = {
  over_meal_cap: "meal_cap",
  receipt_missing: "receipt_required",
  receipt_missing_unresolved: "receipt_required",
  receipt_unreadable: "receipt_required",
  currency_mismatch: "receipt_required",
  possible_duplicate: "receipt_required",
  over_finance_threshold: "finance_over_1000",
  possible_split: "finance_over_1000",
};
export const policyOf = (reason: ReasonType): PolicyId | null => POLICY_BY_REASON[reason] ?? null;
/** "Meals policy", "Receipt policy" or "Finance policy". The labels are `enums.policy_label` in the dataset. */
export const policyLabel = (id: PolicyId): string => dataset.enums.policy_label[id] ?? id;

const round2 = (n: number) => Math.round(n * 100) / 100;

const isDeclined = (c: LocalClaim) => c.status === "declined_by_agent" || c.status === "declined_by_noa";

/** What the claim is worth for the policy sums: the approved amount once Noa approved it, the claimed amount otherwise. */
export const effectiveAmount = (c: LocalClaim): number => (c.noa?.decision === "approved" ? c.noa.approved_amount_usd : c.amount.usd_claimed);

export type WeekFacts = {
  /** This claim plus the employee's other claims in the window, declined ones and ones over the single limit left out. */
  total: number;
  limit: number;
  days: number;
  /** The other claims that were added. */
  claims: LocalClaim[];
  /** The week's total is over the limit. A claim over the single limit is handled by that rule alone, so it is never "over" here. */
  over: boolean;
};

/** The employee's rolling week ending at this claim. `amount` lets a caller ask "what if this claim were approved for X". */
export function weeklyFacts(claim: LocalClaim, all: LocalClaim[], amount: number = effectiveAmount(claim)): WeekFacts {
  const end = new Date(claim.submitted_at).getTime();
  const start = end - WEEKLY_WINDOW_DAYS * DAY_MS;
  const claims = all.filter((c) => {
    if (c.id === claim.id || c.employee_id !== claim.employee_id || isDeclined(c)) return false;
    if (effectiveAmount(c) > FINANCE_LIMIT) return false;
    const at = new Date(c.submitted_at).getTime();
    return at >= start && at <= end;
  });
  const total = round2(claims.reduce((sum, c) => sum + effectiveAmount(c), 0) + amount);
  return { total, limit: WEEKLY_LIMIT, days: WEEKLY_WINDOW_DAYS, claims, over: amount <= FINANCE_LIMIT && total > WEEKLY_LIMIT };
}

/** Finance approves a claim over the single limit, and one whose week adds up past the weekly limit. */
export const needsFinance = (claim: LocalClaim, amount: number, all: LocalClaim[]): boolean =>
  amount > FINANCE_LIMIT || weeklyFacts(claim, all, amount).over;

export type ReceiptException = {
  /** The manager can approve this claim without a receipt, on the card statement. */
  allowed: boolean;
  ceiling: number;
  statement: LocalClaim["receipt"]["attachments"][number] | undefined;
  /** Why it is not allowed, in a few words. Empty when it is. */
  blockedBy: string;
};

/** Approving without a receipt needs a card statement, both requests to have gone unanswered, and an amount at or under the ceiling. */
export function receiptException(claim: LocalClaim): ReceiptException {
  const statement = claim.receipt.attachments.find((a) => /statement/i.test(a.kind) || /statement/i.test(a.label));
  const chase = claim.agent.chase;
  const chased = Boolean(chase && (chase.status === "unresolved" || chase.attempts.length >= chase.max_attempts));
  const claimed = claim.amount.usd_claimed;
  const blockedBy = claimed > EXCEPTION_CEILING ? "over the ceiling" : !statement ? "no card statement" : !chased ? "requests still going out" : "";
  return { allowed: blockedBy === "", ceiling: EXCEPTION_CEILING, statement, blockedBy };
}

/** Days a claim waits on the employee before it returns to the manager's queue. `wait` is a receipt wait, `ask` a question. */
export function waitDays(reason: ReasonType, kind: "wait" | "ask"): number {
  const table = settings.wait_days;
  return table[reason] ?? (kind === "wait" ? table.receipt_missing_unresolved : table.ask);
}

/** The foreign-currency gap against the tolerance. Null when the claim is in USD. */
export function fxFacts(claim: LocalClaim): { gapPct: number; gapUsd: number; tolerancePct: number; within: boolean; receiptUsd: number } | null {
  const fx = claim.amount.fx;
  if (!fx) return null;
  return { gapPct: fx.gap_pct, gapUsd: fx.gap_usd, tolerancePct: FX_TOLERANCE_PCT, within: fx.gap_pct <= FX_TOLERANCE_PCT, receiptUsd: fx.usd_computed };
}

/** The unusual-amount rule is a median multiple. Read it from the agent's own facts, as the comparison does. */
export const UNUSUAL_MULTIPLE = settings.unusual_amount_multiple_of_median;
