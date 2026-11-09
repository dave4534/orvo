"use client";

import { useCallback, useEffect, useState } from "react";

import { currentVoice, listEnglishVoices, setPreferredVoiceName } from "@/lib/speech";

/** English voices from the browser, best first, and the one in use. Browsers load voices a moment after the page does. */
export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listEnglishVoices());
  const [selected, setSelected] = useState<string | null>(() => currentVoice()?.name ?? null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const refresh = () => {
      setVoices(listEnglishVoices());
      setSelected(currentVoice()?.name ?? null);
    };
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const choose = useCallback((name: string) => {
    setPreferredVoiceName(name);
    setSelected(name);
  }, []);

  return { voices, selected, choose };
}
