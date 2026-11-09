import type { PersonId } from "@/data/types";
import { personById } from "./claims";
import { displayName, formatUsd } from "./format";
import { FINANCE_LIMIT, isAgentDecided, type LocalClaim, type LocalEvent } from "./local";

export type ActionId =
  | "approve"
  | "approve_amount"
  | "exception"
  | "decline"
  | "ask"
  | "hold"
  | "to_finance"
  | "to_finance_both"
  | "decide_now"
  | "confirm"
  | "correct";

export type ActionInput = {
  id: ActionId;
  /** USD amount to pay. Defaults to the claimed amount. */
  amount?: number;
  /** Message to the employee, for decline and ask. */
  message?: string;
  /** Correction outcome, for "correct". */
  to?: "approved" | "declined" | "ask";
  /** What went wrong, for "correct". Null means Noa opted out of telling Orvo. */
  feedback?: { option: string; text?: string } | null;
  /** Short description for the event log, for example the cited rule when approving an exception. */
  reason?: string;
};

export type ActionResult = {
  /** Every claim that changed, including linked ones. */
  changed: LocalClaim[];
  /** Plain sentence for the confirmation toast. */
  summary: string;
};

export const firstName = (claim: LocalClaim): string => {
  const person = personById(claim.employee_id as PersonId);
  return person ? displayName(person).split(" ")[0] : claim.employee_id;
};

const isoLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const setChain = (claim: LocalClaim, noa: string, finance: string) => {
  claim.approval_chain = claim.approval_chain.map((s) =>
    s.step === "noa"
      ? { ...s, state: noa as typeof s.state }
      : s.step === "finance"
        ? { ...s, state: finance as typeof s.state }
        : s,
  );
};

const event = (at: string, type: LocalEvent["type"], text: string): LocalEvent => ({ at, actor: "noa", type, text });

function approveClaim(claim: LocalClaim, amount: number, at: string, overrode: boolean, note: string) {
  const needsFinance = amount > FINANCE_LIMIT;
  claim.status = needsFinance ? "waiting_on_finance" : "approved_by_noa";
  claim.awaiting = needsFinance ? "finance" : null;
  setChain(claim, "done", needsFinance ? "waiting" : "not_needed");
  claim.noa = {
    decision: "approved",
    decided_at: at,
    note,
    approved_amount_usd: amount,
    overrode_agent: overrode,
  };
  return needsFinance;
}

/** Pure: returns changed copies and leaves the input array untouched. PRD 4.2 and 8.2. */
export function applyAction(all: LocalClaim[], claimId: string, input: ActionInput, now: Date): ActionResult {
  const original = all.find((c) => c.id === claimId);
  if (!original) throw new Error(`Unknown claim ${claimId}`);
  const claim = structuredClone(original);
  const at = isoLocal(now);
  const name = firstName(claim);
  const claimed = claim.amount.usd_claimed;
  const wasAgent = isAgentDecided(claim);
  const changed: LocalClaim[] = [claim];

  switch (input.id) {
    case "approve":
    case "approve_amount":
    case "exception": {
      const amount = input.amount ?? claimed;
      const toFinance = approveClaim(claim, amount, at, wasAgent, input.reason ?? "");
      const diff = amount < claimed ? `, ${formatUsd(claimed - amount)} less than claimed` : "";
      const text =
        input.id === "exception"
          ? `Approved ${formatUsd(amount)} as an exception${input.reason ? `: ${input.reason}` : ""}`
          : `Approved ${formatUsd(amount)}${diff}`;
      claim.events.push(event(at, toFinance ? "noa_routed_finance" : "noa_decision", toFinance ? `${text}. Sent to Finance.` : text));
      return {
        changed,
        summary: toFinance
          ? `Approved ${formatUsd(amount)} for ${name} and sent to Finance`
          : `Approved ${formatUsd(amount)} for ${name}`,
      };
    }
    case "decline": {
      claim.status = "declined_by_noa";
      claim.awaiting = null;
      setChain(claim, "done", "skipped");
      claim.noa = { decision: "declined", decided_at: at, note: input.message ?? "", approved_amount_usd: 0, overrode_agent: wasAgent };
      claim.events.push(event(at, "noa_decision", `Declined ${formatUsd(claimed)}${input.message ? `: ${input.message}` : ""}`));
      return { changed, summary: `Declined ${formatUsd(claimed)} for ${name}` };
    }
    case "ask":
    case "hold": {
      claim.status = "waiting_on_employee";
      claim.awaiting = "employee";
      setChain(claim, "waiting", claim.approval_chain.find((s) => s.step === "finance")?.state ?? "not_needed");
      claim.events.push(
        event(at, "noa_asked", input.id === "hold" ? `Asked for a receipt: ${input.message ?? ""}`.trim() : `Asked ${name}: ${input.message ?? ""}`.trim()),
      );
      return { changed, summary: `Asked ${name}${input.id === "hold" ? " for a receipt" : ""}` };
    }
    case "to_finance":
    case "to_finance_both": {
      claim.status = "waiting_on_finance";
      claim.awaiting = "finance";
      setChain(claim, "done", "waiting");
      claim.noa = { decision: "approved", decided_at: at, note: "", approved_amount_usd: claimed, overrode_agent: wasAgent };
      claim.events.push(event(at, "noa_routed_finance", `Sent ${formatUsd(claimed)} to Finance`));
      if (input.id === "to_finance_both") {
        for (const relatedId of claim.agent.related_claim_ids) {
          const other = all.find((c) => c.id === relatedId);
          if (!other || other.status === "waiting_on_finance") continue;
          const copy = structuredClone(other);
          // Reopens an agent approval that has not been paid: recorded as a correction (PRD 8.3).
          copy.status = "waiting_on_finance";
          copy.awaiting = "finance";
          setChain(copy, "done", "waiting");
          copy.noa = {
            decision: "approved",
            decided_at: at,
            note: "",
            approved_amount_usd: copy.amount.usd_claimed,
            overrode_agent: isAgentDecided(other),
          };
          copy.events.push(event(at, "noa_correction", `Reopened Orvo's approval and sent ${formatUsd(copy.amount.usd_claimed)} to Finance with ${claim.id}`));
          changed.push(copy);
        }
      }
      return {
        changed,
        summary: input.id === "to_finance_both" && changed.length > 1 ? `Sent both claims to Finance` : `Sent ${name}'s claim to Finance`,
      };
    }
    case "decide_now": {
      claim.status = "waiting_on_noa";
      claim.awaiting = "noa";
      setChain(claim, "waiting", claim.approval_chain.find((s) => s.step === "finance")?.state ?? "not_needed");
      claim.events.push(event(at, "noa_decision", "Noa took over and stopped the chase"));
      return { changed, summary: `You took over ${name}'s claim` };
    }
    case "confirm": {
      claim.local = { ...claim.local, spot_checked: true };
      return { changed, summary: `Confirmed Orvo's decision for ${name}` };
    }
    case "correct": {
      const outcome = input.to ?? "approved";
      const amount = input.amount ?? claimed;
      const was = claim.status === "declined_by_agent" ? "Orvo's decline" : wasAgent ? `Orvo's approval of ${formatUsd(claimed)}` : "your decision";
      if (outcome === "approved") {
        const toFinance = approveClaim(claim, amount, at, wasAgent, input.reason ?? "");
        claim.events.push(event(at, "noa_correction", `Corrected ${was} to ${formatUsd(amount)}${toFinance ? ". Sent to Finance." : ""}`));
      } else if (outcome === "declined") {
        claim.status = "declined_by_noa";
        claim.awaiting = null;
        setChain(claim, "done", "skipped");
        claim.noa = { decision: "declined", decided_at: at, note: input.message ?? "", approved_amount_usd: 0, overrode_agent: wasAgent };
        claim.events.push(event(at, "noa_correction", `Corrected ${was} to a decline`));
      } else {
        claim.status = "waiting_on_employee";
        claim.awaiting = "employee";
        setChain(claim, "waiting", "not_needed");
        claim.events.push(event(at, "noa_correction", `Reopened ${was} and asked ${name}: ${input.message ?? ""}`.trim()));
      }
      if (input.feedback) {
        claim.local = {
          ...claim.local,
          feedback: [...(claim.local?.feedback ?? []), { ...input.feedback, at }],
        };
        claim.events.push(event(at, "agent_feedback", `Told Orvo what went wrong: ${input.feedback.option}${input.feedback.text ? `. ${input.feedback.text}` : ""}`));
      }
      return {
        changed,
        summary:
          outcome === "approved"
            ? `Corrected to ${formatUsd(amount)} for ${name}`
            : outcome === "declined"
              ? `Corrected to a decline for ${name}`
              : `Reopened and asked ${name}`,
      };
    }
  }
}

export type Preview = { pays: string; tells: string; finance: string };

/** Three lines shown before a non-trivial action is confirmed. PRD 8.4. */
export function actionPreview(claim: LocalClaim, input: ActionInput, all: LocalClaim[]): Preview {
  const name = firstName(claim);
  const claimed = claim.amount.usd_claimed;
  const amount = input.amount ?? claimed;
  const finance = (a: number) =>
    a > FINANCE_LIMIT
      ? `Involved, over ${formatUsd(FINANCE_LIMIT).replace(".00", "")}`
      : claimed > FINANCE_LIMIT
        ? `No longer involved, ${formatUsd(a)} is at or under ${formatUsd(FINANCE_LIMIT).replace(".00", "")}`
        : `Not needed, under ${formatUsd(FINANCE_LIMIT).replace(".00", "")}`;

  switch (input.id) {
    case "approve":
    case "approve_amount":
    case "exception":
    case "correct": {
      if (input.id === "correct" && input.to === "declined") {
        return { pays: `Nothing. ${name} is not paid.`, tells: `${name}, on Slack, that the claim is declined`, finance: "Not needed" };
      }
      if (input.id === "correct" && input.to === "ask") {
        return { pays: "Nothing yet", tells: `${name}, on Slack, with your question`, finance: "Not involved yet" };
      }
      if (amount > FINANCE_LIMIT) {
        return {
          pays: `Nothing until Finance approves ${formatUsd(amount)}. ${name} is paid after that.`,
          tells: `${name}, on Slack, that you approved it and it is with Finance`,
          finance: finance(amount),
        };
      }
      const pays =
        amount < claimed
          ? `${formatUsd(claimed - amount)} less. ${name} gets ${formatUsd(amount)}.`
          : `${formatUsd(amount)}. ${name} is paid in full.`;
      const receiptTotal = claim.receipt.document?.total;
      const tells =
        amount < claimed
          ? input.id === "correct" && receiptTotal === amount
            ? `${name}, on Slack, with the receipt total`
            : `${name}, on Slack, the amount and why it differs`
          : input.id === "exception"
            ? `${name}, on Slack, that it is approved as an exception`
            : `${name}, on Slack, that it is approved`;
      return { pays, tells, finance: finance(amount) };
    }
    case "decline":
      return { pays: `Nothing. ${name} is not paid.`, tells: `${name}, on Slack, that the claim is declined${input.message ? ", with your note" : ""}`, finance: "Not needed" };
    case "ask":
      return { pays: "Nothing yet", tells: `${name}, on Slack, with your question`, finance: "Not involved yet" };
    case "hold":
      return { pays: "Nothing until a receipt arrives", tells: `${name}, on Slack, asking for the receipt`, finance: "Not involved yet" };
    case "to_finance": {
      return { pays: `Nothing until Finance approves ${formatUsd(claimed)}`, tells: `${name}, on Slack, that it is with Finance`, finance: "Involved, you are sending it" };
    }
    case "to_finance_both": {
      const others = claim.agent.related_claim_ids
        .map((id) => all.find((c) => c.id === id))
        .filter((c): c is LocalClaim => Boolean(c));
      const list = others.map((c) => `${c.id} (${formatUsd(c.amount.usd_claimed)}, ${c.status === "approved_by_agent" ? "approved by Orvo, not paid" : c.status})`).join(", ");
      const total = claimed + others.reduce((s, c) => s + c.amount.usd_claimed, 0);
      return {
        pays: `Nothing until Finance approves ${formatUsd(total)} together`,
        tells: `${name}, on Slack, that both claims are with Finance`,
        finance: `Receives both ${claim.id} and ${list || "the linked claim"}`,
      };
    }
    default:
      return { pays: "", tells: "", finance: "" };
  }
}
