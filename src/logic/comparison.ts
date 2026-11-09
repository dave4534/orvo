import { dataset } from "@/data";
import { firstName } from "./actions";
import { personById } from "./claims";
import { displayName, formatSubmitted, formatUsd } from "./format";
import { FINANCE_LIMIT, MEAL_CAP, RECEIPT_LIMIT, type LocalClaim } from "./local";

export type Half = {
  label: string;
  /** Marker dot next to the label. */
  tone: "neutral" | "good" | "info";
  amount?: number;
  /** Used instead of an amount when there is nothing numeric to show. */
  text?: string;
  sub?: string;
};

export type ComparisonRow = { label: string; left: string; right: string; differs: boolean };

export type Comparison = {
  kind: "money" | "text" | "identity";
  left: Half;
  right: Half;
  /** Numeric scale under the halves. Absent for text and identity comparisons. */
  scale?: { max: number; marks: { value: number; label: string }[] };
  /** One plain sentence that states the gap. */
  sentence: string;
  /** True when the receipt and the approval agree. The view marks it with a green check. */
  matches?: boolean;
  evidence: { label: string; value: string }[];
};

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", SEK: "SEK " };
const money = (value: number, currency = "USD") =>
  currency === "USD" ? formatUsd(value) : `${SYMBOL[currency] ?? `${currency} `}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseMoney = (text: string | undefined): number | null => {
  const m = text?.match(/-?\d[\d,]*(?:\.\d+)?/);
  return m ? Number(m[0].replace(/,/g, "")) : null;
};

const fact = (claim: LocalClaim, pattern: RegExp) => claim.agent.facts.find((f) => pattern.test(f.label))?.value;

const niceMax = (value: number) => {
  const steps = [100, 200, 250, 500, 1000, 1500, 2000, 2500, 5000];
  return steps.find((s) => s >= value * 1.05) ?? Math.ceil(value * 1.1);
};

const scaleFor = (a: number, b: number): Comparison["scale"] => ({
  max: niceMax(Math.max(a, b)),
  marks: [
    { value: a, label: formatUsd(a) },
    { value: b, label: formatUsd(b) },
  ],
});

const RIDE_LABELS: Record<string, string> = {
  ride_id: "Ride ID",
  pickup: "Pickup",
  pickup_time: "Pickup time",
  dropoff: "Drop-off",
  riders: "Riders",
  invoice: "Invoice",
};

function identityComparison(claim: LocalClaim, other: LocalClaim): Comparison {
  const a = other.receipt.document?.details ?? {};
  const b = claim.receipt.document?.details ?? {};
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).filter((k) => k in RIDE_LABELS);
  const rows: ComparisonRow[] = [
    { label: "Amount", left: formatUsd(other.amount.usd_claimed), right: formatUsd(claim.amount.usd_claimed), differs: other.amount.usd_claimed !== claim.amount.usd_claimed },
    ...keys.map((k) => ({
      label: RIDE_LABELS[k],
      left: String(a[k] ?? "None"),
      right: String(b[k] ?? "None"),
      differs: String(a[k]) !== String(b[k]),
    })),
  ];
  const sameRide = rows.find((r) => r.label === "Ride ID")?.differs === false;
  const otherName = firstName(other);
  const otherEmployee = other.employee_id === claim.employee_id ? "earlier claim" : `${otherName}'s claim`;
  return {
    kind: "identity",
    left: { label: "Earlier claim", tone: "neutral", text: other.id, sub: `${otherName}, ${formatSubmitted(other.submitted_at)}` },
    right: { label: "This claim", tone: "info", text: claim.id, sub: `${firstName(claim)}, ${formatSubmitted(claim.submitted_at)}` },
    sentence: sameRide
      ? `Same ride ID on both claims, so this is the same trip claimed twice.`
      : `Same fare and route as ${otherEmployee}, but a different ride ID and pickup.`,
    // The fields side by side, one line each: the earlier value, then this claim's value when it differs.
    evidence: rows.map((r) => ({ label: r.label, value: r.differs ? `${r.left}, now ${r.right}` : r.left })),
  };
}

/** Builds the comparison shown in the triage panel. Pure. PRD 7.2. */
export function buildComparison(claim: LocalClaim, all: LocalClaim[]): Comparison {
  const claimed = claim.amount.usd_claimed;
  const original = claim.amount.original;
  const reason = claim.agent.reason_type;
  const note = claim.employee_note ? [{ label: "Employee note", value: `"${claim.employee_note}"` }] : [];

  // 1. Claims that reached Noa, by the reason the agent gave.
  if (claim.status === "waiting_on_noa" || claim.status === "waiting_on_employee") {
    switch (reason) {
      case "over_finance_threshold": {
        const gap = claimed - FINANCE_LIMIT;
        return {
          kind: "money",
          left: { label: "Policy", tone: "neutral", amount: FINANCE_LIMIT, sub: "Above this, Finance approves too" },
          right: { label: "Claim", tone: "info", amount: claimed, sub: original.currency !== "USD" ? `${money(original.value, original.currency)}${claim.amount.fx ? ` at ${claim.amount.fx.rate}` : ""}` : undefined },
          scale: scaleFor(FINANCE_LIMIT, claimed),
          sentence: `${formatUsd(gap)} over the limit, so it needs Finance after this decision.`,
          evidence: note,
        };
      }
      case "unusual_amount": {
        const usual = parseMoney(fact(claim, /median/i)) ?? 0;
        const surge = fact(claim, /surge/i);
        return {
          kind: "money",
          left: { label: "Usual", tone: "neutral", amount: usual, sub: "Median of other SFO rides this week" },
          right: { label: "Claim", tone: "info", amount: claimed, sub: surge ? `Surge ${surge}` : undefined },
          scale: scaleFor(usual, claimed),
          sentence: `${formatUsd(claimed - usual)} above a usual ride. No policy limit applies.`,
          evidence: note,
        };
      }
      case "currency_mismatch": {
        const fx = claim.amount.fx;
        if (fx) {
          const ceiling = Math.round(fx.usd_computed * (1 + fx.tolerance_pct / 100) * 100) / 100;
          return {
            kind: "money",
            left: { label: "Receipt, converted", tone: "neutral", amount: fx.usd_computed, sub: `${money(original.value, original.currency)} at ${fx.rate} on ${new Date(fx.rate_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` },
            right: { label: "Claim", tone: "info", amount: claimed, sub: "Card statement amount" },
            scale: scaleFor(fx.usd_computed, claimed),
            sentence: `${formatUsd(fx.gap_usd)} (${fx.gap_pct}%) over the receipt. The limit is ${fx.tolerance_pct}%, which is ${formatUsd(ceiling)}.`,
            evidence: note,
          };
        }
        break;
      }
      case "possible_split": {
        const linked = claim.agent.related_claim_ids.map((id) => all.find((c) => c.id === id)).filter((c): c is LocalClaim => Boolean(c));
        const combined = claimed + linked.reduce((s, c) => s + c.amount.usd_claimed, 0);
        const evidence = [
          { label: claim.id, value: `${formatUsd(claimed)}, ${claim.receipt.document?.details?.invoice ?? "no invoice"}, filed ${formatSubmitted(claim.submitted_at)}` },
          ...linked.map((c) => ({
            label: c.id,
            value: `${formatUsd(c.amount.usd_claimed)}, ${c.receipt.document?.details?.invoice ?? "no invoice"}, filed ${formatSubmitted(c.submitted_at)}, ${dataset.enums.status[c.status] ?? c.status}`,
          })),
          { label: "Time apart", value: fact(claim, /time apart/i) ?? "" },
        ].filter((e) => e.value);
        return {
          kind: "money",
          left: { label: "Policy", tone: "neutral", amount: FINANCE_LIMIT, sub: "Finance limit" },
          right: { label: "Combined", tone: "info", amount: combined, sub: `${claim.id} plus ${linked.map((c) => c.id).join(", ")}` },
          scale: scaleFor(FINANCE_LIMIT, combined),
          sentence: `${formatUsd(combined - FINANCE_LIMIT)} over the limit when combined. The invoices are separate.`,
          evidence,
        };
      }
      case "receipt_missing_unresolved": {
        const statement = claim.receipt.attachments.find((a) => /statement/i.test(a.kind) || /statement/i.test(a.label));
        const requests = claim.agent.chase?.attempts.length ?? 0;
        return {
          kind: "money",
          left: { label: "Policy", tone: "neutral", amount: RECEIPT_LIMIT, sub: "Receipt required above this" },
          right: { label: "Claim", tone: "info", amount: claimed, sub: "No receipt" },
          scale: scaleFor(RECEIPT_LIMIT, claimed),
          sentence: `${formatUsd(claimed - RECEIPT_LIMIT)} over the no-receipt limit.`,
          evidence: [
            ...(statement ? [{ label: "Card statement", value: statement.shows }] : []),
            ...note,
            ...(requests ? [{ label: "Requests sent", value: `${requests} of ${claim.agent.chase?.max_attempts}` }] : []),
          ],
        };
      }
      case "no_matching_rule": {
        const tickets = fact(claim, /tickets/i);
        const fees = fact(claim, /fees/i);
        const margin = fact(claim, /under the finance/i);
        return {
          kind: "text",
          left: { label: "No rule", tone: "neutral", text: "Nothing covers entertainment or team events" },
          right: { label: "Claim", tone: "info", amount: claimed, sub: [tickets && `${tickets} tickets`, fees && `${fees} fees`].filter(Boolean).join(" plus ") || undefined },
          sentence: "There is no rule to compare this against, so the decision is open.",
          evidence: [
            ...(fact(claim, /paid by/i) ? [{ label: "Paid by", value: fact(claim, /paid by/i)! }] : []),
            ...note,
            ...(margin ? [{ label: "Under the Finance limit by", value: margin }] : []),
          ],
        };
      }
      case "over_meal_cap": {
        const people = claim.receipt.document?.covers ?? claim.attendees.count;
        const cap = MEAL_CAP * people;
        const doc = claim.receipt.document;
        const wine = doc?.lines.find((l) => /wine|nebbiolo|bottle/i.test(l.label));
        const noWine = noWineAmount(claim);
        return {
          kind: "money",
          left: { label: "Policy", tone: "neutral", amount: cap, sub: `${formatUsd(MEAL_CAP)} × ${people} people` },
          right: { label: "Claim", tone: "info", amount: claimed, sub: `${formatUsd(claimed / people)} per person` },
          scale: scaleFor(cap, claimed),
          sentence: `${formatUsd(claimed - cap)} over the cap in total.`,
          evidence: [
            ...(wine ? [{ label: "Wine on the bill", value: `${formatUsd(wine.amount)}${fact(claim, /wine/i) ? `, ${fact(claim, /wine/i)}` : ""}` }] : []),
            ...(noWine ? [{ label: "Without the wine", value: `${formatUsd(noWine)}, ${formatUsd(noWine / people)} per person` }] : []),
            ...note,
          ],
        };
      }
      default:
        break;
    }
  }

  // 2a. Approved by Noa, possibly after correcting Orvo: compare the receipt with what she approved.
  if (claim.status === "approved_by_noa" && claim.noa && claim.receipt.document?.total != null) {
    const total = claim.receipt.document.total;
    const paid = claim.noa.approved_amount_usd;
    const diff = Math.abs(total - paid);
    return {
      kind: "money",
      left: { label: "Receipt", tone: "neutral", amount: total, sub: "Total printed on the receipt" },
      right: { label: "Approved", tone: "good", amount: paid, sub: claim.noa.overrode_agent ? `Automatically approved at ${formatUsd(claimed)}` : "Amount approved" },
      scale: scaleFor(total, paid),
      sentence: diff < 0.005 ? "Receipt and approval match." : `You approved ${formatUsd(paid)}, ${formatUsd(diff)} ${paid < total ? "less" : "more"} than the receipt.`,
      matches: diff < 0.005,
      evidence: [],
    };
  }

  // 2. Decided by the agent.
  if (claim.status === "approved_by_agent" || claim.status === "approved_by_noa" || claim.status === "declined_by_agent") {
    const doc = claim.receipt.document;
    if (claim.status === "declined_by_agent") {
      const other = all.find((c) => c.id === claim.agent.related_claim_ids[0]);
      if (other) return identityComparison(claim, other);
    }
    if (doc && doc.total !== null) {
      const read = claim.receipt.agent_read?.total ?? claimed;
      const paid = claim.noa?.approved_amount_usd ?? claimed;
      if (Math.abs(doc.total - claimed) > 0.005 || Math.abs(doc.total - read) > 0.005) {
        const diff = Math.abs(claimed - doc.total);
        return {
          kind: "money",
          left: { label: "Receipt", tone: "neutral", amount: doc.total, sub: "Total printed on the receipt" },
          right: { label: "Approved", tone: "good", amount: claimed, sub: "Total read from receipt" },
          scale: scaleFor(doc.total, claimed),
          sentence: `Receipt and approval differ by ${formatUsd(diff)}.`,
          evidence: [],
        };
      }
      if (claim.category === "meals" && doc.covers) {
        const cap = MEAL_CAP * doc.covers;
        if (claimed > cap) {
          return {
            kind: "money",
            left: { label: "Policy", tone: "neutral", amount: cap, sub: `${formatUsd(MEAL_CAP)} × ${doc.covers} on the receipt` },
            right: { label: "Approved", tone: "good", amount: claimed, sub: `Claimed for ${claim.attendees.count} people` },
            scale: scaleFor(cap, claimed),
            sentence: `Policy and approval differ by ${formatUsd(claimed - cap)}. The receipt shows ${doc.covers} diners, the claim says ${claim.attendees.count}.`,
            evidence: [],
          };
        }
      }
      return {
        kind: "money",
        left: { label: "Receipt", tone: "neutral", amount: doc.total, sub: "Total printed on the receipt" },
        right: { label: "Approved", tone: "good", amount: paid, sub: claim.status === "approved_by_noa" ? "Amount approved" : "Total read from receipt" },
        scale: scaleFor(doc.total, paid),
        sentence: Math.abs(doc.total - paid) < 0.005 ? "Receipt and approval match." : `You approved ${formatUsd(paid)}, ${formatUsd(Math.abs(doc.total - paid))} ${paid < doc.total ? "less" : "more"} than the receipt.`,
        matches: Math.abs(doc.total - paid) < 0.005,
        evidence: [],
      };
    }
  }

  // 3. Waiting on the employee for a receipt.
  if (claim.status === "waiting_on_employee" || claim.status === "waiting_on_finance") {
    const over = claimed - RECEIPT_LIMIT;
    if (claimed > FINANCE_LIMIT || claim.status === "waiting_on_finance") {
      return {
        kind: "money",
        left: { label: "Claim", tone: "neutral", amount: claim.amount.usd_claimed, sub: "As claimed" },
        right: { label: "You approved", tone: "good", amount: claim.noa?.approved_amount_usd ?? claimed, sub: "Waiting on Finance" },
        sentence: "With Finance. No action is needed until Finance decides.",
        evidence: [],
      };
    }
    return {
      kind: "money",
      left: { label: "Policy", tone: "neutral", amount: RECEIPT_LIMIT, sub: "Receipt required above this" },
      right: { label: "Claim", tone: "info", amount: claimed, sub: claim.receipt.status === "unreadable" ? "Receipt unreadable" : "No receipt" },
      scale: over > 0 ? scaleFor(RECEIPT_LIMIT, claimed) : undefined,
      sentence: over > 0 ? `${formatUsd(over)} over the no-receipt limit. ${chaseSentence(claim)}` : chaseSentence(claim),
      evidence: note,
    };
  }

  // 4. Decided by Noa, or anything else: show the claim and the decision.
  if (claim.noa) {
    const approved = claim.noa.decision === "approved";
    return {
      kind: "money",
      left: { label: "Claim", tone: "neutral", amount: claimed, sub: "As claimed" },
      right: { label: approved ? "Approved" : "Declined", tone: approved ? "good" : "neutral", amount: claim.noa.approved_amount_usd, sub: claim.noa.note || undefined },
      sentence: approved
        ? claim.noa.approved_amount_usd === claimed
          ? "You approved the full amount."
          : `You approved ${formatUsd(claim.noa.approved_amount_usd)}, ${formatUsd(claimed - claim.noa.approved_amount_usd)} less than claimed.`
        : "You declined this claim.",
      evidence: [],
    };
  }

  // 5. Fallback: the first check that is not a pass, as expected versus observed.
  const check = claim.agent.checks.find((c) => c.result !== "pass" && c.result !== "skipped") ?? claim.agent.checks[0];
  return {
    kind: "text",
    left: { label: "Expected", tone: "neutral", text: check?.label ?? "Policy" },
    right: { label: "Observed", tone: "info", text: check?.detail ?? claim.agent.headline },
    sentence: claim.agent.headline,
    evidence: [],
  };
}

function chaseSentence(claim: LocalClaim): string {
  const chase = claim.agent.chase;
  if (!chase) return "";
  const sent = chase.attempts.length;
  return `Requests sent: ${sent} of ${chase.max_attempts}.`;
}

/** Total with the wine and its share of tax and tip removed, from the receipt lines. PRD 8.3. */
export function noWineAmount(claim: LocalClaim): number | null {
  const doc = claim.receipt.document;
  if (!doc || doc.total === null || !doc.subtotal) return null;
  const wine = doc.lines.find((l) => /wine|nebbiolo|bottle/i.test(l.label));
  if (!wine) return null;
  return Math.round(((doc.total * (doc.subtotal - wine.amount)) / doc.subtotal) * 100) / 100;
}

export const employeeName = (claim: LocalClaim): string => {
  const person = personById(claim.employee_id);
  return person ? displayName(person) : claim.employee_id;
};

/** Neutral differences found in visible fields. Never says a mistake exists. PRD 13.6. */
export type Finding = "amount" | "people" | "declined_valid";

export function detectFinding(claim: LocalClaim, all: LocalClaim[]): Finding | null {
  const doc = claim.receipt.document;
  if (claim.status === "approved_by_agent" && doc?.total != null && Math.abs(doc.total - claim.amount.usd_claimed) > 0.005) return "amount";
  if (claim.status === "approved_by_agent" && claim.category === "meals" && doc?.covers && doc.covers !== claim.attendees.count) return "people";
  if (claim.status === "declined_by_agent") {
    const other = all.find((c) => c.id === claim.agent.related_claim_ids[0]);
    const a = other?.receipt.document?.details?.ride_id;
    const b = doc?.details?.ride_id;
    if (a && b && a !== b) return "declined_valid";
  }
  return null;
}
