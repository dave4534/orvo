"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { firstName } from "@/logic/actions";
import { employeeName } from "@/logic/comparison";
import { initials } from "@/logic/format";
import { isCardTool, type CardKind } from "@/logic/chat-cards";
import type { LocalClaim } from "@/logic/local";
import { photoFor } from "@/logic/photos";
import { useClaims } from "@/store/claims-store";
import { useWorkspace } from "@/store/workspace-store";
import { PolicyChecks, TransactionUnit } from "./claim-sections";
import { DocumentBody, DocumentDialog, type DocumentView } from "./document-dialog";

/** A tool part from the model that carries a card to draw: which card, and the result the server gave. */
export type CardPart = { type: string; state?: string; output?: unknown };

/** The cards in a message: finished card tools whose result says ok. */
export function cardsOf(parts: { type: string }[]): { tool: CardKind; output: Record<string, unknown> }[] {
  const out: { tool: CardKind; output: Record<string, unknown> }[] = [];
  for (const p of parts as CardPart[]) {
    const name = p.type.replace(/^tool-/, "");
    const o = p.output as Record<string, unknown> | undefined;
    if (!p.type.startsWith("tool-") || p.state !== "output-available" || o?.ok !== true) continue;
    if (isCardTool(name)) out.push({ tool: name, output: o });
    // A message that was really sent (the screen tool reports what it sent) is shown as a card.
    else if (name === "messageEmployee" && typeof o.sent === "string") out.push({ tool: "messageEmployee", output: o });
  }
  return out;
}

/** Widest a card ever asks the chat to be. */
const TABLE_WIDTH = 680;

function Shell({ title, claim, children }: { title: string; claim: LocalClaim; children: React.ReactNode }) {
  return (
    <Card size="sm" className="w-full self-stretch">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {claim.id}, {claim.merchant}
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TransactionCard({ claim }: { claim: LocalClaim }) {
  const [viewing, setViewing] = useState<DocumentView | null>(null);
  return (
    <Shell title="Transaction" claim={claim}>
      <TransactionUnit claim={claim} onView={setViewing} />
      {viewing ? <DocumentDialog claim={claim} view={viewing} onClose={() => setViewing(null)} /> : null}
    </Shell>
  );
}

function DocumentCard({ claim, view }: { claim: LocalClaim; view: DocumentView }) {
  return (
    <Shell title={view.kind === "receipt" ? "Receipt" : view.label} claim={claim}>
      <DocumentBody claim={claim} view={view} />
    </Shell>
  );
}

function PolicyCard({ claim }: { claim: LocalClaim }) {
  const { widenAi } = useWorkspace();
  // The table is wide, so the chat makes room for it.
  useEffect(() => widenAi(TABLE_WIDTH), [widenAi]);
  return (
    <Shell title="Policy breakdown" claim={claim}>
      <PolicyChecks claim={claim} />
    </Shell>
  );
}

/** A message that was sent, shown as it went: Noa's photo and the text. "View in chat" opens the claim chat, where the thread is. */
function MessageCard({ claim, text }: { claim: LocalClaim; text: string }) {
  const { runScreenTool } = useWorkspace();
  const [busy, setBusy] = useState(false);

  async function viewInChat() {
    setBusy(true);
    try {
      await runScreenTool("openClaim", { claimId: claim.id });
      await new Promise((r) => setTimeout(r, 300));
      await runScreenTool("openDetails", { tab: "chat" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card size="sm" className="w-full self-stretch">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Avatar size="sm" className="shrink-0">
            <AvatarImage src={photoFor("noa")} alt="" />
            <AvatarFallback className="text-[10px] font-semibold">NL</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle>Noa</CardTitle>
            <CardDescription>
              Sent to {firstName(claim)}, {claim.id}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm whitespace-pre-wrap">{text}</p>
        <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={viewInChat}>
          View in chat
          <ArrowUpRight data-icon="inline-end" />
        </Button>
      </CardContent>
    </Card>
  );
}

/** Draws one card from a card tool's result. Uses the claim's current data from the store. */
export function ChatCard({ tool, output }: { tool: CardKind; output: Record<string, unknown> }) {
  const { claims } = useClaims();
  const claim = claims.find((c) => c.id === output.claimId);
  if (!claim) return null;
  switch (tool) {
    case "showTransaction":
      return <TransactionCard claim={claim} />;
    case "showDocument": {
      if (output.which === "receipt") return <DocumentCard claim={claim} view={{ kind: "receipt" }} />;
      const a = claim.receipt.attachments.find((x) => x.label === output.label);
      return a ? <DocumentCard claim={claim} view={{ kind: "attachment", label: a.label, shows: a.shows }} /> : null;
    }
    case "showPolicyBreakdown":
      return <PolicyCard claim={claim} />;
    case "messageEmployee":
      return <MessageCard claim={claim} text={String(output.sent ?? "")} />;
  }
}

/**
 * The note posted each time a new claim comes up, as a card: the employee's photo and name, then the policy gap, the recommendation or
 * decision, and the reasoning. The text is the three "**Label:** value" lines from `triageNote`; the recommended button goes in `children`.
 */
export function TriageCard({ claimId, text, children }: { claimId: string; text: string; children?: React.ReactNode }) {
  const { claims } = useClaims();
  const claim = claims.find((c) => c.id === claimId);
  const rows = [...text.matchAll(/\*\*(.+?):\*\*\s*(.+)/g)].map((m) => ({ label: m[1], value: m[2] }));
  const name = claim ? employeeName(claim) : "";
  return (
    <Card size="sm" className="w-full self-stretch">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Avatar size="sm" className="shrink-0">
            <AvatarImage src={photoFor(claim?.employee_id)} alt="" />
            <AvatarFallback className="text-[10px] font-semibold">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate">{name}</CardTitle>
            <CardDescription>{claimId}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs font-semibold text-muted-foreground">{r.label}</dt>
              <dd className="text-sm">{r.value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </CardContent>
    </Card>
  );
}
