import { dataset } from "@/data";
import { employeeName } from "@/logic/comparison";
import { formatUsd } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";
import { recommendationFor } from "@/logic/recommendations";

export type AiReply = { text: string; action?: { label: string; kind: "documents" | "policy" } };

/**
 * Scripted replies (PRD 11.2). They are grounded in the claim's own fields, say when the data cannot answer,
 * never call a decision a mistake, and never act on a claim from chat.
 */
export function suggestedPrompts(claim: LocalClaim | null): string[] {
  if (!claim) return ["What needs me today?", "What did you approve on your own?"];
  const base = ["Why did this reach me?", "Show the receipt"];
  if (claim.status === "waiting_on_noa") return [...base, "What would you recommend?"];
  return [...base, "How did you decide this?"];
}

export function replyTo(prompt: string, claim: LocalClaim | null, all: LocalClaim[]): AiReply {
  const q = prompt.toLowerCase();

  if (!claim) {
    const waiting = all.filter((c) => c.status === "waiting_on_noa");
    if (/need|today|queue|waiting/.test(q)) {
      return {
        text: waiting.length
          ? `${waiting.length} ${waiting.length === 1 ? "claim needs" : "claims need"} you. The oldest is ${waiting[0].id} from ${employeeName(waiting[0])}: ${waiting[0].agent.headline}`
          : "Nothing needs you right now.",
      };
    }
    if (/approv|own/.test(q)) {
      return { text: `I approved ${all.filter((c) => c.status === "approved_by_agent").length} claims on my own. Open the Done tab to look through them.` };
    }
    return { text: "Open a claim and I can answer from its data. I can only answer from what is on the claim." };
  }

  const who = employeeName(claim);
  if (/why|reach|escalat/.test(q)) {
    return { text: `${claim.agent.headline} ${claim.agent.explanation}`, action: { label: "See the checks I ran", kind: "policy" } };
  }
  if (/receipt|document/.test(q)) {
    const doc = claim.receipt.document;
    return {
      text: doc
        ? `${doc.merchant}, ${doc.date}. The receipt total is ${doc.total != null ? formatUsd(doc.total) : "unreadable"}.`
        : claim.receipt.status === "missing"
          ? `There is no receipt on this claim.`
          : "The attached receipt can't be read.",
      action: { label: "Open the receipt", kind: "documents" },
    };
  }
  if (/recommend|should|what would/.test(q)) {
    if (claim.status !== "waiting_on_noa") return { text: "This claim is not waiting on you, so I have nothing to recommend." };
    const rec = recommendationFor(claim).recommended;
    return {
      text: rec
        ? `I would choose "${rec.label}". ${claim.agent.needs_from_noa ?? ""} It is your decision, and you can pick any of the other options.`
        : `I can't recommend one here. ${claim.agent.explanation}`,
    };
  }
  if (/how|decide|evidence|check/.test(q)) {
    const checks = claim.agent.checks.map((c) => `${c.label}: ${dataset.enums.check_result[c.result].toLowerCase()}`).join(". ");
    return { text: `${checks}.`, action: { label: "See the checks I ran", kind: "policy" } };
  }
  if (/pay|approve|decline|send/.test(q)) {
    return { text: `I can't change ${who}'s claim from chat in this prototype. Use the buttons in the claim panel and I will show you what each one does first.` };
  }
  return { text: "I can only answer from this claim's data: why it reached you, the receipt, and the checks I ran." };
}
