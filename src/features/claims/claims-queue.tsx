"use client";

import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";

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
  moreTab: MoreTab;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onAskAi: () => void;
  onOpenMore: (tab?: MoreTab) => void;
  onMoreTab: (tab: MoreTab) => void;
  onOpenClaim: (id: string) => void;
  onDecided: (claimId: string, status: Status, action: ActionId) => void;
  onReopen: (claimId: string) => void;
};

/** One queue panel: a header aligned with the Orvo bar, then triage and More info side by side. */
export function ClaimsQueue(props: Props) {
  const { claim, allClaims, position, moreTab, onPrev, onNext, onClose, onAskAi } = props;
  return (
    <section aria-label="Claims queue" className="flex h-full min-h-0 min-w-0 flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-6">
        <div>
          <h2 className="text-base leading-5 font-semibold">Claims Queue</h2>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {position.index + 1} of {position.total} {position.noun}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAskAi}>
            <Sparkles data-icon="inline-start" />
            Ask Orvo AI
          </Button>
          <Button variant="outline" size="sm" disabled={!onPrev} onClick={onPrev}>
            <ArrowLeft data-icon="inline-start" />
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!onNext} onClick={onNext}>
            Next
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <TriagePanel
          key={claim.id}
          claim={claim}
          allClaims={allClaims}
          onOpenMore={props.onOpenMore}
          onDecided={props.onDecided}
          onReopen={props.onReopen}
        />
        <MoreInfoPanel claim={claim} allClaims={allClaims} tab={moreTab} onTab={props.onMoreTab} onOpenClaim={props.onOpenClaim} />
      </div>
    </section>
  );
}
