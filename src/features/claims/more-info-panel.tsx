"use client";

import { useState } from "react";
import { Info, Paperclip, Sparkles, TriangleAlert, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataset } from "@/data";
import type { CheckResult, ClaimEvent } from "@/data/types";
import { employeeName } from "@/logic/comparison";
import { formatSubmitted, formatUsd, initials } from "@/logic/format";
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

/** Marks an event: a sparkle for what Orvo did, a profile initial for what a person did. */
function EventMarker({ actor, name }: { actor: ClaimEvent["actor"]; name: string }) {
  if (actor === "agent") {
    return (
      <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border border-info-border bg-info text-info-foreground">
        <Sparkles className="size-3.5" />
      </span>
    );
  }
  if (actor === "employee" || actor === "noa") {
    return (
      <Avatar size="sm" aria-hidden className="shrink-0">
        <AvatarFallback className="text-[10px] font-semibold">{initials(name)}</AvatarFallback>
      </Avatar>
    );
  }
  return (
    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
      <span className="size-2.5 rounded-full border-2 border-muted-foreground bg-card" />
    </span>
  );
}

function Overview({ claim, onView }: { claim: LocalClaim; onView: (view: DocumentView) => void }) {
  const events = [...claim.events].reverse();
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
          chase ? `Requests sent: ${chase.attempts.length} of ${chase.max_attempts}.` : "",
          statement ? "A card statement is attached instead." : "",
          claim.employee_note ? `Employee note: "${claim.employee_note}"` : "",
        ]
          .filter(Boolean)
          .join(" ");

  const receiptIcon = hasReceipt ? (
    <div aria-hidden className="flex h-10 w-8 shrink-0 flex-col gap-1 rounded border bg-muted/40 p-1.5">
      <Skeleton className="h-1.5" />
      <Skeleton className="h-1.5 w-[70%]" />
      <Skeleton className="h-1.5" />
    </div>
  ) : (
    <span aria-hidden className={cn(DOC_ICON, "bg-warning text-warning-foreground")}>
      <TriangleAlert className="size-4" />
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>Claim Number</SectionLabel>
        <p className="font-semibold tabular-nums">{claim.id}</p>
      </section>

      <section>
        <SectionLabel>Transaction</SectionLabel>
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
            <DocumentRow
              icon={receiptIcon}
              label="Receipt"
              sub={hasReceipt ? undefined : receipt.status === "unreadable" ? "Can't be read" : "Missing"}
              onView={hasReceipt ? () => onView({ kind: "receipt" }) : undefined}
            >
              {!hasReceipt ? (
                <Alert className="border-info-border bg-info text-info-foreground">
                  <Info />
                  <AlertTitle>{receipt.status === "unreadable" ? "Receipt can't be read" : "Receipt missing"}</AlertTitle>
                  <AlertDescription className="text-info-foreground/90">{missingText}</AlertDescription>
                </Alert>
              ) : null}
            </DocumentRow>
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
      </section>

      <section className="mt-2">
        <SectionLabel>Activity</SectionLabel>
        <ol>
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
              {i < events.length - 1 ? <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-border" /> : null}
              <EventMarker actor={e.actor} name={e.actor === "employee" ? employeeName(claim) : "Noa"} />
              <div className="min-w-0 pt-0.5">
                <div className="font-semibold">{e.text}</div>
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
  return (
    <section>
      <SectionLabel>Checks run</SectionLabel>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[34%] pl-0 text-left">Check</TableHead>
            <TableHead className="text-left">Policy</TableHead>
            <TableHead className="w-24 text-left">Passed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {claim.agent.checks.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="pl-0 font-medium whitespace-normal">{c.label}</TableCell>
              <TableCell className="whitespace-normal text-left text-muted-foreground">{rules.find((r) => r.id === c.rule_id)?.text ?? "No policy number"}</TableCell>
              <TableCell className="text-left">
                <Badge variant="outline" className={cn("bg-card", CHECK_STYLE[c.result])}>
                  {PASSED_LABEL[c.result]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
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
