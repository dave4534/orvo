"use client";

import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
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
    <ModalOverlay isOpen isDismissable onOpenChange={(open) => (open ? undefined : onClose())}>
      <Modal className="max-w-3xl">
        <Dialog className="flex max-h-[85svh] flex-col overflow-hidden" aria-label={claim.merchant}>
          <header className="shrink-0 border-b border-secondary px-6 py-4">
            <h2 className="text-base font-semibold text-primary">{claim.merchant}</h2>
            <p className="text-sm text-tertiary">Submitted {dayFormat.format(new Date(claim.submitted_at)).replace(",", "")}</p>
          </header>
          <TriagePanel key={claim.id} claim={claim} allClaims={allClaims} stacked={false} padded={false} flat primary={false} onDecided={onDecided} onReopen={onReopen} />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
