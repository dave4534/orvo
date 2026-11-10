# Assistant capabilities

The rule: **anything Noa can do with a click, a tap or typing, the assistant can do by tool.** The assistant (text chat and voice chat use the same one) works the screen through tools with no server function. The server offers only the tools that make sense on the current screen, the browser runs them, and each one reports back what really happened. The assistant may only say something is done when a tool returned ok in that turn.

The single list is `src/logic/assistant-tools.ts`. `npm run audit:assistant` checks that every entry exists in the server tools, the screen handler (`claims-view.tsx`), the step labels, the prompt and this document, and fails if a handler has no entry.

## Adding or changing a control

1. Add it to `src/logic/assistant-tools.ts`.
2. Define the tool in `src/server/ui-tools.ts` (and say when it is offered).
3. Run it in the handler in `src/features/claims/claims-view.tsx`. A control that lives inside one component registers itself with `setControl(key, handler)` (see `claim-chat.tsx`, `more-info-panel.tsx`).
4. Add a step label in `chat-steps.tsx`, mention it in `src/server/chat-prompt.ts`, and add a row below.
5. Run `npm run audit:assistant`, lint and typecheck.

## Rules every tool follows

- **Truthful results.** Return `{ ok: true }` only when the screen changed. Otherwise `{ ok: false, error }` in plain words. Never report a plan as done.
- **Waits for panels.** A tool that needs a panel (Details, the employee chat) opens it and waits for it before acting.
- **Acts on the right claim.** Decisions apply to the past claim window when one is open, otherwise to the open claim.
- **Typing is not sending.** Messages to employees are typed into the box first, and sent only after Noa says so (`confirmDialog`), unless she already said to send.
- **Decisions are undoable.** Decisions show the Undo notice and `undoLastDecision` reverses the last one.
- **Context.** Each request tells the assistant where Noa is: tab, open claim, Details tab, past claim, open document, open pop-up, unsent message, filters, selection, brief.

## Controls

| Tool | Where | Covers |
| --- | --- | --- |
| `goToSection` | Sidebar | Home, Expenses, Reports, Insights, Policies, Team, Settings, Support, and the Orvo logo |
| `closeChat` | Header | Ask Orvo AI button (closes the chat) |
| `resetDemo` | Claims list | Demo menu: Reset demo |
| `setSaveErrorSimulation` | Claims list | Demo menu: Simulate a save error |
| `showClaimsTab` | Claims list | Tabs: Needs review, Waiting on others, Done, All |
| `searchClaims` | Claims list | Search box |
| `setFilters` | Claims list | Date range, Employee and Status filters |
| `clearSearch` | Claims list | Reset button (clears the search and all filters) |
| `dismissBrief` | Claims list | Brief banner: Dismiss |
| `reviewAll` | Claims list | Brief banner: Review all |
| `selectClaims` | Claims list | Row checkboxes and the select all checkbox |
| `toggleSection` | Claims list | Collapsible groups in the table |
| `openClaim` | Claims list | Review button on a row |
| `nextClaim` | Claim page | Next |
| `previousClaim` | Claim page | Previous |
| `backToClaims` | Claim page | Back to claims |
| `takeAction` | Claim page | Every button in the action bar and More options: approve, decline, hold, ask, send to Finance, different amount, decide now, continue waiting |
| `changeDecision` | Claim page and past claim window | Changing a decision that is already made (status menu, Edit decision, Fix) |
| `confirmDialog` | Pop-ups and chat | Send or Confirm in a pop-up, and Send in the employee chat |
| `cancelDialog` | Pop-ups and chat | Cancel in a pop-up, and clearing an unsent message |
| `undoLastDecision` | Notices | Undo in the notice after a decision |
| `openDetails` | Details panel | View details and the tabs: Overview, Policy, Past claims, Chat |
| `closeDetails` | Details panel | Close (X) |
| `viewDocument` | Details panel | View on the receipt, the card statement and attachments |
| `closeDocument` | Details panel | Close on the document window |
| `openPastClaim` | Details panel | A row in Past claims |
| `closePastClaim` | Past claim window | Close on the past claim window |
| `messageEmployee` | Details panel | Chat tab: message box and Send |

## Not covered on purpose

- Choosing a different voice in the voice bar, muting and ending voice chat. These are part of the voice feature itself.
- Resizing panels, scrolling, and the theme. They change no data and have no meaning for a spoken request.
- Sections other than Home and Expenses are not in the prototype. `goToSection` shows the usual notice and reports that to the assistant.
