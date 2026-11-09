"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { claimStatusLabel, formatSubmitted, formatUsd } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";

type Props = { claim: LocalClaim; allClaims: LocalClaim[]; onOpenClaim: (id: string) => void };

const APPROVED = new Set<LocalClaim["status"]>(["approved_by_agent", "approved_by_noa"]);

/** Status shown in the list. Approvals read as just "Approved"; a claim still in review reads "Needs review". */
function rowStatus(c: LocalClaim): string {
  if (c.status === "waiting_on_noa") return "Needs review";
  if (APPROVED.has(c.status)) return "Approved";
  return claimStatusLabel(c);
}

/** The employee's claims, newest first, with the claim under review in the list. Other rows open that claim in a modal over the review. */
export function PastClaims({ claim, allClaims, onOpenClaim }: Props) {
  const related = new Set(claim.agent.related_claim_ids);
  const others = allClaims.filter((c) => c.employee_id === claim.employee_id && c.id !== claim.id);
  const rows = [claim, ...others].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

  return (
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
          {rows.map((c) => {
            const isCurrent = c.id === claim.id;
            return (
              <TableRow
                key={c.id}
                tabIndex={isCurrent ? undefined : 0}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={isCurrent ? `${c.merchant}, this claim` : `Open claim ${c.id}`}
                className={isCurrent ? "bg-muted/40" : "cursor-pointer"}
                onClick={isCurrent ? undefined : () => onOpenClaim(c.id)}
                onKeyDown={
                  isCurrent
                    ? undefined
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenClaim(c.id);
                        }
                      }
                }
              >
                <TableCell className="whitespace-normal">
                  <div className="text-base font-semibold">
                    {c.merchant}
                    {related.has(c.id) ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">Related</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatSubmitted(c.submitted_at)}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatUsd(c.amount.usd_claimed)}</TableCell>
                <TableCell className="whitespace-normal">
                  <Badge variant="outline" className="bg-card text-muted-foreground">
                    {rowStatus(c)}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
