"use client";

import { useState } from "react";
import { InfoCircle, Paperclip, Stars01, X } from "@untitledui/icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Table } from "@/components/application/table/table";
import { Tabs } from "@/components/application/tabs/tabs";
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

const CHECK_COLOR: Record<CheckResult, "success" | "error" | "warning" | "gray"> = {
  pass: "success",
  fail: "error",
  flag: "warning",
  unsure: "warning",
  skipped: "gray",
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
          <Button color="secondary" size="sm" onPress={onView}>
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
        <Stars01 className="size-3.5" />
      </span>
    );
  }
  if (actor === "employee" || actor === "noa") {
    return (
      <span aria-hidden className="flex shrink-0">
        <Avatar size="xs" initials={initials(name)} />
      </span>
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

  const receiptIcon = (
    <div aria-hidden className="flex h-10 w-8 shrink-0 flex-col gap-1 rounded border bg-muted/40 p-1.5">
      <Skeleton className="h-1.5" />
      <Skeleton className="h-1.5 w-[70%]" />
      <Skeleton className="h-1.5" />
    </div>
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
            {hasReceipt ? (
              <DocumentRow icon={receiptIcon} label="Receipt" onView={() => onView({ kind: "receipt" })} />
            ) : (
              // No receipt to show: the inline banner alone says what is missing or unreadable.
              <li className="p-3">
                <Alert className="border-info-border bg-info text-info-foreground">
                  <InfoCircle />
                  <AlertTitle>{receipt.status === "unreadable" ? "Receipt can't be read" : "Receipt missing"}</AlertTitle>
                  <AlertDescription className="text-info-foreground/90">{missingText}</AlertDescription>
                </Alert>
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
      <Table aria-label="Checks run" size="sm" className="table-fixed">
        <Table.Header>
          <Table.Head id="check" isRowHeader label="Check" className="w-[34%] px-4 text-left" />
          <Table.Head id="policy" label="Policy" className="px-4 text-left" />
          <Table.Head id="passed" label="Passed" className="w-28 px-4 text-left" />
        </Table.Header>
        <Table.Body>
          {claim.agent.checks.map((c) => (
            <Table.Row key={c.id} id={c.id} className="h-auto">
              <Table.Cell className="px-4 py-4 font-medium whitespace-normal text-primary">{c.label}</Table.Cell>
              <Table.Cell className="px-4 py-4 whitespace-normal text-left">{rules.find((r) => r.id === c.rule_id)?.text ?? "No policy number"}</Table.Cell>
              <Table.Cell className="px-4 py-4 text-left">
                <Badge type="pill-color" size="md" color={CHECK_COLOR[c.result]}>
                  {PASSED_LABEL[c.result]}
                </Badge>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
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
        <Button color="tertiary" size="sm" aria-label="Close details" iconLeading={X} onPress={onClose} />
      </div>
      <Tabs selectedKey={tab} onSelectionChange={(k) => onTab(k as MoreTab)} className="min-h-0 flex-1 gap-0">
        <Tabs.List type="underline" size="sm" aria-label="Details" className="h-11 w-full shrink-0 items-end gap-5 px-6">
          <Tabs.Item id="overview" label="Overview" />
          <Tabs.Item id="policy" label="Policy" />
          <Tabs.Item id="past" label="Past claims" />
          <Tabs.Item id="chat" label="Chat" />
        </Tabs.List>
        <Tabs.Panel id="overview" className="min-h-0 flex-1 overflow-y-auto p-6">
          <Overview claim={claim} onView={setViewing} />
        </Tabs.Panel>
        <Tabs.Panel id="policy" className="min-h-0 flex-1 overflow-y-auto p-6">
          <Policy claim={claim} />
        </Tabs.Panel>
        <Tabs.Panel id="past" className="min-h-0 flex-1 overflow-y-auto p-6">
          <PastClaims claim={claim} allClaims={allClaims} onOpenClaim={onOpenPastClaim} />
        </Tabs.Panel>
        <Tabs.Panel id="chat" className="flex min-h-0 flex-1 flex-col">
          <ClaimChat claim={claim} />
        </Tabs.Panel>
      </Tabs>
      {viewing ? <DocumentDialog claim={claim} view={viewing} onClose={() => setViewing(null)} /> : null}
    </aside>
  );
}
