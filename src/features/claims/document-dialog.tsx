"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { LocalClaim } from "@/logic/local";

export type DocumentView = { kind: "receipt" } | { kind: "attachment"; label: string; shows: string };

type Props = { claim: LocalClaim; view: DocumentView; onClose: () => void };

/** Opens a receipt or an attached file in a dialog. The prototype has no images, so it shows what the file contains. */
export function DocumentDialog({ claim, view, onClose }: Props) {
  const doc = claim.receipt.document;
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{view.kind === "receipt" ? "Receipt" : view.label}</DialogTitle>
          <DialogDescription>{claim.id}</DialogDescription>
        </DialogHeader>
        {view.kind === "receipt" && doc ? (
          <div className="rounded-card border p-4 text-sm">
            <div className="font-semibold">{doc.merchant}</div>
            <div className="mb-3 text-xs text-muted-foreground">{doc.date}</div>
            <Table className="table-fixed">
              <TableBody>
                {doc.lines.map((l) => (
                  <TableRow key={l.label}>
                    <TableCell className="whitespace-normal">{l.label}</TableCell>
                    <TableCell className="w-28 text-right tabular-nums">
                      {l.amount.toFixed(2)} {doc.currency}
                    </TableCell>
                  </TableRow>
                ))}
                {doc.tax != null ? (
                  <TableRow>
                    <TableCell>Tax</TableCell>
                    <TableCell className="text-right tabular-nums">{doc.tax.toFixed(2)}</TableCell>
                  </TableRow>
                ) : null}
                {doc.tip != null ? (
                  <TableRow>
                    <TableCell>Tip</TableCell>
                    <TableCell className="text-right tabular-nums">{doc.tip.toFixed(2)}</TableCell>
                  </TableRow>
                ) : null}
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {doc.total?.toFixed(2)} {doc.currency}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {doc.covers != null ? <p className="mt-2 text-xs text-muted-foreground">Diners printed on the receipt: {doc.covers}</p> : null}
            {Object.keys(doc.details).length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {Object.entries(doc.details)
                  .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        ) : view.kind === "attachment" ? (
          <p className="rounded-card border bg-card p-4 font-mono text-sm">{view.shows}</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
