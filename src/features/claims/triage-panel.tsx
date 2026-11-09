"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Sparkles, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dataset } from "@/data";
import type { Status } from "@/data/types";
import { firstName, type ActionId, type ActionInput } from "@/logic/actions";
import { buildComparison, employeeName } from "@/logic/comparison";
import { claimStatusLabel, formatUsd, initials } from "@/logic/format";
import { isAgentDecided, isSpotCheck, type LocalClaim } from "@/logic/local";
import { moreOptionsFor, recommendationFor, type ActionSpec } from "@/logic/recommendations";
import { track } from "@/logic/track";
import { useClaims } from "@/store/claims-store";
import { ActionDialog } from "./action-dialog";
import { ComparisonView } from "./comparison-view";
import { FixDialog } from "./fix-dialog";
import type { MoreTab } from "./panel-types";

export type TriagePosition = { index: number; total: number; noun: string };

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  position: TriagePosition;
  spotCheckPosition?: { index: number; total: number } | null;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onOpenMore: (tab?: MoreTab) => void;
  onAskAi: () => void;
  onDecided: (claimId: string, status: Status, action: ActionId) => void;
  onReopen: (claimId: string) => void;
};

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
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

export function TriagePanel({ claim, allClaims, position, spotCheckPosition, onPrev, onNext, onClose, onOpenMore, onAskAi, onDecided, onReopen }: Props) {
  const { perform } = useClaims();
  const [pending, setPending] = useState<ActionSpec | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [error, setError] = useState<ActionInput | null>(null);

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

  // Menu: decision actions not already shown as buttons, then actions about Orvo's work.
  const shown = rec ? [rec.recommended, ...rec.secondary].filter((s): s is ActionSpec => Boolean(s)) : [];
  const decisionMenu: ActionSpec[] = needsReview
    ? [...(rec?.more ?? []), ...moreOptionsFor(claim, [...shown, ...(rec?.more ?? [])])]
    : agentDecided || decidedByNoa
      ? moreOptionsFor(claim, [])
      : [];

  const lastEvent = claim.events[claim.events.length - 1];
  const title =
    decidedByNoa && claim.noa
      ? `You ${claim.noa.decision} ${formatUsd(claim.noa.decision === "approved" ? claim.noa.approved_amount_usd : claimed)}`
      : agentDecided
        ? `Orvo ${claim.status === "approved_by_agent" ? "approved" : "declined"} ${formatUsd(claimed)}`
        : claim.agent.headline;
  const body =
    decidedByNoa && claim.noa
      ? `${lastEvent?.text ?? ""}${claim.noa.note ? `. Your note: ${claim.noa.note}` : ""}. Orvo's review said: ${claim.agent.headline}`
      : needsReview && claim.agent.needs_from_noa
        ? `${claim.agent.explanation} Orvo asks: ${claim.agent.needs_from_noa}`
        : claim.agent.explanation;

  const subtitle = agentDecided
    ? `${category}, ${claim.status === "approved_by_agent" ? "approved" : "declined"} by Orvo ${formatDay(claim.agent.decided_at)}`
    : decidedByNoa && claim.noa
      ? `${category}, ${claim.noa.overrode_agent ? "corrected" : claim.noa.decision} by you ${formatDay(claim.noa.decided_at)}`
      : `${category}, submitted ${formatDay(claim.submitted_at)}`;

  const chase = claim.agent.chase;

  return (
    <section aria-label={`Claim ${claim.id}, ${full}`} className="flex h-full min-h-0 w-[min(35rem,100vw)] shrink flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-6">
        <div>
          <h2 className="text-base leading-5 font-semibold">Claims Queue</h2>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {position.index + 1} of {position.total} {position.noun}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon-sm" aria-label="Ask Orvo AI about this claim" onClick={onAskAi}>
            <Sparkles />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Previous claim" disabled={!onPrev} onClick={onPrev}>
            <ArrowLeft />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Next claim" disabled={!onNext} onClick={onNext}>
            <ArrowRight />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-background p-4 px-6">
        <div className="flex flex-col gap-2 rounded-xl border border-info-border bg-info p-4 text-info-foreground">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles aria-hidden className="size-[18px] shrink-0" />
            {title}
          </div>
          <p className="text-sm leading-relaxed">{body}</p>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-3.5 border-b px-6 py-[18px]">
            <Avatar size="lg">
              <AvatarFallback>{initials(full)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[1.375rem] leading-7 font-semibold">{full}</div>
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            </div>
            <div className="text-right text-3xl leading-9 font-semibold tabular-nums">{formatUsd(claimed)}</div>
          </div>

          <div className="flex items-center justify-between border-b bg-muted/40 px-6 py-2.5">
            {spotCheckPosition && isSpotCheck(claim) ? (
              <Badge variant="outline" className="border-warning-border bg-warning text-warning-foreground">
                Spot check, {spotCheckPosition.index + 1} of {spotCheckPosition.total}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={needsReview ? "border-warning-border bg-warning text-warning-foreground" : "bg-card text-muted-foreground"}
              >
                {claimStatusLabel(claim)}
                {needsReview ? `, ${dataset.enums.reason_type[claim.agent.reason_type]}` : ""}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenMore()}>
              More info <ArrowRight data-icon="inline-end" />
            </Button>
          </div>

          <div className="mt-6 border-t">
            <ComparisonView comparison={comparison} />
          </div>

          {claim.status === "waiting_on_employee" && chase ? (
            <p className="mx-6 mb-4 rounded-lg bg-muted/60 p-3 text-sm">
              Waiting on {name}. {chase.attempts.length} of {chase.max_attempts} requests sent.{" "}
              {chase.next_attempt_at ? `Next request ${formatDay(chase.next_attempt_at)}. ` : "No requests left. "}
              Passes to you {formatDay(chase.escalates_at)}.
            </p>
          ) : null}

          <div className="flex flex-col gap-2.5 border-t bg-muted/40 px-6 py-4">
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

            {needsReview && rec ? (
              <>
                {rec.recommended ? (
                  <Button size="lg" className="h-11 w-full bg-success text-success-foreground hover:bg-success/90" onClick={() => choose(rec.recommended!)}>
                    {rec.recommended.label}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Orvo has no recommendation here. {claim.agent.unsure ? "It could not judge this one." : ""}</p>
                )}
                {rec.secondary.map((spec) => (
                  <Button key={spec.label} variant="outline" size="lg" className="h-10 w-full" onClick={() => choose(spec)}>
                    {spec.label}
                  </Button>
                ))}
              </>
            ) : null}

            {spot ? (
              <Button size="lg" className="h-11 w-full bg-success text-success-foreground hover:bg-success/90" onClick={() => run({ id: "confirm" })}>
                Confirm decision
              </Button>
            ) : null}

            {agentDecided || decidedByNoa ? (
              <Button variant="outline" size="lg" className="h-10 w-full" onClick={() => setFixOpen(true)}>
                Edit decision
              </Button>
            ) : null}

            {claim.status === "waiting_on_employee" ? (
              <Button size="lg" className="h-11 w-full" onClick={() => run({ id: "decide_now" })}>
                Decide now
              </Button>
            ) : null}

            {claim.status === "waiting_on_finance" ? (
              <p className="text-sm text-muted-foreground">With Finance since {claim.noa ? formatDay(claim.noa.decided_at) : "today"}. There is nothing for you to do until they decide.</p>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="lg" className="h-10 w-full">
                    More options <ChevronDown data-icon="inline-end" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-72">
                {decisionMenu.length > 0 ? (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>DECISION</DropdownMenuLabel>
                      {decisionMenu.map((spec) => (
                        <DropdownMenuItem key={spec.label} onClick={() => choose(spec)}>
                          {spec.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>ABOUT ORVO&apos;S WORK</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setFixOpen(true)}>
                    <span className="flex flex-col">
                      <span>Fix Orvo&apos;s mistake</span>
                      <span className="text-xs text-muted-foreground">Tell Orvo where it went wrong</span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOpenMore("policy")}>
                    <span className="flex flex-col">
                      <span>See how Orvo decided</span>
                      <span className="text-xs text-muted-foreground">Evidence and checks it ran</span>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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
