"use client";

import { useState } from "react";
import { ArrowUp, AudioLines, Mic, Square } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const hasText = draft.trim() !== "" || interim.trim() !== "";
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
      <InputGroup className="rounded-card bg-card shadow-sm has-disabled:bg-card has-disabled:opacity-100 dark:has-disabled:bg-card">
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
          className="max-h-40 min-h-14 field-sizing-content px-4 pt-4 text-[15px]"
        />
        <InputGroupAddon align="block-end" className="justify-end gap-1">
          {speech.supported ? (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <InputGroupButton
                      size="icon-sm"
                      className={cn("rounded-full text-foreground hover:text-foreground", speech.listening && "animate-pulse bg-destructive/15 text-destructive hover:bg-destructive/20 hover:text-destructive")}
                      aria-label={speech.listening ? "Stop dictating" : "Dictate"}
                      aria-pressed={speech.listening}
                      onClick={toggleMic}
                    >
                      <Mic />
                    </InputGroupButton>
                  }
                />
                <TooltipContent>{speech.listening ? "Stop dictating" : "Dictate"}</TooltipContent>
              </Tooltip>
              {hasText || busy ? null : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <InputGroupButton size="icon-sm" className="rounded-full text-foreground hover:text-foreground" aria-label="Start voice chat" onClick={onVoiceChat}>
                        <AudioLines />
                      </InputGroupButton>
                    }
                  />
                  <TooltipContent>Voice chat</TooltipContent>
                </Tooltip>
              )}
            </>
          ) : null}
          {busy ? (
            <InputGroupButton variant="default" size="icon-sm" className="rounded-full" aria-label="Stop" onClick={onStop}>
              <Square className="fill-current" />
            </InputGroupButton>
          ) : hasText ? (
            <InputGroupButton variant="default" size="icon-sm" className="rounded-full" aria-label="Send (Enter)" onClick={send}>
              <ArrowUp />
            </InputGroupButton>
          ) : null}
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
