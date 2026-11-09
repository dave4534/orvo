"use client";

import { useState } from "react";
import { ArrowUp, Square } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";

type Props = {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

/** The message box. It grows with the text, Enter sends, Shift+Enter adds a line, and the send button becomes Stop while an answer is being written. */
export function ChatComposer({ busy, onSend, onStop }: Props) {
  const [draft, setDraft] = useState("");

  function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    onSend(text);
  }

  return (
    <div className="shrink-0 px-4 pt-2 pb-3">
      <InputGroup className="rounded-2xl bg-card shadow-sm">
        <InputGroupTextarea
          aria-label="Message to Ask Orvo AI"
          placeholder="Ask about claims, history or policy"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-40 min-h-11 field-sizing-content px-3.5 pt-3"
        />
        <InputGroupAddon align="block-end" className="justify-end">
          {busy ? (
            <InputGroupButton variant="default" size="icon-sm" className="rounded-full" aria-label="Stop" onClick={onStop}>
              <Square className="fill-current" />
            </InputGroupButton>
          ) : (
            <InputGroupButton variant="default" size="icon-sm" className="rounded-full" aria-label="Send" disabled={!draft.trim()} onClick={send}>
              <ArrowUp />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      <p className="mt-2 text-center text-xs text-muted-foreground">Orvo AI reads the claim data and can&apos;t change anything.</p>
    </div>
  );
}
