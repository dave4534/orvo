"use client";

import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Status } from "@/data/types";
import type { ActionId } from "@/logic/actions";
import type { LocalClaim } from "@/logic/local";
import { MoreInfoPanel } from "./more-info-panel";
import type { MoreTab } from "./panel-types";
import { TriagePanel, type TriagePosition } from "./triage-panel";

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  position: TriagePosition;
  detailsOpen: boolean;
  moreTab: MoreTab;
  onPrev?: () => void;
  onNext?: () => void;
  onBack: () => void;
  onOpenDetails: () => void;
  onCloseDetails: () => void;
  onOpenMore: (tab?: MoreTab) => void;
  onMoreTab: (tab: MoreTab) => void;
  onOpenClaim: (id: string) => void;
  onDecided: (claimId: string, status: Status, action: ActionId) => void;
  onReopen: (claimId: string) => void;
};

/** The triage state: its own page once a claim is opened from the list. Triage on the left, Details drawer on request. */
export function ClaimsQueue(props: Props) {
  const { claim, allClaims, position, detailsOpen, moreTab, onPrev, onNext } = props;
  return (
    <section aria-label="Claims queue" className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-card px-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={props.onBack}>
            <ChevronLeft data-icon="inline-start" />
            Back to claims
          </Button>
          <div>
            <h2 className="text-base leading-5 font-semibold">Claims Queue</h2>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {position.index + 1} of {position.total} {position.noun}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
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
      <div className="flex min-h-0 flex-1">
        <TriagePanel
          key={claim.id}
          claim={claim}
          allClaims={allClaims}
          stacked={Boolean(onNext)}
          onOpenDetails={props.onOpenDetails}
          onOpenMore={props.onOpenMore}
          onDecided={props.onDecided}
          onReopen={props.onReopen}
        />
        {detailsOpen ? (
          <MoreInfoPanel claim={claim} allClaims={allClaims} tab={moreTab} onTab={props.onMoreTab} onClose={props.onCloseDetails} onOpenClaim={props.onOpenClaim} />
        ) : null}
      </div>
    </section>
  );
}
