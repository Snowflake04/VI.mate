/**
 * ---------------------------------------------------------------------------
 * Sender-side mirroring
 * ---------------------------------------------------------------------------
 * Produces a horizontally flipped copy of a camera track and publishes *that*,
 * so every participant receives an already-mirrored image and no receiver has
 * to do anything.
 *
 * The alternative — a CSS transform on each `<video>` — is far cheaper, but it
 * is a rendering trick: the bytes on the wire are unflipped, anything that
 * consumes the track without going through our components (a recording, a
 * screenshot, a future SFU) sees the original, and every client has to be told
 * to apply it. Flipping at the source makes the mirrored frame the actual
 * content of the call.
 *
 * Two implementations, picked at runtime:
 *
 *   1. Insertable Streams (`MediaStreamTrackProcessor`). Chromium only. Frames
 *      are transformed on the media pipeline, so it is unaffected by tab
 *      visibility and never touches the main thread's animation clock.
 *
 *   2. A `<video>` drawn into a canvas, captured back out. Works everywhere.
 *      Draws are driven by `requestVideoFrameCallback` so exactly one draw
 *      happens per decoded frame rather than spinning at display refresh.
 *
 * A rear-facing camera is passed through untouched. Mirroring exists so a
 * preview behaves like a mirror, and that reasoning only holds while the lens
 * points at you — turn it around and the same flip reverses the scene and makes
 * any text in shot read backwards.
 *
 * The canvas path inherits a real limitation: frame callbacks are throttled in
 * a hidden tab, so a backgrounded sender's video slows or stalls for everyone
 * else. Path 1 has no such problem, which is most of why it exists — and it is
 * the path Chrome and Android Chrome take, which is where calls actually
 * happen.
 * ---------------------------------------------------------------------------
 */

/** Whether frames can be transformed on the media pipeline. */
export function supportsTrackProcessor() {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaStreamTrackProcessor === 'function' &&
    typeof window.VideoFrame === 'function' &&
    (typeof window.MediaStreamTrackGenerator === 'function' ||
      typeof window.VideoTrackGenerator === 'function')
  );
}

/**
 * Whether a track is the rear camera.
 *
 * Read from the live track rather than from whatever was requested, because a
 * camera is free to satisfy a `facingMode` hint with whichever device it likes.
 * A camera that reports nothing at all — most desktop webcams — is treated as
 * front-facing, which is what it almost always is.
 */
export function isRearFacing(track) {
  return track?.getSettings?.().facingMode === 'environment';
}

/** `ctx.setTransform` with a negative x-scale, origin pushed to the right edge. */
function flipContext(ctx, width) {
  ctx.setTransform(-1, 0, 0, 1, width, 0);
}

// --------------------------------------------------------------- pipeline ---

function mirrorViaTrackProcessor(track) {
  const processor = new window.MediaStreamTrackProcessor({ track });

  // Two spellings of the same thing: the original Chromium API, and the
  // renamed one from the current spec draft.
  const generator =
    typeof window.MediaStreamTrackGenerator === 'function'
      ? new window.MediaStreamTrackGenerator({ kind: 'video' })
      : new window.VideoTrackGenerator();
  const output = generator.track ?? generator;
  const writable = generator.writable;

  let canvas = null;
  let ctx = null;

  const transformer = new TransformStream({
    transform(frame, controller) {
      const width = frame.displayWidth;
      const height = frame.displayHeight;

      // The camera can change format mid-session; follow it rather than
      // assuming the size we started with.
      if (!canvas || canvas.width !== width || canvas.height !== height) {
        canvas = new OffscreenCanvas(width, height);
        ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      }

      flipContext(ctx, width);
      ctx.drawImage(frame, 0, 0, width, height);

      /*
       * Timestamp and duration are carried across deliberately. They are what
       * the encoder and the receiver's jitter buffer pace playback from —
       * dropping them produces video that decodes correctly and plays at the
       * wrong speed.
       */
      const mirrored = new window.VideoFrame(canvas, {
        timestamp: frame.timestamp,
        ...(frame.duration == null ? {} : { duration: frame.duration }),
      });

      // VideoFrames hold real memory and are not garbage collected promptly.
      // Failing to close one leaks a whole frame buffer per frame.
      frame.close();
      controller.enqueue(mirrored);
    },

    flush() {
      canvas = null;
      ctx = null;
    },
  });

  const done = processor.readable
    .pipeThrough(transformer)
    .pipeTo(writable)
    .catch(() => {
      // Pipeline torn down (track ended, or stop() called). Not an error.
    });

  return {
    track: output,
    stop() {
      // Cancelling the source unwinds the whole chain, closing any frame still
      // in flight.
      processor.readable.cancel().catch(() => {});
      output.stop?.();
      return done;
    },
  };
}

// ----------------------------------------------------------------- canvas ---

function mirrorViaCanvas(track) {
  const settings = track.getSettings?.() ?? {};
  const frameRate = Math.round(settings.frameRate ?? 30) || 30;

  const video = document.createElement('video');
  video.srcObject = new MediaStream([track]);
  video.muted = true;
  video.playsInline = true;
  // Never displayed; it exists only as a decode target for drawImage.
  video.play?.().catch(() => {});

  const canvas = document.createElement('canvas');
  canvas.width = settings.width ?? 1280;
  canvas.height = settings.height ?? 720;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  let stopped = false;
  let frameHandle = null;

  const draw = () => {
    if (stopped) return;

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width && height) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      flipContext(ctx, width);
      ctx.drawImage(video, 0, 0, width, height);
    }

    schedule();
  };

  /*
   * One draw per decoded frame where the browser can tell us about them;
   * otherwise fall back to the animation clock, which over-samples but never
   * misses a frame.
   */
  const schedule = () => {
    if (stopped) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      frameHandle = video.requestVideoFrameCallback(draw);
    } else {
      frameHandle = requestAnimationFrame(draw);
    }
  };

  schedule();

  const output = canvas.captureStream(frameRate).getVideoTracks()[0];

  return {
    track: output,
    stop() {
      stopped = true;
      if (frameHandle != null) {
        if (typeof video.cancelVideoFrameCallback === 'function') {
          video.cancelVideoFrameCallback(frameHandle);
        } else {
          cancelAnimationFrame(frameHandle);
        }
      }
      output.stop();
      video.srcObject = null;
    },
  };
}

// ------------------------------------------------------------------- api ---

/**
 * Mirrors every video track in `source`, passing audio through untouched.
 *
 * The returned stream is what should be previewed and published. The source
 * stream stays open and is still the thing to `stop()` to release the camera —
 * this only reads from it.
 *
 * @param {MediaStream} source
 * @returns {{ stream: MediaStream, stop: () => void }}
 */
export function createMirroredStream(source) {
  const videoTracks = source.getVideoTracks();
  if (videoTracks.length === 0) {
    return { stream: source, stop() {} };
  }

  /*
   * Rear-facing tracks are forwarded as they are. They still travel in the
   * output stream, so callers do not have to care which kind they got — but
   * they own no pipeline, and stopping them is the caller's job either way.
   */
  const mirrors = videoTracks
    .filter((track) => !isRearFacing(track))
    .map((track) =>
      supportsTrackProcessor() ? mirrorViaTrackProcessor(track) : mirrorViaCanvas(track)
    );

  const passthrough = videoTracks.filter(isRearFacing);

  const stream = new MediaStream([
    ...mirrors.map((mirror) => mirror.track),
    ...passthrough,
    ...source.getAudioTracks(),
  ]);

  return {
    stream,
    stop() {
      for (const mirror of mirrors) mirror.stop();
    },
  };
}

export default createMirroredStream;
