/** Cards the assistant can show inside the chat. Each is a server tool whose result says which claim to draw it for. The chat draws them. */
export const CARD_TOOLS = ["showTransaction", "showDocument", "showPolicyBreakdown", "showMessageCard"] as const;
export type CardTool = (typeof CARD_TOOLS)[number];
export const isCardTool = (name: string): name is CardTool => (CARD_TOOLS as readonly string[]).includes(name);
