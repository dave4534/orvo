"use client";

import { useState } from "react";
import { FileText, Info, Paperclip, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataset } from "@/data";
import type { CheckResult, ReceiptRead } from "@/data/types";
import { formatSubmitted, formatUsd } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";
import { cn } from "@/lib/utils";
import { ClaimChat } from "./claim-chat";
import { DocumentDialog, type DocumentView } from "./document-dialog";
import type { MoreTab } from "./panel-types";
import { PastClaims } from "./past-claims";

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  tab: MoreTab;
  onTab: (tab: MoreTab) => void;
  onClose: () => void;
  onOpenPastClaim: (id: string) => void;
};

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h3>;
}

const READ_FIELDS: { key: keyof ReceiptRead; label: string; format: (v: unknown) => string }[] = [
  { key: "merchant", label: "Merchant", format: (v) => String(v ?? "None") },
  { key: "date", label: "Date", format: (v) => String(v ?? "None") },
  { key: "subtotal", label: "Subtotal", format: (v) => (typeof v === "number" ? formatUsd(v) : "None") },
  { key: "tax", label: "Tax", format: (v) => (typeof v === "number" ? formatUsd(v) : "None") },
  { key: "tip", label: "Tip", format: (v) => (typeof v === "number" ? formatUsd(v) : "None") },
  { key: "total", label: "Total", format: (v) => (typeof v === "number" ? formatUsd(v) : "None") },
  { key: "covers", label: "Covers", format: (v) => (v == null ? "None" : String(v)) },
];

/** One file with an icon on the left and a View action on the right. */
function FileRow({ label, sub, onView }: { label: string; sub?: string; onView: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border p-3">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Paperclip className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{label}</div>
        {sub ? <div className="truncate text-xs text-muted-foreground">{sub}</div> : null}
      </div>
      <Button variant="outline" size="sm" onClick={onView}>
        View
      </Button>
    </li>
  );
}

function Overview({ claim, onView }: { claim: LocalClaim; onView: (view: DocumentView) => void }) {
  const events = [...claim.events].reverse();
  const { receipt } = claim;
  const chase = claim.agent.chase;
  const doc = receipt.document;
  const read = receipt.agent_read;
  const hasReceipt = receipt.status !== "missing" && receipt.status !== "unreadable" && Boolean(doc);
  const statement = receipt.attachments.find((a) => /statement/i.test(a.kind) || /statement/i.test(a.label));
  const otherFiles = receipt.attachments.filter((a) => hasReceipt || a !== statement);
  const differing = read && doc ? READ_FIELDS.filter((f) => String(doc[f.key] ?? "") !== String(read[f.key] ?? "")) : [];

  const missingText =
    receipt.status === "unreadable"
      ? "The attached image can't be read, so there are no totals for it."
      : [
          "No receipt is attached.",
          chase ? `Requests sent: ${chase.attempts.length} of ${chase.max_attempts}.` : "",
          statement ? "A card statement is attached instead." : "",
          claim.employee_note ? `Employee note: "${claim.employee_note}"` : "",
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>Transaction</SectionLabel>
        <div className="flex items-center gap-3.5 rounded-xl border p-3">
          {hasReceipt ? (
            <div aria-hidden className="flex h-[72px] w-14 shrink-0 flex-col gap-1.5 rounded border bg-muted/40 p-2">
              <Skeleton className="h-2.5" />
              <Skeleton className="h-2.5 w-[70%]" />
              <Skeleton className="h-2.5" />
            </div>
          ) : (
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{claim.merchant}</div>
            <div className="text-xs text-muted-foreground">
              {dataset.enums.category[claim.category]}, submitted {formatSubmitted(claim.submitted_at)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatUsd(claim.amount.usd_claimed)}
              {claim.amount.original.currency !== "USD" ? `, ${claim.amount.original.currency} ${claim.amount.original.value.toFixed(2)}` : ""}
            </div>
          </div>
          {hasReceipt ? (
            <Button variant="outline" size="sm" onClick={() => onView({ kind: "receipt" })}>
              View
            </Button>
          ) : null}
        </div>

        {!hasReceipt ? (
          <>
            {statement ? (
              <ul className="mt-3">
                <FileRow label={statement.label} sub={statement.shows} onView={() => onView({ kind: "attachment", label: statement.label, shows: statement.shows })} />
              </ul>
            ) : null}
            <Alert className="mt-3 border-info-border bg-info text-info-foreground">
              <Info />
              <AlertTitle>{receipt.status === "unreadable" ? "Receipt can't be read" : "Receipt missing"}</AlertTitle>
              <AlertDescription className="text-info-foreground/90">{missingText}</AlertDescription>
            </Alert>
          </>
        ) : null}

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
      </section>

      {hasReceipt && read && doc ? (
        <section>
          <SectionLabel>What was read</SectionLabel>
          {differing.length === 0 ? (
            <p className="text-sm text-muted-foreground">The reading matches the receipt on every field.</p>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Read value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {differing.map((f) => (
                  <TableRow key={f.label}>
                    <TableCell>{f.label}</TableCell>
                    <TableCell>{f.format(doc[f.key])}</TableCell>
                    <TableCell className="bg-warning font-semibold text-warning-foreground">
                      {f.format(read[f.key])}
                      <span className="sr-only"> (differs)</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : null}

      {otherFiles.length > 0 ? (
        <section>
          <SectionLabel>Attachments</SectionLabel>
          <ul className="flex flex-col gap-2">
            {otherFiles.map((a) => (
              <FileRow key={a.label} label={a.label} sub={a.shows} onView={() => onView({ kind: "attachment", label: a.label, shows: a.shows })} />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionLabel>Activity</SectionLabel>
        <ol>
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-3.5 last:pb-0">
              {i < events.length - 1 ? <span aria-hidden className="absolute top-3.5 bottom-0 left-[5px] w-px bg-border" /> : null}
              <span aria-hidden className="mt-1 size-[11px] shrink-0 rounded-full border-2 border-muted-foreground bg-card" />
              <div className="min-w-0">
                <div className="font-semibold">
                  {e.text}
                  {e.actor === "agent" ? (
                    <Badge variant="outline" className="ml-1.5 border-info-border bg-info text-info-foreground">
                      Automatic
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">{formatSubmitted(e.at)}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Policy({ claim }: { claim: LocalClaim }) {
  const rules = dataset.policy.rules;
  const cited = claim.agent.cited_rule_ids.map((id) => rules.find((r) => r.id === id)).filter((r) => Boolean(r));
  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>Checks run</SectionLabel>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">Check</TableHead>
              <TableHead>Policy</TableHead>
              <TableHead className="w-24 text-right">Passed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claim.agent.checks.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium whitespace-normal">{c.label}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{rules.find((r) => r.id === c.rule_id)?.text ?? "No policy number"}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={cn("bg-card", CHECK_STYLE[c.result])}>
                    {PASSED_LABEL[c.result]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      {cited.length > 0 ? (
        <section>
          <SectionLabel>Rules cited</SectionLabel>
          <ul className="flex flex-col gap-1.5 text-sm">
            {cited.map((r) => (
              <li key={r!.id}>{r!.text}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Policy version {claim.agent.policy_version}. Decided {formatSubmitted(claim.agent.decided_at)}.
      </p>
    </div>
  );
}

/** Details drawer beside triage. The header and tabs stay put; only the tab content scrolls. */
export function MoreInfoPanel({ claim, allClaims, tab, onTab, onClose, onOpenPastClaim }: Props) {
  const [viewing, setViewing] = useState<DocumentView | null>(null);
  return (
    <aside aria-label="Details" className="flex h-full min-h-0 w-full flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <h2 className="text-base font-semibold">Details</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <X />
        </Button>
      </div>
      <Tabs value={tab} onValueChange={(v) => onTab(v as MoreTab)} className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="h-11 w-full shrink-0 justify-start gap-5 border-b px-6">
          <TabsTrigger value="overview" className="flex-none px-1">
            Overview
          </TabsTrigger>
          <TabsTrigger value="policy" className="flex-none px-1">
            Policy
          </TabsTrigger>
          <TabsTrigger value="past" className="flex-none px-1">
            Past claims
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-none px-1">
            Chat
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto p-6">
          <Overview claim={claim} onView={setViewing} />
        </TabsContent>
        <TabsContent value="policy" className="min-h-0 flex-1 overflow-y-auto p-6">
          <Policy claim={claim} />
        </TabsContent>
        <TabsContent value="past" className="min-h-0 flex-1 overflow-y-auto p-6">
          <PastClaims claim={claim} allClaims={allClaims} onOpenClaim={onOpenPastClaim} />
        </TabsContent>
        <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
          <ClaimChat claim={claim} />
        </TabsContent>
      </Tabs>
      {viewing ? <DocumentDialog claim={claim} view={viewing} onClose={() => setViewing(null)} /> : null}
    </aside>
  );
}
