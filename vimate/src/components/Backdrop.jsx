import styled, { keyframes } from 'styled-components';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.js';

/**
 * Ambient light. Generated entirely in CSS — no image files, no canvas.
 *
 * Two very wide, very faint colour fields drifting slowly against each other.
 * The purpose is narrow and specific: a large dark canvas with nothing on it
 * reads as a flat void, and a barely-perceptible gradient gives it depth so
 * elevated surfaces have something to sit *on*.
 *
 * It is deliberately not a grid, not scanlines, and not a particle field. Those
 * decorate; this lights. If you notice it, it is doing too much — which is why
 * the opacity is where it is and the drift takes half a minute per cycle.
 */

const drift = keyframes`
  0%   { transform: translate3d(-6%, -4%, 0) scale(1); }
  50%  { transform: translate3d(6%, 4%, 0) scale(1.12); }
  100% { transform: translate3d(-6%, -4%, 0) scale(1); }
`;

const driftAlt = keyframes`
  0%   { transform: translate3d(5%, 3%, 0) scale(1.08); }
  50%  { transform: translate3d(-5%, -5%, 0) scale(1); }
  100% { transform: translate3d(5%, 3%, 0) scale(1.08); }
`;

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
`;

const Field = styled.div`
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`;

const Warm = styled(Field)`
  top: -30%;
  left: -15%;
  width: 75vw;
  height: 75vw;
  background: var(--ambient-1);
  animation: ${drift} 34s ease-in-out infinite;
`;

const Cool = styled(Field)`
  right: -20%;
  bottom: -35%;
  width: 65vw;
  height: 65vw;
  background: var(--ambient-2);
  animation: ${driftAlt} 42s ease-in-out infinite;
`;

/**
 * A faint grain overlay, drawn as an inline SVG feTurbulence data URI.
 *
 * Wide, soft gradients on an 8-bit display produce visible banding. A little
 * noise dithers it away. This is the one place a texture earns its keep.
 */
const Grain = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");

  :root[data-theme='light'] & {
    opacity: 0.05;
  }
`;

export function Backdrop({ variant = 'app' }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <Layer aria-hidden='true' data-variant={variant} data-static={reducedMotion}>
      <Warm />
      <Cool />
      <Grain />
    </Layer>
  );
}

export default Backdrop;
