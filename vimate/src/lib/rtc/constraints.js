/**
 * ---------------------------------------------------------------------------
 * Adaptive media constraints
 * ---------------------------------------------------------------------------
 * The original client asked for `{ audio: true, video: true }` and left it
 * there. In a mesh topology that is a real problem: every participant encodes
 * and uploads a separate stream to every other participant, so a 6-person call
 * on a fixed 720p ladder asks a laptop to run five simultaneous HD encodes and
 * a phone to do the same on a battery. The result is thermal throttling, fan
 * noise, and — most visibly — everyone's video degrading at once.
 *
 * So the ladder is chosen from what the device and the room actually are, and
 * re-chosen when either changes.
 * ---------------------------------------------------------------------------
 */

/**
 * Encoding ladder.
 *
 * The bitrates are deliberately generous. Softness in a video call is almost
 * always bitrate starvation rather than resolution: an encoder handed 1080p and
 * 1.5 Mbps produces a blurrier picture than one handed 720p and the same
 * budget, because it spends every bit on macroblocks instead of detail.
 */
export const TIERS = {
  ultra: {
    id: 'ultra',
    label: '1080p',
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 3_500_000,
  },
  high: {
    id: 'high',
    label: '720p',
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 2_000_000,
  },
  medium: {
    id: 'medium',
    label: '540p',
    width: 960,
    height: 540,
    frameRate: 30,
    maxBitrate: 1_100_000,
  },
  low: {
    id: 'low',
    label: '360p',
    width: 640,
    height: 360,
    frameRate: 24,
    maxBitrate: 500_000,
  },
  minimal: {
    id: 'minimal',
    label: '240p',
    width: 426,
    height: 240,
    frameRate: 15,
    maxBitrate: 200_000,
  },
};

const ORDER = ['ultra', 'high', 'medium', 'low', 'minimal'];

/**
 * Screen share encoding.
 *
 * 30fps, not the 8 this used to cap at. A frame rate cap is a ceiling, not a
 * target, and screen capture only produces a frame when the captured surface
 * actually changes — a slide or an IDE delivers one or two a second whichever
 * ceiling is set. So the low cap never saved anything on documents, which was
 * its whole justification; all it did was turn shared video into a slideshow.
 */
export const SCREEN_SHARE_ENCODING = {
  maxBitrate: 4_000_000,
  maxFramerate: 30,
};

/**
 * What to protect when a share cannot have everything.
 *
 * This is the decision that genuinely depends on what is being shared, and the
 * two answers are opposites. Text wants every pixel and will happily drop to
 * two frames a second to keep them; video wants smooth motion and would rather
 * lose resolution than stutter. Encoding one as the other is very visible.
 *
 * `contentHint` is the standard way to tell the browser, and it feeds the same
 * encoder tuning libwebrtc uses internally; `degradationPreference` is the
 * explicit lever for the same trade-off.
 */
export const SCREEN_SHARE_MODES = {
  text: {
    id: 'text',
    label: 'Text',
    contentHint: 'text',
    degradationPreference: 'maintain-resolution',
  },
  motion: {
    id: 'motion',
    label: 'Motion',
    contentHint: 'motion',
    degradationPreference: 'maintain-framerate',
  },
};

/**
 * Scores the device once at startup. Deliberately conservative — guessing low
 * costs a little sharpness, guessing high costs dropped frames and heat.
 */
export function profileDevice() {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = navigator.deviceMemory ?? 4;
  const connection = navigator.connection ?? null;

  // `maxTouchPoints` is a far better mobile signal than a UA string, which
  // lies, and which the browser is actively working to freeze.
  const isProbablyMobile =
    navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches;

  /*
   * Compute only. The network is deliberately *not* scored here any more.
   *
   * This used to fold `effectiveType` and `downlink` into the same number, and
   * it was the main reason a good connection started at 360p: `downlink` is a
   * rolling estimate that is at its most pessimistic in the first seconds after
   * load, which is exactly when this runs. A cold reading below 1.5 Mbps cost
   * two points and dropped the whole call two rungs.
   *
   * The link is now measured for real by the congestion controller and read
   * back through `availableOutgoingBitrate`, so guessing it here adds nothing
   * and cannot be corrected. What hardware you have does not change mid-call;
   * what your network is doing changes constantly.
   */
  let score = 0;
  if (cores >= 8) score += 2;
  else if (cores >= 4) score += 1;

  if (memory >= 8) score += 2;
  else if (memory >= 4) score += 1;

  if (isProbablyMobile) score -= 1;

  // Save-Data is an explicit instruction rather than a measurement, so it is
  // still honoured here — it is a statement about intent, not capability.
  if (connection?.saveData) score -= 3;

  // Caps at 'high'. 1080p is granted by room size, not by device score — see
  // tierForRoom — because it is only affordable in a one-to-one call.
  let tier;
  if (score >= 4) tier = 'high';
  else if (score >= 2) tier = 'medium';
  else if (score >= 1) tier = 'low';
  else tier = 'minimal';

  return {
    tier,
    cores,
    memory,
    isProbablyMobile,
    saveData: Boolean(connection?.saveData),
    effectiveType: connection?.effectiveType ?? null,
  };
}

/**
 * The tier the *camera* is opened at, as distinct from the tier it is encoded
 * at.
 *
 * Always the top of the ladder, whatever the device scored. Chromium fixes the
 * capture format when getUserMedia resolves — applyConstraints can downscale
 * from it but will never re-open the device higher — so a camera opened at 360p
 * is a 360p source for the rest of the session no matter what the adaptive loop
 * later decides. Climbing to "1080p" from there raises a label and a bitrate
 * ceiling over a picture that has 360 lines in it.
 *
 * Capturing high costs almost nothing, because it is not what gets encoded:
 * `scaleResolutionDownBy` reduces the frame before the encoder sees it, so the
 * encoder still works at the tier's size. Only capture-and-scale runs at full
 * resolution, and that is far cheaper than encoding. This is what Jitsi and
 * libwebrtc both do — capture once, high, and adapt at the encoder.
 *
 * The one exception is an explicit request to save data, which is a statement
 * of intent rather than a measurement, and is honoured.
 */
export function captureTier(profile) {
  return profile?.saveData ? 'medium' : 'ultra';
}

/**
 * Ceiling for the room, given the device's own ceiling.
 *
 * Mesh calls cost O(n) uplink per participant, so the ladder drops as the room
 * grows — before anything has a chance to fail. Four peers at 720p is ~8 Mbps
 * up, which most home connections do not have.
 *
 * The inverse is the interesting case: in a one-to-one call there is exactly
 * one outbound stream and the entire uplink budget belongs to it, so a capable
 * device gets the full 1080p ladder. That is the only place 1080p is ever
 * granted.
 *
 * @param {string} baseTier  The device's ceiling from profileDevice().
 * @param {number} peerCount Total participants, including yourself.
 */
export function tierForRoom(baseTier, peerCount) {
  let index = ORDER.indexOf(baseTier);
  if (index === -1) index = ORDER.indexOf('medium');

  if (peerCount <= 2) {
    /*
     * Promote to 1080p from 540p up.
     *
     * This used to require the device to have already reached 720p, which kept
     * every phone off the top rung permanently. Being aggressive here is now
     * safe because the loop reads `qualityLimitationReason` and pulls back the
     * moment the encoder reports it is CPU-bound — a measured retreat within a
     * couple of seconds beats a guess that can never be revised.
     */
    return index <= ORDER.indexOf('medium') ? 'ultra' : ORDER[index];
  }

  /*
   * Stepping starts at four, not three.
   *
   * Three participants is two outbound streams — about 4 Mbps at 720p, which
   * ordinary broadband carries. Penalising it meant one person joining a pair
   * dropped everyone two rungs at once, from 1080p straight to 540p, which is
   * very visible. Four participants (three streams, ~3.3 Mbps at 540p) is where
   * the budget genuinely runs out.
   *
   * If three people at 720p turns out to be too much for a particular network,
   * the closed loop in CallEngine#adaptQuality drops it within a few seconds —
   * that is what measured adaptation is for, and it beats guessing pessimistically.
   */
  if (peerCount >= 8) index += 3;
  else if (peerCount >= 6) index += 2;
  else if (peerCount >= 4) index += 1;

  return ORDER[Math.min(index, ORDER.length - 1)];
}

/**
 * The best tier whose bitrate budget fits `bitrate`, never above `ceiling`.
 *
 * This is what lets the loop jump rungs. GCC increases multiplicatively while
 * far from convergence rather than inching upward, and the same reasoning
 * applies here: if the measured headroom fits three rungs up, going there
 * directly is correct — stepping one rung per hold-down is what turns a
 * recovery from a blip into a minutes-long climb.
 *
 * Returns the lowest tier when nothing fits, because sending something poor
 * beats sending nothing.
 */
export function bestTierFor(bitrate, ceiling = 'ultra') {
  const floorIndex = ORDER.length - 1;
  const ceilingIndex = Math.max(0, ORDER.indexOf(ceiling));

  for (let index = ceilingIndex; index <= floorIndex; index += 1) {
    if (bitrate >= TIERS[ORDER[index]].maxBitrate) return ORDER[index];
  }
  return ORDER[floorIndex];
}

export function stepDown(tier) {
  const index = ORDER.indexOf(tier);
  return ORDER[Math.min(index + 1, ORDER.length - 1)];
}

export function stepUp(tier) {
  const index = ORDER.indexOf(tier);
  return ORDER[Math.max(index - 1, 0)];
}

export function isLowerThan(a, b) {
  return ORDER.indexOf(a) > ORDER.indexOf(b);
}

/**
 * getUserMedia constraints. Resolution is expressed as `ideal` rather than
 * `exact` on purpose: `exact` makes the call throw OverconstrainedError on any
 * camera that cannot hit the number, and a slightly-wrong resolution is
 * infinitely better than no video.
 */
export function mediaConstraints(tier) {
  const spec = TIERS[tier] ?? TIERS.medium;

  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      // 48 kHz mono is what Opus wants; stereo doubles bitrate for speech
      // that is mono anyway.
      channelCount: 1,
    },
    video: {
      /*
       * `max` is square (1920 on both axes) rather than 1920×1080, because a
       * phone in portrait legitimately produces 1080×1920 and a landscape-
       * shaped ceiling would reject or rotate it. The `ideal` pair is only a
       * hint — the device picks the nearest mode it actually has, which on a
       * portrait-locked phone is the portrait one.
       */
      width: { ideal: spec.width, max: 1920 },
      height: { ideal: spec.height, max: 1920 },
      frameRate: { ideal: spec.frameRate, max: 30 },
      facingMode: 'user',
      /*
       * `resizeMode: 'crop-and-scale'` is deliberately NOT set. It permits the
       * browser to satisfy the ideal by cropping and rescaling the sensor
       * output, which throws away real detail to hit a number. Letting the
       * camera hand over its native mode and constraining bitrate at the
       * encoder instead produces a visibly sharper picture.
       */
    },
  };
}

/**
 * Applies a tier to a live sender without renegotiating.
 *
 * `setParameters` is the important half: constraining the *track* alone lets
 * the encoder still spend far more bitrate than intended, and bitrate is what
 * actually saturates an uplink.
 */
export async function applyTierToSender(
  sender,
  tier,
  { isScreenShare, captureSize, shareMode = 'text' } = {}
) {
  if (!sender || sender.track?.kind !== 'video') return false;

  const spec = TIERS[tier] ?? TIERS.medium;
  const encoding = isScreenShare
    ? SCREEN_SHARE_ENCODING
    : { maxBitrate: spec.maxBitrate, maxFramerate: spec.frameRate };

  /*
   * Resolution is reduced at the encoder, never at the camera.
   *
   * The obvious alternative — `track.applyConstraints({ width, height })` —
   * cannot be trusted to preserve orientation. A camera treats constraints as
   * a request to pick a supported *mode*, and it may pick one with a different
   * shape entirely: a 720×1080 portrait phone asked for `height: 1920` was
   * observed returning 1920×1080, having simply rotated to its preferred
   * landscape mode. The participant then appears in everyone's grid in the
   * wrong orientation, which is precisely the failure this is meant to avoid.
   *
   * `scaleResolutionDownBy` divides both axes by the same factor, so the
   * aspect ratio is arithmetically guaranteed to survive. The encoder also
   * encodes at the reduced size, so the CPU saving that made constraining the
   * camera attractive is kept.
   */
  let scaleResolutionDownBy = 1;
  if (!isScreenShare) {
    /*
     * `captureSize` is the camera's own format, passed in because the track on
     * the sender may not be the camera's. Sender-side mirroring publishes a
     * derived track, and a `MediaStreamTrackGenerator` reports no width or
     * height at all — which would read as "capture is 0 wide", leave the scale
     * factor at 1, and silently disable the entire downscaling ladder.
     */
    const settings = captureSize ?? sender.track.getSettings?.() ?? {};
    const captureLongEdge = Math.max(settings.width ?? 0, settings.height ?? 0);
    const targetLongEdge = Math.max(spec.width, spec.height);

    if (captureLongEdge > targetLongEdge && targetLongEdge > 0) {
      scaleResolutionDownBy = captureLongEdge / targetLongEdge;
    }
  }

  try {
    const parameters = sender.getParameters();
    // Firefox returns parameters with no encodings until the first setParameters.
    if (!parameters.encodings || parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    }

    parameters.encodings[0] = {
      ...parameters.encodings[0],
      ...encoding,
      scaleResolutionDownBy,
    };

    /*
     * A camera is always a talking head, so 'balanced' lets the encoder trade
     * either way. A share depends on what is on the screen — see
     * SCREEN_SHARE_MODES.
     */
    parameters.degradationPreference = isScreenShare
      ? (SCREEN_SHARE_MODES[shareMode] ?? SCREEN_SHARE_MODES.text).degradationPreference
      : 'balanced';

    await sender.setParameters(parameters);
    return true;
  } catch (error) {
    // Not fatal — an un-tuned sender still works, it just uses more bandwidth.
    console.warn('[rtc] could not apply encoding parameters', error);
    return false;
  }
}

export { ORDER as TIER_ORDER };
