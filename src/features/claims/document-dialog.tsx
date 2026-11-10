"use client";

import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import type { LocalClaim } from "@/logic/local";

export type DocumentView = { kind: "receipt" } | { kind: "attachment"; label: string; shows: string };

type Props = { claim: LocalClaim; view: DocumentView; onClose: () => void };

/** Opens a receipt or an attached file in a dialog. The prototype has no images, so it shows what the file contains. */
export function DocumentDialog({ claim, view, onClose }: Props) {
  const doc = claim.receipt.document;
  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(open) => (open ? undefined : onClose())}>
      <Modal className="max-w-md">
        <Dialog className="flex flex-col gap-4 p-6" aria-label={view.kind === "receipt" ? "Receipt" : view.label}>
        <header>
          <h2 className="text-lg font-semibold text-primary">{view.kind === "receipt" ? "Receipt" : view.label}</h2>
          <p className="text-sm text-tertiary">{claim.id}</p>
        </header>
        {view.kind === "receipt" && doc ? (
          <div className="rounded-xl border border-secondary p-4 text-sm">
            <div className="font-semibold">{doc.merchant}</div>
            <div className="mb-3 text-xs text-tertiary">{doc.date}</div>
            <div role="table" aria-label="Receipt lines" className="text-sm">
              <div role="rowgroup">
                {doc.lines.map((l) => (
                  <div role="row" key={l.label} className="flex items-baseline justify-between gap-4 py-2">
                    <div role="cell" className="min-w-0">{l.label}</div>
                    <div role="cell" className="shrink-0 text-right tabular-nums">
                      {l.amount.toFixed(2)} {doc.currency}
                    </div>
                  </div>
                ))}
                {doc.tax != null ? (
                  <div role="row" className="flex items-baseline justify-between gap-4 py-2 ">
                    <div role="cell" className="min-w-0">Tax</div>
                    <div role="cell" className="shrink-0 text-right tabular-nums">{doc.tax.toFixed(2)}</div>
                  </div>
                ) : null}
                {doc.tip != null ? (
                  <div role="row" className="flex items-baseline justify-between gap-4 py-2 ">
                    <div role="cell" className="min-w-0">Tip</div>
                    <div role="cell" className="shrink-0 text-right tabular-nums">{doc.tip.toFixed(2)}</div>
                  </div>
                ) : null}
                <div role="row" className="flex items-baseline justify-between gap-4 py-2 font-semibold text-primary">
                  <div role="cell" className="min-w-0">Total</div>
                  <div role="cell" className="shrink-0 text-right tabular-nums">
                    {doc.total?.toFixed(2)} {doc.currency}
                  </div>
                </div>
              </div>
            </div>
            {doc.covers != null ? <p className="mt-2 text-xs text-tertiary">Diners printed on the receipt: {doc.covers}</p> : null}
            {Object.keys(doc.details).length > 0 ? (
              <p className="mt-1 text-xs text-tertiary">
                {Object.entries(doc.details)
                  .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        ) : view.kind === "attachment" ? (
          <p className="rounded-xl border border-secondary bg-secondary p-4 font-mono text-sm">{view.shows}</p>
        ) : null}
        <footer className="flex justify-end">
          <Button color="secondary" size="md" onPress={onClose}>
            Close
          </Button>
        </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
