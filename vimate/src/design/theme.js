import { themes } from './tokens.js';

const STORAGE_KEY = 'vimate.theme';
const listeners = new Set();

let current = 'dark';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in themes) return stored;
  } catch {
    // Private browsing / blocked storage. Fall through to the media query.
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function apply(theme) {
  current = theme;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  // Drives native form controls, scrollbars, and the mobile URL bar.
  root.style.colorScheme = themes[theme].colorScheme;

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the theme still applies for this session.
  }

  for (const listener of listeners) listener(theme);
}

/**
 * The theme change as a designed moment.
 *
 * A new sun rises from wherever the switch was pressed: the incoming theme is
 * revealed by an expanding circular wipe centred on the toggle, easing out over
 * ~700ms so the eye can follow the edge across the panels. Same idea in both
 * directions — night falls the same way it lifts.
 *
 * Implemented on the View Transitions API where available, because that
 * captures the *entire* document (video tiles, canvas layers, live telemetry)
 * into a single snapshot and cross-fades it for free. Browsers without it get a
 * hand-rolled overlay that produces the same wipe; anyone who has asked for
 * reduced motion gets an instant, honest flip.
 *
 * @param {string} theme
 * @param {{x: number, y: number}} [origin] Viewport coords the wipe grows from.
 */
export function setTheme(theme, origin) {
  if (!(theme in themes) || theme === current) return;

  if (prefersReducedMotion() || !origin) {
    apply(theme);
    return;
  }

  const { x, y } = origin;
  // Radius to the furthest corner, so the wipe always finishes off-screen.
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const clipFrom = `circle(0px at ${x}px ${y}px)`;
  const clipTo = `circle(${radius}px at ${x}px ${y}px)`;
  const timing = {
    duration: 700,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  };

  if (typeof document.startViewTransition === 'function') {
    const transition = document.startViewTransition(() => apply(theme));

    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [clipFrom, clipTo] },
          { ...timing, pseudoElement: '::view-transition-new(root)' }
        );
      })
      .catch(() => {
        // A transition can be skipped (e.g. a second toggle mid-flight).
        // The theme has still been applied, which is what matters.
      });
    return;
  }

  animateFallbackWipe(theme, clipFrom, clipTo, timing);
}

/**
 * Fallback wipe for Firefox and older Safari.
 *
 * Paints an overlay in the *incoming* theme's base colour, grows the same
 * circle, and swaps the real theme in at the end. Visually near-identical to
 * the View Transition; it just cannot cross-fade the live video underneath.
 */
function animateFallbackWipe(theme, clipFrom, clipTo, timing) {
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
    background: themes[theme].canvas,
    clipPath: clipFrom,
  });
  document.body.appendChild(overlay);

  const animation = overlay.animate({ clipPath: [clipFrom, clipTo] }, timing);

  const finish = () => {
    apply(theme);
    // One frame of the overlay at full size hides the swap itself.
    requestAnimationFrame(() => overlay.remove());
  };

  animation.finished.then(finish).catch(finish);
}

export function toggleTheme(origin) {
  setTheme(current === 'dark' ? 'light' : 'dark', origin);
}

export function getTheme() {
  return current;
}

export function subscribeToTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Applied before React mounts (see main.jsx) so the first paint is already in
 * the right theme — no white flash on a dark-theme reload.
 */
export function initTheme() {
  // Read *before* applying — `apply` persists, which would otherwise make
  // every visitor look like they had made an explicit choice.
  let hasExplicitChoice = false;
  try {
    hasExplicitChoice = localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    hasExplicitChoice = false;
  }

  apply(readStoredTheme());

  // Follow the OS only while the user has not made an explicit choice.
  if (!hasExplicitChoice) {
    window
      .matchMedia('(prefers-color-scheme: light)')
      .addEventListener('change', (event) => {
        apply(event.matches ? 'light' : 'dark');
      });
  }

  return current;
}
