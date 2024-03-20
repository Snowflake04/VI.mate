import { useUIStore } from '../../store/uiStore.js';

/**
 * ---------------------------------------------------------------------------
 * Sound design, synthesised
 * ---------------------------------------------------------------------------
 * No audio files: every cue is generated from oscillators and a gain envelope
 * at play time. That keeps the bundle free of binary assets, makes the whole
 * palette tunable by editing numbers, and fits the instrument aesthetic —
 * these are console acknowledgement tones, not notification jingles.
 *
 * The palette is deliberately quiet and short (all under 400 ms, peak gain
 * 0.08). Cues you notice consciously during a call are cues you will turn off.
 * Every one of them can be silenced from the control bar, and the choice
 * persists.
 * ---------------------------------------------------------------------------
 */

let context = null;

function ensureContext() {
  if (context) return context;

  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;

  context = new AudioContextClass({ latencyHint: 'interactive' });
  return context;
}

/**
 * A single voice: oscillator through an exponential decay envelope.
 * `ramp` slides the pitch, which is what separates a "rising" cue from a
 * "falling" one without needing two oscillators.
 */
function voice({
  frequency,
  ramp = null,
  type = 'sine',
  start = 0,
  duration = 0.14,
  gain = 0.05,
}) {
  const ctx = context;
  const now = ctx.currentTime + start;

  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (ramp !== null) {
    oscillator.frequency.exponentialRampToValueAtTime(ramp, now + duration);
  }

  const envelope = ctx.createGain();
  // A 12 ms attack instead of an instant one — a hard start on a sine is
  // audible as a click.
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  // Rolls off the top so the cues sit behind speech rather than over it.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;

  oscillator.connect(envelope);
  envelope.connect(tone);
  tone.connect(ctx.destination);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

/** The cue palette. Two-tone rising = arrival, falling = departure. */
const CUES = {
  join: () => {
    voice({ frequency: 587.33, duration: 0.1, gain: 0.045 }); // D5
    voice({ frequency: 880, start: 0.075, duration: 0.16, gain: 0.05 }); // A5
  },

  leave: () => {
    voice({ frequency: 880, duration: 0.1, gain: 0.04 });
    voice({ frequency: 587.33, start: 0.075, duration: 0.18, gain: 0.045 });
  },

  // Mute drops a fifth; unmute lifts one. Same gesture, mirrored — you learn
  // the pair in one use.
  mute: () => {
    voice({ frequency: 440, ramp: 293.66, duration: 0.12, gain: 0.04 });
  },

  unmute: () => {
    voice({ frequency: 587.33, ramp: 880, duration: 0.11, gain: 0.04 });
  },

  message: () => {
    voice({ frequency: 1318.51, type: 'triangle', duration: 0.06, gain: 0.03 });
  },

  // Private messages get a distinct double-tick, so you can tell a DM from
  // room chatter without looking.
  whisper: () => {
    voice({ frequency: 1174.66, type: 'triangle', duration: 0.05, gain: 0.03 });
    voice({
      frequency: 1567.98,
      type: 'triangle',
      start: 0.07,
      duration: 0.06,
      gain: 0.028,
    });
  },

  request: () => {
    voice({ frequency: 659.25, duration: 0.09, gain: 0.045 });
    voice({ frequency: 659.25, start: 0.13, duration: 0.09, gain: 0.045 });
  },

  // Deliberately the least pleasant cue in the set — a minor second beat.
  alert: () => {
    voice({ frequency: 415.3, type: 'square', duration: 0.16, gain: 0.022 });
    voice({ frequency: 392, type: 'square', duration: 0.16, gain: 0.022 });
  },
};

/** Rate limit per cue, so eight people joining at once is one chirp, not eight. */
const lastPlayed = new Map();
const THROTTLE_MS = 220;

export function play(name) {
  if (!useUIStore.getState().soundEnabled) return;

  const cue = CUES[name];
  if (!cue) return;

  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? 0) < THROTTLE_MS) return;
  lastPlayed.set(name, now);

  const ctx = ensureContext();
  if (!ctx) return;

  // Autoplay policy: a context created before any gesture starts suspended.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
    // Do not queue the cue — a burst of sound the moment a user first clicks
    // is exactly the behaviour the policy exists to prevent.
    return;
  }

  try {
    cue();
  } catch (error) {
    console.warn('[sound] cue failed', error);
  }
}

/** Warms the context on a real gesture so the first cue is not swallowed. */
export function unlock() {
  const ctx = ensureContext();
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

export function teardown() {
  if (!context) return;
  context.close().catch(() => {});
  context = null;
}
