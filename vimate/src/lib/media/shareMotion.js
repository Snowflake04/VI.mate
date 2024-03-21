/**
 * ---------------------------------------------------------------------------
 * Screen share content detection
 * ---------------------------------------------------------------------------
 * Decides whether what is being shared is a document or moving pictures, so the
 * encoder can be told which of the two to protect *when it cannot have both*.
 *
 * Note what this deliberately does not do: gate the frame rate. Both modes are
 * capped at 30. A cap is a ceiling rather than a target, and screen capture
 * only emits a frame when the surface changes, so a static document produces
 * one or two a second regardless — gating the ceiling on content type would
 * cost video everything and save documents nothing.
 *
 * What genuinely differs is the trade-off under pressure. A slide or an IDE
 * wants every pixel and will happily drop to two frames a second to keep them;
 * a video wants smooth motion and would rather lose resolution than stutter.
 * That is `contentHint` and `degradationPreference`, and getting it backwards
 * is very visible — text encoded as motion turns to mush.
 *
 * Detection is a real measurement rather than a guess, and screen capture makes
 * it an easy one: the browser only produces a frame when the captured surface
 * actually changes. A static document delivers a couple of frames a second; a
 * playing video delivers twenty-five or thirty. So counting frames off the
 * source track separates them cleanly, with no heuristics about window titles
 * or `displaySurface`.
 *
 * Note this measures the *source*, not what we send. Measuring the outbound
 * stream would be circular — it is already capped by the decision being made
 * here, so a share stuck in text mode would look like a static document
 * forever.
 * ---------------------------------------------------------------------------
 */

/** Sustained source frame rate at or above this reads as moving pictures. */
const MOTION_ENTER_FPS = 12;

/**
 * And below this it reads as a document again.
 *
 * The gap between the two is hysteresis. Sharing a document involves plenty of
 * brief motion — scrolling, switching tabs, dragging a window — and flipping
 * the encoder's whole strategy on each of those would be worse than picking
 * either mode and staying there.
 */
const MOTION_EXIT_FPS = 5;

/** How long a reading has to hold before it counts. */
const WINDOW_MS = 2000;
/** Consecutive quiet windows before dropping back to text. */
const EXIT_WINDOWS = 2;

/**
 * Watches a screen-share track and reports 'text' or 'motion'.
 *
 * @param {MediaStreamTrack} track  The video track from getDisplayMedia.
 * @param {(mode: 'text' | 'motion', fps: number) => void} onChange
 * @returns {{ stop: () => void }}
 */
export function watchShareMotion(track, onChange) {
  const video = document.createElement('video');
  video.srcObject = new MediaStream([track]);
  video.muted = true;
  video.playsInline = true;
  video.play?.().catch(() => {});

  let mode = 'text';
  let frames = 0;
  let quietWindows = 0;
  let windowStartedAt = performance.now();
  let timer = null;
  let stopped = false;
  let stopReader = null;

  const evaluate = () => {
    const now = performance.now();
    const elapsed = (now - windowStartedAt) / 1000;
    if (elapsed <= 0) return;

    const fps = frames / elapsed;
    frames = 0;
    windowStartedAt = now;

    if (mode === 'text' && fps >= MOTION_ENTER_FPS) {
      mode = 'motion';
      quietWindows = 0;
      onChange(mode, fps);
      return;
    }

    if (mode === 'motion') {
      if (fps <= MOTION_EXIT_FPS) {
        quietWindows += 1;
        if (quietWindows >= EXIT_WINDOWS) {
          mode = 'text';
          quietWindows = 0;
          onChange(mode, fps);
        }
      } else {
        quietWindows = 0;
      }
    }
  };

  /*
   * Counting frames without being lied to.
   *
   * `requestVideoFrameCallback` is the obvious choice and the wrong one here:
   * it fires per *presented* frame, and this video element is deliberately
   * detached, so the browser throttles presentation. Measured against a 30fps
   * source it reported 9.7 — below the motion threshold, so the detector could
   * never fire at all.
   *
   * `MediaStreamTrackProcessor` reads the track itself and is unaffected by
   * whether anything is on screen; it measured the same source at 30.7. Where
   * it is missing, the decoded-frame counter is accurate too (it counted 31),
   * because decoding happens regardless of presentation.
   */
  const processor =
    typeof window.MediaStreamTrackProcessor === 'function'
      ? new window.MediaStreamTrackProcessor({ track })
      : null;

  if (processor) {
    const reader = processor.readable.getReader();
    (async () => {
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ done: true }));
        if (done || stopped) {
          value?.close();
          break;
        }
        frames += 1;
        // VideoFrames hold real memory and must be released explicitly.
        value.close();
      }
    })();
    stopReader = () => reader.cancel().catch(() => {});
  }

  let previousDecoded = 0;
  timer = setInterval(() => {
    if (stopped) return;
    if (!processor) {
      const decoded = video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0;
      frames = Math.max(0, decoded - previousDecoded);
      previousDecoded = decoded;
    }
    evaluate();
  }, WINDOW_MS);

  return {
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      stopReader?.();
      video.srcObject = null;
    },
  };
}

export default watchShareMotion;
