"use client";

import { Table, TableCard } from "@/components/application/table/table";
import { Badge } from "@/components/base/badges/badges";
import { cx } from "@/utils/cx";
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
    <TableCard.Root className="rounded-lg">
      <Table aria-label="Past claims" className="table-fixed">
        <Table.Header>
          <Table.Head id="claim" isRowHeader label="Claim" className="px-4 py-3" />
          <Table.Head id="amount" label="Amount" className="w-24 px-4 py-3" />
          <Table.Head id="status" label="Status" className="w-44 px-4 py-3" />
        </Table.Header>
        <Table.Body>
          {rows.map((c) => {
            const isCurrent = c.id === claim.id;
            return (
              <Table.Row
                key={c.id}
                id={c.id}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={isCurrent ? `${c.merchant}, this claim` : `Open claim ${c.id}`}
                className={cx("h-auto", isCurrent ? "bg-secondary" : "cursor-pointer")}
                onAction={isCurrent ? undefined : () => onOpenClaim(c.id)}
              >
                <Table.Cell className="px-4 py-4 whitespace-normal">
                  <div className="text-base font-semibold text-primary">
                    {c.merchant}
                    {related.has(c.id) ? <span className="ml-1.5 text-xs font-normal text-tertiary">Related</span> : null}
                  </div>
                  <div className="text-xs text-tertiary">{formatSubmitted(c.submitted_at)}</div>
                </Table.Cell>
                <Table.Cell className="px-4 py-4 text-left tabular-nums">{formatUsd(c.amount.usd_claimed)}</Table.Cell>
                <Table.Cell className="px-4 py-4 whitespace-normal">
                  <Badge type="pill-color" size="sm" color="gray">
                    {rowStatus(c)}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
}
