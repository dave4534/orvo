"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Ban, Check, ChevronDown, CircleDollarSign, Clock, Info, Landmark, ListChecks, MessageSquare, Pencil, Wrench, type LucideIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { dataset } from "@/data";
import type { Status } from "@/data/types";
import { actionPreview, firstName, type ActionId, type ActionInput } from "@/logic/actions";
import { buildComparison, employeeName } from "@/logic/comparison";
import { claimStatusLabel, formatUsd, initials } from "@/logic/format";
import { isAgentDecided, isSpotCheck, type LocalClaim } from "@/logic/local";
import { allActionsFor, moreOptionsFor, recommendationFor, type ActionSpec } from "@/logic/recommendations";
import { track } from "@/logic/track";
import { cn } from "@/lib/utils";
import { useClaims } from "@/store/claims-store";
import { useWorkspace } from "@/store/workspace-store";
import { ActionDialog } from "./action-dialog";
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
};

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const ACTION_ICON: Partial<Record<ActionId, LucideIcon>> = {
  approve: Check,
  approve_amount: CircleDollarSign,
  exception: Check,
  decline: Ban,
  ask: MessageSquare,
  hold: Clock,
  to_finance: Landmark,
  to_finance_both: Landmark,
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
export function TriagePanel({ claim, allClaims, stacked, onOpenDetails, onOpenMore, padded = true, flat = false, primary = true, onDecided, onReopen }: Props) {
  const { perform } = useClaims();
  const { setActionRunner } = useWorkspace();
  const [pending, setPending] = useState<ActionSpec | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [error, setError] = useState<ActionInput | null>(null);
  const [choice, setChoice] = useState<Outcome>("keep");

  const comparison = useMemo(() => buildComparison(claim, allClaims), [claim, allClaims]);
  const name = firstName(claim);
  const full = employeeName(claim);
  const claimed = claim.amount.usd_claimed;
  const category = dataset.enums.category[claim.category];
  const needsReview = claim.status === "waiting_on_noa";
  const agentDecided = isAgentDecided(claim);
  const decidedByNoa = claim.status === "approved_by_noa" || claim.status === "declined_by_noa";
  const spot = isSpotCheck(claim) && !claim.local?.spot_checked && claim.status === "approved_by_agent";
  const rec = needsReview ? recommendationFor(claim) : null;

  function run(input: ActionInput) {
    const result = perform(claim.id, input, { onUndo: onReopen, silent: input.id === "confirm" });
    if (!result.ok) {
      setError(input);
      return;
    }
    setError(null);
    setPending(null);
    setFixOpen(false);
    onDecided(claim.id, result.status, input.id);
  }

  function choose(spec: ActionSpec) {
    const target = retarget(spec, claim);
    track("action_chosen", { claim: claim.id, action: target.id, recommended: rec?.recommended?.label === spec.label });
    if (target.confirm) setPending(target);
    else run(target.input);
  }

  useEffect(() => {
    if (!primary) return;
    setActionRunner(
      needsReview
        ? (label) => {
            const spec = allActionsFor(claim).find((s) => s.label === label);
            if (spec) choose(spec);
          }
        : null,
    );
    return () => setActionRunner(null);
  });

  // Menu: decision actions not already shown as buttons, then actions about Orvo's work.
  const shown = rec ? [rec.recommended, ...rec.secondary].filter((s): s is ActionSpec => Boolean(s)) : [];
  const decisionMenu: ActionSpec[] = needsReview
    ? [...(rec?.more ?? []), ...moreOptionsFor(claim, [...shown, ...(rec?.more ?? [])])]
    : agentDecided || decidedByNoa
      ? moreOptionsFor(claim, [])
      : [];

  const subtitle = agentDecided
    ? `${category}, ${claim.status === "approved_by_agent" ? "approved" : "declined"} automatically ${formatDay(claim.agent.decided_at)}`
    : decidedByNoa && claim.noa
      ? `${category}, ${claim.noa.overrode_agent ? "corrected" : claim.noa.decision} ${formatDay(claim.noa.decided_at)}`
      : `${category}, submitted ${formatDay(claim.submitted_at)}`;

  const chase = claim.agent.chase;

  // Flat (modal) mode: the decision is edited in place with a dropdown, then saved.
  const editable = flat && (agentDecided || decidedByNoa);
  const currentOutcome: Outcome | null = claim.status.startsWith("approved") ? "approved" : claim.status.startsWith("declined") ? "declined" : null;
  const decisionItems: Record<Outcome, string> = {
    keep: claimStatusLabel(claim),
    approved: "Approved",
    declined: "Declined",
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
    <section aria-label={`Claim ${claim.id}, ${full}`} className={cn("@container flex min-h-0 min-w-0 flex-1 flex-col", flat ? "bg-card" : "bg-background")}>
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", flat ? "p-0" : "p-6", padded && "@3xl:px-[100px] @3xl:[@media(min-height:880px)]:py-[100px]")}>
        <div className={cn("relative flex flex-1 flex-col", !flat && "pb-5")}>
          {stacked ? (
            <>
              <div aria-hidden className="absolute inset-x-7 bottom-0 h-10 rounded-[14px] border bg-card" />
              <div aria-hidden className="absolute inset-x-3.5 bottom-2.5 h-10 rounded-[14px] border bg-card" />
            </>
          ) : null}
          <div className={cn("relative flex flex-1 flex-col overflow-hidden", !flat && "rounded-2xl border bg-card shadow-md")}>
            <div className="flex items-center gap-3.5 border-b px-6 py-[18px]">
              <Avatar size="lg">
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
                  <span className="truncate">{needsReview ? dataset.enums.reason_type[claim.agent.reason_type] : claimStatusLabel(claim)}</span>
                </span>
              )}
              {onOpenDetails ? (
                <Button variant="outline" size="sm" onClick={onOpenDetails}>
                  View details <ArrowRight data-icon="inline-end" />
                </Button>
              ) : null}
            </div>

            <div className={cn("border-t", !flat && "mt-6")}>
              <ComparisonView comparison={comparison} />
            </div>

            {claim.status === "waiting_on_employee" && chase ? (
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
        {changed ? (
          <Alert>
            <Info aria-hidden />
            <AlertTitle>What happens when you save</AlertTitle>
            <AlertDescription>
              {savedPreview ? (
                <span className="flex flex-col gap-0.5">
                  <span>Pays: {savedPreview.pays}</span>
                  <span>Tells: {savedPreview.tells}</span>
                  <span>Finance: {savedPreview.finance}</span>
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Decision not saved</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>Nothing was sent to {name} and the claim is unchanged. Try again, or leave it in the queue.</span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => run(error)}>
                  Try again
                </Button>
                <Button size="sm" variant="outline" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        {needsReview && rec && !rec.recommended ? (
          <p className="text-sm text-muted-foreground">No recommendation for this claim. {claim.agent.unsure ? "It could not be judged." : ""}</p>
        ) : null}

        {claim.status === "waiting_on_finance" ? (
          <p className="text-sm text-muted-foreground">With Finance since {claim.noa ? formatDay(claim.noa.decided_at) : "today"}. No action is needed until Finance decides.</p>
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
                  <Button size="lg" className="h-11 bg-success text-success-foreground hover:bg-success/90" onClick={() => choose(rec.recommended!)}>
                    {rec.recommended.label}
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
                  <Button variant="outline" size="lg" className="h-11" onClick={() => setChoice("keep")}>
                    Cancel
                  </Button>
                  <Button size="lg" className="h-11" onClick={() => run(savedInput)}>
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

            {claim.status === "waiting_on_employee" ? (
              <Button size="lg" className="h-11" onClick={() => run({ id: "decide_now" })}>
                Decide now
              </Button>
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
          onCancel={() => setPending(null)}
          onConfirm={run}
        />
      ) : null}
      {fixOpen ? <FixDialog key={claim.id} claim={claim} allClaims={allClaims} onCancel={() => setFixOpen(false)} onConfirm={run} /> : null}
    </section>
  );
}
