"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type StepPart = { type: string; state?: string; input?: unknown; output?: unknown };

type Input = { id?: string; employee?: string; claimId?: string; buttonLabel?: string };

const LABELS: Record<string, { running: (i: Input) => string; done: (i: Input) => string }> = {
  "tool-getQueueSummary": { running: () => "Checking the queue", done: () => "Checked the queue" },
  "tool-listClaims": { running: () => "Searching claims", done: () => "Searched claims" },
  "tool-getClaim": { running: (i) => `Reading claim ${i.id ?? ""}`.trim(), done: (i) => `Read claim ${i.id ?? ""}`.trim() },
  "tool-getEmployeeHistory": { running: (i) => `Looking up ${i.employee ?? "an employee"}'s claims`, done: (i) => `Looked up ${i.employee ?? "an employee"}'s claims` },
  "tool-getPolicy": { running: () => "Reading the policy", done: () => "Read the policy" },
  "tool-openClaim": { running: (i) => `Opening claim ${i.claimId ?? ""}`.trim(), done: (i) => `Opened claim ${i.claimId ?? ""}`.trim() },
  "tool-nextClaim": { running: () => "Moving to the next claim", done: () => "Moved to the next claim" },
  "tool-previousClaim": { running: () => "Moving to the previous claim", done: () => "Moved to the previous claim" },
  "tool-backToClaims": { running: () => "Going back to claims", done: () => "Back on claims" },
  "tool-openDetails": { running: () => "Opening details", done: () => "Opened details" },
  "tool-closeDetails": { running: () => "Closing details", done: () => "Closed details" },
  "tool-showClaimsTab": { running: () => "Switching the tab", done: () => "Switched the tab" },
  "tool-takeAction": { running: (i) => `Carrying out ${i.buttonLabel ?? "the decision"}`, done: (i) => `Carried out ${i.buttonLabel ?? "the decision"}` },
  "tool-searchClaims": { running: (i) => `Searching for ${(i as { query?: string }).query ?? "claims"}`, done: (i) => `Searched for ${(i as { query?: string }).query ?? "claims"}` },
  "tool-confirmDialog": { running: () => "Sending it", done: () => "Sent it" },
  "tool-cancelDialog": { running: () => "Closing the pop-up", done: () => "Closed the pop-up" },
  "tool-clearSearch": { running: () => "Clearing the search", done: () => "Cleared the search" },
  "tool-skipAhead": { running: () => "Skipping ahead", done: (i) => `Skipped ahead ${(i as { days?: number }).days ?? 14} days` },
  "tool-removeFlag": { running: (i) => `Removing the flag on ${(i as { claimId?: string }).claimId ?? "the claim"}`, done: (i) => `Removed the flag on ${(i as { claimId?: string }).claimId ?? "the claim"}` },
  "tool-undoLastDecision": { running: () => "Undoing the decision", done: () => "Undid the decision" },
  "tool-lookAtScreen": { running: () => "Looking at the screen", done: () => "Looked at the screen" },
  "tool-pressControl": { running: (i) => `Pressing ${(i as { label?: string }).label ?? "a control"}`, done: (i) => `Pressed ${(i as { label?: string }).label ?? "a control"}` },
  "tool-typeInField": { running: () => "Typing", done: () => "Typed" },
  "tool-goToSection": { running: (i) => `Opening ${(i as { section?: string }).section ?? "the section"}`, done: (i) => `Opened ${(i as { section?: string }).section ?? "the section"}` },
  "tool-closeChat": { running: () => "Closing the chat", done: () => "Closed the chat" },
  "tool-setFilters": { running: () => "Setting the filters", done: () => "Set the filters" },
  "tool-dismissBrief": { running: () => "Dismissing the brief", done: () => "Dismissed the brief" },
  "tool-reviewAll": { running: () => "Starting the review", done: () => "Started the review" },
  "tool-selectClaims": { running: () => "Selecting claims", done: () => "Selected claims" },
  "tool-bulkAction": { running: (i) => `${(i as { action?: string }).action === "decline" ? "Declining" : "Approving"} the selected claims`, done: (i) => `${(i as { action?: string }).action === "decline" ? "Declined" : "Approved"} the selected claims` },
  "tool-toggleSection": { running: () => "Changing the group", done: () => "Changed the group" },
  "tool-changeDecision": { running: () => "Changing the decision", done: () => "Changed the decision" },
  "tool-viewDocument": { running: () => "Opening the document", done: () => "Opened the document" },
  "tool-closeDocument": { running: () => "Closing the document", done: () => "Closed the document" },
  "tool-openPastClaim": { running: (i) => `Opening past claim ${(i as { claimId?: string }).claimId ?? ""}`.trim(), done: (i) => `Opened past claim ${(i as { claimId?: string }).claimId ?? ""}`.trim() },
  "tool-closePastClaim": { running: () => "Closing the past claim", done: () => "Closed the past claim" },
  "tool-messageEmployee": { running: () => "Writing to the employee", done: (i) => ((i as { send?: boolean }).send ? "Sent the message" : "Typed the message") },
  "tool-getRecommendedAction": { running: (i) => `Checking the recommendation for ${i.id ?? "the claim"}`, done: (i) => `Checked the recommendation for ${i.id ?? "the claim"}` },
};

export const isStepDone = (p: StepPart) => p.state === "output-available" || p.state === "output-error";

export function stepLabel(p: StepPart): string {
  const l = LABELS[p.type];
  const input = (p.input ?? {}) as Input;
  if (!l) return isStepDone(p) ? "Checked the data" : "Checking the data";
  return isStepDone(p) ? l.done(input) : l.running(input);
}

/** One short line under a finished step, like the result line under a tool call in Claude Code. */
function stepResult(p: StepPart): string | null {
  if (p.state === "output-error") return "Could not be read";
  if (p.state !== "output-available") return null;
  const o = (p.output ?? {}) as Record<string, unknown>;
  if (typeof o.error === "string") return o.error;
  switch (p.type) {
    case "tool-getQueueSummary":
      return `${(o.waitingForReview as unknown[] | undefined)?.length ?? 0} waiting for review`;
    case "tool-listClaims":
      return `${o.count ?? 0} ${o.count === 1 ? "claim" : "claims"} found`;
    case "tool-getClaim":
      return [o.status, typeof o.amountUsd === "number" ? `$${o.amountUsd.toFixed(2)}` : null].filter(Boolean).join(", ");
    case "tool-getEmployeeHistory":
      return `${o.claimCount ?? 0} claims`;
    case "tool-getPolicy":
      return `${(o.rules as unknown[] | undefined)?.length ?? 0} rules`;
    case "tool-getRecommendedAction":
      return (o.recommendedButton as string | null) ?? "No recommendation";
    default:
      return null;
  }
}

/** Text with a moving highlight, used while something is in progress. */
export function Shimmer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "animate-shimmer bg-[linear-gradient(110deg,var(--color-muted-foreground)_35%,var(--color-foreground)_50%,var(--color-muted-foreground)_65%)] bg-[length:200%_100%] bg-clip-text text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return seconds;
}

/** Shown while an answer is being prepared: a pulsing mark, what is happening right now, and the time so far. */
export function WorkingIndicator({ label }: { label: string }) {
  const seconds = useElapsedSeconds();
  return (
    <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
      <Sparkles aria-hidden className="size-4 animate-pulse text-foreground" />
      <Shimmer>{label}</Shimmer>
      <span className="text-xs text-muted-foreground tabular-nums">{seconds}s</span>
    </div>
  );
}

/** The data lookups behind an answer. Open while they run, folded away afterwards, and open again on click. */
export function ToolSteps({ steps, running }: { steps: StepPart[]; running: boolean }) {
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? running;
  return (
    <Collapsible open={open} onOpenChange={setManual}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        {running ? <Shimmer>Working through {steps.length === 1 ? "1 step" : `${steps.length} steps`}</Shimmer> : <span>Checked {steps.length === 1 ? "1 thing" : `${steps.length} things`}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-1.5 ml-[7px] flex flex-col gap-1.5 border-l pl-3">
          {steps.map((s, i) => {
            const done = isStepDone(s);
            const result = stepResult(s);
            return (
              <li key={i} className="flex gap-2 text-xs">
                <span aria-hidden className="mt-px flex size-4 shrink-0 items-center justify-center">
                  {!done ? <Spinner className="size-3.5" /> : s.state === "output-error" ? <X className="size-3.5 text-destructive" /> : <Check className="size-3.5 text-success" />}
                </span>
                <div className="min-w-0">
                  {done ? <span className="text-foreground/80">{stepLabel(s)}</span> : <Shimmer>{stepLabel(s)}</Shimmer>}
                  {result ? <div className="text-muted-foreground">{result}</div> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
