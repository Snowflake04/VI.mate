import { useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styled from 'styled-components';

import { getTheme, subscribeToTheme, toggleTheme } from '../design/theme.js';
import { SunIcon, MoonIcon } from './Icons.jsx';
import { VisuallyHidden } from './Primitives.jsx';

/**
 * The theme switch, and the origin point of the transition.
 *
 * The click's viewport coordinates are handed to `toggleTheme`, which grows the
 * circular wipe from exactly there — so the new theme visibly emanates from the
 * control you pressed rather than simply replacing the page.
 *
 * Icon only. The previous version spelled out the theme's name beside it, which
 * meant a piece of decorative jargon sat permanently in the header for a control
 * whose two states are already universally understood as sun and moon.
 *
 * Subscribed via `useSyncExternalStore` because the theme lives in the DOM (a
 * `data-theme` attribute), not in React — this is the only component that
 * re-renders when it changes.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, () => 'dark');
  const isDark = theme === 'dark';

  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    toggleTheme({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  return (
    <Toggle
      type='button'
      onClick={handleClick}
      aria-pressed={!isDark}
      title={isDark ? 'Switch to daylight' : 'Switch to low light'}
    >
      <IconWell>
        <AnimatePresence mode='wait' initial={false}>
          <motion.span
            key={theme}
            initial={{ y: 12, opacity: 0, rotate: -40 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -12, opacity: 0, rotate: 40 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            {isDark ? <MoonIcon /> : <SunIcon />}
          </motion.span>
        </AnimatePresence>
      </IconWell>

      <VisuallyHidden>
        {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      </VisuallyHidden>
    </Toggle>
  );
}

const Toggle = styled.button`
  display: grid;
  place-items: center;

  width: 36px;
  height: 36px;

  /* Comfortable to hit with a thumb; unchanged for mouse users. */
  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
  }

  color: var(--ink-2);
  border-radius: var(--radius-pill);

  transition: color 200ms var(--ease), background-color 200ms var(--ease);

  &:hover {
    color: var(--ink);
    background: var(--surface-3);
  }

  svg {
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const IconWell = styled.span`
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  /* Clips the icons as they slide past each other during the swap. */
  overflow: hidden;

  > span {
    display: grid;
    place-items: center;
  }
`;

export default ThemeToggle;
