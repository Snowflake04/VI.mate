import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { motion } from 'motion/react';

import Avatar from '../../components/Avatar.jsx';
import SignalBars from '../../components/SignalBars.jsx';
import { AudioLevel, SpeakingRing } from '../../components/AudioLevel.jsx';
import { Shimmer, VisuallyHidden } from '../../components/Primitives.jsx';
import {
  CollapseIcon,
  ExitFullscreenIcon,
  ExpandIcon,
  FullscreenIcon,
  MicOffIcon,
  ScreenIcon,
} from '../../components/Icons.jsx';
import {
  enterFullscreen,
  exitFullscreen,
  fullscreenElement,
  isFullscreenSupported,
  onFullscreenChange,
} from '../../lib/fullscreen.js';

import { DOCK_H, TAP, media } from '../../design/media.js';
import { useCallStore } from '../../store/callStore.js';
import { useUIStore } from '../../store/uiStore.js';

/**
 * One participant.
 *
 * Memoised and subscribed narrowly: the tile reads only its own peer record, so
 * a message arriving, a stats sample landing, or another peer reconnecting
 * costs this component nothing. The telemetry badge and the audio meter manage
 * their own subscriptions at a finer grain still — the meter never re-renders,
 * it writes transforms directly.
 *
 * The chrome is a floating glass pill rather than a full-width gradient scrim.
 * A scrim permanently darkens a strip of everybody's face to hold a name that is
 * eleven characters long; a pill sits in the corner and gets out of the way.
 */

function VideoTileImpl({
  id,
  isSelf,
  featured,
  compact,
  isScreenShare,
  placement,
  size,
  onAspect,
  transition,
  immersive,
  onActivate,
}) {
  // Two different shapes of state depending on whether this is us or a peer.
  const peer = useCallStore((state) => (isSelf ? null : state.peers[id]));
  const localStream = useCallStore((state) => (isSelf ? state.localStream : null));
  const micOn = useCallStore((state) => (isSelf ? state.micOn : null));
  const camOn = useCallStore((state) => (isSelf ? state.camOn : null));
  const screenOn = useCallStore((state) => (isSelf ? state.screenOn : null));
  const screenStream = useCallStore((state) => (isSelf ? state.screenStream : null));

  const toggleSpotlight = useUIStore((state) => state.toggleSpotlight);

  /*
   * While sharing, your own tile shows the share rather than your camera —
   * what everyone else is looking at. Only in the featured slot: the thumbnail
   * in the strip is still you, which is what a thumbnail of you should be.
   */
  const stream = isSelf
    ? (screenOn && featured && screenStream ? screenStream : localStream)
    : peer?.stream;
  const displayName = isSelf ? 'You' : (peer?.displayName ?? 'Connecting');
  const audioEnabled = isSelf ? micOn : (peer?.state?.audio ?? true);
  const videoEnabled = isSelf ? camOn : (peer?.state?.video ?? true);
  const sharing = isSelf ? screenOn : (peer?.state?.screen ?? false);

  const link = peer?.link;

  /*
   * Attach the video element as soon as a live track exists, and let the
   * element itself report when frames actually arrive.
   *
   * The tempting shortcut is to gate this on “track.muted”, but that flag is
   * unreliable after a perfect-negotiation rollback — Chrome can leave a
   * receiver track reporting “muted” forever while RTP flows — and gating on it
   * leaves one side of every peer pair staring at a permanent placeholder.
   */
  const hasVideoTrack = isSelf
    ? Boolean(stream?.getVideoTracks().length)
    : Boolean(link?.hasVideoTrack);

  /*
   * Which stream we have actually seen frames from. Storing the stream rather
   * than a boolean means a new stream invalidates the flag for free.
   */
  const [framesFrom, setFramesFrom] = useState(null);
  const hasFrames = framesFrom === stream;

  /*
   * The source's true aspect ratio, reported by the video element once it has
   * decoded a frame. Drives two things: whether a letterbox is actually going
   * to appear (so the blurred fill can be skipped when it would be occluded),
   * and the tile's own shape in single-column layouts, where matching the
   * source exactly means no bars at all.
   */
  const [sourceAspect, setSourceAspect] = useState(null);

  // The stage needs every participant's aspect to lay out justified rows, so
  // a portrait phone can be given a portrait tile.
  const handleAspect = useCallback(
    (aspect) => {
      setSourceAspect(aspect);
      onAspect?.(id, aspect);
    },
    [id, onAspect]
  );
  const tileRef = useRef(null);
  const [tileAspect, setTileAspect] = useState(null);
  const [tileWidth, setTileWidth] = useState(0);

  useEffect(() => {
    const element = tileRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (height > 0) setTileAspect(width / height);
      setTileWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /*
   * Fullscreen, per tile.
   *
   * The gap this closes: someone shares their screen and there is no way to
   * actually read it. A shared document is letterboxed into a phone-sized tile
   * and the only escape was to leave the call.
   */
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const element = fullscreenElement();
      setIsFullscreen(Boolean(element) && element === tileRef.current);
    };
    sync();
    return onFullscreenChange(sync);
  }, []);

  const toggleFullscreen = useCallback(
    (event) => {
      // The tile itself spotlights on click; these must not do both.
      event.stopPropagation();
      if (fullscreenElement()) exitFullscreen();
      else enterFullscreen(tileRef.current);
    },
    []
  );

  const spotlightId = useUIStore((state) => state.spotlightId);
  const isSpotlit = spotlightId === id;

  // Resolved after mount so the button is not offered where nothing can happen.
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  useEffect(() => {
    setFullscreenAvailable(isFullscreenSupported(tileRef.current));
  }, []);

  /*
   * Measured, not guessed. Two 44px targets need a tile with room for them; on
   * a picture-in-picture thumbnail or a filmstrip cell they cover the face they
   * are meant to act on. Keying off the real width means this holds at every
   * layout without each one having to remember to opt out.
   */
  const showActions = !compact && tileWidth >= 220;

  const videoFit = useUIStore((state) => state.videoFit);
  /*
   * An immersive tile is the only thing on screen, so it fills it. Letterboxing
   * a lone remote participant on a phone leaves bars down both sides; the
   * retention floor below still catches the case where filling would gut the
   * frame, and falls back to embedding it against the blurred backdrop.
   */
  const isFit = immersive ? false : videoFit === 'fit';

  /*
   * Fill mode crops to the tile — but only when the crop is modest.
   *
   * `object-fit: cover` keeps `min(source/tile, tile/source)` of the frame. A
   * 4:3 webcam in a 16:9 tile keeps 75%, which is the ordinary, expected crop.
   * A 9:16 phone camera in that same tile keeps 32% — a vertical slice through
   * the middle of someone, which is what was lopping heads off. Past that point
   * the source is embedded whole and the blurred backdrop fills the rest, the
   * way Meet and Zoom seat a phone in a landscape grid.
   *
   * The floor sits below 4:3-in-16:9 and far above any orientation mismatch, so
   * in practice it reads as "crop within an orientation, embed across one"
   * without having to special-case orientation itself.
   */
  const coverRetention =
    sourceAspect != null && tileAspect != null
      ? Math.min(sourceAspect / tileAspect, tileAspect / sourceAspect)
      : 1;
  const cropWouldGut = coverRetention < 0.62;

  /*
   * A shared screen is always fitted: cropping a window loses the edges of
   * whatever someone is trying to show you.
   *
   * An immersive tile always fills. The retention floor exists so a portrait
   * phone is not gutted inside a landscape *grid cell*; filling the whole
   * screen with the one person you are talking to is the entire point of that
   * layout, and letterboxing them leaves bands of blur top and bottom where
   * every other app shows a face.
   */
  const contained = isScreenShare || sharing || (!immersive && (isFit || cropWouldGut));

  /*
   * Only paint the blurred backdrop when a letterbox will genuinely be visible.
   * Blur is an expensive filter and an occluded one is pure waste — with twelve
   * tiles that is twelve full-frame blurs a frame for nothing.
   */
  const letterboxed =
    contained &&
    sourceAspect != null &&
    tileAspect != null &&
    Math.abs(sourceAspect - tileAspect) / tileAspect > 0.04;

  const showVideo = hasVideoTrack && videoEnabled;
  const failed = !isSelf && link?.connectionState === 'failed';
  const recovering = !isSelf && link?.recovering;
  const connecting = !isSelf && !failed && (!showVideo ? !peer?.stream : !hasFrames);

  // The meter is keyed by 'self' locally and by socket id remotely, matching
  // how AudioMeter registers the streams.
  const meterKey = isSelf ? 'self' : id;

  /*
   * Built explicitly rather than spread inline, and never containing an
   * `undefined` value.
   *
   * `--tile-aspect` is consumed by the single-column mobile layout in
   * VideoStage, where a tile is free to take the shape of its source: a
   * portrait camera gets a portrait tile, so there is no letterbox to hide in
   * the first place. Clamped so an unusual source cannot produce an absurdly
   * tall or wide tile.
   *
   * `placement` carries grid placement in focus mode. It must not carry width
   * or height — Motion's `layout` projection owns those and drops them.
   */
  const tileStyle = useMemo(() => {
    const style = { ...placement };

    if (sourceAspect) {
      style['--tile-aspect'] = Math.min(Math.max(sourceAspect, 0.4), 2.6);
    }

    /*
     * Size arrives as custom properties, not as `width`/`height`.
     *
     * Motion's `layout` projection owns the real width and height — it
     * measures and writes them during the animation — so an inline `width`
     * here is silently discarded. Custom properties pass through untouched,
     * and the Tile's own CSS reads them, which Motion then animates the
     * resulting box change for.
     */
    if (size) {
      style['--tile-w'] = `${size.width}px`;
      style['--tile-h'] = `${size.height}px`;
    }

    return style;
  }, [placement, sourceAspect, size]);

  return (
    <Tile
      ref={tileRef}
      layout
      transition={transition}
      style={tileStyle}
      $featured={featured}
      $compact={compact}
      onDoubleClick={() => toggleSpotlight(id)}
      onClick={onActivate}
      // Double-click is a shortcut, not the only route — the buttons below are
      // the discoverable path, and the only usable one on a touch screen.
      title={compact ? displayName : undefined}
      data-peer={id}
      // Lets the stage style the featured pane and the strip differently
      // without relying on DOM order, which follows join order rather than
      // which tile happens to be featured.
      data-tile={featured ? 'featured' : compact ? 'strip' : 'grid'}
    >
      <Surface layout>
        {showVideo && stream ? (
          <>
            {letterboxed && !compact && <BackdropVideo stream={stream} />}
            <Video
              stream={stream}
              muted={isSelf}
              contain={contained}
              onFrames={setFramesFrom}
              onAspect={handleAspect}
            />
          </>
        ) : (
          <Placeholder>
            <Avatar name={isSelf ? 'You' : displayName} size={compact ? 32 : 72} />
            {!compact && (
              <PlaceholderNote>
                {failed
                  ? 'Connection lost'
                  : videoEnabled
                    ? 'No video'
                    : 'Camera off'}
              </PlaceholderNote>
            )}
          </Placeholder>
        )}

        {/* Overlaid, not instead-of: the video keeps its element (and its
            srcObject) underneath while the skeleton covers the wait. */}
        {connecting && (
          <Skeleton>
            <SkeletonFill />
            {!compact && <SkeletonNote>Connecting…</SkeletonNote>}
          </Skeleton>
        )}

        {/* Real audio level — blooms only while this person is speaking. */}
        {!compact && <SpeakingRing peerId={meterKey} muted={!audioEnabled} />}
      </Surface>

      {/*
        * Per-tile actions.
        *
        * These exist because the only way to enlarge anyone used to be a
        * double-click, which is undiscoverable on a mouse and barely works on a
        * touch screen — so on a phone there was no way to read a shared screen
        * at all. Shown on hover where there is a pointer, and always on touch,
        * where there is no hover to reveal them.
        */}
      {showActions && (
        <Actions $immersive={immersive}>
          <TileAction
            onClick={(event) => {
              event.stopPropagation();
              toggleSpotlight(id);
            }}
            title={isSpotlit ? 'Back to the grid' : 'Make this the main view'}
          >
            {isSpotlit ? <CollapseIcon /> : <ExpandIcon />}
            <VisuallyHidden>
              {isSpotlit ? 'Back to the grid' : 'Make this the main view'}
            </VisuallyHidden>
          </TileAction>

          {fullscreenAvailable && (
            <TileAction
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
              <VisuallyHidden>
                {isFullscreen ? 'Exit full screen' : 'Full screen'}
              </VisuallyHidden>
            </TileAction>
          )}
        </Actions>
      )}

      <Chrome $compact={compact} $immersive={immersive}>
        <NamePill $compact={compact}>
          {!audioEnabled ? (
            <MutedMark title='Microphone off'>
              <MicOffIcon />
            </MutedMark>
          ) : (
            <AudioLevel peerId={meterKey} height={compact ? 9 : 11} bars={3} />
          )}
          <Name $compact={compact}>{displayName}</Name>
          {sharing && !compact && (
            <ShareMark title='Sharing screen'>
              <ScreenIcon />
            </ShareMark>
          )}
        </NamePill>

        {!isSelf && !compact && (
          <StatPill>
            <SignalBars peerId={id} />
          </StatPill>
        )}
      </Chrome>

      {recovering && <Recovering>Reconnecting…</Recovering>}
    </Tile>
  );
}

/**
 * The “<video>” element, isolated so it re-renders only when the stream
 * identity actually changes.
 *
 * “srcObject” is assigned imperatively — it is not a serialisable attribute and
 * React will not set it. Assigning only on change keeps the element from
 * restarting playback (a visible black flash) on unrelated renders.
 */
const Video = memo(function Video({ stream, muted, contain, onFrames, onAspect }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !(stream instanceof MediaStream)) return undefined;

    if (element.srcObject !== stream) {
      element.srcObject = stream;

      // Autoplay can still be rejected (Safari, or a tab never interacted
      // with). Retrying muted is the documented escape hatch.
      element.play?.().catch(() => {
        element.muted = true;
        element.play?.().catch(() => {});
      });
    }

    /*
     * “videoWidth > 0” is the browser saying it has decoded a frame and knows
     * the dimensions — the trustworthy "media is really arriving" signal.
     */
    const report = () => {
      if (element.videoWidth <= 0) return;
      onFrames?.(stream);
      onAspect?.(element.videoWidth / element.videoHeight);
    };

    report();
    element.addEventListener('loadedmetadata', report);
    element.addEventListener('resize', report);
    element.addEventListener('playing', report);

    return () => {
      element.removeEventListener('loadedmetadata', report);
      element.removeEventListener('resize', report);
      element.removeEventListener('playing', report);
    };
  }, [stream, onFrames, onAspect]);

  return (
    <Player
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      $contain={contain}
      data-role='participant-video'
    />
  );
});

/**
 * The blurred fill behind a letterboxed video.
 *
 * Google Meet's tiled view leaves plain grey bars; Meet on mobile and Teams
 * both put a blurred, scaled copy of the frame there instead, which reads as
 * depth rather than as dead space. Same MediaStream, second element — browsers
 * share the decoder, so this costs a composited layer rather than a second
 * decode, and it only mounts when a letterbox is actually visible.
 */
const BackdropVideo = memo(function BackdropVideo({ stream }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !(stream instanceof MediaStream)) return;
    if (element.srcObject === stream) return;
    element.srcObject = stream;
    element.play?.().catch(() => {});
  }, [stream]);

  return (
    <Backdrop ref={ref} autoPlay playsInline muted aria-hidden='true' data-role='backdrop' />
  );
});

const Backdrop = styled.video`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Scaled past the edges so the blur has no visible falloff at the border. */
  transform: scale(1.2);
  filter: blur(28px) saturate(1.3) brightness(0.55);
  pointer-events: none;

  :root[data-theme='light'] & {
    filter: blur(28px) saturate(1.3) brightness(0.9);
  }

  @media (prefers-reduced-motion: reduce) {
    /* Still a fill, just not a moving one. */
    filter: blur(28px) saturate(1.3) brightness(0.55) contrast(0.8);
  }
`;

const Tile = styled(motion.div)`
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;

  background: var(--tile-empty);
  border-radius: ${({ $compact }) =>
    $compact ? 'var(--radius-md)' : 'var(--radius-lg)'};
  box-shadow: var(--shadow-2);

  transition: box-shadow 260ms var(--ease);

  ${({ $featured }) =>
    $featured &&
    css`
      box-shadow: var(--shadow-3);
    `}
`;

const Surface = styled(motion.div)`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: inherit;
`;

const Player = styled.video`
  /*
   * Absolutely positioned so the element is exactly the tile, always.
   *
   * Surface centres its children, and a centred grid item does not stretch —
   * so a plain height:100% had no definite height to resolve against and the
   * video fell back to its intrinsic aspect. A 9:16 phone in a 16:9 tile became
   * an element taller than the box it sat in, clipped top and bottom by
   * Surface's overflow, with object-fit powerless because the element already
   * matched the source. Pinning the element to the tile is what gives the
   * contain / cover rule below something to act on.
   */
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: ${({ $contain }) => ($contain ? 'contain' : 'cover')};

  /*
   * When cropping is deliberately chosen, crop toward the top of frame rather
   * than the centre — heads live in the upper third, so an even crop takes the
   * top of someone's head off. In fit mode nothing is cropped and the position
   * is simply centred.
   */
  object-position: ${({ $contain }) => ($contain ? 'center' : 'center 30%')};

  /* Transparent in fit mode so the blurred backdrop shows through the bars. */
  background: ${({ $contain }) => ($contain ? 'transparent' : 'var(--surface-sunken)')};
`;

const Placeholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
`;

const PlaceholderNote = styled.span`
  font-size: 13px;
  color: var(--ink-3);
`;

const Skeleton = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  background: var(--tile-empty);
`;

const SkeletonFill = styled(Shimmer)`
  position: absolute;
  inset: 0;
`;

const SkeletonNote = styled.span`
  position: relative;
  font-size: 13px;
  color: var(--ink-3);
`;

/**
 * Top-right action cluster.
 *
 * Revealed on hover where there is a real pointer, and permanently visible on
 * touch — there is no hover to reveal them with, and hiding a control behind a
 * gesture nobody knows about is the same as not having it.
 */
const Actions = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;

  display: flex;
  gap: 6px;

  opacity: 1;
  transition: opacity 160ms var(--ease);

  ${media.hover} {
    opacity: 0;

    /* Revealed by hovering the tile, and by keyboard focus reaching inside. */
    [data-peer]:hover &,
    &:focus-within {
      opacity: 1;
    }
  }

  /* Immersive tiles run under the floating header; drop clear of it. */
  ${({ $immersive }) =>
    $immersive &&
    css`
      top: calc(env(safe-area-inset-top, 0px) + 60px);
    `}
`;

const TileAction = styled.button`
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;

  color: #fff;
  background: rgb(0 0 0 / 0.42);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  border-radius: var(--radius-pill);
  transition: background-color 160ms var(--ease), transform 160ms var(--ease);

  &:hover {
    background: rgb(0 0 0 / 0.62);
  }

  &:active {
    transform: scale(0.94);
  }

  ${media.touch} {
    width: ${TAP};
    height: ${TAP};
  }

  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const Chrome = styled.div`
  position: absolute;
  inset: auto 0 0 0;
  z-index: 2;

  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
  padding: ${({ $compact }) => ($compact ? '7px' : '11px')};

  /* Immersive tiles run under the floating dock; lift the chrome clear of it. */
  ${({ $immersive }) =>
    $immersive &&
    css`
      padding-bottom: calc(${DOCK_H} + 8px);
    `}

  pointer-events: none;
`;

/**
 * Frosted pill. Deliberately not theme-aware: it floats over video, which is
 * its own unpredictable background, so it stays light-on-dark in both themes.
 */
const pill = css`
  display: inline-flex;
  align-items: center;
  gap: 7px;

  height: ${({ $compact }) => ($compact ? '22px' : '28px')};
  padding: 0 ${({ $compact }) => ($compact ? '8px' : '10px')};

  color: rgb(255 255 255 / 0.95);
  background: rgb(10 10 14 / 0.5);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.09);
  max-width: 100%;
`;

const NamePill = styled.div`
  ${pill}
  min-width: 0;
`;

const StatPill = styled.div`
  ${pill}
  flex-shrink: 0;
  padding: 0 9px;
`;

const Name = styled.span`
  font-size: ${({ $compact }) => ($compact ? '12px' : '13px')};
  font-weight: 500;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Mark = styled.span`
  display: grid;
  place-items: center;
  flex-shrink: 0;

  svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const MutedMark = styled(Mark)`
  svg {
    stroke: #ff8a8a;
  }
`;

const ShareMark = styled(Mark)`
  svg {
    stroke: currentColor;
  }
`;

const Recovering = styled.div`
  position: absolute;
  top: 11px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;

  font-size: 12px;
  font-weight: 500;
  padding: 5px 11px;

  color: var(--ink-inverse);
  background: var(--warn);
  border-radius: var(--radius-pill);
  white-space: nowrap;
`;

/**
 * Shallow compare on primitives — made explicit so the “placement” object's
 * identity churn on every stage render does not defeat memoisation.
 */
/**
 * Compares a style-ish object by value over every key it might carry.
 *
 * `placement` and `size` are rebuilt on every stage render, so comparing them
 * by identity would defeat memoisation entirely — but listing individual keys
 * is worse, because the moment the layout starts expressing itself through a
 * key that is not on the list, every update for it is silently swallowed and
 * tiles keep rendering at whatever size they last happened to get.
 */
function sameStyle(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export default memo(VideoTileImpl, (previous, next) => {
  return (
    previous.id === next.id &&
    previous.isSelf === next.isSelf &&
    previous.featured === next.featured &&
    previous.compact === next.compact &&
    previous.isScreenShare === next.isScreenShare &&
    previous.onAspect === next.onAspect &&
    sameStyle(previous.placement, next.placement) &&
    sameStyle(previous.size, next.size)
  );
});
