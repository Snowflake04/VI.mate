import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/**
 * Live-updating reduced-motion preference.
 *
 * `useSyncExternalStore` rather than an effect + state: it reads the correct
 * value during the very first render, so a spring-animated component never
 * plays one frame of motion before finding out it should not have.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default usePrefersReducedMotion;
