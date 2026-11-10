"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { firstName } from "@/logic/actions";
import { formatSubmitted } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";
import { cn } from "@/lib/utils";
import { useClaims } from "@/store/claims-store";
import { useWorkspace } from "@/store/workspace-store";

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
  const { setControl } = useWorkspace();

  // The assistant can type into this box, send what is typed, or clear it, exactly as Noa would. It reports what really happened.
  useEffect(() => {
    setControl("employeeChat", (input) => {
      switch (input.do) {
        case "read":
          return { ok: true, draft };
        case "type": {
          const text = String(input.text ?? "").trim();
          if (!text) return { ok: false, error: "There was no text to type." };
          setDraft(text);
          return { ok: true, typed: text, to: name };
        }
        case "send": {
          const text = (typeof input.text === "string" ? input.text : draft).trim();
          if (!text) return { ok: false, error: "There is no message typed to send." };
          sendMessage(claim.id, text);
          setDraft("");
          return { ok: true, sent: text, to: name, note: "A message in the claim chat can't be undone, so do not offer undo." };
        }
        case "clear":
          if (!draft.trim()) return { ok: false, error: "There is no unsent message." };
          setDraft("");
          return { ok: true };
        default:
          return { ok: false, error: "Unknown chat action." };
      }
    });
    return () => setControl("employeeChat", null);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-6" aria-live="polite">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Messages sent here stay with this claim, so there is a record of what was asked.</p>
        ) : (
          lines.map((l, i) => (
            <div key={`${l.at}-${i}`} className={cn("flex max-w-[85%] flex-col gap-1", l.from === "manager" ? "self-end items-end" : "self-start")}>
              <div className={cn("rounded-xl px-3.5 py-2.5 text-sm", l.from === "manager" ? "bg-(--primary) text-primary-foreground" : "border bg-card")}>{l.text}</div>
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
        <Textarea aria-label={`Message to ${name}`} placeholder={`Message ${name}`} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" disabled={!draft.trim()}>
          <Send data-icon="inline-start" />
          Send
        </Button>
      </form>
    </div>
  );
}
