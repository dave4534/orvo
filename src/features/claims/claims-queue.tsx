"use client";

import { ArrowLeft, ArrowRight, ChevronLeft, Stars01 } from "@untitledui/icons";

import { Button } from "@/components/base/buttons/button";
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
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button color="secondary" size="sm" className="shrink-0" iconLeading={ChevronLeft} onPress={props.onBack}>
            Back to claims
          </Button>
          <div>
            <h2 className="flex items-center gap-2 text-base leading-5 font-semibold whitespace-nowrap">
              {props.queueTitle === "Done Queue" ? <Stars01 aria-hidden className="size-4 text-brand-secondary" /> : null}
              {props.queueTitle}
            </h2>
            <p className="text-xs whitespace-nowrap text-muted-foreground" aria-live="polite">
              {position.index + 1} of {position.total} {position.noun}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button color="secondary" size="sm" isDisabled={!onPrev} iconLeading={ArrowLeft} onPress={onPrev}>
            Previous
          </Button>
          <Button color="secondary" size="sm" isDisabled={!onNext} iconTrailing={ArrowRight} onPress={onNext}>
            Next
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
