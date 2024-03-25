import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'motion/react';

import MagneticButton from '../../components/MagneticButton.jsx';
import { VisuallyHidden } from '../../components/Primitives.jsx';
import {
  CameraIcon,
  CameraOffIcon,
  ChatIcon,
  FlipCameraIcon,
  FillIcon,
  FitIcon,
  GaugeIcon,
  GridIcon,
  LayoutIcon,
  LeaveIcon,
  MicIcon,
  MicOffIcon,
  MoreIcon,
  RosterIcon,
  ScreenIcon,
  ScreenOffIcon,
  SoundOffIcon,
  SoundOnIcon,
} from '../../components/Icons.jsx';

import { media, TAP } from '../../design/media.js';
import { callEngine } from '../../lib/CallEngine.js';
import { useCallStore } from '../../store/callStore.js';
import { useChatStore } from '../../store/chatStore.js';
import { useUIStore } from '../../store/uiStore.js';
import { SUPPORTS_SCREEN_SHARE } from '../../lib/env.js';
import Diagnostics from './Diagnostics.jsx';

/**
 * The control dock.
 *
 * A floating frosted pill centred under the stage, rather than a full-width
 * bordered bar. Two reasons: the controls are a single object you aim at, so
 * they should look like one; and a bar spanning the viewport spends most of its
 * width on nothing while stealing height from the video.
 *
 * Magnetic hover on every control (see MagneticButton) — these are the things
 * you reach for mid-sentence, and a small pull toward the cursor makes them
 * feel like keys with detents.
 *
 * State is read from the store rather than passed down, so toggling your own
 * microphone re-renders a few buttons and nothing else in the call.
 */
export default function ControlBar({ onLeave }) {
  const micOn = useCallStore((state) => state.micOn);
  const camOn = useCallStore((state) => state.camOn);
  const screenOn = useCallStore((state) => state.screenOn);
  const mediaStatus = useCallStore((state) => state.mediaStatus);
  const cameraCount = useCallStore((state) => state.cameras.length);

  const layout = useUIStore((state) => state.layout);
  const soundEnabled = useUIStore((state) => state.soundEnabled);
  const isPanelOpen = useUIStore((state) => state.isPanelOpen);
  const sidePanel = useUIStore((state) => state.sidePanel);
  const diagnosticsOpen = useUIStore((state) => state.diagnosticsOpen);
  const videoFit = useUIStore((state) => state.videoFit);

  const cycleLayout = useUIStore((state) => state.cycleLayout);
  const toggleSound = useUIStore((state) => state.toggleSound);
  const toggleVideoFit = useUIStore((state) => state.toggleVideoFit);
  const togglePanel = useUIStore((state) => state.togglePanel);
  const openPanel = useUIStore((state) => state.openPanel);
  const toggleDiagnostics = useUIStore((state) => state.toggleDiagnostics);
  const pushToast = useUIStore((state) => state.pushToast);

  const unread = useChatStore((state) =>
    Object.values(state.unread).reduce((sum, count) => sum + count, 0)
  );

  const hasMedia = mediaStatus === 'ready';
  // 'auto' behaves as grid until a spotlight or screen share overrides it.
  const showingGrid = layout !== 'spotlight';

  /*
   * Publishes the dock's real height as --control-bar-h.
   *
   * The mobile chat sheet anchors itself above the controls, and the dock wraps
   * to two rows on narrow screens. A hardcoded height is wrong at some
   * breakpoint by construction, and being wrong here means the sheet covers the
   * mute button. Measuring is a ResizeObserver and four lines.
   */
  const dockRef = useRef(null);

  useEffect(() => {
    const element = dockRef.current;
    if (!element) return undefined;

    const publish = () => {
      document.documentElement.style.setProperty(
        '--control-bar-h',
        `${Math.ceil(element.getBoundingClientRect().height)}px`
      );
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--control-bar-h');
    };
  }, []);

  const handleScreenShare = useCallback(() => {
    if (screenOn) callEngine.stopScreenShare();
    else callEngine.startScreenShare();
  }, [screenOn]);

  const handleFit = useCallback(() => {
    const next = toggleVideoFit();
    pushToast({
      tone: 'ink-3',
      text:
        next === 'fit'
          ? 'Showing the whole frame'
          : 'Filling the tile — edges are cropped',
    });
  }, [toggleVideoFit, pushToast]);

  const handleSound = useCallback(() => {
    const enabled = toggleSound();
    pushToast({
      tone: enabled ? 'ok' : 'ink-3',
      text: enabled ? 'Sounds on' : 'Sounds off',
    });
  }, [toggleSound, pushToast]);

  const handlePanel = useCallback(
    (panel) => {
      if (isPanelOpen && sidePanel === panel) togglePanel();
      else openPanel(panel);
    },
    [isPanelOpen, sidePanel, openPanel, togglePanel]
  );

  const [moreOpen, setMoreOpen] = useState(false);

  /*
   * Declared once and rendered twice — inline in the dock on wide screens, and
   * as labelled rows in the sheet on phones. Describing them as data rather
   * than duplicating the markup is what keeps the two in step.
   */
  const handleSwitchCamera = useCallback(async () => {
    const label = await callEngine.switchCamera();
    if (label) pushToast({ tone: 'ink-3', text: `Switched to ${label}` });
  }, [pushToast]);

  const secondary = useMemo(
    () => [
      /*
       * Shown only when there is genuinely something to switch to. Keyed off
       * the device count rather than "is this a phone" — laptops often have
       * two, and a phone with one usable camera should not offer a no-op.
       */
      ...(cameraCount > 1 && hasMedia
        ? [
            {
              key: 'flip',
              label: 'Switch camera',
              title: 'Switch camera',
              active: false,
              icon: <FlipCameraIcon />,
              onClick: handleSwitchCamera,
            },
          ]
        : []),
      /*
       * Shown even where it cannot work, but disabled and labelled with why.
       *
       * Screen sharing is not available from a phone browser: Chrome for
       * Android has hidden `getDisplayMedia` since Canary 88, and iOS Safari
       * has never implemented it. Silently dropping the control made that look
       * like a missing feature of this app rather than of the platform, and
       * left anyone hunting for it with nothing to find.
       */
      {
        key: 'screen',
        label: SUPPORTS_SCREEN_SHARE
          ? screenOn
            ? 'Stop sharing'
            : 'Share screen'
          : 'Share screen',
        note: SUPPORTS_SCREEN_SHARE ? null : 'Not supported on this browser',
        title: SUPPORTS_SCREEN_SHARE
          ? screenOn
            ? 'Stop sharing'
            : 'Share your screen'
          : 'Screen sharing is not available in mobile browsers',
        disabled: !SUPPORTS_SCREEN_SHARE,
        active: screenOn,
        icon: screenOn ? <ScreenOffIcon /> : <ScreenIcon />,
        onClick: handleScreenShare,
      },
      {
        /*
         * Labelled by what it switches *to*, and named for what it changes.
         * "Spotlight" next to "Fill tiles" read as two versions of the same
         * setting; "Spotlight view" and "Crop to fill" do not.
         */
        key: 'layout',
        label: showingGrid ? 'Spotlight view' : 'Grid view',
        title: showingGrid ? 'Switch to spotlight' : 'Switch to grid',
        active: false,
        icon: showingGrid ? <LayoutIcon /> : <GridIcon />,
        onClick: cycleLayout,
      },
      {
        key: 'fit',
        label: videoFit === 'fit' ? 'Crop to fill' : 'Show whole frame',
        title:
          videoFit === 'fit'
            ? 'Fill the tile (crops edges)'
            : 'Show the whole frame',
        active: videoFit === 'fill',
        icon: videoFit === 'fit' ? <FitIcon /> : <FillIcon />,
        onClick: handleFit,
      },
      {
        key: 'sound',
        label: soundEnabled ? 'Sounds on' : 'Sounds off',
        title: soundEnabled ? 'Mute sounds' : 'Enable sounds',
        active: soundEnabled,
        icon: soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />,
        onClick: handleSound,
      },
      {
        key: 'roster',
        label: 'Participants',
        title: 'Participants',
        active: isPanelOpen && sidePanel === 'roster',
        icon: <RosterIcon />,
        onClick: () => handlePanel('roster'),
      },
      {
        key: 'diagnostics',
        label: 'Connection stats',
        title: 'Connection diagnostics',
        active: diagnosticsOpen,
        icon: <GaugeIcon />,
        onClick: toggleDiagnostics,
      },
    ],
    [
      cameraCount,
      hasMedia,
      handleSwitchCamera,
      screenOn,
      showingGrid,
      videoFit,
      soundEnabled,
      diagnosticsOpen,
      isPanelOpen,
      sidePanel,
      handleScreenShare,
      cycleLayout,
      handleFit,
      handleSound,
      handlePanel,
      toggleDiagnostics,
    ]
  );

  return (
    <>
      <Diagnostics open={diagnosticsOpen} />

      <DockRow>
        <Dock ref={dockRef}>
          <Group>
            <MagneticButton
              onClick={() => callEngine.toggleMic()}
              disabled={!hasMedia}
              $danger={hasMedia && !micOn}
              aria-pressed={micOn}
              title={micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {micOn && hasMedia ? <MicIcon /> : <MicOffIcon />}
              <VisuallyHidden>
                {micOn ? 'Mute microphone' : 'Unmute microphone'}
              </VisuallyHidden>
            </MagneticButton>

            <MagneticButton
              onClick={() => callEngine.toggleCamera()}
              disabled={!hasMedia}
              $danger={hasMedia && !camOn}
              aria-pressed={camOn}
              title={camOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {camOn && hasMedia ? <CameraIcon /> : <CameraOffIcon />}
              <VisuallyHidden>
                {camOn ? 'Turn camera off' : 'Turn camera on'}
              </VisuallyHidden>
            </MagneticButton>

          </Group>

          <Divider />

          {/* Roomy screens show these inline; phones fold them into a sheet. */}
          <SecondaryGroup>
            {secondary.map((item) => (
              <MagneticButton
                key={item.key}
                onClick={item.onClick}
                disabled={item.disabled}
                $active={item.active}
                aria-pressed={item.active}
                title={item.title}
              >
                {item.icon}
                <VisuallyHidden>{item.title}</VisuallyHidden>
              </MagneticButton>
            ))}
          </SecondaryGroup>

          <CompactGroup>
            <MagneticButton
              onClick={() => handlePanel('chat')}
              $active={isPanelOpen && sidePanel === 'chat'}
              title='Chat'
            >
              <ChatIcon />
              {unread > 0 && <Unread>{unread > 9 ? '9+' : unread}</Unread>}
              <VisuallyHidden>Chat</VisuallyHidden>
            </MagneticButton>

            <MagneticButton
              onClick={() => setMoreOpen(true)}
              $active={moreOpen}
              title='More options'
            >
              <MoreIcon />
              <VisuallyHidden>More options</VisuallyHidden>
            </MagneticButton>
          </CompactGroup>

          <Divider />

          <Leave onClick={onLeave} title='Leave the call'>
            <LeaveIcon />
            <LeaveLabel>Leave</LeaveLabel>
          </Leave>
        </Dock>
      </DockRow>

      <MoreSheet
        open={moreOpen}
        items={secondary}
        onClose={() => setMoreOpen(false)}
      />
    </>
  );
}

/**
 * The secondary controls, as a bottom sheet.
 *
 * A phone dock can hold about five targets at a comfortable size. Everything
 * beyond that used to wrap onto a second row of 36px icons — which is both
 * hard to hit and hard to scan. Folding the rest into a sheet keeps one row of
 * large targets and gives the overflow room to carry actual labels.
 */
function MoreSheet({ open, items, onClose }) {
  // Escape closes it, as a dialog should. The scrim is the touch affordance;
  // this is the one for anyone on a keyboard.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <SheetScrim
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <Sheet
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            role='dialog'
            aria-label='More options'
          >
            <Grabber />
            <SheetGrid>
              {items.map((item) => (
                <SheetItem
                  key={item.key}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onClick();
                    onClose();
                  }}
                  disabled={item.disabled}
                  title={item.title}
                  $active={item.active}
                >
                  <SheetIcon>{item.icon}</SheetIcon>
                  <SheetLabel>{item.label}</SheetLabel>
                  {item.note && <SheetNote>{item.note}</SheetNote>}
                </SheetItem>
              ))}
            </SheetGrid>
          </Sheet>
        </>
      )}
    </AnimatePresence>
  );
}

const DockRow = styled.div`
  display: flex;
  justify-content: center;
  flex-shrink: 0;

  /*
   * Pinned to the viewport on a phone, not to the bottom of the stage.
   *
   * The stage shrinks when the sheet is up, and a dock that flows after it
   * rides up with it and disappears behind the sheet — taking mute and camera
   * with it. Fixing it to the bottom edge is what keeps the controls reachable
   * in every state. It clears the home indicator, and the video runs behind it.
   */
  position: fixed;
  inset: auto 0 0 0;
  z-index: 65;
  padding: 0 10px calc(env(safe-area-inset-bottom, 0px) + 10px);

  ${media.lg} {
    position: relative;
    inset: auto;
    z-index: auto;
    padding: 0;
  }
`;

const Dock = styled.div`
  display: flex;
  align-items: center;
  /* Evenly spread across the thumb arc rather than clustered at the edges. */
  justify-content: space-evenly;
  gap: 6px;
  width: 100%;

  padding: 7px;

  background: var(--glass-strong);
  backdrop-filter: blur(24px) saturate(1.5);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-dock), inset 0 1px 0 var(--edge-light);

  ${media.lg} {
    width: auto;
    justify-content: center;
    gap: 4px;
    padding: 6px;
  }
`;

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;

  ${media.lg} {
    gap: 2px;
  }
`;

/** Inline secondary controls. Below lg they live in the sheet instead. */
const SecondaryGroup = styled(Group)`
  display: none;

  ${media.lg} {
    display: flex;
  }
`;

/** Chat + overflow. Above lg these are inline in the secondary group. */
const CompactGroup = styled(Group)`
  ${media.lg} {
    display: none;
  }
`;

const Divider = styled.span`
  width: 1px;
  height: 22px;
  margin: 0 5px;
  background: var(--hairline-strong);
  flex-shrink: 0;
  display: none;

  ${media.lg} {
    display: block;
  }
`;

// ------------------------------------------------------------------ sheet ---

const SheetScrim = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 70;
  background: color-mix(in srgb, var(--canvas) 55%, transparent);
  backdrop-filter: blur(2px);

  ${media.lg} {
    display: none;
  }
`;

const Sheet = styled(motion.div)`
  position: fixed;
  inset: auto 0 0 0;
  z-index: 71;

  padding: 8px 12px calc(env(safe-area-inset-bottom, 0px) + 16px);

  background: var(--surface-1);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3), inset 0 1px 0 var(--edge-light);

  ${media.lg} {
    display: none;
  }
`;

/** The grab affordance. Decorative — the scrim is what closes the sheet. */
const Grabber = styled.div`
  width: 36px;
  height: 4px;
  margin: 0 auto 12px;
  border-radius: var(--radius-pill);
  background: var(--hairline-strong);
`;

const SheetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 6px;
`;

const SheetItem = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;

  /* Comfortably past the 44px minimum: these are one-handed, in a call. */
  min-height: 76px;
  padding: 12px 6px;

  border-radius: var(--radius-md);
  color: ${({ $active }) => ($active ? 'var(--accent)' : 'var(--ink-2)')};
  background: ${({ $active }) => ($active ? 'var(--accent-soft)' : 'var(--surface-2)')};
  transition: background-color 160ms var(--ease), color 160ms var(--ease);

  &:active {
    transform: scale(0.97);
  }

  &:disabled {
    /* Legible, not invisible — the label explains why it cannot be used. */
    opacity: 0.55;
    cursor: default;
  }

  &:disabled:active {
    transform: none;
  }
`;

const SheetIcon = styled.span`
  display: grid;
  place-items: center;

  svg {
    width: 21px;
    height: 21px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const SheetNote = styled.span`
  font-size: 10.5px;
  line-height: 1.2;
  text-align: center;
  color: var(--ink-3);
  text-wrap: balance;
`;

const SheetLabel = styled.span`
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.008em;
  text-align: center;
  color: var(--ink-2);
  line-height: 1.25;
`;

const Leave = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;

  height: 44px;
  padding: 0 18px;
  margin-left: 2px;

  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.012em;

  color: #fff;
  background: var(--bad);
  border-radius: var(--radius-pill);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18);

  transition: filter 180ms var(--ease), transform 180ms var(--ease);

  &:hover {
    filter: brightness(1.08);
  }

  &:active {
    transform: scale(0.97);
  }

  svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  ${media.touch} {
    height: ${TAP};
    padding: 0 16px;
  }
`;

const LeaveLabel = styled.span`
  display: none;

  ${media.sm} {
    display: inline;
  }
`;

const Unread = styled.span`
  position: absolute;
  top: 3px;
  right: 3px;

  min-width: 16px;
  height: 16px;
  padding: 0 4px;

  display: grid;
  place-items: center;

  font-size: 10px;
  font-weight: 600;
  line-height: 1;

  color: var(--accent-ink);
  background: var(--accent);
  border-radius: var(--radius-pill);
  box-shadow: 0 0 0 2px var(--glass-strong);
`;
