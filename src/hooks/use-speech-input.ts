"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getRecognitionCtor, type Recognition } from "@/lib/speech";

type Handlers = {
  /** Words heard so far in the current phrase. */
  onInterim?: (text: string) => void;
  /** A finished phrase. */
  onFinal: (text: string) => void;
  /** Recognition stopped by itself, for example after silence. */
  onEnded?: () => void;
};

export type SpeechInputError = "blocked" | "unavailable" | null;

/** Listens through the microphone and reports what was said. */
export function useSpeechInput() {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechInputError>(null);
  const recognition = useRef<Recognition | null>(null);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback((handlers: Handlers) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    recognition.current?.abort();
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onstart = () => {
      setError(null);
      setListening(true);
    };
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) handlers.onFinal(text.trim());
        else interim += text;
      }
      handlers.onInterim?.(interim);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("blocked");
      else if (e.error === "network" || e.error === "audio-capture") setError("unavailable");
    };
    r.onend = () => {
      setListening(false);
      handlers.onInterim?.("");
      handlers.onEnded?.();
    };
    recognition.current = r;
    r.start();
  }, []);

  useEffect(
    () => () => {
      recognition.current?.abort();
    },
    [],
  );

  return { supported, listening, error, start, stop };
}
