import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { dataset, NOW } from "@/data";
import type { Category, Status } from "@/data/types";
import { employeeName } from "@/logic/comparison";
import { claimStatusLabel, formatSubmitted } from "@/logic/format";
import { isWaitOver, type LocalClaim } from "@/logic/local";
import { allActionsFor, assess, reasoningText } from "@/logic/recommendations";

const STATUSES = [
  "waiting_on_noa",
  "waiting_on_employee",
  "waiting_on_finance",
  "approved_by_agent",
  "declined_by_agent",
  "approved_by_noa",
  "declined_by_noa",
] as const satisfies readonly Status[];

const CATEGORIES = Object.keys(dataset.enums.category) as [Category, ...Category[]];

const money = (n: number | null | undefined) => (typeof n === "number" ? Math.round(n * 100) / 100 : null);

/**
 * Lets the model attach a button to its message when it suggests an action on the open claim.
 * The button runs the same action as the one in the action bar.
 * The label is limited to the buttons that exist for that claim.
 */
export function buildSuggestActionTool(claim: LocalClaim | undefined, claims: LocalClaim[] = [], now: Date = NOW): ToolSet {
  if (!claim || !(claim.status === "waiting_on_noa" || isWaitOver(claim, now))) return {};
  const labels = allActionsFor(claim, claims, now).map((s) => s.label) as [string, ...string[]];
  return {
    suggestAction: tool({
      description:
        "Call this when you recommend or suggest that Noa take one specific action on the open claim. A button with that label appears under your message. Write your answer in text as well: the button never replaces it. Do not call it for questions that do not suggest an action.",
      inputSchema: z.object({ claimId: z.literal(claim.id), buttonLabel: z.enum(labels).describe("Exact label of the button") }),
      execute: async () => ({ ok: true, note: "Done. A button now sits under your message. Now write your complete answer to Noa's question from scratch, in your normal style: the answer first, then the reason. Do not refer to the button, this tool, or anything you did before." }),
    }),
  };
}

/** Read-only tools over the dataset with the session's changes laid over it. */
export function buildChatTools(claims: LocalClaim[], now: Date = NOW) {
  const byId = new Map(claims.map((c) => [c.id.toUpperCase(), c]));
  const people = dataset.people.filter((p) => p.role === "team_member");

  const row = (c: LocalClaim) => ({
    id: c.id,
    employee: employeeName(c),
    merchant: c.merchant,
    category: dataset.enums.category[c.category],
    amountUsd: money(c.amount.usd_claimed),
    status: claimStatusLabel(c),
    submitted: formatSubmitted(c.submitted_at),
    headline: c.agent.headline,
  });

  const findPerson = (text: string) => {
    const q = text.trim().toLowerCase();
    return people.find((p) => p.id === q || p.name.toLowerCase().includes(q));
  };

  return {
    getQueueSummary: tool({
      description: "Overview of the queue right now: counts by status, the claims waiting for review, and totals.",
      inputSchema: z.object({}),
      execute: async () => {
        const counts: Record<string, number> = {};
        for (const c of claims) counts[claimStatusLabel(c)] = (counts[claimStatusLabel(c)] ?? 0) + 1;
        const waiting = claims.filter((c) => c.status === "waiting_on_noa");
        return {
          now: NOW.toISOString(),
          totalClaims: claims.length,
          countsByStatus: counts,
          waitingForReview: waiting.map(row),
          waitingForReviewTotalUsd: money(waiting.reduce((s, c) => s + c.amount.usd_claimed, 0)),
        };
      },
    }),

    listClaims: tool({
      description: "Find claims by status, employee, category or free text (merchant, description, id). Returns short rows, newest first.",
      inputSchema: z.object({
        status: z.enum(STATUSES).optional(),
        employee: z.string().optional().describe("Part of the employee's name"),
        category: z.enum(CATEGORIES).optional(),
        text: z.string().optional().describe("Matches merchant, description, id and the automatic review headline"),
        limit: z.number().int().min(1).max(40).optional(),
      }),
      execute: async ({ status, employee, category, text, limit }) => {
        const person = employee ? findPerson(employee) : undefined;
        if (employee && !person) return { error: `No team member matches "${employee}".`, teamMembers: people.map((p) => p.name) };
        const q = text?.trim().toLowerCase();
        const rows = claims
          .filter((c) => !status || c.status === status)
          .filter((c) => !person || c.employee_id === person.id)
          .filter((c) => !category || c.category === category)
          .filter((c) => !q || [c.id, c.merchant, c.description, c.agent.headline].some((f) => f.toLowerCase().includes(q)))
          .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
          .slice(0, limit ?? 20);
        return { count: rows.length, claims: rows.map(row) };
      },
    }),

    getClaim: tool({
      description:
        "Everything about one claim: amounts, receipt, what the automatic review found and why, checks, activity, requests to the employee, the claim chat, and the decision if there is one.",
      inputSchema: z.object({ id: z.string().describe('Claim id such as "C-1019"') }),
      execute: async ({ id }) => {
        const c = byId.get(id.trim().toUpperCase());
        if (!c) return { error: `No claim with id ${id}.` };
        const doc = c.receipt.document;
        const read = c.receipt.agent_read;
        const readDiffers =
          doc && read
            ? (["merchant", "date", "subtotal", "tax", "tip", "total", "covers"] as const)
                .filter((k) => String(doc[k] ?? "") !== String(read[k] ?? ""))
                .map((k) => ({ field: k, receipt: doc[k], read: read[k] }))
            : [];
        return {
          ...row(c),
          description: c.description,
          expenseDate: c.expense_date,
          employeeNote: c.employee_note,
          attendeeCount: c.attendees.count,
          original: c.amount.original,
          fx: c.amount.fx,
          receipt: {
            status: c.receipt.status,
            printed: doc && { merchant: doc.merchant, date: doc.date, currency: doc.currency, lines: doc.lines, tax: doc.tax, tip: doc.tip, total: doc.total, covers: doc.covers, details: doc.details },
            readValueDiffersFromReceipt: readDiffers,
            attachments: c.receipt.attachments,
          },
          automaticReview: {
            outcome: c.agent.outcome,
            reason: dataset.enums.reason_type[c.agent.reason_type],
            headline: c.agent.headline,
            explanation: c.agent.explanation,
            couldNotJudge: c.agent.unsure,
            neededFromManager: c.agent.needs_from_noa,
            facts: c.agent.facts,
            checks: c.agent.checks.map((k) => ({ check: k.label, passed: k.result === "pass" ? "yes" : k.result === "fail" ? "no" : dataset.enums.check_result[k.result], detail: k.detail })),
            decidedAt: formatSubmitted(c.agent.decided_at),
            policyVersion: c.agent.policy_version,
          },
          decision: c.noa && { decision: c.noa.decision, approvedUsd: money(c.noa.approved_amount_usd), decidedAt: formatSubmitted(c.noa.decided_at), note: c.noa.note, changedAutomaticDecision: c.noa.overrode_agent },
          awaiting: c.awaiting,
          approvalChain: c.approval_chain,
          relatedClaimIds: c.agent.related_claim_ids,
          activity: c.events.map((e) => ({ at: formatSubmitted(e.at), actor: e.actor, text: e.text })),
          requestsToEmployee: c.agent.chase && {
            maxRequests: c.agent.chase.max_attempts,
            status: c.agent.chase.status,
            attempts: c.agent.chase.attempts.map((a) => ({ sentAt: formatSubmitted(a.sent_at), message: a.message, reply: a.reply && { at: formatSubmitted(a.reply.at), text: a.reply.text } })),
            nextRequestAt: c.agent.chase.next_attempt_at && formatSubmitted(c.agent.chase.next_attempt_at),
            passesToManagerAt: formatSubmitted(c.agent.chase.escalates_at),
          },
          claimChat: (c.local?.thread ?? []).map((m) => ({ at: formatSubmitted(m.at), from: m.from, text: m.text })),
        };
      },
    }),

    getEmployeeHistory: tool({
      description: "An employee's claims (all of them), newest first, with this month's total.",
      inputSchema: z.object({ employee: z.string().describe("Part of the employee's name") }),
      execute: async ({ employee }) => {
        const person = findPerson(employee);
        if (!person) return { error: `No team member matches "${employee}".`, teamMembers: people.map((p) => p.name) };
        const mine = claims
          .filter((c) => c.employee_id === person.id)
          .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
        return {
          employee: person.name,
          claimCount: mine.length,
          totalClaimedUsd: money(mine.reduce((s, c) => s + c.amount.usd_claimed, 0)),
          claims: mine.map(row),
        };
      },
    }),

    getPolicy: tool({
      description: "The expense policy rules and the settings the automatic review uses.",
      inputSchema: z.object({}),
      execute: async () => ({
        version: dataset.policy.version,
        rules: dataset.policy.rules.map((r) => ({ id: r.id, text: r.text, limitUsd: r.limit_usd ?? null, thresholdUsd: r.threshold_usd ?? null, approver: r.approver ?? null })),
        automaticReviewSettings: dataset.policy.agent_settings,
      }),
    }),

    getRecommendedAction: tool({
      description: "The product's recommended action for a claim that is waiting for review, with the other actions it offers. Returns button labels.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const c = byId.get(id.trim().toUpperCase());
        if (!c) return { error: `No claim with id ${id}.` };
        if (c.status !== "waiting_on_noa" && !isWaitOver(c, now)) return { note: `${c.id} is not waiting for review (${claimStatusLabel(c)}), so nothing is recommended.` };
        // The same record the triage note and the Policy tab show, so every answer matches the card.
        const a = assess(c, claims, now);
        const rec = a.recommendation;
        return {
          recommendedButton: rec.recommended?.label ?? null,
          otherButtons: rec.secondary.map((s) => s.label),
          inMoreOptions: rec.more.map((s) => s.label),
          reasonForReview: dataset.enums.reason_type[c.agent.reason_type],
          policyGap: a.gap,
          whyRecommended: a.why,
          whyOthersAreWeaker: a.others,
          reasoning: reasoningText(a),
        };
      },
    }),
  };
}
