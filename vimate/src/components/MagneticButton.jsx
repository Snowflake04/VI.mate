import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import styled, { css } from 'styled-components';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.js';

/**
 * A control-dock button with magnetic hover.
 *
 * The controls that matter during a call — mute, camera, leave — are the ones
 * you reach for without looking, often mid-sentence. A small pull toward the
 * cursor makes them feel like physical keys with detents, and it widens their
 * effective hit area, which is a real usability gain rather than a flourish.
 *
 * Spring-driven, not CSS-transition-driven: the button keeps momentum when the
 * pointer changes direction, which is what sells it as an object. Touch devices
 * and reduced-motion users get a plain button — there is no cursor to be
 * magnetic toward on a touchscreen.
 */

const SPRING = { stiffness: 280, damping: 20, mass: 0.3 };
/** Fraction of the distance from centre the button travels. */
const PULL = 0.3;

export function MagneticButton({
  children,
  className,
  radius = 22,
  as: _as,
  ...props
}) {
  const ref = useRef(null);
  const reducedMotion = usePrefersReducedMotion();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING);
  const y = useSpring(rawY, SPRING);

  // The icon lags the shell slightly, which reads as depth.
  const innerX = useTransform(x, (value) => value * 0.38);
  const innerY = useTransform(y, (value) => value * 0.38);

  const handlePointerMove = (event) => {
    if (reducedMotion || event.pointerType !== 'mouse') return;

    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const offsetX = event.clientX - (rect.left + rect.width / 2);
    const offsetY = event.clientY - (rect.top + rect.height / 2);

    // Clamped so a fast pass across the dock cannot fling the button away.
    rawX.set(Math.max(-radius, Math.min(radius, offsetX * PULL)));
    rawY.set(Math.max(-radius, Math.min(radius, offsetY * PULL)));
  };

  const release = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <Shell
      ref={ref}
      className={className}
      style={{ x, y }}
      onPointerMove={handlePointerMove}
      onPointerLeave={release}
      onPointerCancel={release}
      onBlur={release}
      whileTap={reducedMotion ? undefined : { scale: 0.92 }}
      {...props}
    >
      <Inner style={{ x: innerX, y: innerY }}>{children}</Inner>
    </Shell>
  );
}

const Shell = styled(motion.button)`
  position: relative;
  display: grid;
  place-items: center;

  width: 44px;
  height: 44px;
  flex-shrink: 0;

  color: var(--ink-2);
  background: transparent;
  border-radius: var(--radius-pill);

  transition:
    background-color 200ms var(--ease),
    color 200ms var(--ease),
    box-shadow 200ms var(--ease);

  &:hover:not(:disabled) {
    color: var(--ink);
    background: var(--surface-3);
  }

  /* Active state is a filled pill, not a coloured outline — an "on" control
     should read as pressed-in hardware. */
  ${({ $active }) =>
    $active &&
    css`
      color: var(--ink);
      background: var(--surface-3);
      box-shadow: inset 0 0 0 1px var(--hairline-strong);
    `}

  /* A control that is OFF when it should be on (muted mic, camera down) is the
     only thing in the dock allowed to be red. */
  ${({ $danger }) =>
    $danger &&
    css`
      color: var(--bad);
      background: var(--bad-soft);

      &:hover:not(:disabled) {
        color: var(--bad);
        background: var(--bad-soft);
        filter: brightness(1.1);
      }
    `}

  &:disabled {
    opacity: 0.3;
  }

  svg {
    width: 19px;
    height: 19px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  @media (pointer: coarse) {
    width: 46px;
    height: 46px;
  }
`;

const Inner = styled(motion.span)`
  display: grid;
  place-items: center;
  pointer-events: none;
`;

export default MagneticButton;
