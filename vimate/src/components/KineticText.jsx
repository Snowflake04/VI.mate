import { useMemo } from 'react';
import { motion } from 'motion/react';
import styled from 'styled-components';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.js';

/**
 * Kinetic typography for the lobby headline.
 *
 * Each glyph arrives on its own spring with a staggered delay, rising and
 * un-blurring into place — the phrase assembles the way a readout resolves as
 * a system comes online, which is the whole conceit of the lobby.
 *
 * Two things this gets right that per-character animation usually gets wrong:
 * the text stays a single accessible string for screen readers and copy/paste
 * (the split glyphs are `aria-hidden`), and words are kept whole so the line
 * never wraps mid-word.
 */
export function KineticText({
  text,
  as = 'h1',
  delay = 0,
  stagger = 0.028,
  className,
}) {
  const reducedMotion = usePrefersReducedMotion();

  const words = useMemo(() => text.split(' '), [text]);

  if (reducedMotion) {
    return (
      <Line as={as} className={className}>
        {text}
      </Line>
    );
  }

  let glyphIndex = 0;

  return (
    <Line as={as} className={className}>
      {/* The accessible copy — one clean string, not 40 spans. */}
      <ScreenReaderText>{text}</ScreenReaderText>

      <span aria-hidden='true'>
        {words.map((word, wordIndex) => (
          <Word key={`${word}-${wordIndex}`}>
            {Array.from(word).map((character, characterIndex) => {
              const index = glyphIndex;
              glyphIndex += 1;

              return (
                <Glyph
                  key={characterIndex}
                  initial={{ y: '0.5em', opacity: 0, filter: 'blur(6px)' }}
                  animate={{ y: '0em', opacity: 1, filter: 'blur(0px)' }}
                  transition={{
                    type: 'spring',
                    stiffness: 320,
                    damping: 26,
                    mass: 0.7,
                    delay: delay + index * stagger,
                  }}
                >
                  {character}
                </Glyph>
              );
            })}
            {wordIndex < words.length - 1 && ' '}
          </Word>
        ))}
      </span>
    </Line>
  );
}

const Line = styled.span`
  display: block;
`;

/** `inline-block` on the word keeps wrapping at word boundaries. */
const Word = styled.span`
  display: inline-block;
  white-space: nowrap;
`;

const Glyph = styled(motion.span)`
  display: inline-block;
  /* Without this the blur filter clips against the glyph box. */
  will-change: transform, opacity, filter;
`;

const ScreenReaderText = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;

export default KineticText;
