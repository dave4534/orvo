/** Cards the assistant can show inside the chat. Each is a server tool whose result says which claim to draw it for. The chat draws them. */
export const CARD_TOOLS = ["showTransaction", "showDocument", "showPolicyBreakdown"] as const;
export type CardTool = (typeof CARD_TOOLS)[number];
export const isCardTool = (name: string): name is CardTool => (CARD_TOOLS as readonly string[]).includes(name);

/** A message sent to an employee is also shown as a card, drawn from the screen tool's own result once it succeeded. */
export type CardKind = CardTool | "messageEmployee";
