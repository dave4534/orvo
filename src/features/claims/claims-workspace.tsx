"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Status } from "@/data/types";
import type { ActionId } from "@/logic/actions";
import type { LocalClaim } from "@/logic/local";
import { AiPanel } from "./ai-panel";
import { ClaimsQueue } from "./claims-queue";
import type { MoreTab } from "./panel-types";
import type { TriagePosition } from "./triage-panel";

type Props = {
  claim: LocalClaim | null;
  allClaims: LocalClaim[];
  position: TriagePosition | null;
  moreTab: MoreTab;
  aiOpen: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onOpenMore: (tab?: MoreTab) => void;
  onMoreTab: (tab: MoreTab) => void;
  onOpenClaim: (id: string) => void;
  onSetAi: (open: boolean) => void;
  onDecided: (claimId: string, status: Status, action: ActionId) => void;
  onReopen: (claimId: string) => void;
};

/**
 * Full-height panels over the list with a dimmed layer: the claims queue (triage and More info side by side), then Ask Orvo AI on the far right.
 * The queue starts at the top of the window, so its header lines up with the Orvo bar.
 */
export function ClaimsWorkspace(props: Props) {
  const { claim, position, aiOpen } = props;
  return (
    <Sheet
      open={claim !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="data-[side=right]:top-0 data-[side=right]:h-svh data-[side=right]:w-auto data-[side=right]:max-w-full data-[side=right]:sm:max-w-full flex-row gap-0 p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Review claim</SheetTitle>
          <SheetDescription>The claim, its evidence and decision options.</SheetDescription>
        </SheetHeader>
        {claim && position ? (
          <ClaimsQueue
            claim={claim}
            allClaims={props.allClaims}
            position={position}
            moreTab={props.moreTab}
            onPrev={props.onPrev}
            onNext={props.onNext}
            onClose={props.onClose}
            onAskAi={() => props.onSetAi(true)}
            onOpenMore={props.onOpenMore}
            onMoreTab={props.onMoreTab}
            onOpenClaim={props.onOpenClaim}
            onDecided={props.onDecided}
            onReopen={props.onReopen}
          />
        ) : null}
        {aiOpen ? <AiPanel claim={claim} allClaims={props.allClaims} onClose={() => props.onSetAi(false)} onOpenMore={props.onOpenMore} /> : null}
      </SheetContent>
    </Sheet>
  );
}
