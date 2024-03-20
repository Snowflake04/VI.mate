/**
 * Fullscreen, across the three APIs browsers actually ship.
 *
 * The standard one, WebKit's prefixed one, and — the case that matters — iOS
 * Safari, which does not implement the Fullscreen API on arbitrary elements at
 * all. There, only a `<video>` can go fullscreen, through
 * `webkitEnterFullscreen`, and it takes over the whole screen with the system
 * player chrome rather than filling our tile. That is a worse experience than
 * on other platforms, but it is the only one available, and it beats a button
 * that silently does nothing.
 */

/** Whether anything can go fullscreen here. */
export function isFullscreenSupported(element) {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      element?.querySelector?.('video')?.webkitEnterFullscreen
  );
}

/** The element currently filling the screen, if any. */
export function fullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

export async function enterFullscreen(element) {
  if (!element) return false;

  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
      return true;
    }

    // iOS Safari: the video element is the only thing that can do this.
    const video = element.querySelector?.('video');
    if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return true;
    }
  } catch {
    // Denied (not a user gesture, or blocked by permissions policy). The tile
    // simply stays where it is.
  }
  return false;
}

export async function exitFullscreen() {
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch {
    // Already exited.
  }
}

/**
 * Subscribes to fullscreen changes, including WebKit's separate event.
 * Returns an unsubscribe function.
 */
export function onFullscreenChange(handler) {
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
