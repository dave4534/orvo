import { anthropic } from "@ai-sdk/anthropic";
import { createAgentUIStreamResponse, isStepCount, ToolLoopAgent, type UIMessage } from "ai";
import { z } from "zod";

import { dataset } from "@/data";
import { mergeOverlay, type ClaimOverlay } from "@/logic/chat-context";
import type { LocalClaim } from "@/logic/local";
import { checkRateLimit } from "@/lib/rate-limit";
import { STATIC_INSTRUCTIONS, uiInstructions } from "@/server/chat-prompt";
import { buildChatTools, buildSuggestActionTool } from "@/server/chat-tools";

export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
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
    }),
    overlay: z.array(z.object({ id: z.string() }).passthrough()).max(60),
  }),
});

const json = (body: unknown, status: number, headers?: Record<string, string>) => Response.json(body, { status, headers });

/** Keeps only plain text from earlier turns, so the model looks facts up again and nothing forged can pass as a tool result. */
function cleanMessages(messages: z.infer<typeof bodySchema>["messages"]): UIMessage[] {
  const cleaned: UIMessage[] = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    const text = m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof (p as { text?: unknown }).text === "string")
      .map((p) => p.text.slice(0, MAX_TEXT_CHARS))
      .join("\n\n")
      .trim();
    if (text) cleaned.push({ id: m.id ?? crypto.randomUUID(), role: m.role, parts: [{ type: "text", text }] });
  }
  // The conversation has to start with the user. Notes the app posted on its own come first, so say so.
  if (cleaned[0]?.role === "assistant") {
    cleaned.unshift({ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: "(The app opened the review and posted these notes automatically.)" }] });
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
  if (uiMessages.at(-1)?.role !== "user") return json({ error: "bad_request" }, 400);

  const claims = mergeOverlay(dataset.claims as unknown as LocalClaim[], parsed.context.overlay as unknown as ClaimOverlay[]);

  const openClaim = claims.find((c) => c.id === parsed.context.ui.openClaimId);
  const agent = new ToolLoopAgent({
    model: anthropic(MODEL),
    instructions: [
      { role: "system", content: STATIC_INSTRUCTIONS, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
      { role: "system", content: uiInstructions(parsed.context.ui, openClaim) },
    ],
    tools: { ...buildChatTools(claims), ...buildSuggestActionTool(openClaim) },
    stopWhen: isStepCount(6),
    maxOutputTokens: 700,
  });

  return createAgentUIStreamResponse({ agent, uiMessages, abortSignal: req.signal, timeout: 45_000 });
}
