"use client";

import { useState } from "react";
import { Send, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { employeeName } from "@/logic/comparison";
import type { LocalClaim } from "@/logic/local";
import { track } from "@/logic/track";
import { replyTo, suggestedPrompts } from "@/mocks/ai-replies";
import { useWorkspace } from "@/store/workspace-store";
import type { MoreTab } from "./panel-types";

type Props = {
  claim: LocalClaim | null;
  allClaims: LocalClaim[];
  onClose: () => void;
  onOpenMore: (tab: MoreTab) => void;
};

export function AiPanel({ claim, allClaims, onClose, onOpenMore }: Props) {
  const { aiMessages, addAiMessage } = useWorkspace();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);

  function ask(prompt: string) {
    const text = prompt.trim();
    if (!text || thinking) return;
    track("ai_prompt_sent", { claim: claim?.id ?? null });
    addAiMessage({ role: "user", text });
    setDraft("");
    setThinking(true);
    const reply = replyTo(text, claim, allClaims);
    window.setTimeout(() => {
      addAiMessage({ role: "orvo", text: reply.text, action: reply.action });
      setThinking(false);
    }, 500);
  }

  return (
    <aside aria-label="Ask Orvo AI" className="flex h-full min-h-0 w-[min(25rem,100vw)] shrink flex-col border-l bg-card">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles aria-hidden className="size-4 text-primary" />
          Ask Orvo AI
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close Ask Orvo AI" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="border-b px-5 py-2.5 text-xs text-muted-foreground">
        About:{" "}
        <Badge variant="outline" className="ml-1 bg-card text-foreground">
          {claim ? `${claim.id}, ${employeeName(claim)}` : "All claims"}
        </Badge>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5" aria-live="polite">
        {aiMessages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              I can answer from the claim&apos;s own data. I won&apos;t change anything from here.
            </p>
            <div className="flex flex-col items-start gap-2">
              {suggestedPrompts(claim).map((p) => (
                <Button key={p} variant="outline" size="sm" onClick={() => ask(p)}>
                  {p}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          aiMessages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "ml-8 self-end rounded-xl bg-primary px-3.5 py-2.5 text-sm text-primary-foreground" : "mr-8 rounded-xl border bg-info px-3.5 py-2.5 text-sm text-info-foreground"}>
              {m.text}
              {m.action ? (
                <Button variant="outline" size="sm" className="mt-2 block bg-card text-foreground" onClick={() => onOpenMore(m.action!.kind)}>
                  {m.action.label}
                </Button>
              ) : null}
            </div>
          ))
        )}
        {thinking ? <p className="text-sm text-muted-foreground">Checking the claim.</p> : null}
      </div>

      <form
        className="flex gap-2 border-t p-4"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <Input aria-label="Message to Ask Orvo AI" placeholder="Ask about this claim" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim() || thinking}>
          <Send />
        </Button>
      </form>
    </aside>
  );
}
