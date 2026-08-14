// DeskBuddies Games — sound effects
// -----------------------------------------------------------------------
// Every effect is synthesized on the fly with the Web Audio API instead of
// loading audio files. No files to host, no licensing to worry about, and
// nothing to add to the bundle. Respects a mute preference in
// localStorage so it persists across sessions and games.

const MUTE_KEY = "deskbuddies_sound_muted";

type ToneStep = {
  freq: number;
  start: number; // seconds from the effect's start
  duration: number; // seconds
  type?: OscillatorType;
  gain?: number; // peak gain, 0-1
};

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtxCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return null;
  if (!ctx) ctx = new AudioCtxCtor();
  return ctx;
}

/**
 * Call once on any early user gesture (a click, a tap) so the browser's
 * autoplay policy doesn't block sound that's later triggered by a realtime
 * event rather than a direct click. Safe to call repeatedly.
 */
export function unlockAudio() {
  const c = getContext();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function playTones(steps: ToneStep[]) {
  if (isMuted()) return;
  const c = getContext();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;

  for (const step of steps) {
    const osc = c.createOscillator();
    const gainNode = c.createGain();
    osc.type = step.type ?? "sine";
    osc.frequency.value = step.freq;

    const peak = step.gain ?? 0.2;
    const t0 = now + step.start;
    const t1 = t0 + step.duration;

    // Quick linear attack, exponential decay — avoids the click/pop you'd
    // get from a hard on/off, and reads as a natural little "blip".
    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.015, step.duration / 4));
    gainNode.gain.exponentialRampToValueAtTime(0.001, t1);

    osc.connect(gainNode).connect(c.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

export const sounds = {
  /** Soft tick — last few seconds of any countdown timer. */
  tick() {
    playTones([{ freq: 880, start: 0, duration: 0.07, type: "square", gain: 0.1 }]);
  },

  /** Bright ascending chime — a correct answer. */
  correct() {
    playTones([
      { freq: 523.25, start: 0, duration: 0.12, gain: 0.18 }, // C5
      { freq: 659.25, start: 0.1, duration: 0.12, gain: 0.18 }, // E5
      { freq: 783.99, start: 0.2, duration: 0.22, gain: 0.2 }, // G5
    ]);
  },

  /** Low descending buzz — a wrong answer or a strike. */
  wrong() {
    playTones([
      { freq: 220, start: 0, duration: 0.18, type: "sawtooth", gain: 0.14 },
      { freq: 164.81, start: 0.14, duration: 0.26, type: "sawtooth", gain: 0.14 },
    ]);
  },

  /** Quick two-note "ding" — a Feud board slot flipping to reveal. */
  boardReveal() {
    playTones([
      { freq: 987.77, start: 0, duration: 0.08, gain: 0.14 },
      { freq: 1318.51, start: 0.06, duration: 0.14, gain: 0.15 },
    ]);
  },

  /** Blaring double honk — a face-off buzz-in. */
  buzzer() {
    playTones([
      { freq: 180, start: 0, duration: 0.26, type: "square", gain: 0.2 },
      { freq: 180, start: 0.3, duration: 0.26, type: "square", gain: 0.2 },
    ]);
  },

  /** Triumphant rising arpeggio — you won. */
  winner() {
    playTones([
      { freq: 523.25, start: 0, duration: 0.14, gain: 0.2 },
      { freq: 659.25, start: 0.12, duration: 0.14, gain: 0.2 },
      { freq: 783.99, start: 0.24, duration: 0.14, gain: 0.2 },
      { freq: 1046.5, start: 0.36, duration: 0.34, gain: 0.22 },
    ]);
  },

  /** Gentle falling tone — better luck next time. */
  loser() {
    playTones([
      { freq: 392, start: 0, duration: 0.2, type: "triangle", gain: 0.14 },
      { freq: 329.63, start: 0.18, duration: 0.2, type: "triangle", gain: 0.14 },
      { freq: 261.63, start: 0.36, duration: 0.34, type: "triangle", gain: 0.14 },
    ]);
  },
};
