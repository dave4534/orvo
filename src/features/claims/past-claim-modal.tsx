"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Status } from "@/data/types";
import type { ActionId } from "@/logic/actions";
import type { LocalClaim } from "@/logic/local";
import { TriagePanel } from "./triage-panel";

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  onClose: () => void;
  onDecided: (claimId: string, status: Status, action: ActionId) => void;
  onReopen: (claimId: string) => void;
};

/** A past claim opened over the review, so closing it returns to exactly where the review was. */
export function PastClaimModal({ claim, allClaims, onClose, onDecided, onReopen }: Props) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 bg-card sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-base">{claim.merchant}</DialogTitle>
          <DialogDescription>Submitted {dayFormat.format(new Date(claim.submitted_at)).replace(",", "")}</DialogDescription>
        </DialogHeader>
        <TriagePanel key={claim.id} claim={claim} allClaims={allClaims} stacked={false} padded={false} flat primary={false} onDecided={onDecided} onReopen={onReopen} />
      </DialogContent>
    </Dialog>
  );
}
