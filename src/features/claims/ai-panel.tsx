"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, Command, Copy, CornerDownLeft, RotateCcw, Sparkles, X } from "lucide-react";
import { AutoAwesome } from "@/components/icons/auto-awesome";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isWaitOver, type LocalClaim } from "@/logic/local";
import { track } from "@/logic/track";
import { allActionsFor } from "@/logic/recommendations";
import { replyTo, suggestedPrompts } from "@/mocks/ai-replies";
import { isUndoable, undoDecision, useClaims } from "@/store/claims-store";
import { useWorkspace, type AiMessage } from "@/store/workspace-store";
import { isCardTool } from "@/logic/chat-cards";
import { cardsOf, ChatCard, TriageCard } from "./chat-cards";
import { ChatComposer } from "./chat-composer";
import { ChatMarkdown } from "./chat-markdown";
import { VoiceBar } from "./voice-chat";
import { isStepDone, stepLabel, ToolSteps, WorkingIndicator, type StepPart } from "./chat-steps";
import type { MoreTab } from "./panel-types";

type Props = {
  claim: LocalClaim | null;
  allClaims: LocalClaim[];
  onClose: () => void;
  onOpenMore: (tab: MoreTab) => void;
};

const textOf = (m: AiMessage) =>
  m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n\n");
const stepsOf = (m: AiMessage) => m.parts.filter((p) => p.type.startsWith("tool-") && p.type !== "tool-suggestAction" && !isCardTool(p.type.slice(5))) as StepPart[];

/** The action the model suggested in this message, if any. */
function suggestionOf(m: AiMessage): { claimId: string; label: string } | null {
  const part = m.parts.find((p) => p.type === "tool-suggestAction") as { input?: { claimId?: string; buttonLabel?: string } } | undefined;
  return part?.input?.claimId && part.input.buttonLabel ? { claimId: part.input.claimId, label: part.input.buttonLabel } : null;
}

/** The default small outline button under a message that suggests an action. It runs the same action as the one in the action bar. */
/** Claude's shortcut hint: keys in a subtle outline with a transparent background, 4px apart. */
export const ShortcutKeys = () => (
  <span aria-hidden className="inline-flex items-center gap-1">
    <Kbd className="h-5 min-w-5 rounded-md border border-current/25 bg-transparent text-current opacity-70">
      <Command />
    </Kbd>
    <Kbd className="h-5 min-w-5 rounded-md border border-current/25 bg-transparent text-current opacity-70">
      <CornerDownLeft />
    </Kbd>
  </span>
);

/** The default small outline button under a message that suggests an action. Cmd+Enter runs the latest one, shown with its keys. */
function SuggestedAction({ label, onAct, shortcut = false }: { label: string; onAct: (label: string) => void; shortcut?: boolean }) {
  return (
    <Button variant="outline" size="sm" className="gap-2 self-start" onClick={() => onAct(label)}>
      {label}
      {shortcut ? <ShortcutKeys /> : null}
    </Button>
  );
}

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

function Message({ m, isLast, busy, canAct, onAct, onOpenMore, onRetry, shortcutLabel }: { m: AiMessage; isLast: boolean; busy: boolean; canAct: (claimId: string, label: string) => boolean; onAct: (label: string) => void; onOpenMore: (tab: MoreTab) => void; onRetry: () => void; shortcutLabel: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = textOf(m);
  const steps = stepsOf(m);
  const action = m.metadata?.action;
  const undo = m.metadata?.undo;
  // Re-renders when a decision is undone, so the button can say so.
  useClaims();
  const enter = "animate-in fade-in-0 slide-in-from-bottom-1 duration-200";

  if (m.role === "user") {
    return <div className={`${enter} ml-8 max-w-[85%] self-end rounded-2xl bg-muted px-3.5 py-2 text-sm whitespace-pre-wrap`}>{text}</div>;
  }

  // Notes the app posts on its own (claim summary and recommendation, offline reply). Plain text like every other answer.
  if (m.metadata?.note) {
    const noteSuggest = m.metadata.suggest && m.metadata.claimId && canAct(m.metadata.claimId, m.metadata.suggest) ? m.metadata.suggest : null;
    if (m.metadata.triage && m.metadata.claimId) {
      return (
        <div className={`${enter} flex flex-col`}>
          <TriageCard claimId={m.metadata.claimId} text={text}>
            {noteSuggest ? <SuggestedAction label={noteSuggest} onAct={onAct} shortcut={shortcutLabel === noteSuggest} /> : null}
          </TriageCard>
        </div>
      );
    }
    return (
      <div className={`${enter} flex flex-col gap-2 text-sm leading-relaxed`}>
        {m.metadata.heading ? <div className="text-xs text-muted-foreground">{m.metadata.heading}</div> : null}
        <ChatMarkdown>{text}</ChatMarkdown>
        {noteSuggest ? <SuggestedAction label={noteSuggest} onAct={onAct} shortcut={shortcutLabel === noteSuggest} /> : null}
        {undo ? (
          <Button variant="outline" size="sm" className="self-start" disabled={!isUndoable(undo.entryId)} onClick={() => undoDecision(undo.entryId)}>
            {isUndoable(undo.entryId) ? "Undo" : "Undone"}
          </Button>
        ) : null}
        {action ? (
          <Button variant="outline" size="sm" className="self-start" onClick={() => onOpenMore(action.kind)}>
            {action.label}
          </Button>
        ) : null}
      </div>
    );
  }

  const suggestion = suggestionOf(m);
  const cards = cardsOf(m.parts);
  if (!text && steps.length === 0 && !suggestion && cards.length === 0) return null;
  const stepsRunning = isLast && busy && steps.some((s) => !isStepDone(s));
  const finished = !(isLast && busy);
  return (
    <div className={`${enter} flex flex-col gap-2 text-sm leading-relaxed`}>
      {steps.length > 0 ? <ToolSteps steps={steps} running={stepsRunning} /> : null}
      {text ? <ChatMarkdown>{text}</ChatMarkdown> : null}
      {cards.map((c, i) => (
        <ChatCard key={i} tool={c.tool} output={c.output} />
      ))}
      {suggestion && finished && canAct(suggestion.claimId, suggestion.label) ? <SuggestedAction label={suggestion.label} onAct={onAct} shortcut={shortcutLabel === suggestion.label} /> : null}
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

export function AiPanel({ claim, allClaims, onClose, onOpenMore }: Props) {
  const { aiMessages, aiStatus, askAi, stopAi, regenerateAi, addAiMessage, setAiFallback, runAction, voiceOpen, setVoiceOpen } = useWorkspace();
  const { now } = useClaims();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const busy = aiStatus === "submitted" || aiStatus === "streaming";
  const last = aiMessages[aiMessages.length - 1];

  // A suggested action only shows while that claim is open and still waiting for review.
  const availableLabels = claim && (claim.status === "waiting_on_noa" || isWaitOver(claim, now)) ? allActionsFor(claim, allClaims, now).map((s) => s.label) : [];
  const canAct = (claimId: string, label: string) => claim?.id === claimId && availableLabels.includes(label);

  // Cmd+Enter (Ctrl+Enter elsewhere) runs the suggested action of the latest answer, the one shown with its keys. It stays out of the way
  // while a dialog is open, and while typing a message that has text in it.
  const latestSuggestion = (() => {
    const m = aiMessages[aiMessages.length - 1];
    if (!m || m.role !== "assistant") return null;
    if (m.metadata?.note) return m.metadata.suggest && m.metadata.claimId && canAct(m.metadata.claimId, m.metadata.suggest) ? m.metadata.suggest : null;
    const s = suggestionOf(m);
    return s && !busy && canAct(s.claimId, s.label) ? s.label : null;
  })();
  useEffect(() => {
    if (!latestSuggestion) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      const typing = t?.closest("input,textarea,select,[contenteditable=true]");
      if (typing && (t as HTMLTextAreaElement).value?.trim()) return;
      if (document.querySelector("[role=dialog],[role=alertdialog]")) return;
      e.preventDefault();
      runAction(latestSuggestion, { interactive: true });
    };
    // Capture phase, so this runs before the bottom bar's handler and can mark the event as handled.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [latestSuggestion, runAction]);

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
  }, [aiMessages, aiStatus, atBottom]);

  function send(text: string) {
    track("ai_prompt_sent", { claim: claim?.id ?? null });
    setAtBottom(true);
    askAi(text);
  }

  return (
    <aside aria-label="Ask Orvo AI" className="relative flex h-full min-h-0 w-full flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <AutoAwesome className="size-4 text-foreground" />
          Ask Orvo AI
        </h2>
        <div className="flex items-center gap-1">
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
              <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-info text-foreground">
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
            aiMessages.map((m) => <Message key={m.id} m={m} isLast={m === last} busy={busy} canAct={canAct} onAct={(label) => runAction(label, { interactive: true })} onOpenMore={onOpenMore} onRetry={regenerateAi} shortcutLabel={latestSuggestion} />)
          )}
          {busy ? <WorkingIndicator label={workingLabel(last)} /> : null}
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

      {voiceOpen ? (
        <VoiceBar busy={busy} onAsk={send} onStopAnswer={stopAi} onEnd={() => setVoiceOpen(false)} />
      ) : (
        <ChatComposer busy={busy} onSend={send} onStop={stopAi} onVoiceChat={() => setVoiceOpen(true)} />
      )}

    </aside>
  );
}
