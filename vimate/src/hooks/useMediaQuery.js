import { useCallback, useSyncExternalStore } from 'react';

/**
 * Live media-query match.
 *
 * `useSyncExternalStore` rather than an effect + state, so the correct value is
 * available on the very first render. That matters here: the video stage picks
 * between two entirely different layout strategies on this value, and a frame
 * rendered with the wrong one is a visible jump.
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (callback) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', callback);
      return () => media.removeEventListener('change', callback);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default useMediaQuery;
