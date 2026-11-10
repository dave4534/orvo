import { tool, type ToolSet } from "ai";
import { z } from "zod";

import type { LocalClaim } from "@/logic/local";

/**
 * Tools that put a card in the chat: the transaction, a receipt or attachment, the policy breakdown, or a drafted message.
 * They only describe what to show. The chat draws the card from the claim's data, so the card is always current.
 * Use them only when Noa asks to see the thing.
 */
export function buildCardTools(claims: LocalClaim[], openClaimId: string | undefined): ToolSet {
  const ids = claims.map((c) => c.id) as [string, ...string[]];
  const pick = (claimId?: string) => claims.find((c) => c.id === (claimId ?? openClaimId));
  const claimField = z.enum(ids).optional().describe("Claim id. Leave out for the claim that is open.");
  const noClaim = { ok: false, error: "No claim is open and none was named." };
  const shown = (card: string, claimId: string) => ({ ok: true, card, claimId, note: "The card is now in the chat. Do not repeat what is on it. Write at most one short sentence, or nothing." });

  return {
    showTransaction: tool({
      description: "Show the transaction card in the chat: merchant, amount, receipt and attached files, description and date, the same as the Overview tab. Only when Noa asks to see the transaction or the claim's details.",
      inputSchema: z.object({ claimId: claimField }),
      execute: async ({ claimId }) => {
        const claim = pick(claimId);
        return claim ? shown("transaction", claim.id) : noClaim;
      },
    }),
    showDocument: tool({
      description: "Show a receipt or an attached file (for example the card statement) in the chat. Only when Noa asks to see the receipt, a statement or the documentation for a claim.",
      inputSchema: z.object({ claimId: claimField, which: z.enum(["receipt", "attachment"]), label: z.string().max(80).optional().describe("Part of the attachment's name, if there is more than one") }),
      execute: async ({ claimId, which, label }) => {
        const claim = pick(claimId);
        if (!claim) return noClaim;
        const { receipt } = claim;
        if (which === "receipt") {
          if (receipt.status === "missing" || receipt.status === "unreadable" || !receipt.document) return { ok: false, error: `${claim.id} has no readable receipt.${receipt.attachments.length ? ` It has: ${receipt.attachments.map((a) => a.label).join(", ")}.` : ""}` };
          return { ...shown("receipt", claim.id), which };
        }
        const want = (label ?? "").toLowerCase();
        const found = want ? receipt.attachments.find((a) => a.label.toLowerCase().includes(want) || a.kind.toLowerCase().includes(want)) : receipt.attachments[0];
        if (!found) return { ok: false, error: receipt.attachments.length ? `No attachment matches "${label}". There is: ${receipt.attachments.map((a) => a.label).join(", ")}.` : `${claim.id} has no attachments.` };
        return { ...shown("attachment", claim.id), which, label: found.label };
      },
    }),
    showPolicyBreakdown: tool({
      description: "Show the policy breakdown in the chat as a table of the checks that were run and whether each passed, the same as the Policy tab. Only when Noa asks to see the policy breakdown or the checks.",
      inputSchema: z.object({ claimId: claimField }),
      execute: async ({ claimId }) => {
        const claim = pick(claimId);
        if (!claim) return noClaim;
        return claim.agent.checks.length > 0 ? shown("policy", claim.id) : { ok: false, error: `No checks were run on ${claim.id}.` };
      },
    }),
    showMessageCard: tool({
      description:
        'Show a drafted message to the employee as a card in the chat, with a "View in chat" button that opens it in the claim chat (Details, Chat tab). Use it once the wording is settled: Noa dictated it or accepted your offer to write it. Write the text as a short imperative with no "you", "your" or "could you". Nothing is sent by this.',
      inputSchema: z.object({ claimId: claimField, text: z.string().min(1).max(500) }),
      execute: async ({ claimId, text }) => {
        const claim = pick(claimId);
        return claim ? { ...shown("message", claim.id), text } : noClaim;
      },
    }),
  };
}
