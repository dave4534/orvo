"use client";

import { useState } from "react";
import { Send01 } from "@untitledui/icons";

import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import { firstName } from "@/logic/actions";
import { formatSubmitted } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";
import { cn } from "@/lib/utils";
import { useClaims } from "@/store/claims-store";

type Line = { at: string; from: "manager" | "employee"; text: string };

/** Everything said between the manager and the employee on this claim: automatic requests, replies and typed messages. */
function threadFor(claim: LocalClaim): Line[] {
  const lines: Line[] = [];
  for (const a of claim.agent.chase?.attempts ?? []) {
    lines.push({ at: a.sent_at, from: "manager", text: a.message });
    if (a.reply) lines.push({ at: a.reply.at, from: "employee", text: a.reply.text });
  }
  for (const m of claim.local?.thread ?? []) lines.push({ at: m.at, from: "manager", text: m.text });
  return lines.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function ClaimChat({ claim }: { claim: LocalClaim }) {
  const { sendMessage } = useClaims();
  const [draft, setDraft] = useState("");
  const name = firstName(claim);
  const lines = threadFor(claim);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-6" aria-live="polite">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Messages sent here stay with this claim, so there is a record of what was asked.</p>
        ) : (
          lines.map((l, i) => (
            <div key={`${l.at}-${i}`} className={cn("flex max-w-[85%] flex-col gap-1", l.from === "manager" ? "self-end items-end" : "self-start")}>
              <div className={cn("rounded-xl px-3.5 py-2.5 text-sm", l.from === "manager" ? "bg-brand-solid text-white" : "border bg-card")}>{l.text}</div>
              <div className="text-xs text-muted-foreground">
                {l.from === "manager" ? "Sent" : name}, {formatSubmitted(l.at)}
              </div>
            </div>
          ))
        )}
      </div>
      <form
        className="flex items-end gap-2 border-t p-4"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(claim.id, draft);
          setDraft("");
        }}
      >
        <TextArea aria-label={`Message to ${name}`} placeholder={`Message ${name}`} rows={2} value={draft} onChange={setDraft} className="flex-1" textAreaClassName="resize-none" />
        <Button type="submit" size="md" isDisabled={!draft.trim()} iconLeading={Send01}>
          Send
        </Button>
      </form>
    </div>
  );
}
