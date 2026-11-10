"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClaimEvent } from "@/data/types";
import { employeeName } from "@/logic/comparison";
import { formatSubmitted, initials } from "@/logic/format";
import { photoFor } from "@/logic/photos";
import type { LocalClaim } from "@/logic/local";
import { TABS_LIST, TABS_TRIGGER } from "@/lib/blocks";
import { cn } from "@/lib/utils";
import { ClaimChat } from "./claim-chat";
import { DocumentDialog, type DocumentView } from "./document-dialog";
import type { MoreTab } from "./panel-types";
import { PastClaims } from "./past-claims";
import { PolicyChecks, RecommendationReasoning, SectionLabel, TransactionUnit } from "./claim-sections";
import { useClaims } from "@/store/claims-store";
import { useWorkspace } from "@/store/workspace-store";

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  tab: MoreTab;
  onTab: (tab: MoreTab) => void;
  onClose: () => void;
  onOpenPastClaim: (id: string) => void;
};

/** Marks an event: a sparkle for what Orvo did, a profile initial for what a person did. */
function EventMarker({ actor, name, personId }: { actor: ClaimEvent["actor"]; name: string; personId: string }) {
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
        <AvatarImage src={photoFor(personId)} alt="" />
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

/** The claim's event history, newest first. Shared by the overview and the correction dialog. */
export function ActivityList({ claim }: { claim: LocalClaim }) {
  const events = [...claim.events].reverse();
  return (
    <ol>
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 ? <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-border" /> : null}
          <EventMarker actor={e.actor} name={e.actor === "employee" ? employeeName(claim) : "Noa"} personId={e.actor === "employee" ? claim.employee_id : "noa"} />
          <div className="min-w-0 pt-0.5">
            <div className="font-semibold">{e.text}</div>
            <div className="text-xs text-muted-foreground">{formatSubmitted(e.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Overview({ claim, onView }: { claim: LocalClaim; onView: (view: DocumentView) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>Claim Number</SectionLabel>
        <p className="font-semibold tabular-nums">{claim.id}</p>
      </section>

      <section>
        <SectionLabel>Transaction</SectionLabel>
        <TransactionUnit claim={claim} onView={onView} />
      </section>

      <section className="mt-2">
        <SectionLabel>Activity</SectionLabel>
        <ActivityList claim={claim} />
      </section>
    </div>
  );
}

function Policy({ claim, allClaims }: { claim: LocalClaim; allClaims: LocalClaim[] }) {
  const { now } = useClaims();
  return (
    <div className="flex flex-col gap-6">
      <RecommendationReasoning claim={claim} allClaims={allClaims} now={now} />
      <section>
        <SectionLabel>Checks run</SectionLabel>
        <PolicyChecks claim={claim} allClaims={allClaims} />
      </section>
    </div>
  );
}

/** Details drawer beside triage. The header and tabs stay put; only the tab content scrolls. */
export function MoreInfoPanel({ claim, allClaims, tab, onTab, onClose, onOpenPastClaim }: Props) {
  const [viewing, setViewing] = useState<DocumentView | null>(null);
  const { setControl } = useWorkspace();

  // The assistant can open and close the receipt and attachments, the same as the View buttons. It reports what really opened.
  useEffect(() => {
    setControl("document", (input) => {
      const { receipt } = claim;
      if (input.do === "read") return { ok: true, open: viewing !== null };
      if (input.do === "close") {
        if (!viewing) return { ok: false, error: "No receipt or attachment is open." };
        setViewing(null);
        return { ok: true };
      }
      if (input.which === "receipt") {
        if (receipt.status === "missing" || receipt.status === "unreadable" || !receipt.document) return { ok: false, error: "This claim has no readable receipt to open." };
        setViewing({ kind: "receipt" });
        return { ok: true, opened: "receipt" };
      }
      const label = typeof input.label === "string" ? input.label.toLowerCase() : "";
      const a = (label ? receipt.attachments.find((x) => x.label.toLowerCase().includes(label) || x.kind.toLowerCase().includes(label)) : undefined) ?? (label ? undefined : receipt.attachments[0]);
      if (!a) return { ok: false, error: receipt.attachments.length ? `No attachment matches "${label}". There is: ${receipt.attachments.map((x) => x.label).join(", ")}.` : "This claim has no attachments." };
      setViewing({ kind: "attachment", label: a.label, shows: a.shows });
      return { ok: true, opened: a.label };
    });
    return () => setControl("document", null);
  });
  return (
    <aside aria-label="Details" className="flex h-full min-h-0 w-full flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <h2 className="text-base font-semibold">Details</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <X />
        </Button>
      </div>
      <Tabs value={tab} onValueChange={(v) => onTab(v as MoreTab)} className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className={cn(TABS_LIST, "w-full shrink-0 justify-start gap-5 px-6")}>
          <TabsTrigger value="overview" className={cn(TABS_TRIGGER, "flex-none px-1")}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="policy" className={cn(TABS_TRIGGER, "flex-none px-1")}>
            Policy
          </TabsTrigger>
          <TabsTrigger value="past" className={cn(TABS_TRIGGER, "flex-none px-1")}>
            Past claims
          </TabsTrigger>
          <TabsTrigger value="chat" className={cn(TABS_TRIGGER, "flex-none px-1")}>
            Chat
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto p-6">
          <Overview claim={claim} onView={setViewing} />
        </TabsContent>
        <TabsContent value="policy" className="min-h-0 flex-1 overflow-y-auto p-6">
          <Policy claim={claim} allClaims={allClaims} />
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
