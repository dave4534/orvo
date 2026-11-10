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

// The spoken voice is fixed: Google UK English Female. Other browsers that do not have it get the best natural English voice they have.
const DEFAULT_VOICE = "Google UK English Female";

// Novelty voices that ship with macOS. They are never a good fallback.
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Fred|Good News|Jester|Junior|Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Eddy|Rocko)\b/;

/** Higher is better, for the fallback only. */
function voiceScore(v: SpeechSynthesisVoice): number {
  let score = 0;
  if (/premium|enhanced|natural|neural|online/i.test(v.name)) score += 100;
  if (/google/i.test(v.name)) score += 60;
  if (/^(Samantha|Daniel|Karen|Moira|Tessa|Rishi)\b/.test(v.name)) score += 30;
  if (v.lang === "en-GB") score += 10;
  if (NOVELTY.test(v.name)) score -= 200;
  return score;
}

/** Google UK English Female if the browser has it, otherwise the best English voice available. */
export function currentVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const english = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  return english.find((v) => v.name === DEFAULT_VOICE) ?? [...english].sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name))[0];
}

// Browsers load their voices a moment after the page does, and Google's cloud voices last of all. Speaking before that would use
// another voice for the first sentence, so the first utterance waits (at most two seconds) for the chosen voice to appear.
let voicesSettled = false;
let waiting: Promise<void> | null = null;

function voicesReady(): Promise<void> {
  if (voicesSettled || typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
  const synth = window.speechSynthesis;
  const has = () => synth.getVoices().some((v) => v.name === DEFAULT_VOICE);
  if (has()) {
    voicesSettled = true;
    return Promise.resolve();
  }
  waiting ??= new Promise<void>((resolve) => {
    const finish = () => {
      voicesSettled = true;
      synth.removeEventListener("voiceschanged", check);
      window.clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (has()) finish();
    };
    synth.addEventListener("voiceschanged", check);
    const timer = window.setTimeout(finish, 2000);
  });
  return waiting;
}

// Start loading the voices as soon as the app is open.
if (typeof window !== "undefined" && "speechSynthesis" in window) void voicesReady();

// The utterance being spoken, so cancelling can silence its callbacks (a cancel is not "finished speaking").
let current: SpeechSynthesisUtterance | null = null;
// Bumped by every cancel, so a sentence that was still waiting for the voices is dropped.
let token = 0;

export function speak(text: string, handlers: { onStart?: () => void; onEnd?: () => void }): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return false;
  cancelSpeech();
  const mine = token;
  void voicesReady().then(() => {
    if (mine !== token) return;
    const utterance = new SpeechSynthesisUtterance(text);
    current = utterance;
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
  });
  return true;
}

export function cancelSpeech() {
  token++;
  if (current) {
    current.onend = null;
    current.onerror = null;
    current = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
