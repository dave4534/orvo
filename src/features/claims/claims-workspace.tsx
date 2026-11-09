"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Status } from "@/data/types";
import type { ActionId } from "@/logic/actions";
import type { LocalClaim } from "@/logic/local";
import { AiPanel } from "./ai-panel";
import { MoreInfoPanel } from "./more-info-panel";
import type { MoreTab } from "./panel-types";
import { TriagePanel, type TriagePosition } from "./triage-panel";

type Props = {
  claim: LocalClaim | null;
  allClaims: LocalClaim[];
  position: TriagePosition | null;
  spotCheckPosition: { index: number; total: number } | null;
  moreOpen: boolean;
  moreTab: MoreTab;
  aiOpen: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onOpenMore: (tab?: MoreTab) => void;
  onCloseMore: () => void;
  onMoreTab: (tab: MoreTab) => void;
  onOpenClaim: (id: string) => void;
  onSetAi: (open: boolean) => void;
  onDecided: (claimId: string, status: Status, action: ActionId) => void;
  onReopen: (claimId: string) => void;
};

/**
 * Panels open over the list with a dimmed layer, left to right: triage, More info, Ask Orvo AI.
 * Ask Orvo AI is always the rightmost panel, and More info always opens between triage and it.
 */
export function ClaimsWorkspace(props: Props) {
  const { claim, position, aiOpen, moreOpen } = props;
  return (
    <Sheet
      open={claim !== null}
      onOpenChange={(open, details) => {
        if (open) return;
        // Escape closes More info first, then the whole workspace (PRD FR-SHELL-2).
        if (details.reason === "escape-key" && moreOpen) {
          details.cancel();
          props.onCloseMore();
          return;
        }
        props.onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="data-[side=right]:top-(--header-height) data-[side=right]:h-[calc(100svh-var(--header-height))] data-[side=right]:w-auto data-[side=right]:max-w-full data-[side=right]:sm:max-w-full flex-row gap-0 p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Review claim</SheetTitle>
          <SheetDescription>The claim, its evidence and your decision options.</SheetDescription>
        </SheetHeader>
        {claim && position ? (
          <TriagePanel
            key={claim.id}
            claim={claim}
            allClaims={props.allClaims}
            position={position}
            spotCheckPosition={props.spotCheckPosition}
            onPrev={props.onPrev}
            onNext={props.onNext}
            onClose={props.onClose}
            onOpenMore={props.onOpenMore}
            onAskAi={() => props.onSetAi(true)}
            onDecided={props.onDecided}
            onReopen={props.onReopen}
          />
        ) : null}
        {claim && moreOpen ? (
          <MoreInfoPanel
            claim={claim}
            allClaims={props.allClaims}
            tab={props.moreTab}
            onTab={props.onMoreTab}
            onClose={props.onCloseMore}
            onOpenClaim={props.onOpenClaim}
          />
        ) : null}
        {aiOpen ? (
          <AiPanel claim={claim} allClaims={props.allClaims} onClose={() => props.onSetAi(false)} onOpenMore={props.onOpenMore} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
