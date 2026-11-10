/**
 * Detects that someone is talking, from the microphone level, so the assistant can be interrupted while it speaks.
 * The browser's echo cancellation removes most of the assistant's own voice from the signal. What is left of it is learned as
 * a baseline, and only a clearly louder sound for a short stretch counts as speech. Works without any speech recognition.
 */
export type VoiceActivity = { stop: () => void };

const FRAME_MS = 50;
const NEEDED_FRAMES = 5; // about a quarter of a second of speech
const MIN_LEVEL = 0.04;

export async function startVoiceActivity(onVoice: () => void): Promise<VoiceActivity | null> {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
  } catch {
    return null;
  }
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }
  const ctx = new Ctx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  let baseline = 0;
  let loud = 0;
  let frames = 0;
  let done = false;

  const timer = window.setInterval(() => {
    if (done) return;
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += v * v;
    const level = Math.sqrt(sum / data.length);
    frames += 1;
    // The first moments only teach what the assistant's own voice looks like through the microphone.
    if (frames <= 6) {
      baseline = Math.max(baseline, level);
      return;
    }
    if (level > Math.max(MIN_LEVEL, baseline * 2.2)) {
      loud += 1;
      if (loud >= NEEDED_FRAMES) {
        done = true;
        onVoice();
      }
    } else {
      loud = 0;
      // Slowly follow changes in how loud the assistant itself is.
      baseline = baseline * 0.97 + level * 0.03;
    }
  }, FRAME_MS);

  return {
    stop() {
      done = true;
      window.clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
