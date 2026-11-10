import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { dataset } from "@/data";
import type { Status } from "@/data/types";
import { CLAIM_TABS, DATE_RANGES, DETAIL_TABS, SECTIONS } from "@/logic/assistant-tools";
import type { LocalClaim } from "@/logic/local";
import { allActionsFor } from "@/logic/recommendations";

const STATUSES = ["waiting_on_noa", "waiting_on_employee", "waiting_on_finance", "approved_by_agent", "declined_by_agent", "approved_by_noa", "declined_by_noa"] as const satisfies readonly Status[];
const TEAM = dataset.people.filter((p) => p.role === "team_member").map((p) => p.id) as [string, ...string[]];
const TEAM_HELP = dataset.people
  .filter((p) => p.role === "team_member")
  .map((p) => `${p.id} (${p.name.replace(/\s*"[^"]*"\s*/g, " ").trim()})`)
  .join(", ");

const isDecided = (c: LocalClaim) => c.status === "approved_by_agent" || c.status === "declined_by_agent" || c.status === "approved_by_noa" || c.status === "declined_by_noa";

/** Labels takeAction accepts for a claim. Claims waiting on an employee have their own two buttons. */
export function actionLabelsFor(claim: LocalClaim | undefined): string[] {
  if (!claim) return [];
  if (claim.status === "waiting_on_noa") return allActionsFor(claim).map((s) => s.label);
  if (claim.status === "waiting_on_employee") return ["Decide now", "Continue waiting"];
  return [];
}

/**
 * Builds the screen tools for one request. They have no server function: the browser runs them and sends the result back.
 * `active` is the claim the user is working on right now: the past claim window if one is open, otherwise the open claim.
 * Names, surfaces and controls are listed in src/logic/assistant-tools.ts, which `npm run audit:assistant` checks this file against.
 */
export function buildUiTools(active: LocalClaim | undefined, claims: LocalClaim[], opts: { claimOpen: boolean; pastOpen: boolean; detailsOpen: boolean }): ToolSet {
  const ids = claims.map((c) => c.id) as [string, ...string[]];
  const labels = actionLabelsFor(active);

  const tools: ToolSet = {
    goToSection: tool({
      description: "Use the sidebar. Home and Expenses go to the claims list. The other sections are not in this prototype, and the app shows a notice saying so.",
      inputSchema: z.object({ section: z.enum(SECTIONS) }),
    }),
    closeChat: tool({ description: "Close this chat panel.", inputSchema: z.object({}) }),
    resetDemo: tool({ description: "Reset the demo to the start of Monday: all decisions undone, tabs and filters back to normal. Use only when Noa asks.", inputSchema: z.object({}) }),
    setSaveErrorSimulation: tool({ description: "Turn on or off the demo setting that makes saving a decision fail, to show the error state.", inputSchema: z.object({ on: z.boolean() }) }),
    undoLastDecision: tool({
      description: "Undo the most recent decision, the same as the Undo button. Use when Noa asks to undo or reverse what was just done.",
      inputSchema: z.object({}),
    }),
    confirmDialog: tool({
      description: 'Send or confirm whatever is waiting: an open pop-up (for example the message to an employee) or a message typed into the employee chat. Use when Noa says "send it", "yes", "go ahead" or similar after you opened or typed one.',
      inputSchema: z.object({}),
    }),
    cancelDialog: tool({ description: 'Close the open pop-up without sending, or clear a message typed into the employee chat that was not sent. Use when Noa says "cancel" or "never mind".', inputSchema: z.object({}) }),
  };

  if (!opts.claimOpen) {
    tools.showClaimsTab = tool({ description: "Switch the claims list to one of its tabs.", inputSchema: z.object({ tab: z.enum(CLAIM_TABS) }) });
    tools.searchClaims = tool({ description: "Search the claims list, for example by employee, merchant or claim id.", inputSchema: z.object({ query: z.string().max(80) }) });
    tools.setFilters = tool({
      description: `Set the filters on the claims list. Only the fields you pass change. Employees use these ids: ${TEAM_HELP}. Pass an empty array to clear that filter. Statuses only apply on the All tab.`,
      inputSchema: z.object({
        dateRange: z.enum(DATE_RANGES).optional(),
        employees: z.array(z.enum(TEAM)).optional(),
        statuses: z.array(z.enum(STATUSES)).optional(),
      }),
    });
    tools.clearSearch = tool({ description: "Clear the search and every filter on the claims list.", inputSchema: z.object({}) });
    tools.dismissBrief = tool({ description: "Dismiss the brief banner at the top of the claims list.", inputSchema: z.object({}) });
    tools.reviewAll = tool({ description: "Press Review all in the brief banner: open the first claim in the queue.", inputSchema: z.object({}) });
    tools.selectClaims = tool({
      description: 'Tick rows in the claims list: all visible rows, none, the first N rows as shown (mode "first" with count), or specific claims by id.',
      inputSchema: z.object({ mode: z.enum(["all", "none", "first", "ids"]), count: z.number().int().min(1).max(50).optional(), ids: z.array(z.enum(ids)).optional() }),
    });
    tools.toggleSection = tool({ description: "Expand or collapse a group in the claims table, by its id as shown in the app (for example approved).", inputSchema: z.object({ sectionId: z.string().max(40) }) });
    tools.openClaim = tool({ description: "Open a claim for review. Use the claim id, such as C-1019.", inputSchema: z.object({ claimId: z.enum(ids) }) });
  } else {
    tools.openClaim = tool({ description: "Open a different claim for review. Use the claim id, such as C-1019.", inputSchema: z.object({ claimId: z.enum(ids) }) });
    tools.nextClaim = tool({ description: "Move to the next claim in the queue.", inputSchema: z.object({}) });
    tools.previousClaim = tool({ description: "Move to the previous claim in the queue.", inputSchema: z.object({}) });
    tools.backToClaims = tool({ description: "Leave the claim and return to the claims list. This also closes this chat.", inputSchema: z.object({}) });
    tools.openDetails = tool({
      description: "Open the Details panel on one of its tabs: overview (transaction and receipt), policy (checks run), past (the employee's other claims) or chat (messages with the employee).",
      inputSchema: z.object({ tab: z.enum(DETAIL_TABS) }),
    });
    tools.closeDetails = tool({ description: "Close the Details panel.", inputSchema: z.object({}) });
    tools.viewDocument = tool({
      description: "Open the receipt or one of the attached files (such as the card statement) in a window. Opens Details first if needed.",
      inputSchema: z.object({ which: z.enum(["receipt", "attachment"]), label: z.string().max(80).optional().describe("Part of the attachment's name, if there is more than one") }),
    });
    tools.closeDocument = tool({ description: "Close the receipt or attachment window.", inputSchema: z.object({}) });
    tools.openPastClaim = tool({ description: "Open one of the employee's other claims in a window over the review, as the Past claims tab does.", inputSchema: z.object({ claimId: z.enum(ids) }) });
    tools.messageEmployee = tool({
      description:
        'Write a message to the employee in the claim chat (Details, Chat tab). With send false, the text is typed into the message box for Noa to check and send ("send it" calls confirmDialog). With send true it is sent at once: use that only when Noa said to send it. Write the text as a short imperative with no "you", "your" or "could you".',
      inputSchema: z.object({ text: z.string().min(1).max(500), send: z.boolean() }),
    });
    if (opts.pastOpen) tools.closePastClaim = tool({ description: "Close the past claim window and return to the review.", inputSchema: z.object({}) });
  }

  if (active && labels.length > 0) {
    tools.takeAction = tool({
      description:
        "Carry out one of the buttons on the claim now: approve, decline, hold for a receipt, send to Finance, approve a different amount, or for a claim waiting on the employee Decide now or Continue waiting. Only call it when Noa has asked for that or accepted your suggestion. The decision is applied at once, and Noa can undo it. The button that asks the employee a question opens the Chat tab in Details with the question typed in for Noa to send, instead of sending at once.",
      inputSchema: z.object({
        buttonLabel: z.enum(labels as [string, ...string[]]).describe("Exact label of the button"),
        amount: z.number().positive().optional().describe('Only for "Approve a different amount": the amount in USD that Noa said. Required there.'),
        message: z
          .string()
          .max(300)
          .optional()
          .describe('For Hold, Ask and Decline: the wording Noa dictated for the employee, written as a short imperative with no "you", "your" or "could you" (for example: "Resend the card statement as a PDF."). Leave out to send the standard wording (Hold and Ask) or no note (Decline).'),
      }),
    });
  }

  if (active && isDecided(active)) {
    const now = active.status.startsWith("approved") ? "approved" : "declined";
    tools.changeDecision = tool({
      description: `Change a decision that is already made on this claim (it is ${now} now). Declining needs a reason, which is sent to the employee in the claim chat: ask Noa for it if she did not give one.`,
      inputSchema: z.object({
        decision: z.enum(["approved", "declined"]),
        reason: z.string().max(300).optional().describe('Required when declining. A short imperative with no "you" or "your".'),
        whatWentWrong: z.string().max(300).optional().describe("Optional note on what the automatic decision got wrong, recorded as feedback."),
      }),
    });
  }

  return tools;
}
