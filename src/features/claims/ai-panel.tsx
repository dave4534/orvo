"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LocalClaim } from "@/logic/local";
import { track } from "@/logic/track";
import { replyTo, suggestedPrompts } from "@/mocks/ai-replies";
import { useWorkspace, type AiMessage } from "@/store/workspace-store";
import type { MoreTab } from "./panel-types";

type Props = {
  claim: LocalClaim | null;
  /** Label of the recommended action for the open claim. Shown as a primary button after the latest message. */
  primaryLabel?: string | null;
  onPrimary?: () => void;
  allClaims: LocalClaim[];
  onClose: () => void;
  onOpenMore: (tab: MoreTab) => void;
};

/** Friendly line for a data lookup the model made, shown above its answer. */
function lookupLabel(part: { type: string; input?: unknown }): string {
  const input = (part.input ?? {}) as { id?: string; employee?: string };
  switch (part.type) {
    case "tool-getQueueSummary":
      return "the queue";
    case "tool-listClaims":
      return "claims";
    case "tool-getClaim":
      return input.id ? `claim ${input.id}` : "a claim";
    case "tool-getEmployeeHistory":
      return input.employee ? `${input.employee}'s claims` : "an employee's claims";
    case "tool-getPolicy":
      return "the policy";
    case "tool-getRecommendedAction":
      return input.id ? `the recommendation for ${input.id}` : "the recommendation";
    default:
      return "the data";
  }
}

function MessageBubble({ m, onOpenMore }: { m: AiMessage; onOpenMore: (tab: MoreTab) => void }) {
  const text = m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n\n");
  const lookups = m.parts.filter((p) => p.type.startsWith("tool-")) as { type: string; state?: string; input?: unknown }[];
  const action = m.metadata?.action;
  if (m.role === "user") {
    return <div className="ml-8 self-end rounded-xl bg-primary px-3.5 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">{text}</div>;
  }
  if (!text && lookups.length === 0) return null;
  return (
    <div className="mr-8 flex flex-col gap-1.5">
      {lookups.length > 0 ? (
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {lookups.map((l, i) => (
            <span key={i}>
              {l.state === "output-available" ? "Checked" : "Checking"} {lookupLabel(l)}
            </span>
          ))}
        </div>
      ) : null}
      {text || action ? (
        <div className="rounded-xl border bg-info px-3.5 py-2.5 text-sm text-info-foreground">
          {m.metadata?.heading ? <div className="mb-1 text-xs font-semibold opacity-70">{m.metadata.heading}</div> : null}
          <div className="whitespace-pre-wrap">{text}</div>
          {action ? (
            <Button variant="outline" size="sm" className="mt-2 block bg-card text-foreground" onClick={() => onOpenMore(action.kind)}>
              {action.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AiPanel({ claim, allClaims, primaryLabel, onPrimary, onClose, onOpenMore }: Props) {
  const { aiMessages, aiStatus, askAi, addAiMessage, setAiFallback } = useWorkspace();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const busy = aiStatus === "submitted" || aiStatus === "streaming";

  // If the live model can't answer (no connection, limit reached), a scripted reply from the claim's data steps in.
  useEffect(() => {
    setAiFallback((prompt) => {
      const reply = replyTo(prompt, claim, allClaims);
      addAiMessage({ role: "assistant", text: reply.text, action: reply.action, heading: "Offline reply" });
    });
    return () => setAiFallback(null);
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [aiMessages, aiStatus, primaryLabel]);

  function ask(prompt: string) {
    const text = prompt.trim();
    if (!text || busy) return;
    track("ai_prompt_sent", { claim: claim?.id ?? null });
    setDraft("");
    askAi(text);
  }

  return (
    <aside aria-label="Ask Orvo AI" className="flex h-full min-h-0 w-full flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles aria-hidden className="size-4 text-primary" />
          Ask Orvo AI
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close Ask Orvo AI" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5" aria-live="polite">
        {aiMessages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Ask me anything about the claims, the history behind them, the policy, or how the product works. I read the data and never change anything from here.</p>
            <div className="flex flex-col items-start gap-2">
              {suggestedPrompts(claim).map((p) => (
                <Button key={p} variant="outline" size="sm" onClick={() => ask(p)}>
                  {p}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          aiMessages.map((m) => <MessageBubble key={m.id} m={m} onOpenMore={onOpenMore} />)
        )}
        {aiStatus === "submitted" ? <p className="text-sm text-muted-foreground">Thinking.</p> : null}
        {primaryLabel && onPrimary && !busy ? (
          <Button size="lg" className="h-11 w-full bg-success text-success-foreground hover:bg-success/90" onClick={onPrimary}>
            {primaryLabel}
          </Button>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-2 border-t p-4"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <Input aria-label="Message to Ask Orvo AI" placeholder="Ask about claims, history or policy" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim() || busy}>
          <Send />
        </Button>
      </form>
    </aside>
  );
}
