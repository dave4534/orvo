/**
 * The one list of everything the assistant can do on the screen. Every control in the product has an entry here, and the server tools
 * (src/server/ui-tools.ts), the browser runner (src/features/claims/assistant-tools.ts), the step labels (chat-steps.tsx) and the
 * capability doc (docs/assistant-capabilities.md) are all checked against it by `npm run audit:assistant`.
 *
 * Rule: when a control is added to the product, add a tool for it here and implement it in the places above, in the same change.
 */
export const UI_TOOLS = [
  // App shell
  { name: "goToSection", surface: "Sidebar", control: "Home, Expenses, Reports, Insights, Policies, Team, Settings, Support, and the Orvo logo" },
  { name: "closeChat", surface: "Header", control: "Ask Orvo AI button (closes the chat)" },
  // Claims list
  { name: "showClaimsTab", surface: "Claims list", control: "Tabs: Needs review, Waiting on others, Done, All" },
  { name: "searchClaims", surface: "Claims list", control: "Search box" },
  { name: "setFilters", surface: "Claims list", control: "Date range, Employee and Status filters" },
  { name: "clearSearch", surface: "Claims list", control: "Reset button (clears the search and all filters)" },
  { name: "dismissBrief", surface: "Claims list", control: "Brief banner: Dismiss" },
  { name: "reviewAll", surface: "Claims list", control: "Brief banner: Review all" },
  { name: "selectClaims", surface: "Claims list", control: "Row checkboxes and the select all checkbox" },
  { name: "bulkAction", surface: "Claims list", control: "Bulk Approve and Decline buttons beside the filters, shown when two or more claims are selected" },
  { name: "skipAhead", surface: "Claims list", control: "Skip ahead 14 days button beside the filters on Waiting on others (demo clock: waits end and their claims return to Needs review)" },
  { name: "toggleSection", surface: "Claims list", control: "Collapsible groups in the table" },
  { name: "openClaim", surface: "Claims list", control: "Review button on a row" },
  // Claim page
  { name: "nextClaim", surface: "Claim page", control: "Next" },
  { name: "previousClaim", surface: "Claim page", control: "Previous" },
  { name: "backToClaims", surface: "Claim page", control: "Back to claims" },
  { name: "takeAction", surface: "Claim page", control: "Every button in the action bar and More options: approve, decline, wait for receipt, ask, send to Finance, different amount, decide now, continue waiting" },
  { name: "changeDecision", surface: "Claim page and past claim window", control: "Changing a decision that is already made (status menu, Edit decision, Fix)" },
  { name: "confirmDialog", surface: "Pop-ups and chat", control: "Send or Confirm in a pop-up, and Send in the employee chat" },
  { name: "cancelDialog", surface: "Pop-ups and chat", control: "Cancel in a pop-up, and clearing an unsent message" },
  { name: "undoLastDecision", surface: "Notices", control: "Undo in the notice after a decision" },
  // Details
  { name: "openDetails", surface: "Details panel", control: "View details and the tabs: Overview, Policy, Past claims, Chat" },
  { name: "closeDetails", surface: "Details panel", control: "Close (X)" },
  { name: "viewDocument", surface: "Details panel", control: "View on the receipt, the card statement and attachments" },
  { name: "closeDocument", surface: "Details panel", control: "Close on the document window" },
  { name: "openPastClaim", surface: "Details panel", control: "A row in Past claims" },
  { name: "closePastClaim", surface: "Past claim window", control: "Close on the past claim window" },
  // Anywhere: the general hands. They reach anything on screen the specific tools do not name.
  { name: "lookAtScreen", surface: "Anywhere", control: "Reading what is on screen: open dialogs and every visible control" },
  { name: "pressControl", surface: "Anywhere", control: "Any visible button, menu item, tab, checkbox, radio, option or link, by its label (for example More options, a filter, the steps of a dialog)" },
  { name: "typeInField", surface: "Anywhere", control: "Any visible text field, by its label" },
  { name: "messageEmployee", surface: "Details panel", control: "Chat tab: message box and Send" },
] as const;

export type UiToolName = (typeof UI_TOOLS)[number]["name"];
export const UI_TOOL_NAMES: readonly UiToolName[] = UI_TOOLS.map((t) => t.name);
export const isUiTool = (name: string): name is UiToolName => (UI_TOOL_NAMES as readonly string[]).includes(name);

export const CLAIM_TABS = ["needs_review", "waiting", "done", "all"] as const;
export const DETAIL_TABS = ["overview", "policy", "past", "chat"] as const;
export const SECTIONS = ["Home", "Expenses", "Reports", "Insights", "Policies", "Team", "Settings", "Support"] as const;
export const DATE_RANGES = ["this_week", "last_3_days", "last_24_hours"] as const;
