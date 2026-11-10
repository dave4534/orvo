"use client";

import { Kbd } from "@/components/ui/kbd";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Ban, Check, ChevronDown, Command, CornerDownLeft, CircleDollarSign, Clock, Info, Landmark, ListChecks, MessageSquare, Pencil, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";

import { StatusBanner } from "@/components/status-banner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dataset, NOW } from "@/data";
import type { Status } from "@/data/types";
import { actionPreview, firstName, type ActionId, type ActionInput } from "@/logic/actions";
import { buildComparison, employeeName } from "@/logic/comparison";
import { claimStatusLabel, formatUsd, initials } from "@/logic/format";
import { daysOverTarget, formatDuration, isOpen, WAIT_TARGET_DAYS, waitingFor } from "@/logic/wait";
import { isAgentDecided, isSpotCheck, isWaitOver, type LocalClaim } from "@/logic/local";
import { allActionsFor, moreOptionsFor, recommendationFor, type ActionSpec } from "@/logic/recommendations";
import { photoFor } from "@/logic/photos";
import { track } from "@/logic/track";
import { cn } from "@/lib/utils";
import { useClaims } from "@/store/claims-store";
import { useWorkspace } from "@/store/workspace-store";
import { ActionDialog, defaultMessage } from "./action-dialog";
import { ComparisonView } from "./comparison-view";
import { FixDialog } from "./fix-dialog";
import type { MoreTab } from "./panel-types";

export type TriagePosition = { index: number; total: number; noun: string };

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  /** Show the next claims peeking behind the card. */
  stacked: boolean;
  /** Leave out to hide "View details" (for example inside the past claim modal). */
  onOpenDetails?: () => void;
  /** Leave out to hide "See how the decision was made". */
  onOpenMore?: (tab?: MoreTab) => void;
  /** Wide spacing around the card stack. Off inside the past claim modal. */
  padded?: boolean;
  /** No card surface and an editable decision: the past claim modal. The status bar becomes a dropdown and Save replaces "Edit decision". */
  flat?: boolean;
  /** Registers the actions so a button in the AI chat can run one. */
  primary?: boolean;
  onDecided: (claimId: string, status: Status, action: ActionId) => void;
  onReopen: (claimId: string) => void;
  /** Continue waiting on the employee: moves on to the next claim. */
  onContinue?: () => void;
};

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const ACTION_ICON: Partial<Record<ActionId, LucideIcon>> = {
  approve: Check,
  approve_amount: CircleDollarSign,
  exception: Check,
  decline: Ban,
  ask: MessageSquare,
  wait: Clock,
  to_finance: Landmark,
  to_finance_both: Landmark,
  extend_wait: Clock,
  correct: Pencil,
};

type Outcome = "keep" | "approved" | "declined";

const formatDay = (ts: string) => dayFormat.format(new Date(ts)).replace(",", "");

/** For a decided claim, the menu actions are corrections of that decision. */
function retarget(spec: ActionSpec, claim: LocalClaim): ActionSpec {
  const decided = isAgentDecided(claim) || claim.status === "approved_by_noa" || claim.status === "declined_by_noa";
  if (!decided) return spec;
  if (spec.id === "approve_amount" || spec.id === "approve" || spec.id === "exception") {
    return { ...spec, input: { ...spec.input, id: "correct", to: "approved", feedback: null } };
  }
  if (spec.id === "ask") return { ...spec, input: { ...spec.input, id: "correct", to: "ask", feedback: null } };
  if (spec.id === "decline") return { ...spec, input: { ...spec.input, id: "correct", to: "declined", feedback: null } };
  return spec;
}

/** Triage column of the claims queue: the claim, its comparison and the decision actions (actions stay pinned at the bottom). */
export function TriagePanel({ claim, allClaims, stacked, onOpenDetails, onOpenMore, padded = true, flat = false, primary = true, onDecided, onReopen, onContinue }: Props) {
  const { perform, sendMessage, now } = useClaims();
  const { setActionRunner, setDialogControl, setAskDraft } = useWorkspace();
  const [pending, setPending] = useState<ActionSpec | null>(null);
  /** Wording to start the pop-up with, when it was opened from the chat. */
  const [pendingMessage, setPendingMessage] = useState<string | undefined>(undefined);
  const dialogSubmit = useRef<(() => boolean) | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [error, setError] = useState<ActionInput | null>(null);
  const [choice, setChoice] = useState<Outcome>("keep");
  /** Required for a decline. It is sent to the employee in chat after the update. */
  const [reason, setReason] = useState("");

  const comparison = useMemo(() => buildComparison(claim, allClaims), [claim, allClaims]);
  const name = firstName(claim);
  const full = employeeName(claim);
  const claimed = claim.amount.usd_claimed;
  const category = dataset.enums.category[claim.category];
  // A claim whose wait ended is back in the queue and gets the same decision buttons as one the agent escalated.
  const waitedOut = isWaitOver(claim, now);
  const needsReview = claim.status === "waiting_on_noa" || waitedOut;
  const agentDecided = isAgentDecided(claim);
  const decidedByNoa = claim.status === "approved_by_noa" || claim.status === "declined_by_noa";
  const spot = isSpotCheck(claim) && !claim.local?.spot_checked && claim.status === "approved_by_agent";
  const rec = needsReview ? recommendationFor(claim, allClaims, now) : null;
  const wait = claim.local?.wait;

  function run(input: ActionInput): boolean {
    const result = perform(claim.id, input, { onUndo: onReopen, silent: input.id === "confirm" });
    if (!result.ok) {
      setError(input);
      return false;
    }
    setError(null);
    setPending(null);
    setFixOpen(false);
    onDecided(claim.id, result.status, input.id);
    return true;
  }

  // Always the latest run, since the question is sent later from the Chat tab.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  // Ask a question does not open a pop-up. It switches Details to the Chat tab with the wording typed in, and Send there asks it.
  const asksInChat = !flat && Boolean(onOpenMore);
  function openAsk(target: ActionSpec, spec: ActionSpec, message?: string) {
    setAskDraft({ claimId: claim.id, text: message || defaultMessage(spec, claim), send: (text) => runRef.current({ ...target.input, message: text.trim() }) });
    onOpenMore?.("chat");
  }

  function choose(spec: ActionSpec) {
    const target = retarget(spec, claim);
    if (asksInChat && spec.askMessage === "ask") {
      openAsk(target, spec);
      return;
    }
    track("action_chosen", { claim: claim.id, action: target.id, recommended: rec?.recommended?.label === spec.label });
    if (target.confirm) {
      setPendingMessage(undefined);
      setPending(target);
    } else run(target.input);
  }

  // Command+Enter (Control+Enter elsewhere) takes the recommended action, like the shortcut hint on the button. It stays out of the way
  // while typing in a field and while a dialog is open.
  useEffect(() => {
    if (!primary || !needsReview || !rec?.recommended) return;
    const spec = rec.recommended;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input,textarea,select,[contenteditable=true]") || document.querySelector("[role=dialog],[role=alertdialog]")) return;
      e.preventDefault();
      choose(spec);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!primary) return;
    // The AI chat runs a button by its label. Decisions are carried out at once; the toast offers Undo.
    setActionRunner(
      needsReview
        ? (label, extra) => {
            const spec = allActionsFor(claim, allClaims, now).find((s) => s.label === label);
            if (!spec) return { ok: false, error: "That button is not available." };
            const target = retarget(spec, claim);
            // Asking the employee a question opens the message pop-up with the wording filled in, so it can be read and sent or cancelled.
            if (spec.askMessage === "ask") {
              if (asksInChat) {
                openAsk(target, spec, extra?.message?.trim());
                return { ok: true, note: `The Chat tab is open with the question to ${name} typed in. It is not sent yet. Noa can say "send it" to send it or "cancel" to clear it.` };
              }
              setPendingMessage(extra?.message?.trim() || undefined);
              setPending(target);
              return { ok: true, note: `The message to ${name} is open for Noa to check. She can say "send it" to send it or "cancel" to close it.` };
            }
            let input = target.input;
            if (spec.askAmount) {
              const amount = extra?.amount;
              if (typeof amount !== "number" || !(amount > 0)) {
                // A click with no amount opens the dialog to ask for it. A spoken command has to say the amount.
                if (extra?.interactive) {
                  choose(spec);
                  return { ok: true };
                }
                return { ok: false, error: "An amount is needed. Ask Noa for it." };
              }
              if (amount > claimed) return { ok: false, error: `The amount can't be more than the ${formatUsd(claimed)} claimed.` };
              input = { ...input, amount: Math.round(amount * 100) / 100 };
            }
            if (spec.askMessage) {
              // Ask and Hold send the standard wording unless a message was given. Decline sends a note only if one was given.
              const message = extra?.message?.trim() || (spec.askMessage === "decline" ? "" : defaultMessage(spec, claim));
              if (message) input = { ...input, message };
            }
            track("action_chosen", { claim: claim.id, action: target.id, recommended: rec?.recommended?.label === spec.label, via: "chat" });
            return run(input) ? { ok: true } : { ok: false, error: "The decision could not be saved. Nothing was sent." };
          }
        : null,
    );
    // The chat can send or cancel the pop-up that is open.
    setDialogControl(
      pending
        ? {
            confirm: () => (dialogSubmit.current?.() ? { ok: true } : { ok: false, error: "The pop-up is not ready to send." }),
            cancel: () => {
              setPending(null);
              return { ok: true };
            },
          }
        : null,
    );
    return () => {
      setActionRunner(null);
      setDialogControl(null);
    };
  });

  // Menu: decision actions not already shown as buttons, then actions about Orvo's work.
  const shown = rec ? [rec.recommended, ...rec.secondary].filter((s): s is ActionSpec => Boolean(s)) : [];
  const decisionMenu: ActionSpec[] = needsReview
    ? [...(rec?.more ?? []), ...moreOptionsFor(claim, [...shown, ...(rec?.more ?? [])])]
    : agentDecided || decidedByNoa
      ? moreOptionsFor(claim, [])
      : [];

  const detail = agentDecided
    ? `${category}, ${claim.status === "approved_by_agent" ? "approved" : "declined"} automatically ${formatDay(claim.agent.decided_at)}`
    : decidedByNoa && claim.noa
      ? `${category}, ${claim.noa.overrode_agent ? "corrected" : claim.noa.decision} ${formatDay(claim.noa.decided_at)}`
      : isOpen(claim)
        ? `${category}, submitted ${formatDay(claim.submitted_at)}, waiting ${waitingFor(claim, NOW)}${daysOverTarget(claim, NOW) > 0 ? `, ${formatDuration(daysOverTarget(claim, NOW) * 86400000)} over the ${WAIT_TARGET_DAYS}-day target` : ""}`
        : `${category}, submitted ${formatDay(claim.submitted_at)}`;
  const subtitle = `${claim.id}, ${detail}`;

  const chase = claim.agent.chase;

  // Flat (modal) mode: the decision is edited in place with a dropdown, then saved.
  const editable = flat && (agentDecided || decidedByNoa);
  const currentOutcome: Outcome | null = claim.status.startsWith("approved") ? "approved" : claim.status.startsWith("declined") ? "declined" : null;
  const decisionItems: Record<Outcome, string> = {
    keep: claimStatusLabel(claim),
    approved: "Approve",
    declined: "Decline",
  };
  const decisionOptions = (["keep", "approved", "declined"] as const).filter((o) => o === "keep" || o !== currentOutcome);
  const changed = editable && choice !== "keep";
  const savedInput: ActionInput | null = changed
    ? { id: "correct", to: choice === "approved" ? "approved" : "declined", amount: choice === "approved" ? claimed : undefined, feedback: null }
    : null;
  const decidedSummary = agentDecided
    ? `${claim.status === "approved_by_agent" ? "Approved" : "Declined"} automatically by Orvo on ${formatDay(claim.agent.decided_at)}.`
    : decidedByNoa && claim.noa
      ? `${claim.noa.overrode_agent ? "Corrected" : claim.noa.decision === "declined" ? "Declined" : "Approved"} by you on ${formatDay(claim.noa.decided_at)}.`
      : "";
  const savedPreview = savedInput ? actionPreview(claim, savedInput, allClaims) : null;

  return (
    <section aria-label={`Claim ${claim.id}, ${full}`} className={cn("@container flex min-h-0 min-w-0 flex-1 flex-col", flat ? "bg-card" : "bg-stack")}>
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", flat ? "p-0" : "p-6", padded && "@3xl:px-[100px] @3xl:[@media(min-height:880px)]:py-[100px]")}>
        <div className={cn("relative flex flex-1 flex-col", !flat && "pb-5")}>
          {stacked ? (
            <>
              {/* Each card sits 2px lower and is 4px narrower than the one in front: the back card is 8px narrower than the front one. */}
              <div aria-hidden className="absolute inset-x-8 -bottom-0.5 h-10 rounded-[14px] border bg-card" />
              <div aria-hidden className="absolute inset-x-4 bottom-2 h-10 rounded-[14px] border bg-card" />
            </>
          ) : null}
          <div className={cn("relative flex flex-1 flex-col overflow-hidden", !flat && "rounded-2xl border bg-card shadow-md")}>
            <div className="flex items-center gap-3.5 border-b px-6 py-[18px]">
              <Avatar size="lg">
                <AvatarImage src={photoFor(claim.employee_id)} alt="" />
                <AvatarFallback>{initials(full)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[1.375rem] leading-7 font-semibold">{full}</div>
                {flat ? null : <div className="text-xs text-muted-foreground">{subtitle}</div>}
              </div>
              <div className="text-right text-3xl leading-9 font-semibold tabular-nums">{formatUsd(claimed)}</div>
            </div>

            <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-6 py-2.5">
              {editable ? (
                <>
                  <p className="min-w-0 text-sm text-muted-foreground">{decidedSummary}</p>
                  <div className="flex shrink-0 flex-col items-start gap-1.5">
                    <Label htmlFor="decision-select" className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Select items={decisionItems} value={choice} onValueChange={(v) => setChoice(v as Outcome)}>
                      <SelectTrigger id="decision-select" className="bg-card font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} align="end">
                        {decisionOptions.map((o) => (
                          <SelectItem key={o} value={o}>
                            {decisionItems[o]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <span className="inline-flex min-w-0 items-center gap-2 font-medium">
                  <Info aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{needsReview ? (comparison.summary ?? dataset.enums.reason_type[claim.agent.reason_type]) : claimStatusLabel(claim)}</span>
                </span>
              )}
              {onOpenDetails ? (
                <Button variant="outline" size="sm" onClick={onOpenDetails}>
                  View details <ArrowRight data-icon="inline-end" />
                </Button>
              ) : null}
            </div>

            <div>
              <ComparisonView comparison={comparison} />
            </div>

            {waitedOut && wait ? (
              // The wait ended: say so, and how many times it was already extended, so a loop is visible.
              <p className="mx-6 mb-4 rounded-lg bg-muted/60 p-3 text-sm">
                {wait.kind === "finance"
                  ? `Back in the queue. No decision from Finance after ${wait.days} working days (since ${formatDay(wait.since)}).`
                  : `Back in the queue. The ${wait.days}-day wait for ${name} ended ${formatDay(wait.until)}.`}
                {wait.extensions > 0 ? ` Waited ${wait.extensions + 1} times already.` : ""}
              </p>
            ) : claim.status === "waiting_on_employee" && wait ? (
              <p className="mx-6 mb-4 rounded-lg bg-muted/60 p-3 text-sm">
                Waiting on {name} for {wait.days} days. Back in the queue {formatDay(wait.until)}.
              </p>
            ) : claim.status === "waiting_on_employee" && chase ? (
              <p className="mx-6 mb-4 rounded-lg bg-muted/60 p-3 text-sm">
                Waiting on {name}. {chase.attempts.length} of {chase.max_attempts} requests sent.{" "}
                {chase.next_attempt_at ? `Next request ${formatDay(chase.next_attempt_at)}. ` : "No requests left. "}
                Passes to review {formatDay(chase.escalates_at)}.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cn("flex shrink-0 flex-col gap-3 border-t px-6 py-4", "bg-card")}>
        {changed && choice === "declined" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="decline-reason">Reason for declining</Label>
            <Textarea
              id="decline-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Say why the claim is declined"
            />
            <p className="text-xs text-muted-foreground">Sent to {name} in chat after the update.</p>
          </div>
        ) : null}

        {changed ? (
          <StatusBanner icon={<Info />} title="What happens when you save">
            {savedPreview ? savedPreview.summary : null}
          </StatusBanner>
        ) : null}

        {error ? (
          <StatusBanner tone="destructive" icon={<TriangleAlert />} title="Decision not saved">
            <span className="flex flex-col gap-2">
              <span>Nothing was sent to {name} and the claim is unchanged. Try again, or leave it in the queue.</span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => run(error)}>
                  Try again
                </Button>
                <Button size="sm" variant="outline" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              </span>
            </span>
          </StatusBanner>
        ) : null}

        {needsReview && rec && !rec.recommended ? (
          <p className="text-sm text-muted-foreground">No recommendation for this claim. {claim.agent.unsure ? "It could not be judged." : ""}</p>
        ) : null}

        {claim.status === "waiting_on_finance" && !waitedOut ? (
          <p className="text-sm text-muted-foreground">
            With Finance since {claim.noa ? formatDay(claim.noa.decided_at) : "today"}. No action is needed until Finance decides.
            {wait ? ` Back in the queue ${formatDay(wait.until)} to check on it.` : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="lg" className="h-11">
                  More options <ChevronDown data-icon="inline-end" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" side="top" className="w-72">
              {decisionMenu.length > 0 ? (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>DECISION</DropdownMenuLabel>
                    {decisionMenu.map((spec) => {
                      const Icon = ACTION_ICON[spec.id];
                      return (
                        <DropdownMenuItem key={spec.label} onClick={() => choose(spec)}>
                          {Icon ? <Icon /> : null}
                          {spec.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuGroup>
                <DropdownMenuLabel>ABOUT AUTOMATIC DECISIONS</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFixOpen(true)}>
                  <Wrench />
                  <span className="flex flex-col">
                    <span>Correct an automatic decision</span>
                    <span className="text-xs text-muted-foreground">Record what went wrong</span>
                  </span>
                </DropdownMenuItem>
                {onOpenMore ? (
                  <DropdownMenuItem onClick={() => onOpenMore("policy")}>
                    <ListChecks />
                    <span className="flex flex-col">
                      <span>See how the decision was made</span>
                      <span className="text-xs text-muted-foreground">Evidence and checks that were run</span>
                    </span>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {needsReview && rec ? (
              <>
                {rec.secondary.map((spec) => {
                  const Icon = ACTION_ICON[spec.id];
                  return (
                    <Button key={spec.label} variant="outline" size="lg" className="h-11" onClick={() => choose(spec)}>
                      {Icon ? <Icon data-icon="inline-start" /> : null}
                      {spec.label}
                    </Button>
                  );
                })}
                {rec.recommended ? (
                  <Button
                    size="lg"
                    variant={rec.recommended.destructive ? "destructive" : "default"}
                    className={cn("h-11", !rec.recommended.destructive && "bg-success text-success-foreground hover:bg-success/90")}
                    onClick={() => choose(rec.recommended!)}
                  >
                    {rec.recommended.label}
                    {primary ? (
                      <span aria-hidden className="ml-1 inline-flex items-center gap-1">
                        <Kbd className="border border-current/25 bg-transparent text-current opacity-70"><Command /></Kbd>
                        <Kbd className="border border-current/25 bg-transparent text-current opacity-70"><CornerDownLeft /></Kbd>
                      </span>
                    ) : null}
                  </Button>
                ) : null}
              </>
            ) : null}

            {spot ? (
              <Button size="lg" className="h-11 bg-success text-success-foreground hover:bg-success/90" onClick={() => run({ id: "confirm" })}>
                Confirm decision
              </Button>
            ) : null}

            {editable ? (
              changed && savedInput ? (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-11"
                    onClick={() => {
                      setChoice("keep");
                      setReason("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="lg"
                    className="h-11"
                    disabled={choice === "declined" && !reason.trim()}
                    onClick={() => {
                      const text = reason.trim();
                      if (run(savedInput) && choice === "declined" && text) sendMessage(claim.id, text);
                    }}
                  >
                    Save
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="lg" className="h-11" disabled>
                  Save
                </Button>
              )
            ) : agentDecided || decidedByNoa ? (
              <Button variant="outline" size="lg" className="h-11" onClick={() => setFixOpen(true)}>
                <Pencil data-icon="inline-start" />
                Edit decision
              </Button>
            ) : null}

            {claim.status === "waiting_on_employee" && !waitedOut ? (
              <>
                <Button variant="ghost" size="lg" className="h-11" onClick={() => run({ id: "decide_now" })}>
                  Decide now
                </Button>
                <Button size="lg" className="h-11" onClick={() => onContinue?.()}>
                  Continue waiting
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {pending ? (
        <ActionDialog
          key={pending.label}
          claim={claim}
          allClaims={allClaims}
          spec={pending}
          initialMessage={pendingMessage}
          registerSubmit={(submit) => {
            dialogSubmit.current = submit;
          }}
          onCancel={() => setPending(null)}
          onConfirm={run}
        />
      ) : null}
      {fixOpen ? <FixDialog key={claim.id} claim={claim} allClaims={allClaims} onCancel={() => setFixOpen(false)} onConfirm={run} /> : null}
    </section>
  );
}
