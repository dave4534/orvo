"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { cancelSpeech, plainForSpeech, speak } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { Shimmer } from "./chat-steps";

type Props = {
  /** An answer is being prepared. */
  busy: boolean;
  /** The latest answer from the model, once it is complete. */
  reply: string | null;
  onAsk: (text: string) => void;
  onStopAnswer: () => void;
  onEnd: () => void;
};

/** Hands-free conversation: it listens, sends what was said, reads the answer aloud, then listens again. */
export function VoiceChat({ busy, reply, onAsk, onStopAnswer, onEnd }: Props) {
  const speech = useSpeechInput();
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [heard, setHeard] = useState("");
  const wasBusy = useRef(false);
  const keepListening = useRef(true);

  function listen() {
    if (!keepListening.current) return;
    speech.start({
      onInterim: setHeard,
      onFinal: (text) => {
        if (!text) return;
        keepListening.current = false;
        speech.stop();
        setHeard(text);
        onAsk(text);
      },
      // The browser ends recognition after a stretch of silence. Start again while the conversation goes on.
      onEnded: () => {
        if (keepListening.current) listen();
      },
    });
  }

  // Start listening when the voice chat opens, and stop everything when it closes.
  useEffect(() => {
    listen();
    return () => {
      keepListening.current = false;
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When an answer finishes, read it aloud and then listen again.
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    const spoken = reply ? plainForSpeech(reply) : "";
    const started = speak(spoken, {
      onStart: () => setSpeaking(true),
      onEnd: () => {
        setSpeaking(false);
        keepListening.current = !muted;
        listen();
      },
    });
    if (!started) {
      keepListening.current = !muted;
      listen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  function interrupt() {
    if (speaking) {
      cancelSpeech();
      setSpeaking(false);
      keepListening.current = !muted;
      listen();
    } else if (busy) {
      onStopAnswer();
    }
  }

  function toggleMute() {
    if (muted) {
      setMuted(false);
      keepListening.current = true;
      if (!busy && !speaking) listen();
    } else {
      setMuted(true);
      keepListening.current = false;
      speech.stop();
    }
  }

  function end() {
    keepListening.current = false;
    cancelSpeech();
    speech.stop();
    if (busy) onStopAnswer();
    onEnd();
  }

  const phase = speaking ? "speaking" : busy ? "thinking" : muted ? "muted" : "listening";
  const status = { speaking: "Speaking", thinking: "Thinking", muted: "Microphone is off", listening: "Listening" }[phase];

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles aria-hidden className="size-4 text-primary" />
          Voice chat
        </h2>
        <Button variant="outline" size="sm" onClick={end}>
          End
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <Button
          variant="ghost"
          onClick={interrupt}
          aria-label={speaking ? "Stop speaking" : busy ? "Stop the answer" : status}
          className="relative size-28 rounded-full bg-info text-primary hover:bg-info"
        >
          {phase === "listening" ? <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/20" /> : null}
          {phase === "speaking" ? (
            <span aria-hidden className="flex h-10 items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="w-1.5 animate-pulse rounded-full bg-primary" style={{ height: `${[40, 70, 100, 70, 40][i]}%`, animationDelay: `${i * 120}ms` }} />
              ))}
            </span>
          ) : phase === "thinking" ? (
            <Spinner className="size-8" />
          ) : phase === "muted" ? (
            <MicOff className="size-8" />
          ) : (
            <Mic className="size-8" />
          )}
        </Button>
        <div className="min-h-14">
          <p className={cn("text-base font-semibold", phase === "muted" && "text-muted-foreground")}>{phase === "thinking" ? <Shimmer>{status}</Shimmer> : status}</p>
          {heard && phase !== "speaking" ? <p className="mt-2 text-sm text-muted-foreground">{heard}</p> : null}
          {phase === "speaking" && reply ? <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{plainForSpeech(reply)}</p> : null}
          {speech.error === "blocked" ? <p className="mt-2 text-sm text-destructive">Microphone access is blocked. Allow it in the browser&apos;s site settings.</p> : null}
          {speech.error === "unavailable" ? <p className="mt-2 text-sm text-destructive">Voice isn&apos;t available in this browser right now.</p> : null}
        </div>
      </div>

      <div className="flex shrink-0 justify-center gap-2 border-t p-4">
        <Button variant="outline" onClick={toggleMute}>
          {muted ? <Mic data-icon="inline-start" /> : <MicOff data-icon="inline-start" />}
          {muted ? "Turn microphone on" : "Turn microphone off"}
        </Button>
      </div>
    </div>
  );
}
