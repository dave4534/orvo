import { tool, type ToolSet } from "ai";
import { z } from "zod";

import type { LocalClaim } from "@/logic/local";
import { allActionsFor } from "@/logic/recommendations";

/** Tools that act on the screen. They have no server function: the browser runs them and sends the result back. */
export const UI_TOOL_NAMES = [
  "openClaim",
  "nextClaim",
  "previousClaim",
  "backToClaims",
  "openDetails",
  "closeDetails",
  "showClaimsTab",
  "takeAction",
  "undoLastDecision",
] as const;

export const CLAIM_TABS = ["needs_review", "waiting", "done", "all"] as const;
export const DETAIL_TABS = ["overview", "policy", "past", "chat"] as const;

/**
 * Builds the screen tools for one request. Button labels are limited to the buttons the open claim really has,
 * and only those that need no typed input. Decline is allowed without a note; Ask and Hold need a message, so they are left to the button.
 */
export function buildUiTools(openClaim: LocalClaim | undefined, claims: LocalClaim[]): ToolSet {
  const ids = claims.map((c) => c.id) as [string, ...string[]];
  const labels = openClaim && openClaim.status === "waiting_on_noa" ? allActionsFor(openClaim).filter((s) => !s.askAmount && (!s.askMessage || s.askMessage === "decline")).map((s) => s.label) : [];

  const tools: ToolSet = {
    undoLastDecision: tool({
      description: "Undo the most recent decision, the same as the Undo button. Use when Noa asks to undo or reverse what was just done.",
      inputSchema: z.object({}),
    }),
    openClaim: tool({
      description: "Open a claim for review. Use the claim id, such as C-1019.",
      inputSchema: z.object({ claimId: z.enum(ids) }),
    }),
    showClaimsTab: tool({
      description: "Switch the claims list to one of its tabs. Use only when no claim is open.",
      inputSchema: z.object({ tab: z.enum(CLAIM_TABS) }),
    }),
  };

  if (openClaim) {
    tools.nextClaim = tool({ description: "Move to the next claim in the queue.", inputSchema: z.object({}) });
    tools.previousClaim = tool({ description: "Move to the previous claim in the queue.", inputSchema: z.object({}) });
    tools.backToClaims = tool({ description: "Leave the claim and return to the claims list. This also closes this chat.", inputSchema: z.object({}) });
    tools.openDetails = tool({
      description: "Open the Details panel on one of its tabs: overview (transaction and receipt), policy (checks run), past (the employee's other claims) or chat (messages with the employee).",
      inputSchema: z.object({ tab: z.enum(DETAIL_TABS) }),
    });
    tools.closeDetails = tool({ description: "Close the Details panel.", inputSchema: z.object({}) });
  }

  if (labels.length > 0) {
    tools.takeAction = tool({
      description:
        "Carry out one of the buttons on the open claim now. Only call it when Noa has asked for that decision or accepted your suggestion. The decision is applied at once, and Noa can undo it.",
      inputSchema: z.object({ buttonLabel: z.enum(labels as [string, ...string[]]).describe("Exact label of the button") }),
    });
  }

  return tools;
}
