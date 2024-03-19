import styled, { css, keyframes } from 'styled-components';

/**
 * The shared vocabulary: lit surfaces, real type scale, soft controls.
 *
 * The thing this file is deliberately *not* doing is outlining everything. A
 * surface separates itself from the one below by elevation — a shadow, a
 * lighter fill, and a hairline highlight along its top edge — and only falls
 * back to a full border where it genuinely sits flush against something.
 */

/** An elevated surface. `$level` 1–3 picks how far off the canvas it sits. */
export const Surface = styled.div`
  position: relative;
  background: var(--surface-${({ $level = 1 }) => $level});
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-${({ $level = 1 }) => Math.min($level, 3)});

  /* Light from above: a hairline highlight on the top edge only. */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding-top: 1px;
    background: linear-gradient(var(--edge-light), transparent 60%);
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
`;

/** Frosted panel for anything that floats over video. */
export const Glass = styled.div`
  background: var(--glass);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2), inset 0 1px 0 var(--edge-light);
`;

/**
 * Type scale. Sentence case, real weights, optical tracking — the hierarchy
 * lives here rather than in a single uppercase label style applied everywhere.
 */
export const Display = styled.h1`
  font-size: clamp(38px, 6vw, 68px);
  font-weight: 500;
  line-height: 1.03;
  letter-spacing: -0.038em;
`;

export const Title = styled.h2`
  font-size: 21px;
  font-weight: 550;
  line-height: 1.25;
  letter-spacing: -0.022em;
`;

export const Heading = styled.h3`
  font-size: 15px;
  font-weight: 550;
  letter-spacing: -0.012em;
`;

export const Body = styled.p`
  font-size: 15px;
  line-height: 1.62;
  color: var(--ink-2);
`;

/**
 * A quiet label. Sentence case at a readable size — not 10px uppercase with
 * 0.16em tracking, which turns every noun in the interface into the same
 * texture and destroys the hierarchy it was meant to create.
 */
export const Label = styled.span`
  font-size: 13px;
  font-weight: 450;
  color: var(--ink-3);
  letter-spacing: -0.006em;
`;

/** A measured value. Monospace only here, where digits must not jitter. */
export const Readout = styled.span`
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: ${({ $size = 13 }) => $size}px;
  letter-spacing: -0.01em;
  color: ${({ $tone }) => ($tone ? `var(--${$tone})` : 'var(--ink)')};
`;

export const Rule = styled.div`
  height: 1px;
  width: 100%;
  background: var(--hairline);
`;

export const Button = styled.button`
  --bg: transparent;
  --fg: var(--ink);
  --ring: var(--hairline-strong);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);

  height: 40px;
  padding: 0 18px;

  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.012em;
  white-space: nowrap;

  color: var(--fg);
  background: var(--bg);
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 1px var(--ring);

  transition:
    background-color 180ms var(--ease),
    color 180ms var(--ease),
    box-shadow 180ms var(--ease),
    transform 180ms var(--ease);

  &:hover:not(:disabled) {
    background: var(--surface-3);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.4;
  }

  ${({ $variant }) =>
    $variant === 'primary' &&
    css`
      --bg: var(--accent);
      --fg: var(--accent-ink);
      --ring: transparent;
      font-weight: 550;
      box-shadow: var(--shadow-2), inset 0 1px 0 rgb(255 255 255 / 0.18);

      &:hover:not(:disabled) {
        background: var(--accent-hover);
      }
    `}

  ${({ $variant }) =>
    $variant === 'danger' &&
    css`
      --fg: var(--bad);
      --ring: transparent;
      --bg: var(--bad-soft);

      &:hover:not(:disabled) {
        background: var(--bad);
        color: var(--ink-inverse);
      }
    `}

  ${({ $variant }) =>
    $variant === 'ghost' &&
    css`
      --ring: transparent;
      --fg: var(--ink-2);

      &:hover:not(:disabled) {
        --fg: var(--ink);
        background: var(--surface-3);
      }
    `}
`;

export const Field = styled.input`
  width: 100%;
  height: 46px;
  padding: 0 15px;

  font-size: 15px;
  letter-spacing: -0.011em;

  color: var(--ink);
  background: var(--surface-sunken);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--hairline);

  transition: box-shadow 180ms var(--ease), background-color 180ms var(--ease);

  &::placeholder {
    color: var(--ink-3);
  }

  &:hover:not(:focus) {
    box-shadow: inset 0 0 0 1px var(--hairline-strong);
  }

  &:focus {
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1.5px var(--accent);
    outline: none;
  }

  &[aria-invalid='true'] {
    box-shadow: inset 0 0 0 1.5px var(--bad);
  }
`;

/** Small status chip. `$tone` names a semantic token. */
export const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;

  height: 22px;
  padding: 0 9px;

  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.008em;
  white-space: nowrap;

  color: var(--${({ $tone = 'ink-2' }) => $tone});
  background: ${({ $tone }) =>
    $tone === 'accent'
      ? 'var(--accent-soft)'
      : $tone === 'ok'
        ? 'var(--ok-soft)'
        : $tone === 'bad'
          ? 'var(--bad-soft)'
          : 'var(--surface-3)'};
  border-radius: var(--radius-pill);
`;

export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;

const shimmer = keyframes`
  0% { background-position: -180% 0; }
  100% { background-position: 180% 0; }
`;

/**
 * Placeholder for a peer whose media has not arrived. A shimmer rather than a
 * spinner: it occupies exactly the footprint the video will, so nothing shifts
 * when the first frame lands.
 */
export const Shimmer = styled.div`
  background: linear-gradient(
    100deg,
    var(--shimmer-base) 20%,
    var(--shimmer-peak) 42%,
    var(--shimmer-base) 64%
  );
  background-size: 220% 100%;
  animation: ${shimmer} 2.1s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: var(--shimmer-base);
  }
`;

export const Stack = styled.div`
  display: flex;
  flex-direction: ${({ $direction = 'column' }) => $direction};
  gap: ${({ $gap = 3 }) => `var(--space-${$gap})`};
  ${({ $align }) => $align && css`align-items: ${$align};`}
  ${({ $justify }) => $justify && css`justify-content: ${$justify};`}
  min-width: 0;
`;
