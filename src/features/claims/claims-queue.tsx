"use client";

import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Status } from "@/data/types";
import type { ActionId } from "@/logic/actions";
import type { LocalClaim } from "@/logic/local";
import type { MoreTab } from "./panel-types";
import { TriagePanel, type TriagePosition } from "./triage-panel";

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  /** "Claims Queue" for review, "Done Queue" from Done, "All Claims" from All, "Waiting on others" from Waiting. */
  queueTitle: "Claims Queue" | "Done Queue" | "All Claims" | "Waiting on others";
  position: TriagePosition;
  onPrev?: () => void;
  onNext?: () => void;
  onBack: () => void;
  onOpenDetails: () => void;
  onOpenMore: (tab?: MoreTab) => void;
  onDecided: (claimId: string, status: Status, action: ActionId) => void;
  onReopen: (claimId: string) => void;
};

/** The triage state: its own page once a claim is opened from the list. Details and the AI chat sit beside it. */
export function ClaimsQueue(props: Props) {
  const { claim, allClaims, position, onPrev, onNext } = props;
  return (
    <section aria-label="Claims queue" className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b bg-card px-4">
        <div className="flex min-w-0 items-center justify-start">
          <Button variant="outline" size="sm" className="shrink-0" onClick={props.onBack}>
            <ChevronLeft data-icon="inline-start" />
            Back to claims
          </Button>
        </div>
        <div className="flex flex-col items-center text-center">
          <h2 className="text-base leading-5 font-semibold whitespace-nowrap">{props.queueTitle}</h2>
          <p className="mt-1 text-xs leading-4 whitespace-nowrap text-muted-foreground" aria-live="polite">
            {position.index + 1} of {position.total} {position.noun}
          </p>
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="outline" size="sm" disabled={!onPrev} onClick={onPrev}>
            <ArrowLeft data-icon="inline-start" />
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!onNext} onClick={onNext}>
            Next
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
      <TriagePanel
        key={claim.id}
        claim={claim}
        allClaims={allClaims}
        stacked={Boolean(onNext)}
        onOpenDetails={props.onOpenDetails}
        onOpenMore={props.onOpenMore}
        onDecided={props.onDecided}
        onReopen={props.onReopen}
        onContinue={props.onNext ?? props.onBack}
      />
    </section>
  );
}
