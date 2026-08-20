// DeskBuddies Games — sound effects
// -----------------------------------------------------------------------
// Every effect is synthesized on the fly with the Web Audio API instead of
// loading audio files. No files to host, no licensing to worry about, and
// nothing to add to the bundle. Respects a volume preference in
// localStorage (0 = muted) so it persists across sessions and games.

const VOLUME_KEY = "deskbuddies_sound_volume"; // "0".."100"
const DEFAULT_VOLUME = 70;

type ToneStep = {
  freq: number;
  start: number; // seconds from the effect's start
  duration: number; // seconds
  type?: OscillatorType;
  gain?: number; // peak gain, 0-1, before the volume setting is applied
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
export async function unlockAudio(): Promise<boolean> {
  const c = getContext();
  if (!c) return false;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      // Still blocked — the caller can retry on the next gesture.
    }
  }
  return c.state === "running";
}

/** True once the AudioContext is actually running (i.e. sound can play). */
export function isAudioUnlocked(): boolean {
  return ctx?.state === "running";
}

/** 0-100. Defaults to 70 the first time someone opens the app. */
export function getVolume(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  const raw = window.localStorage.getItem(VOLUME_KEY);
  if (raw === null) return DEFAULT_VOLUME;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_VOLUME;
}

export function setVolume(volume: number) {
  if (typeof window === "undefined") return;
  const clamped = Math.min(100, Math.max(0, Math.round(volume)));
  window.localStorage.setItem(VOLUME_KEY, String(clamped));
}

function playTones(steps: ToneStep[]) {
  const volume = getVolume();
  if (volume === 0) return;
  const c = getContext();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;
  const scale = volume / 100;

  for (const step of steps) {
    const osc = c.createOscillator();
    const gainNode = c.createGain();
    osc.type = step.type ?? "sine";
    osc.frequency.value = step.freq;

    const peak = (step.gain ?? 0.2) * scale;
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

  /** Soft paper-flick — a card being drawn from the pile. */
  cardDraw() {
    playTones([
      { freq: 320, start: 0, duration: 0.05, type: "triangle", gain: 0.12 },
      { freq: 260, start: 0.04, duration: 0.09, type: "triangle", gain: 0.1 },
    ]);
  },

  /** Crisp single snap — a card landing face-up on the discard pile. */
  cardReveal() {
    playTones([{ freq: 720, start: 0, duration: 0.07, type: "triangle", gain: 0.15 }]);
  },

  /** Quick 3-note "here we go" riser — the host starts the session/game. */
  sessionStart() {
    playTones([
      { freq: 349.23, start: 0, duration: 0.12, type: "triangle", gain: 0.16 }, // F4
      { freq: 440, start: 0.1, duration: 0.12, type: "triangle", gain: 0.16 }, // A4
      { freq: 523.25, start: 0.2, duration: 0.24, type: "triangle", gain: 0.2 }, // C5
    ]);
  },

  /** Single crisp pop — a new question or prompt appears on screen. */
  questionFlash() {
    playTones([{ freq: 987.77, start: 0, duration: 0.1, type: "triangle", gain: 0.16 }]);
  },

  /** Gentle descending "womp" — didn't type or choose an answer in time. */
  noAnswer() {
    playTones([
      { freq: 293.66, start: 0, duration: 0.16, type: "triangle", gain: 0.12 }, // D4
      { freq: 233.08, start: 0.13, duration: 0.24, type: "triangle", gain: 0.12 }, // Bb3
    ]);
  },

  /** Neutral wrap-up cadence — a MOD ended the session early. */
  sessionEndedByMod() {
    playTones([
      { freq: 440, start: 0, duration: 0.16, gain: 0.16 }, // A4
      { freq: 349.23, start: 0.14, duration: 0.3, gain: 0.16 }, // F4
    ]);
  },

  /** Fuller ascending fanfare — the whole set/game was completed. */
  setFinished() {
    playTones([
      { freq: 392, start: 0, duration: 0.14, type: "triangle", gain: 0.18 }, // G4
      { freq: 493.88, start: 0.13, duration: 0.14, type: "triangle", gain: 0.18 }, // B4
      { freq: 587.33, start: 0.26, duration: 0.14, type: "triangle", gain: 0.18 }, // D5
      { freq: 783.99, start: 0.39, duration: 0.4, type: "triangle", gain: 0.22 }, // G5
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

  /** Soft two-note tap — a clue lands on the Impostor WHO? board. */
  clueChime() {
    playTones([
      { freq: 587.33, start: 0, duration: 0.06, type: "triangle", gain: 0.13 },
      { freq: 698.46, start: 0.05, duration: 0.1, type: "triangle", gain: 0.13 },
    ]);
  },

  /** Quick low click — a vote gets locked in (deliberately understated, no result leaked). */
  voteLock() {
    playTones([{ freq: 349.23, start: 0, duration: 0.06, type: "square", gain: 0.1 }]);
  },

  /** Tense low rumble-into-rise — building up to an accusation reveal. */
  suspenseReveal() {
    playTones([
      { freq: 196, start: 0, duration: 0.3, type: "sawtooth", gain: 0.08 },
      { freq: 246.94, start: 0.26, duration: 0.22, type: "sawtooth", gain: 0.1 },
    ]);
  },

  /** Quick fluttering sweep — the Wheel of Fortune wheel spinning. */
  wheelSpin() {
    playTones([
      { freq: 300, start: 0, duration: 0.05, type: "square", gain: 0.08 },
      { freq: 260, start: 0.08, duration: 0.05, type: "square", gain: 0.08 },
      { freq: 300, start: 0.16, duration: 0.05, type: "square", gain: 0.08 },
      { freq: 260, start: 0.24, duration: 0.05, type: "square", gain: 0.08 },
      { freq: 300, start: 0.32, duration: 0.05, type: "square", gain: 0.07 },
      { freq: 260, start: 0.4, duration: 0.05, type: "square", gain: 0.06 },
    ]);
  },

  /** Harsh alarm blare — landed on Bankrupt. */
  bankrupt() {
    playTones([
      { freq: 150, start: 0, duration: 0.3, type: "sawtooth", gain: 0.2 },
      { freq: 110, start: 0.24, duration: 0.4, type: "sawtooth", gain: 0.22 },
    ]);
  },

  /** Bright single coin-drop chime — buying a vowel. */
  vowelBought() {
    playTones([
      { freq: 1046.5, start: 0, duration: 0.08, type: "triangle", gain: 0.16 },
      { freq: 1318.51, start: 0.06, duration: 0.12, type: "triangle", gain: 0.16 },
    ]);
  },

  /** Sparkly ascending run — landed on Wild Card. */
  wildCard() {
    playTones([
      { freq: 659.25, start: 0, duration: 0.08, type: "triangle", gain: 0.14 },
      { freq: 830.61, start: 0.06, duration: 0.08, type: "triangle", gain: 0.14 },
      { freq: 1046.5, start: 0.12, duration: 0.16, type: "triangle", gain: 0.16 },
    ]);
  },

  /** Warm two-note relief — Free Play saved a miss from ending your turn. */
  freePlaySaved() {
    playTones([
      { freq: 523.25, start: 0, duration: 0.1, type: "sine", gain: 0.14 },
      { freq: 659.25, start: 0.08, duration: 0.16, type: "sine", gain: 0.16 },
    ]);
  },

  /** Short triumphant flourish — a round was solved (smaller than setFinished, which is reserved for the whole game). */
  roundSolved() {
    playTones([
      { freq: 587.33, start: 0, duration: 0.12, type: "triangle", gain: 0.18 },
      { freq: 739.99, start: 0.1, duration: 0.12, type: "triangle", gain: 0.18 },
      { freq: 987.77, start: 0.2, duration: 0.28, type: "triangle", gain: 0.22 },
    ]);
  },

  /**
   * Plays the right "how did this end" intro (finished vs. cut short), then
   * calls `then` once it's had time to land — meant to be followed by
   * `winner()`/`loser()` so the two don't overlap.
   */
  playSessionEnd(completed: boolean, then: () => void) {
    if (completed) {
      sounds.setFinished();
      setTimeout(then, 850);
    } else {
      sounds.sessionEndedByMod();
      setTimeout(then, 550);
    }
  },
};

// ---- Lobby background music ----
// A quiet, looping ambient pattern for the "waiting for the host to start"
// screen — not a discrete cue, just something pleasant in the background.
// Scheduled as one note at a time with setTimeout rather than a real audio
// loop file, consistent with everything else here being synthesized.
const LOBBY_MELODY = [392.0, 440.0, 523.25, 440.0, 392.0, 349.23, 392.0, 440.0]; // G4 A4 C5 A4 G4 F4 G4 A4
const LOBBY_NOTE_MS = 600;

let lobbyMusicTimer: ReturnType<typeof setTimeout> | null = null;
let lobbyMusicStep = 0;

function scheduleLobbyNote() {
  const freq = LOBBY_MELODY[lobbyMusicStep % LOBBY_MELODY.length];
  lobbyMusicStep += 1;
  playTones([{ freq, start: 0, duration: LOBBY_NOTE_MS / 1000 - 0.08, type: "sine", gain: 0.05 }]);
  lobbyMusicTimer = setTimeout(scheduleLobbyNote, LOBBY_NOTE_MS);
}

export const lobbyMusic = {
  /** Idempotent — calling start() while already running does nothing. */
  start() {
    if (lobbyMusicTimer) return;
    lobbyMusicStep = 0;
    scheduleLobbyNote();
  },
  stop() {
    if (lobbyMusicTimer) {
      clearTimeout(lobbyMusicTimer);
      lobbyMusicTimer = null;
    }
  },
};
