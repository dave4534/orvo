"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataset, NOW } from "@/data";
import type { CheckResult, ReceiptRead } from "@/data/types";
import { employeeName } from "@/logic/comparison";
import { claimStatusLabel, formatSubmitted, formatUsd } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";
import { cn } from "@/lib/utils";
import type { MoreTab } from "./panel-types";

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  tab: MoreTab;
  onTab: (tab: MoreTab) => void;
  onOpenClaim: (id: string) => void;
};

const CHECK_STYLE: Record<CheckResult, string> = {
  pass: "border-success-border text-success",
  fail: "border-danger-border bg-danger text-danger-foreground",
  flag: "border-warning-border bg-warning text-warning-foreground",
  unsure: "border-warning-border bg-warning text-warning-foreground",
  skipped: "text-muted-foreground",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h3>;
}

function Overview({ claim, onTab }: { claim: LocalClaim; onTab: (t: MoreTab) => void }) {
  const events = [...claim.events].reverse();
  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>Transaction</SectionLabel>
        <div className="flex items-center gap-3.5 rounded-xl border p-3">
          <div aria-hidden className="flex h-[72px] w-14 shrink-0 flex-col gap-1.5 rounded border bg-muted/40 p-2">
            <Skeleton className="h-2.5" />
            <Skeleton className="h-2.5 w-[70%]" />
            <Skeleton className="h-2.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{claim.merchant}</div>
            <div className="text-xs text-muted-foreground">{dataset.enums.category[claim.category]}, submitted {formatSubmitted(claim.submitted_at)}</div>
            <div className="text-xs text-muted-foreground">
              {formatUsd(claim.amount.usd_claimed)}
              {claim.amount.original.currency !== "USD" ? `, ${claim.amount.original.currency} ${claim.amount.original.value.toFixed(2)}` : ""}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onTab("documents")}>
            View receipt
          </Button>
        </div>
        <dl className="mt-3 flex flex-col gap-1.5 text-sm">
          <div className="grid grid-cols-[7.5rem_1fr] gap-3"><dt className="text-muted-foreground">Description</dt><dd>{claim.description}</dd></div>
          <div className="grid grid-cols-[7.5rem_1fr] gap-3"><dt className="text-muted-foreground">Expense date</dt><dd>{formatSubmitted(claim.expense_date).split(",")[0]}</dd></div>
          <div className="grid grid-cols-[7.5rem_1fr] gap-3"><dt className="text-muted-foreground">Attendees</dt><dd>{claim.attendees.count}</dd></div>
          {claim.employee_note ? (
            <div className="grid grid-cols-[7.5rem_1fr] gap-3"><dt className="text-muted-foreground">Employee note</dt><dd>&quot;{claim.employee_note}&quot;</dd></div>
          ) : null}
        </dl>
      </section>

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
                    <Badge variant="outline" className="ml-1.5 border-info-border bg-info text-info-foreground">Orvo AI</Badge>
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

const READ_FIELDS: { key: keyof ReceiptRead; label: string; format: (v: unknown) => string }[] = [
  { key: "merchant", label: "Merchant", format: (v) => String(v ?? "None") },
  { key: "date", label: "Date", format: (v) => String(v ?? "None") },
  { key: "subtotal", label: "Subtotal", format: (v) => (typeof v === "number" ? formatUsd(v) : "None") },
  { key: "tax", label: "Tax", format: (v) => (typeof v === "number" ? formatUsd(v) : "None") },
  { key: "tip", label: "Tip", format: (v) => (typeof v === "number" ? formatUsd(v) : "None") },
  { key: "total", label: "Total", format: (v) => (typeof v === "number" ? formatUsd(v) : "None") },
  { key: "covers", label: "Covers", format: (v) => (v == null ? "None" : String(v)) },
];

function Documents({ claim }: { claim: LocalClaim }) {
  const { receipt } = claim;
  const doc = receipt.document;
  const read = receipt.agent_read;
  const chase = claim.agent.chase;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>Receipt</SectionLabel>
        {receipt.status === "missing" ? (
          <p className="rounded-xl border p-4 text-sm">No receipt. {chase ? `Orvo asked ${chase.attempts.length} of ${chase.max_attempts} times.` : ""}</p>
        ) : receipt.status === "unreadable" || !doc ? (
          <p className="rounded-xl border p-4 text-sm">The attached image can&apos;t be read, so Orvo has no totals for it.</p>
        ) : (
          <div className="rounded-xl border p-4 text-sm">
            <div className="font-semibold">{doc.merchant}</div>
            <div className="mb-3 text-xs text-muted-foreground">{doc.date}</div>
            <Table className="table-fixed">
              <TableBody>
                {doc.lines.map((l) => (
                  <TableRow key={l.label}>
                    <TableCell className="whitespace-normal">{l.label}</TableCell>
                    <TableCell className="w-28 text-right tabular-nums">{l.amount.toFixed(2)} {doc.currency}</TableCell>
                  </TableRow>
                ))}
                {doc.tax != null ? <TableRow><TableCell>Tax</TableCell><TableCell className="text-right tabular-nums">{doc.tax.toFixed(2)}</TableCell></TableRow> : null}
                {doc.tip != null ? <TableRow><TableCell>Tip</TableCell><TableCell className="text-right tabular-nums">{doc.tip.toFixed(2)}</TableCell></TableRow> : null}
                <TableRow className="font-semibold"><TableCell>Total</TableCell><TableCell className="text-right tabular-nums">{doc.total?.toFixed(2)} {doc.currency}</TableCell></TableRow>
              </TableBody>
            </Table>
            {doc.covers != null ? <p className="mt-2 text-xs text-muted-foreground">Diners printed on the receipt: {doc.covers}</p> : null}
            {Object.keys(doc.details).length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {Object.entries(doc.details).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section>
        <SectionLabel>What Orvo read</SectionLabel>
        {!read || !doc ? (
          <p className="text-sm text-muted-foreground">Orvo has nothing to show because there is no readable receipt.</p>
        ) : (
          (() => {
            const differing = READ_FIELDS.filter((f) => String(doc[f.key] ?? "") !== String(read[f.key] ?? ""));
            return differing.length === 0 ? (
              <p className="text-sm text-muted-foreground">Orvo&apos;s reading matches the receipt on every field.</p>
            ) : (
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow><TableHead>Field</TableHead><TableHead>Receipt</TableHead><TableHead>Orvo read</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {differing.map((f) => (
                    <TableRow key={f.label}>
                      <TableCell>{f.label}</TableCell>
                      <TableCell>{f.format(doc[f.key])}</TableCell>
                      <TableCell className="bg-warning font-semibold text-warning-foreground">{f.format(read[f.key])}<span className="sr-only"> (differs)</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          })()
        )}
      </section>

      {receipt.attachments.length > 0 ? (
        <section>
          <SectionLabel>Attachments</SectionLabel>
          <ul className="flex flex-col gap-2">
            {receipt.attachments.map((a) => (
              <li key={a.label} className="rounded-xl border p-3 text-sm">
                <div className="font-semibold">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.shows}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {chase && chase.attempts.length > 0 ? (
        <section>
          <SectionLabel>Requests to {employeeName(claim)}</SectionLabel>
          <ol className="flex flex-col gap-2">
            {chase.attempts.map((a) => (
              <li key={a.sent_at} className="rounded-xl border p-3 text-sm">
                <div className="text-xs text-muted-foreground">{formatSubmitted(a.sent_at)}</div>
                <div>{a.message}</div>
                {a.reply ? <div className="mt-1 text-muted-foreground">Reply: {a.reply.text}</div> : <div className="mt-1 text-muted-foreground">No reply yet.</div>}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function Policy({ claim }: { claim: LocalClaim }) {
  const rules = dataset.policy.rules;
  const cited = claim.agent.cited_rule_ids.map((id) => rules.find((r) => r.id === id)).filter((r) => Boolean(r));
  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>Checks Orvo ran</SectionLabel>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[26%]">Check</TableHead>
              <TableHead className="w-[24%]">Policy</TableHead>
              <TableHead>This claim</TableHead>
              <TableHead className="w-24 text-right">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claim.agent.checks.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium whitespace-normal">{c.label}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{rules.find((r) => r.id === c.rule_id)?.text ?? "No policy number"}</TableCell>
                <TableCell className="whitespace-normal">{c.detail}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={cn("bg-card", CHECK_STYLE[c.result])}>{dataset.enums.check_result[c.result]}</Badge>
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
      <p className="text-xs text-muted-foreground">Policy version {claim.agent.policy_version}. Decided {formatSubmitted(claim.agent.decided_at)}.</p>
    </div>
  );
}

function PastClaims({ claim, allClaims, onOpenClaim }: { claim: LocalClaim; allClaims: LocalClaim[]; onOpenClaim: (id: string) => void }) {
  const mine = allClaims
    .filter((c) => c.employee_id === claim.employee_id && c.id !== claim.id)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  const related = claim.agent.related_claim_ids.map((id) => allClaims.find((c) => c.id === id)).filter((c): c is LocalClaim => Boolean(c));
  const month = allClaims.filter((c) => c.employee_id === claim.employee_id && new Date(c.submitted_at).getMonth() === NOW.getMonth());
  const total = month.reduce((s, c) => s + c.amount.usd_claimed, 0);

  const row = (c: LocalClaim, note?: string) => (
    <li key={c.id}>
      <Button variant="ghost" className="h-auto w-full justify-between gap-3 px-2 py-2 text-left font-normal" onClick={() => onOpenClaim(c.id)}>
        <span className="min-w-0">
          <span className="block font-semibold">{c.id}, {formatUsd(c.amount.usd_claimed)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {dataset.enums.category[c.category]}, {formatSubmitted(c.submitted_at)}{note ? `. ${note}` : ""}
          </span>
        </span>
        <Badge variant="outline" className="shrink-0 bg-card text-muted-foreground">{claimStatusLabel(c)}</Badge>
      </Button>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {employeeName(claim)} has {month.length} {month.length === 1 ? "claim" : "claims"} this month, {formatUsd(total)} in total.
      </p>
      {related.length > 0 ? (
        <section>
          <SectionLabel>Related to this claim</SectionLabel>
          <ul>{related.map((c) => row(c, "Linked by Orvo"))}</ul>
        </section>
      ) : null}
      <section>
        <SectionLabel>Other claims</SectionLabel>
        {mine.length === 0 ? <p className="text-sm text-muted-foreground">{employeeName(claim)} has no other claims.</p> : <ul>{mine.map((c) => row(c))}</ul>}
      </section>
    </div>
  );
}

/** Right column of the claims queue, beside triage. Always shows the claim open in triage. */
export function MoreInfoPanel({ claim, allClaims, tab, onTab, onOpenClaim }: Props) {
  return (
    <aside aria-label="More info" className="flex min-h-0 w-[30rem] max-w-full shrink-0 flex-col border-l">
      <Tabs value={tab} onValueChange={(v) => onTab(v as MoreTab)} className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="h-11 w-full justify-start border-b px-6">
          <TabsTrigger value="overview" className="flex-none px-1 mr-5">Overview</TabsTrigger>
          <TabsTrigger value="documents" className="flex-none px-1 mr-5">Documents</TabsTrigger>
          <TabsTrigger value="policy" className="flex-none px-1 mr-5">Policy</TabsTrigger>
          <TabsTrigger value="past" className="flex-none px-1">Past claims</TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <TabsContent value="overview"><Overview claim={claim} onTab={onTab} /></TabsContent>
          <TabsContent value="documents"><Documents claim={claim} /></TabsContent>
          <TabsContent value="policy"><Policy claim={claim} /></TabsContent>
          <TabsContent value="past"><PastClaims claim={claim} allClaims={allClaims} onOpenClaim={onOpenClaim} /></TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}
