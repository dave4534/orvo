"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { cancelSpeech, plainForSpeech, speak } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace-store";
import { Shimmer } from "./chat-steps";

/** Bars that move while the assistant listens or speaks. Same look in the chat and in the bar. */
export function Wave({ phase }: { phase: "listening" | "thinking" | "speaking" | "muted" }) {
  const bars = [0, 1, 2, 3, 4, 5, 6];
  return (
    <span aria-hidden className="flex h-6 items-center gap-0.5">
      {bars.map((i) => (
        <span
          key={i}
          className={cn(
            "w-1 origin-center rounded-full",
            phase === "muted" ? "h-1 bg-muted-foreground" : phase === "thinking" ? "h-1.5 animate-pulse bg-muted-foreground" : "h-6 bg-primary",
            phase === "listening" && "animate-wave",
            phase === "speaking" && "animate-wave",
          )}
          style={{ animationDelay: `${i * 110}ms`, animationDuration: phase === "speaking" ? "0.55s" : "1.1s" }}
        />
      ))}
    </span>
  );
}

type Props = {
  busy: boolean;
  onAsk: (text: string) => void;
  onStopAnswer: () => void;
  onEnd: () => void;
};

/**
 * Voice mode inside the chat. It takes the place of the message box: the chat stays visible, what you say appears as your message,
 * and the wave shows whether it is listening, thinking or speaking. Replies are read aloud as they finish.
 */
export function VoiceBar({ busy, onAsk, onStopAnswer, onEnd }: Props) {
  const speech = useSpeechInput();
  const { setReplyListener } = useWorkspace();
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [heard, setHeard] = useState("");
  const keep = useRef(true);
  const busyRef = useRef(busy);
  const speakingRef = useRef(false);
  const wasBusy = useRef(false);
  const mutedRef = useRef(muted);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  function listen() {
    if (!keep.current || busyRef.current || speakingRef.current || mutedRef.current) return;
    speech.start({
      onInterim: setHeard,
      onFinal: (text) => {
        setHeard("");
        if (!text || busyRef.current) return;
        keep.current = false;
        speech.stop();
        onAsk(text);
      },
      // The browser ends listening after a stretch of silence. Start again while voice mode is on.
      onEnded: () => {
        if (keep.current) listen();
      },
    });
  }

  function speakReply(text: string) {
    const spoken = plainForSpeech(text);
    if (!spoken) return;
    keep.current = false;
    speech.stop();
    speakingRef.current = true;
    const started = speak(spoken, {
      onStart: () => setSpeaking(true),
      onEnd: () => {
        speakingRef.current = false;
        setSpeaking(false);
        keep.current = !mutedRef.current;
        listen();
      },
    });
    if (!started) {
      speakingRef.current = false;
      keep.current = !mutedRef.current;
      listen();
    }
  }

  // Start listening when voice mode opens. Remounting (for example after moving to another claim) starts it again.
  useEffect(() => {
    keep.current = !mutedRef.current;
    listen();
    setReplyListener(speakReply);
    return () => {
      keep.current = false;
      cancelSpeech();
      setReplyListener(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While an answer is being written, do not listen. When it is done, go back to listening.
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (!wasBusy.current) return;
    // A screen action can finish and the answer can carry on right after, so wait a moment before deciding.
    const timer = window.setTimeout(() => {
      wasBusy.current = false;
      if (!speakingRef.current) listen();
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  function interrupt() {
    if (speakingRef.current) {
      cancelSpeech();
      speakingRef.current = false;
      setSpeaking(false);
      keep.current = !mutedRef.current;
      listen();
    } else if (busy) {
      onStopAnswer();
    }
  }

  function toggleMute() {
    if (mutedRef.current) {
      mutedRef.current = false;
      setMuted(false);
      keep.current = true;
      if (!busyRef.current && !speakingRef.current) listen();
    } else {
      mutedRef.current = true;
      setMuted(true);
      keep.current = false;
      speech.stop();
    }
  }

  function end() {
    keep.current = false;
    cancelSpeech();
    speech.stop();
    if (busy) onStopAnswer();
    onEnd();
  }

  const phase = speaking ? "speaking" : busy ? "thinking" : muted ? "muted" : "listening";
  const label = { speaking: "Speaking", thinking: "Thinking", muted: "Microphone is off", listening: "Listening" }[phase];

  return (
    <div className="shrink-0 border-t bg-card px-4 pt-3 pb-3">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Wave phase={phase} />
          {phase === "thinking" ? <Shimmer className="text-sm">{label}</Shimmer> : <span className="text-sm font-medium">{label}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={muted ? "Turn microphone on" : "Turn microphone off"} aria-pressed={muted} onClick={toggleMute}>
            {muted ? <MicOff /> : <Mic />}
          </Button>
          {speaking || busy ? (
            <Button variant="ghost" size="icon-sm" aria-label={speaking ? "Stop speaking" : "Stop the answer"} onClick={interrupt}>
              <Square className="fill-current" />
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={end}>
            <X data-icon="inline-start" />
            End voice
          </Button>
        </div>
      </div>
      {heard ? <p className="mt-2 text-sm text-muted-foreground italic">{heard}</p> : null}
      {speech.error === "blocked" ? <p className="mt-2 text-xs text-destructive">Microphone access is blocked. Allow it in the browser&apos;s site settings.</p> : null}
      {speech.error === "unavailable" ? <p className="mt-2 text-xs text-destructive">Voice isn&apos;t available in this browser right now.</p> : null}
    </div>
  );
}
