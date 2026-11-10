"use client";

import { useEffect, useRef, useState } from "react";
import { Square } from "lucide-react";
import { Check, ChevronDown, Microphone01, MicrophoneOff01, X } from "@untitledui/icons";

import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { stopAllListening, useSpeechInput } from "@/hooks/use-speech-input";
import { useVoices } from "@/hooks/use-voices";
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
            phase === "muted" ? "h-1 bg-muted-foreground" : phase === "thinking" ? "h-1.5 animate-pulse bg-muted-foreground" : "h-6 bg-brand-solid",
            (phase === "listening" || phase === "speaking") && "animate-wave",
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

// How long to wait after speaking before listening again. A second part of the answer often follows right after a screen action.
const GRACE_MS = 1200;
// If nothing comes back for this long after a question, start listening again anyway.
const WATCHDOG_MS = 25_000;

/**
 * Voice mode inside the chat. It takes the place of the message box: the chat stays visible, what you say appears as your message,
 * and the wave shows whether it is listening, thinking or speaking. Replies are read aloud one after another as they finish,
 * wherever they were written (a decision can move the view to another claim while the answer is still coming).
 * It keeps its state in refs, so it keeps working when the screen around it changes.
 */
export function VoiceBar({ busy, onAsk, onStopAnswer, onEnd }: Props) {
  const speech = useSpeechInput();
  const { setReplyListener } = useWorkspace();
  const { voices, selected, choose } = useVoices();
  const [speaking, setSpeaking] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [heard, setHeard] = useState("");

  const alive = useRef(true); // false once voice mode has ended: nothing may start again
  const keep = useRef(true); // listening is wanted
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);
  const pending = useRef(false); // a question was sent and no answer has been spoken yet
  const queue = useRef<string[]>([]);
  const timers = useRef<{ grace?: number; watchdog?: number }>({});
  const wasBusy = useRef(false);
  // Always the latest props, since listeners created earlier would otherwise keep old ones.
  const latest = useRef({ busy, onAsk, onStopAnswer });
  useEffect(() => {
    latest.current = { busy, onAsk, onStopAnswer };
  });

  function clearTimers() {
    window.clearTimeout(timers.current.grace);
    window.clearTimeout(timers.current.watchdog);
  }

  function listen() {
    if (!alive.current || !keep.current || mutedRef.current || speakingRef.current || pending.current || queue.current.length > 0 || latest.current.busy) return;
    speech.start({
      onInterim: setHeard,
      onFinal: (text) => {
        setHeard("");
        if (!alive.current || !text || pending.current || speakingRef.current || latest.current.busy) return;
        pending.current = true;
        keep.current = false;
        setWaiting(true);
        speech.stop();
        window.clearTimeout(timers.current.watchdog);
        timers.current.watchdog = window.setTimeout(() => {
          pending.current = false;
          setWaiting(false);
          keep.current = !mutedRef.current;
          listen();
        }, WATCHDOG_MS);
        latest.current.onAsk(text);
      },
      // The browser ends listening after a stretch of silence. Start again while voice mode is on.
      onEnded: () => {
        if (alive.current && keep.current) listen();
      },
    });
  }

  function scheduleListen() {
    window.clearTimeout(timers.current.grace);
    timers.current.grace = window.setTimeout(() => {
      if (!alive.current || queue.current.length > 0 || speakingRef.current) return;
      pending.current = false;
      setWaiting(false);
      keep.current = !mutedRef.current;
      listen();
    }, GRACE_MS);
  }

  function playNext() {
    if (!alive.current) return;
    const text = queue.current.shift();
    if (!text) {
      speakingRef.current = false;
      setSpeaking(false);
      scheduleListen();
      return;
    }
    speakingRef.current = true;
    setWaiting(false);
    keep.current = false;
    speech.stop();
    const started = speak(text, { onStart: () => setSpeaking(true), onEnd: playNext });
    if (!started) playNext();
  }

  function enqueue(reply: string) {
    if (!alive.current) return;
    const spoken = plainForSpeech(reply);
    window.clearTimeout(timers.current.watchdog);
    window.clearTimeout(timers.current.grace);
    if (!spoken) {
      scheduleListen();
      return;
    }
    queue.current.push(spoken);
    if (!speakingRef.current) playNext();
  }

  // Start listening when voice mode opens, and hear every finished reply.
  useEffect(() => {
    alive.current = true;
    keep.current = true;
    listen();
    setReplyListener(enqueue);
    return () => {
      alive.current = false;
      keep.current = false;
      clearTimers();
      queue.current = [];
      cancelSpeech();
      stopAllListening();
      setReplyListener(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the visible chat finishes writing, give a moment for more to arrive, then listen again.
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (wasBusy.current) {
      wasBusy.current = false;
      scheduleListen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  function interrupt() {
    if (speakingRef.current) {
      queue.current = [];
      cancelSpeech();
      speakingRef.current = false;
      setSpeaking(false);
      pending.current = false;
      setWaiting(false);
      keep.current = !mutedRef.current;
      listen();
    } else if (latest.current.busy) {
      latest.current.onStopAnswer();
    }
  }

  function toggleMute() {
    if (mutedRef.current) {
      mutedRef.current = false;
      setMuted(false);
      keep.current = true;
      listen();
    } else {
      mutedRef.current = true;
      setMuted(true);
      keep.current = false;
      speech.stop();
    }
  }

  function end() {
    alive.current = false;
    keep.current = false;
    clearTimers();
    queue.current = [];
    cancelSpeech();
    speech.stop();
    stopAllListening();
    if (latest.current.busy) latest.current.onStopAnswer();
    onEnd();
  }

  const phase = speaking ? "speaking" : busy || waiting ? "thinking" : muted ? "muted" : "listening";
  const label = { speaking: "Speaking", thinking: "Thinking", muted: "Microphone is off", listening: "Listening" }[phase];

  return (
    <div className="shrink-0 border-t bg-card px-4 pt-3 pb-3">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Wave phase={phase} />
          {phase === "thinking" ? <Shimmer className="text-sm">{label}</Shimmer> : <span className="text-sm font-medium">{label}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button color="tertiary" size="sm" aria-label={muted ? "Turn microphone on" : "Turn microphone off"} aria-pressed={muted} iconLeading={muted ? MicrophoneOff01 : Microphone01} onPress={toggleMute} />
          {speaking || busy ? (
            <Button color="tertiary" size="sm" aria-label={speaking ? "Stop speaking" : "Stop the answer"} iconLeading={<Square className="size-4 fill-current" />} onPress={interrupt} />
          ) : null}
          <Button color="secondary" size="sm" iconLeading={X} onPress={end}>
            End voice
          </Button>
        </div>
      </div>
      {heard ? <p className="mt-2 text-sm text-muted-foreground italic">{heard}</p> : null}
      {voices.length > 0 ? (
        <Dropdown.Root>
          <Button color="tertiary" size="xs" className="mt-2 -ml-1.5" iconTrailing={ChevronDown}>
            Voice: {selected ?? "Default"}
          </Button>
          <Dropdown.Popover placement="top left" className="max-h-72 w-64 overflow-y-auto">
            <Dropdown.Menu aria-label="Spoken voice">
              <Dropdown.Section>
                <Dropdown.SectionHeader className="px-4 py-1.5 text-xs font-medium text-quaternary">Spoken voice</Dropdown.SectionHeader>
                {voices.slice(0, 12).map((v) => (
                  <Dropdown.Item
                    key={v.name}
                    id={v.name}
                    textValue={v.name}
                    onAction={() => {
                      choose(v.name);
                      speak("Hi, this is how I sound.", {});
                    }}
                  >
                    <span className="flex flex-1 items-center">
                      <span className="flex-1">{v.name}</span>
                      {v.name === selected ? <Check className="size-4" /> : null}
                    </span>
                  </Dropdown.Item>
                ))}
              </Dropdown.Section>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      ) : null}
      {speech.error === "blocked" ? <p className="mt-2 text-xs text-destructive">Microphone access is blocked. Allow it in the browser&apos;s site settings.</p> : null}
      {speech.error === "unavailable" ? <p className="mt-2 text-xs text-destructive">Voice isn&apos;t available in this browser right now.</p> : null}
    </div>
  );
}
