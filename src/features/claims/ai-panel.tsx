"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, Copy, RotateCcw, Sparkles, SquarePen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LocalClaim } from "@/logic/local";
import { track } from "@/logic/track";
import { replyTo, suggestedPrompts } from "@/mocks/ai-replies";
import { useWorkspace, type AiMessage } from "@/store/workspace-store";
import { ChatComposer } from "./chat-composer";
import { ChatMarkdown } from "./chat-markdown";
import { isStepDone, stepLabel, ToolSteps, WorkingIndicator, type StepPart } from "./chat-steps";
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

const textOf = (m: AiMessage) =>
  m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n\n");
const stepsOf = (m: AiMessage) => m.parts.filter((p) => p.type.startsWith("tool-")) as StepPart[];

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon-xs" aria-label={label} onClick={onClick}>
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** What the model is doing right now, for the working indicator. */
function workingLabel(last: AiMessage | undefined): string {
  if (!last || last.role !== "assistant" || last.metadata?.note) return "Thinking";
  const running = stepsOf(last).filter((s) => !isStepDone(s));
  if (running.length > 0) return stepLabel(running[running.length - 1]);
  return textOf(last) ? "Writing" : "Thinking";
}

function Message({ m, isLast, busy, onOpenMore, onRetry }: { m: AiMessage; isLast: boolean; busy: boolean; onOpenMore: (tab: MoreTab) => void; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = textOf(m);
  const steps = stepsOf(m);
  const action = m.metadata?.action;
  const enter = "animate-in fade-in-0 slide-in-from-bottom-1 duration-200";

  if (m.role === "user") {
    return <div className={`${enter} ml-8 max-w-[85%] self-end rounded-2xl bg-muted px-3.5 py-2 text-sm whitespace-pre-wrap`}>{text}</div>;
  }

  // Notes the app posts on its own (claim summary, recommendation, offline reply).
  if (m.metadata?.note) {
    return (
      <div className={`${enter} rounded-xl border border-info-border bg-info px-3.5 py-2.5 text-sm text-info-foreground`}>
        {m.metadata.heading ? <div className="mb-1 text-xs font-semibold opacity-70">{m.metadata.heading}</div> : null}
        <div className="whitespace-pre-wrap">{text}</div>
        {action ? (
          <Button variant="outline" size="sm" className="mt-2 bg-card text-foreground" onClick={() => onOpenMore(action.kind)}>
            {action.label}
          </Button>
        ) : null}
      </div>
    );
  }

  if (!text && steps.length === 0) return null;
  const stepsRunning = isLast && busy && steps.some((s) => !isStepDone(s));
  const finished = !(isLast && busy);
  return (
    <div className={`${enter} flex flex-col gap-2 text-sm leading-relaxed`}>
      {steps.length > 0 ? <ToolSteps steps={steps} running={stepsRunning} /> : null}
      {text ? <ChatMarkdown>{text}</ChatMarkdown> : null}
      {text && finished ? (
        <div className="-ml-1.5 flex items-center gap-0.5 text-muted-foreground">
          <IconAction
            label={copied ? "Copied" : "Copy"}
            onClick={() => {
              void navigator.clipboard?.writeText(text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check /> : <Copy />}
          </IconAction>
          {isLast ? (
            <IconAction label="Try again" onClick={onRetry}>
              <RotateCcw />
            </IconAction>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AiPanel({ claim, allClaims, primaryLabel, onPrimary, onClose, onOpenMore }: Props) {
  const { aiMessages, aiStatus, askAi, stopAi, regenerateAi, resetAi, addAiMessage, setAiFallback } = useWorkspace();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const busy = aiStatus === "submitted" || aiStatus === "streaming";
  const last = aiMessages[aiMessages.length - 1];

  // If the live model can't answer (no connection, limit reached), a scripted reply from the claim's data steps in.
  useEffect(() => {
    setAiFallback((prompt) => {
      const reply = replyTo(prompt, claim, allClaims);
      addAiMessage({ role: "assistant", text: reply.text, action: reply.action, heading: "Offline reply" });
    });
    return () => setAiFallback(null);
  });

  // Stay at the bottom while the answer grows, unless the reader scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [aiMessages, aiStatus, primaryLabel, atBottom]);

  function send(text: string) {
    track("ai_prompt_sent", { claim: claim?.id ?? null });
    setAtBottom(true);
    askAi(text);
  }

  return (
    <aside aria-label="Ask Orvo AI" className="flex h-full min-h-0 w-full flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles aria-hidden className="size-4 text-primary" />
          Ask Orvo AI
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={aiMessages.length === 0} onClick={resetAi}>
            <SquarePen data-icon="inline-start" />
            New chat
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close Ask Orvo AI" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
          }}
          className="flex h-full flex-col gap-4 overflow-y-auto p-4"
          aria-live="polite"
        >
          {aiMessages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-info text-primary">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="text-base font-semibold">How can I help?</p>
                <p className="mt-1 text-sm text-muted-foreground">Ask about the claims, the history behind them, the policy, or how the product works.</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                {suggestedPrompts(claim).map((p) => (
                  <Button key={p} variant="outline" size="sm" onClick={() => send(p)}>
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            aiMessages.map((m) => <Message key={m.id} m={m} isLast={m === last} busy={busy} onOpenMore={onOpenMore} onRetry={regenerateAi} />)
          )}
          {busy ? <WorkingIndicator label={workingLabel(last)} /> : null}
          {primaryLabel && onPrimary && !busy ? (
            <Button size="lg" className="h-11 w-full bg-success text-success-foreground hover:bg-success/90" onClick={onPrimary}>
              {primaryLabel}
            </Button>
          ) : null}
        </div>
        {!atBottom && aiMessages.length > 0 ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Scroll to latest"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card shadow-md"
            onClick={() => setAtBottom(true)}
          >
            <ArrowDown />
          </Button>
        ) : null}
      </div>

      <ChatComposer busy={busy} onSend={send} onStop={stopAi} />
    </aside>
  );
}
