"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { stopAllListening, useSpeechInput } from "@/hooks/use-speech-input";
import { cancelSpeech, plainForSpeech, speak } from "@/lib/speech";
import { startVoiceActivity, type VoiceActivity } from "@/lib/voice-activity";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace-store";

/**
 * The voice glyph in the Stop button, like Claude's: two bars and a dot in the button's own colour. The bars move while the assistant
 * listens or speaks, and rest while it thinks or the microphone is off.
 */
function VoiceGlyph({ active }: { active: boolean }) {
  return (
    <span aria-hidden className="flex h-4 items-center gap-[3px]">
      <span className={cn("h-3 w-[3px] origin-center rounded-full bg-current", active && "animate-wave")} />
      <span className={cn("h-4 w-[3px] origin-center rounded-full bg-current", active && "animate-wave")} style={{ animationDelay: "180ms" }} />
      <span className="size-[5px] rounded-full bg-current" />
    </span>
  );
}

type Props = {
  busy: boolean;
  onAsk: (text: string) => void;
  onStopAnswer: () => void;
  onEnd: () => void;
};

const wordsOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter(Boolean);
const STOP_WORDS = new Set(["stop", "wait", "cancel", "pause", "hold"]);

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
  const [speaking, setSpeaking] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [heard, setHeard] = useState("");

  const keep = useRef(true); // listening is wanted
  const alive = useRef(true); // false once voice mode has ended: nothing may start again
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);
  const pending = useRef(false); // a question was sent and no answer has been spoken yet
  const queue = useRef<string[]>([]);
  const timers = useRef<{ grace?: number; watchdog?: number }>({});
  const wasBusy = useRef(false);
  const activity = useRef<VoiceActivity | null>(null);
  const activityToken = useRef(0);
  // Always the latest props, since listeners created earlier would otherwise keep old ones.
  const latest = useRef({ busy, onAsk, onStopAnswer });
  useEffect(() => {
    latest.current = { busy, onAsk, onStopAnswer };
  });

  function clearTimers() {
    window.clearTimeout(timers.current.grace);
    window.clearTimeout(timers.current.watchdog);
  }

  // Sends what was said, unless something is already in progress.
  function submit(text: string) {
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
  }

  // Talking over the assistant cuts it off. Same reset as the Stop button, so the next phrase is sent normally.
  function bargeIn(heardText = "") {
    if (!speakingRef.current) return;
    stopWatching();
    clearTimers();
    queue.current = [];
    cancelSpeech();
    speakingRef.current = false;
    setSpeaking(false);
    pending.current = false;
    setWaiting(false);
    keep.current = true;
    if (heardText) setHeard(heardText);
  }

  // While the assistant speaks the microphone stays on, so Noa can talk over it. Two signals count: the sound level
  // (see src/lib/voice-activity.ts) and words that are not part of what is being said (or "stop"). Short interjections arrive
  // as finished phrases, so those are checked too.
  const isBarge = (text: string, known: Set<string>) => {
    const words = wordsOf(text);
    return words.filter((w) => !known.has(w)).length >= 2 || words.some((w) => STOP_WORDS.has(w));
  };

  function bargeListen(spoken: string) {
    if (!alive.current || mutedRef.current) return;
    const known = new Set(wordsOf(spoken));
    speech.start({
      onInterim: (t) => {
        if (!speakingRef.current) {
          setHeard(t);
          return;
        }
        if (isBarge(t, known)) bargeIn(t);
      },
      onFinal: (text) => {
        setHeard("");
        if (speakingRef.current && isBarge(text, known)) bargeIn();
        if (!speakingRef.current) submit(text);
      },
      onEnded: () => {
        if (!alive.current) return;
        if (speakingRef.current) bargeListen(spoken);
        else if (keep.current) listen();
      },
    });
  }

  // Watches the microphone level for as long as the assistant speaks.
  function watchForVoice() {
    activity.current?.stop();
    activity.current = null;
    const token = ++activityToken.current;
    void startVoiceActivity(() => {
      if (token === activityToken.current && alive.current && speakingRef.current) {
        bargeIn();
        // Make sure a phrase is being listened for, in case the listening session ended while speaking.
        listen();
      }
    }).then((a) => {
      if (!a) return;
      if (token === activityToken.current && alive.current && speakingRef.current) activity.current = a;
      else a.stop();
    });
  }

  function stopWatching() {
    activityToken.current++;
    activity.current?.stop();
    activity.current = null;
  }

  function listen() {
    if (!alive.current || !keep.current || mutedRef.current || speakingRef.current || pending.current || queue.current.length > 0 || latest.current.busy) return;
    speech.start({
      onInterim: setHeard,
      onFinal: (text) => {
        setHeard("");
        submit(text);
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
    const text = queue.current.shift();
    if (!alive.current) return;
    if (!text) {
      speakingRef.current = false;
      setSpeaking(false);
      stopWatching();
      scheduleListen();
      return;
    }
    speakingRef.current = true;
    setWaiting(false);
    keep.current = false;
    bargeListen(text);
    watchForVoice();
    const started = speak(text, { onStart: () => setSpeaking(true), onEnd: playNext });
    if (!started) playNext();
  }

  function enqueue(reply: string) {
    const spoken = plainForSpeech(reply);
    if (!alive.current) return;
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
    keep.current = true;
    alive.current = true;
    listen();
    setReplyListener(enqueue);
    return () => {
      keep.current = false;
      alive.current = false;
      clearTimers();
      queue.current = [];
      cancelSpeech();
      stopWatching();
      setReplyListener(null);
      stopAllListening();
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
    keep.current = false;
    alive.current = false;
    clearTimers();
    queue.current = [];
    cancelSpeech();
    speech.stop();
    if (latest.current.busy) latest.current.onStopAnswer();
    stopWatching();
    stopAllListening();
    onEnd();
  }

  const phase = speaking ? "speaking" : busy || waiting ? "thinking" : muted ? "muted" : "listening";
  const label = { speaking: "Speaking", thinking: "Thinking", muted: "Microphone is off", listening: "Listening" }[phase];

  return (
    <div className="shrink-0 px-4 pt-2 pb-3">
      <InputGroup className="rounded-2xl bg-card shadow-sm has-disabled:bg-card has-disabled:opacity-100 dark:has-disabled:bg-card">
        <InputGroupTextarea
          aria-label="Voice chat status"
          readOnly
          rows={1}
          value={heard}
          placeholder={label}
          className="max-h-40 min-h-14 field-sizing-content px-4 pt-4 text-[15px] italic"
        />
        <InputGroupAddon align="block-end" className="justify-end gap-1">
          <InputGroupButton
            size="icon-sm"
            className="rounded-lg text-foreground hover:text-foreground"
            aria-label={muted ? "Turn microphone on" : "Turn microphone off"}
            aria-pressed={muted}
            onClick={toggleMute}
          >
            {muted ? <MicOff /> : <Mic />}
          </InputGroupButton>
          {/* Stop ends voice mode: it stops speech and the answer and puts the normal message box back, like Claude. */}
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-2 rounded-lg bg-info px-3 font-medium text-info-foreground hover:bg-info/80" aria-label="Stop voice chat" onClick={end}>
            <VoiceGlyph active={phase === "listening" || phase === "speaking"} />
            Stop
          </Button>
        </InputGroupAddon>
      </InputGroup>
      {speech.error === "blocked" ? <p className="mt-2 text-center text-xs text-destructive">Microphone access is blocked. Allow it in the browser&apos;s site settings.</p> : null}
      {speech.error === "unavailable" ? <p className="mt-2 text-center text-xs text-destructive">Voice isn&apos;t available in this browser right now.</p> : null}
    </div>
  );
}
