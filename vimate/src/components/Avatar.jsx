import { memo, useMemo } from 'react';
import styled from 'styled-components';

/**
 * Deterministic generated avatar — no image files, no stock photography.
 *
 * A soft two-tone gradient disc carrying the person's initials. Everything
 * derives from a hash of the name, so the same person is the same mark in every
 * tile, every session, every machine. (The version this replaced called
 * `Math.random()` inside a render effect, so people changed colour on re-render.)
 *
 * The earlier identicon dot-matrix was dropped deliberately: it was legible
 * texture at 60px and illegible noise at 26px, and it pulled the whole
 * interface back toward the technical-costume register.
 */

/** FNV-1a. Small, fast, well distributed for short strings. */
function hash(value) {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function initialsOf(name) {
  // Unicode-aware, so non-Latin scripts work where /\w/ would not.
  const words = name.match(/\p{L}+/gu) ?? [];
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const Disc = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;

  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;

  /* Two hues a short step apart on the wheel — a gradient with a light source
     rather than a flat swatch. */
  background: linear-gradient(
    145deg,
    ${({ $hue }) => `hsl(${$hue} 58% 58%)`},
    ${({ $hue }) => `hsl(${($hue + 34) % 360} 52% 44%)`}
  );
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.22),
    inset 0 0 0 1px rgb(0 0 0 / 0.08);

  color: #fff;
  font-size: ${({ $size }) => Math.round($size * 0.38)}px;
  font-weight: 550;
  letter-spacing: -0.02em;
  line-height: 1;
  /* Keeps initials readable over the lighter end of the gradient. */
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.22);
  user-select: none;
`;

export const Avatar = memo(function Avatar({ name = '', size = 34, className }) {
  const { hue, initials } = useMemo(() => {
    const seed = hash(name || 'unknown');
    return {
      // Golden-angle stepping spreads consecutive hashes far apart in hue, so
      // two people in one room rarely collide on colour.
      hue: Math.round(((seed % 1021) * 137.508) % 360),
      initials: initialsOf(name),
    };
  }, [name]);

  return (
    <Disc $size={size} $hue={hue} className={className} aria-hidden='true'>
      {initials}
    </Disc>
  );
});

export default Avatar;
