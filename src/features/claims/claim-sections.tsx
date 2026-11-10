"use client";

import { Info, Paperclip } from "lucide-react";

import { StatusBanner } from "@/components/status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dataset } from "@/data";
import type { CheckResult } from "@/data/types";
import { formatSubmitted, formatUsd } from "@/logic/format";
import { isWaitOver, type LocalClaim } from "@/logic/local";
import { FINANCE_LIMIT, WEEKLY_LIMIT, weeklyFacts } from "@/logic/policy";
import { assess } from "@/logic/recommendations";
import { PILL } from "@/lib/blocks";
import { cn } from "@/lib/utils";
import type { DocumentView } from "./document-dialog";

const CHECK_STYLE: Record<CheckResult, string> = {
  pass: "border-success-border text-success",
  fail: "border-danger-border bg-danger text-danger-foreground",
  flag: "border-warning-border bg-warning text-warning-foreground",
  unsure: "border-warning-border bg-warning text-warning-foreground",
  skipped: "text-muted-foreground",
};

/** The Policy tab answers "did it pass?", so pass and fail read as yes and no. */
const PASSED_LABEL: Record<CheckResult, string> = {
  pass: "Yes",
  fail: "No",
  flag: dataset.enums.check_result.flag,
  unsure: dataset.enums.check_result.unsure,
  skipped: dataset.enums.check_result.skipped,
};

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h3>;
}

/** One document listed under the transaction. The icon on the left can be a warning when the document is missing. */
function DocumentRow({
  icon,
  label,
  sub,
  onView,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onView?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="p-3">
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{label}</div>
          {sub ? <div className="truncate text-xs text-muted-foreground">{sub}</div> : null}
        </div>
        {onView ? (
          <Button variant="outline" size="sm" onClick={onView}>
            View
          </Button>
        ) : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </li>
  );
}

const DOC_ICON = "flex size-9 shrink-0 items-center justify-center rounded-lg";

/** The transaction as the Overview tab shows it: merchant, amount, receipt and attached files, then the description and date. Also used in the chat. */
export function TransactionUnit({ claim, onView }: { claim: LocalClaim; onView: (view: DocumentView) => void }) {
  const { receipt } = claim;
  const chase = claim.agent.chase;
  const doc = receipt.document;
  const hasReceipt = receipt.status !== "missing" && receipt.status !== "unreadable" && Boolean(doc);
  const statement = receipt.attachments.find((a) => /statement/i.test(a.kind) || /statement/i.test(a.label));

  const missingText =
    receipt.status === "unreadable"
      ? "The attached image can't be read, so there are no totals for it."
      : [
          "No receipt is attached.",
          chase ? `Requests sent: ${chase.attempts.length}, one a day.` : "",
          statement ? "A card statement is attached instead." : "",
          claim.employee_note ? `Employee note: "${claim.employee_note}"` : "",
        ]
          .filter(Boolean)
          .join(" ");

  const receiptIcon = (
    <div aria-hidden className="flex h-10 w-8 shrink-0 flex-col gap-1 rounded border bg-muted/40 p-1.5">
      <Skeleton className="h-1.5" />
      <Skeleton className="h-1.5 w-[70%]" />
      <Skeleton className="h-1.5" />
    </div>
  );

  return (
    <div>
        <div className="overflow-hidden rounded-xl border">
          <div className="p-3">
            <div className="truncate font-semibold">{claim.merchant}</div>
            <div className="text-xs text-muted-foreground">
              {dataset.enums.category[claim.category]}, submitted {formatSubmitted(claim.submitted_at)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatUsd(claim.amount.usd_claimed)}
              {claim.amount.original.currency !== "USD" ? `, ${claim.amount.original.currency} ${claim.amount.original.value.toFixed(2)}` : ""}
            </div>
          </div>

          <ul className="divide-y border-t">
            {hasReceipt ? (
              <DocumentRow icon={receiptIcon} label="Receipt" onView={() => onView({ kind: "receipt" })} />
            ) : (
              // No receipt to show: the inline banner alone says what is missing or unreadable.
              <li className="p-3">
                <StatusBanner icon={<Info />} title={receipt.status === "unreadable" ? "Receipt can't be read" : "Receipt missing"}>
                  {missingText}
                </StatusBanner>
              </li>
            )}
            {receipt.attachments.map((a) => (
              <DocumentRow
                key={a.label}
                icon={
                  <span aria-hidden className={cn(DOC_ICON, "bg-muted text-muted-foreground")}>
                    <Paperclip className="size-4" />
                  </span>
                }
                label={a.label}
                sub={a.shows}
                onView={() => onView({ kind: "attachment", label: a.label, shows: a.shows })}
              />
            ))}
          </ul>
        </div>

        <dl className="mt-3 flex flex-col gap-1.5 text-sm">
          <div className="grid grid-cols-[7.5rem_1fr] gap-3">
            <dt className="text-muted-foreground">Description</dt>
            <dd>{claim.description}</dd>
          </div>
          <div className="grid grid-cols-[7.5rem_1fr] gap-3">
            <dt className="text-muted-foreground">Expense date</dt>
            <dd>{formatSubmitted(claim.expense_date).split(",")[0]}</dd>
          </div>
        </dl>
    </div>
  );
}

type DerivedCheck = { id: string; label: string; policy: string; result: CheckResult };

/** Checks the app works out from the claims around this one. The agent's own checks are in the data; this one needs the employee's other claims. */
function derivedChecks(claim: LocalClaim, all: LocalClaim[]): DerivedCheck[] {
  const rows: DerivedCheck[] = [];
  if (claim.amount.usd_claimed <= FINANCE_LIMIT) {
    const week = weeklyFacts(claim, all);
    rows.push({
      id: "weekly_total",
      label: "Weekly total",
      policy: `${formatUsd(week.total)} in ${week.days} days. Above ${formatUsd(WEEKLY_LIMIT)} also needs Finance (our reading of the Finance policy)`,
      result: week.over ? "fail" : "pass",
    });
  }
  return rows;
}

/** Why the recommended action is the right one and why each other action is weaker. The same record the triage note reads. */
export function RecommendationReasoning({ claim, allClaims, now }: { claim: LocalClaim; allClaims: LocalClaim[]; now: Date }) {
  if (claim.status !== "waiting_on_noa" && !isWaitOver(claim, now)) return null;
  const a = assess(claim, allClaims, now);
  const rec = a.recommendation.recommended;
  return (
    <section aria-label="Why this is recommended">
      <SectionLabel>{rec ? "Why this is recommended" : "Close call"}</SectionLabel>
      {rec ? <p className="mb-3 text-sm"><span className="font-semibold">{rec.label}.</span> {a.why}</p> : null}
      {a.others.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm">
          {a.others.map((o) => (
            <li key={o.label}>
              <span className="font-semibold">{o.label}.</span> <span className="text-muted-foreground">{o.why}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** The Policy tab's table of checks, one row per check and whether it passed. Also used in the chat. */
export function PolicyChecks({ claim, allClaims }: { claim: LocalClaim; allClaims?: LocalClaim[] }) {
  const rules = dataset.policy.rules;
  const derived = allClaims ? derivedChecks(claim, allClaims) : [];
  return (
    <div>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%] px-3 py-3 text-left">Check</TableHead>
            <TableHead className="px-3 py-3 text-left">Policy</TableHead>
            <TableHead className="w-[8.5rem] px-3 py-3 text-right">Passed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {claim.agent.checks.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="px-3 py-4 font-medium whitespace-normal">{c.label}</TableCell>
              <TableCell className="px-3 py-4 whitespace-normal text-left text-muted-foreground">{rules.find((r) => r.id === c.rule_id)?.text ?? "No policy number"}</TableCell>
              <TableCell className="px-3 py-4 text-right">
                <Badge variant="outline" className={cn(PILL, "bg-card whitespace-nowrap", CHECK_STYLE[c.result])}>
                  {PASSED_LABEL[c.result]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {derived.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="px-3 py-4 font-medium whitespace-normal">{c.label}</TableCell>
              <TableCell className="px-3 py-4 whitespace-normal text-left text-muted-foreground">{c.policy}</TableCell>
              <TableCell className="px-3 py-4 text-right">
                <Badge variant="outline" className={cn(PILL, "bg-card whitespace-nowrap", CHECK_STYLE[c.result])}>
                  {PASSED_LABEL[c.result]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
