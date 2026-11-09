// Browser speech support (Web Speech API). Dictation and spoken answers cost nothing and need no key.
// Speech recognition works in Chrome, Edge and Safari. Firefox has none, so the voice buttons stay hidden there.

type RecognitionAlternative = { transcript: string };
type RecognitionResult = ArrayLike<RecognitionAlternative> & { isFinal: boolean };
export type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };

export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Markdown out, something that sounds natural in. */
export function plainForSpeech(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\.\s*\./g, ".")
    .replace(/\bC-(\d+)/g, "C $1")
    .trim();
}

const VOICE_KEY = "orvo.voice";

// Novelty voices that ship with macOS. They are never a good default.
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Fred|Good News|Jester|Junior|Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Eddy|Rocko)\b/;

/** Higher is better. Prefers voices that sound natural: premium or enhanced downloads, cloud voices, then the standard ones. */
function voiceScore(v: SpeechSynthesisVoice): number {
  let score = 0;
  if (/premium|enhanced|natural|neural|online/i.test(v.name)) score += 100;
  if (/^(Ava|Zoe|Allison|Evan|Susan|Tom|Nathan|Serena|Aria|Jenny|Guy|Libby|Sonia)\b/i.test(v.name)) score += 80;
  if (/google/i.test(v.name)) score += 60;
  if (/^(Samantha|Daniel|Karen|Moira|Tessa|Rishi)\b/.test(v.name)) score += 30;
  if (/^(Flo|Shelley|Sandy|Reed)\b/.test(v.name)) score += 20;
  if (v.lang === "en-US") score += 5;
  if (NOVELTY.test(v.name)) score -= 200;
  return score;
}

/** English voices, best first. */
export function listEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("en"))
    .sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
}

export function getPreferredVoiceName(): string | null {
  try {
    return window.localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

export function setPreferredVoiceName(name: string) {
  try {
    window.localStorage.setItem(VOICE_KEY, name);
  } catch {
    // Storage can be blocked. The voice then resets next time, which is fine.
  }
}

/** The chosen voice if there is one, otherwise the best available. */
export function currentVoice(): SpeechSynthesisVoice | undefined {
  const voices = listEnglishVoices();
  const chosen = getPreferredVoiceName();
  return voices.find((v) => v.name === chosen) ?? voices[0];
}

export function speak(text: string, handlers: { onStart?: () => void; onEnd?: () => void }): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = currentVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  utterance.rate = 1;
  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onEnd?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function cancelSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
