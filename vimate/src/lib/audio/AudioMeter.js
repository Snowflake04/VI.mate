/**
 * ---------------------------------------------------------------------------
 * Real per-participant audio levels, from the Web Audio API
 * ---------------------------------------------------------------------------
 * Every value this produces is measured from an actual MediaStream — the local
 * microphone for you, the decoded remote track for everyone else. There is no
 * idle animation and no synthetic floor: silence reads as zero, and a peer
 * whose audio has not arrived yet has no meter at all.
 *
 * Two deliberate design decisions:
 *
 * 1. Levels never enter React state. A speech envelope updates at 60fps; a
 *    `setState` per frame per participant would re-render the call continuously
 *    and is the single most expensive mistake available here. Instead one
 *    rAF loop samples every analyser and writes into a plain object, and
 *    subscribers read it from their own animation frame to drive a transform
 *    or a canvas directly.
 *
 * 2. A single shared AudioContext. Browsers cap the number of contexts (Chrome
 *    at six), so one per participant would break a call at seven people.
 * ---------------------------------------------------------------------------
 */

let context = null;
/** @type {Map<string, {source: MediaStreamAudioSourceNode, analyser: AnalyserNode, buffer: Uint8Array, stream: MediaStream}>} */
const nodes = new Map();
/** Mutable level registry. Read directly, never through React. */
const levels = Object.create(null);
const listeners = new Set();

let rafId = null;

function ensureContext() {
  if (context) return context;

  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;

  context = new AudioContextClass({
    // Levels do not need 48 kHz, and a lower rate is measurably cheaper on
    // low-end devices where this loop competes with video encoding.
    sampleRate: 24_000,
    latencyHint: 'playback',
  });

  return context;
}

/**
 * Browsers suspend an AudioContext created before a user gesture. Called from
 * the first real interaction (joining a call is itself a click).
 */
export async function resumeAudioContext() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Still gated; the next gesture will get it.
    }
  }
  return ctx?.state ?? 'unavailable';
}

/**
 * Starts metering a stream under `id`. Safe to call repeatedly with the same
 * stream — re-attaching an unchanged source would pointlessly rebuild nodes.
 */
export function attach(id, stream) {
  if (!stream) return;
  if (stream.getAudioTracks().length === 0) return;

  const existing = nodes.get(id);
  if (existing?.stream === stream) return;
  if (existing) detach(id);

  const ctx = ensureContext();
  if (!ctx) return;

  try {
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();

    // 512 samples at 24 kHz is ~21 ms — long enough for a stable RMS, short
    // enough that the meter tracks speech onsets rather than lagging them.
    analyser.fftSize = 512;
    // Our own smoothing below is level-domain and better tuned for a meter,
    // so the analyser's frequency-domain smoothing stays out of the way.
    analyser.smoothingTimeConstant = 0;

    source.connect(analyser);
    // Deliberately NOT connected to the destination: this is a measurement
    // tap. Routing it to output would double every remote voice and feed the
    // local mic straight back into the room.

    nodes.set(id, {
      source,
      analyser,
      buffer: new Uint8Array(analyser.fftSize),
      stream,
    });
    levels[id] = 0;

    start();
  } catch (error) {
    console.warn('[audio] could not meter stream', error);
  }
}

export function detach(id) {
  const entry = nodes.get(id);
  if (!entry) return;

  try {
    entry.source.disconnect();
    entry.analyser.disconnect();
  } catch {
    // Already torn down.
  }

  nodes.delete(id);
  delete levels[id];

  if (nodes.size === 0) stop();
}

export function detachAll() {
  for (const id of [...nodes.keys()]) detach(id);
}

/** Current level for `id`, 0…1. Always a number so callers need no guard. */
export function getLevel(id) {
  return levels[id] ?? 0;
}

export function getLevels() {
  return levels;
}

/**
 * Notified once per animation frame after levels are refreshed. Intended for
 * components that paint directly (canvas, style writes) rather than re-render.
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Perceptual response, and the attack/release envelope of a real VU meter. */
const ATTACK = 0.55; // rises fast, so a syllable registers immediately
const RELEASE = 0.12; // falls slowly, so the meter is readable not strobing

function tick() {
  for (const [id, { analyser, buffer }] of nodes) {
    analyser.getByteTimeDomainData(buffer);

    // RMS of the waveform around the 128 midpoint.
    let sumOfSquares = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const sample = (buffer[i] - 128) / 128;
      sumOfSquares += sample * sample;
    }
    const rms = Math.sqrt(sumOfSquares / buffer.length);

    // Speech sits low in linear amplitude; a perceptual curve is what makes a
    // normal talking voice fill most of the meter instead of a tenth of it.
    const shaped = Math.min(1, Math.pow(rms, 0.55) * 2.1);

    const previous = levels[id] ?? 0;
    const coefficient = shaped > previous ? ATTACK : RELEASE;
    levels[id] = previous + (shaped - previous) * coefficient;
  }

  for (const listener of listeners) listener(levels);
  rafId = requestAnimationFrame(tick);
}

function start() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(tick);
}

function stop() {
  if (rafId === null) return;
  cancelAnimationFrame(rafId);
  rafId = null;
}

/**
 * Pauses metering when the tab is hidden. rAF already throttles there, but
 * releasing the loop entirely keeps a backgrounded call off the CPU.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (nodes.size > 0) start();
  });
}

export function teardown() {
  detachAll();
  stop();
  if (context) {
    context.close().catch(() => {});
    context = null;
  }
}
