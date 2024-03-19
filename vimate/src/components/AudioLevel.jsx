import { memo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { getLevel, subscribe } from '../lib/audio/AudioMeter.js';

/**
 * Live microphone level, read from the Web Audio API.
 *
 * The value is real: an AnalyserNode tapped off the actual MediaStream (your
 * own mic locally, the decoded remote track for everyone else), RMS per frame
 * with a VU-style attack/release envelope. Silence reads zero. A muted peer
 * reads zero. Nothing here loops when there is no sound.
 *
 * The important implementation detail is what it does *not* do: no React state.
 * A speech envelope updates 60 times a second, and routing that through
 * `setState` would re-render the call continuously. Instead each meter runs a
 * subscription that writes `transform` and `opacity` straight onto its own DOM
 * nodes — compositor-only properties, so this costs no layout and no paint.
 */

const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  height: ${({ $height }) => $height}px;
`;

const Bar = styled.span`
  width: 2.5px;
  height: 100%;
  border-radius: var(--radius-pill);
  /* Inherits from the parent, so the same meter works on glass over video and
     on an opaque roster row without a variant. */
  background: currentColor;
  transform: scaleY(0.12);
  transform-origin: center;
  opacity: 0.35;
  will-change: transform, opacity;
`;

/**
 * Weights per bar, highest in the middle — a speech envelope rendered as a
 * flat block reads as a progress bar, not a voice.
 */
const WEIGHTS = [0.45, 0.75, 1, 0.8, 0.5];

export const AudioLevel = memo(function AudioLevel({
  peerId,
  height = 14,
  bars = 5,
  muted = false,
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const elements = Array.from(container.children);

    // Muted means muted: park the meter at its floor and stop sampling
    // entirely, so a muted tile costs nothing.
    if (muted) {
      for (const element of elements) {
        element.style.transform = 'scaleY(0.1)';
        element.style.opacity = '0.18';
      }
      return undefined;
    }

    let previous = -1;

    const unsubscribe = subscribe(() => {
      const level = getLevel(peerId);

      // Skip the DOM writes when the level has not meaningfully moved. Most
      // frames of a real conversation are silence.
      if (Math.abs(level - previous) < 0.004) return;
      previous = level;

      for (let i = 0; i < elements.length; i += 1) {
        const weight = WEIGHTS[i % WEIGHTS.length];
        const scale = Math.max(0.1, Math.min(1, level * weight * 1.35));
        elements[i].style.transform = `scaleY(${scale.toFixed(3)})`;
        elements[i].style.opacity = (0.3 + level * 0.7).toFixed(2);
      }
    });

    return unsubscribe;
  }, [peerId, muted]);

  return (
    <Wrap ref={containerRef} $height={height} aria-hidden='true'>
      {Array.from({ length: bars }, (_, index) => (
        <Bar key={index} />
      ))}
    </Wrap>
  );
});

/**
 * A ring that brightens around a speaking participant's tile. Same data
 * source, different expression — used on the video tiles where a bar chart
 * would compete with the face.
 */
export const SpeakingRing = memo(function SpeakingRing({ peerId, muted }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || muted) return undefined;

    let previous = -1;

    return subscribe(() => {
      const level = getLevel(peerId);
      if (Math.abs(level - previous) < 0.01) return;
      previous = level;

      // Below the noise floor there is no ring at all — this must read as
      // "someone is talking", not "someone is present".
      const active = Math.max(0, (level - 0.08) / 0.92);
      element.style.opacity = active.toFixed(2);
      element.style.transform = `scale(${(1 + active * 0.006).toFixed(4)})`;
    });
  }, [peerId, muted]);

  return <Ring ref={ref} aria-hidden='true' />;
});

/**
 * The active-speaker cue: a soft halo that blooms outward from the tile edge
 * rather than a hard ring drawn on it. A 1px outline switching on and off reads
 * as a selection state; a glow reads as someone's voice filling the room.
 */
const Ring = styled.span`
  position: absolute;
  inset: -1px;
  pointer-events: none;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1.5px var(--accent),
    0 0 22px -2px var(--accent-line);
  opacity: 0;
  will-change: opacity, transform;
`;

export default AudioLevel;
