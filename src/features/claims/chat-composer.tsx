"use client";

import { useState } from "react";
import { AudioLines, Square } from "lucide-react";
import { CornerDownLeft, Microphone01 } from "@untitledui/icons";

import { Button } from "@/components/base/buttons/button";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { AI_MODEL_LABEL } from "@/lib/ai-model";
import { cn } from "@/lib/utils";
import { ClaudeLogo } from "./claude-logo";

type Props = {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onVoiceChat: () => void;
};

/** The message box. It grows with the text, Enter sends, Shift+Enter adds a line, and the send button becomes Stop while an answer is being written. The microphone dictates into the box; the waveform starts a voice chat. */
export function ChatComposer({ busy, onSend, onStop, onVoiceChat }: Props) {
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const speech = useSpeechInput();
  const shown = interim ? `${draft}${draft ? " " : ""}${interim}` : draft;

  function send() {
    const text = shown.trim();
    if (!text || busy) return;
    speech.stop();
    setDraft("");
    setInterim("");
    onSend(text);
  }

  function toggleMic() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    speech.start({ onInterim: setInterim, onFinal: (t) => setDraft((d) => (d ? `${d} ${t}` : t)) });
  }

  return (
    <div className="shrink-0 px-4 pt-2 pb-3">
      <InputGroup className="rounded-xl border-border bg-muted/40 shadow-none has-disabled:bg-muted/40 has-disabled:opacity-100 dark:has-disabled:bg-muted/40">
        <InputGroupTextarea
          aria-label="Message to Ask Orvo AI"
          placeholder={speech.listening ? "Listening" : "Ask about claims, history or policy"}
          rows={1}
          value={shown}
          onChange={(e) => {
            setInterim("");
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-40 min-h-11 field-sizing-content px-3.5 pt-3"
        />
        <InputGroupAddon align="block-end" className="justify-end gap-1">
          {speech.supported ? (
            <>
              <Tooltip title={speech.listening ? "Stop dictating" : "Dictate"}>
                <Button
                  color="tertiary"
                  size="sm"
                  className={cn("rounded-full text-primary", speech.listening && "animate-pulse bg-error-primary text-error-primary hover:bg-error-primary")}
                  aria-label={speech.listening ? "Stop dictating" : "Dictate"}
                  aria-pressed={speech.listening}
                  iconLeading={Microphone01}
                  onPress={toggleMic}
                />
              </Tooltip>
              <Tooltip title="Voice chat">
                <Button color="tertiary" size="sm" className="rounded-full text-primary" aria-label="Start voice chat" iconLeading={AudioLines} onPress={onVoiceChat} />
              </Tooltip>
            </>
          ) : null}
          {busy ? (
            <Button color="tertiary" size="sm" className="text-primary" aria-label="Stop" iconLeading={<Square className="size-4 fill-current" />} onPress={onStop} />
          ) : (
            <Button color="tertiary" size="sm" className="text-primary" aria-label="Send (Enter)" isDisabled={!shown.trim()} iconLeading={CornerDownLeft} onPress={send} />
          )}
        </InputGroupAddon>
      </InputGroup>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        {speech.error === "blocked" ? (
          "Microphone access is blocked. Allow it in the browser's site settings."
        ) : speech.error === "unavailable" ? (
          "Voice isn't available in this browser right now."
        ) : (
          <>
            <ClaudeLogo className="size-3.5" />
            Uses {AI_MODEL_LABEL}
          </>
        )}
      </p>
    </div>
  );
}
