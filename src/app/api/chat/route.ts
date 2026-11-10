import { anthropic } from "@ai-sdk/anthropic";
import { createAgentUIStreamResponse, isStepCount, ToolLoopAgent, type UIMessage } from "ai";
import { z } from "zod";

import { dataset, NOW } from "@/data";
import { mergeOverlay, type ClaimOverlay } from "@/logic/chat-context";
import type { LocalClaim } from "@/logic/local";
import { AI_MODEL_ID } from "@/lib/ai-model";
import { checkRateLimit } from "@/lib/rate-limit";
import { STATIC_INSTRUCTIONS, uiInstructions } from "@/server/chat-prompt";
import { buildChatTools, buildSuggestActionTool } from "@/server/chat-tools";
import { isUiTool } from "@/logic/assistant-tools";
import { buildCardTools } from "@/server/chat-card-tools";
import { isCardTool } from "@/logic/chat-cards";
import { buildUiTools } from "@/server/ui-tools";

export const maxDuration = 60;

const MAX_BODY_CHARS = 250_000;
const MAX_MESSAGES = 24;
const MAX_TEXT_CHARS = 2_000;

const bodySchema = z.object({
  messages: z.array(z.object({ id: z.string().optional(), role: z.enum(["user", "assistant"]), parts: z.array(z.object({ type: z.string() }).passthrough()) })).max(80),
  context: z.object({
    ui: z.object({
      tab: z.string().max(40),
      openClaimId: z.string().max(20).nullable(),
      detailsOpen: z.boolean(),
      detailsTab: z.string().max(20),
      search: z.string().max(80),
      filters: z.string().max(300).optional().default(""),
      pastClaimId: z.string().max(20).nullable().optional().default(null),
      documentOpen: z.boolean().optional().default(false),
      dialogOpen: z.boolean().optional().default(false),
      unsentMessage: z.string().max(600).optional().default(""),
      selectedCount: z.number().optional().default(0),
      controls: z.array(z.string().max(90)).max(80).optional().default([]),
      briefVisible: z.boolean().optional().default(false),
      voice: z.boolean().optional().default(false),
      now: z.string().max(30).optional(),
    }),
    overlay: z.array(z.object({ id: z.string() }).passthrough()).max(60),
  }),
});

const json = (body: unknown, status: number, headers?: Record<string, string>) => Response.json(body, { status, headers });


/**
 * Keeps the text of earlier turns. Lookups are left out (the model asks again if it needs them). Finished screen actions are kept
 * as a short bracketed note in the assistant's message, so the model knows they happened. The original tool call is not passed on,
 * because the screen may have changed since (a decision moves on to the next claim) and it could no longer be checked against the
 * buttons of the claim that is open now. If the last thing that happened was a screen action, a notice from the app asks the model
 * to reply, since otherwise the conversation would end on the assistant's own message.
 */
function cleanMessages(messages: z.infer<typeof bodySchema>["messages"]): UIMessage[] {
  const cleaned: UIMessage[] = [];
  let lastNotice: string | null = null;
  for (const m of messages.slice(-MAX_MESSAGES)) {
    const texts: string[] = [];
    const notices: string[] = [];
    const cards: string[] = [];
    for (const p of m.parts) {
      if (p.type === "text" && typeof (p as { text?: unknown }).text === "string") {
        texts.push(((p as unknown as { text: string }).text).slice(0, MAX_TEXT_CHARS));
      } else if (p.type.startsWith("tool-") && isCardTool(p.type.slice(5)) && (p as { state?: unknown }).state === "output-available") {
        cards.push(`showed the ${p.type.slice(5).replace(/^show/, "")} card in the chat`);
      } else if (p.type.startsWith("tool-") && isUiTool(p.type.slice(5)) && (p as { state?: unknown }).state === "output-available") {
        const q = p as { input?: unknown; output?: unknown };
        notices.push(`${p.type.slice(5)} ${JSON.stringify(q.input ?? {})} finished: ${JSON.stringify(q.output ?? {})}`.slice(0, 400));
      }
    }
    const body = [texts.join("\n\n").trim(), ...notices.map((n) => `[Done on screen: ${n}]`), ...cards.map((c) => `[Done: ${c}]`)].filter(Boolean).join("\n\n");
    if (body) cleaned.push({ id: m.id ?? crypto.randomUUID(), role: m.role, parts: [{ type: "text", text: body }] });
    lastNotice = m.role === "assistant" && notices.length > 0 ? notices[notices.length - 1] : null;
  }
  // The conversation has to start with the user. Notes the app posted on its own come first, so say so.
  if (cleaned[0]?.role === "assistant") {
    cleaned.unshift({ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: "(The app opened the review and posted these notes automatically.)" }] });
  }
  if (lastNotice && cleaned.at(-1)?.role === "assistant") {
    cleaned.push({ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: `(App notice: the screen action ${lastNotice}. It is complete and the app has already updated. Reply to Noa now, as your instructions say for after this action, without looking anything up. If the app has moved on to the next claim, that is normal: do not mention it.)` }] });
  }
  return cleaned;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = checkRateLimit(ip);
  if (!limit.ok) return json({ error: "rate_limited" }, 429, { "retry-after": String(limit.retryAfterSeconds) });

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return json({ error: "too_large" }, 413);

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(JSON.parse(raw));
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const uiMessages = cleanMessages(parsed.messages);
  // Usually the last message is the user's. After a screen action it is the assistant's, carrying the tool result, which is also valid.
  if (uiMessages.length === 0) return json({ error: "bad_request" }, 400);

  const claims = mergeOverlay(dataset.claims as unknown as LocalClaim[], parsed.context.overlay as unknown as ClaimOverlay[]);
  const parsedNow = parsed.context.ui.now ? new Date(parsed.context.ui.now) : NOW;
  const now = Number.isNaN(parsedNow.getTime()) ? NOW : parsedNow;

  const openClaim = claims.find((c) => c.id === parsed.context.ui.openClaimId);
  const pastClaim = claims.find((c) => c.id === parsed.context.ui.pastClaimId);
  // Decisions go to the claim Noa is looking at: the past claim window if one is open, otherwise the open claim.
  const activeClaim = pastClaim ?? openClaim;
  const agent = new ToolLoopAgent({
    model: anthropic(AI_MODEL_ID),
    instructions: [
      { role: "system", content: STATIC_INSTRUCTIONS, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
      { role: "system", content: uiInstructions(parsed.context.ui, openClaim, pastClaim, claims, now) },
    ],
    tools: { ...buildChatTools(claims, now), ...buildSuggestActionTool(openClaim, claims, now), ...buildCardTools(claims, openClaim?.id), ...buildUiTools(activeClaim, claims, { claimOpen: Boolean(openClaim), pastOpen: Boolean(pastClaim), detailsOpen: parsed.context.ui.detailsOpen, now }) },
    stopWhen: isStepCount(6),
    maxOutputTokens: 700,
  });

  return createAgentUIStreamResponse({ agent, uiMessages, abortSignal: req.signal, timeout: 45_000 });
}
