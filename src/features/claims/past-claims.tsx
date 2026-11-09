"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dataset, NOW } from "@/data";
import { employeeName } from "@/logic/comparison";
import { claimStatusLabel, formatSubmitted, formatUsd } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";

type Props = { claim: LocalClaim; allClaims: LocalClaim[]; onOpenClaim: (id: string) => void };

/** The employee's other claims, newest first. A row opens that claim in a modal over the review. */
export function PastClaims({ claim, allClaims, onOpenClaim }: Props) {
  const rows = allClaims
    .filter((c) => c.employee_id === claim.employee_id && c.id !== claim.id)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  const related = new Set(claim.agent.related_claim_ids);
  const month = allClaims.filter((c) => c.employee_id === claim.employee_id && new Date(c.submitted_at).getMonth() === NOW.getMonth());
  const total = month.reduce((s, c) => s + c.amount.usd_claimed, 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {employeeName(claim)} has {month.length} {month.length === 1 ? "claim" : "claims"} this month, {formatUsd(total)} in total.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{employeeName(claim)} has no other claims.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Claim</TableHead>
                <TableHead className="w-24 text-right">Amount</TableHead>
                <TableHead className="w-36">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow
                  key={c.id}
                  tabIndex={0}
                  aria-label={`Open claim ${c.id}`}
                  onClick={() => onOpenClaim(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenClaim(c.id);
                    }
                  }}
                >
                  <TableCell className="whitespace-normal">
                    <div className="font-semibold">
                      {c.id}
                      {related.has(c.id) ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">Related</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dataset.enums.category[c.category]}, {formatSubmitted(c.submitted_at)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(c.amount.usd_claimed)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <Badge variant="outline" className="bg-card text-muted-foreground">
                      {claimStatusLabel(c)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
