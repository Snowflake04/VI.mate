import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import Backdrop from '../../components/Backdrop.jsx';
import Brand from '../../components/Brand.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';

import VideoStage from './VideoStage.jsx';
import ControlBar from './ControlBar.jsx';
import SidePanel from './SidePanel.jsx';
import JoinRequests from './JoinRequests.jsx';
import MediaGate from './MediaGate.jsx';
import RejoinCard from './RejoinCard.jsx';
import RoomCode from './RoomCode.jsx';

import { media } from '../../design/media.js';
import { callEngine } from '../../lib/CallEngine.js';
import { useCallStore } from '../../store/callStore.js';
import { useUIStore } from '../../store/uiStore.js';

/**
 * The call surface, written mobile-first.
 *
 * On a phone the video is full-bleed, the header is a compact translucent strip
 * over it, and the side panel is a bottom sheet. From `lg` up the header becomes
 * a real header, the stage is inset, and the panel docks beside it.
 *
 * Everything below the shell subscribes to the stores directly rather than
 * receiving props, so a peer joining does not re-render the chat and a chat
 * message does not re-render the grid.
 */
export default function Room() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const phase = useCallStore((state) => state.phase);
  const room = useCallStore((state) => state.room);
  const socketStatus = useCallStore((state) => state.socketStatus);
  const mediaStatus = useCallStore((state) => state.mediaStatus);
  const isPanelOpen = useUIStore((state) => state.isPanelOpen);

  const [mediaDismissed, setMediaDismissed] = useState(false);
  const mediaRequested = useRef(false);

  useEffect(() => {
    callEngine.start();
  }, []);

  /**
   * Fallback only. Media is normally acquired by the engine before the room is
   * entered (see CallEngine.#ensureMedia), so this covers the one path that
   * bypasses it: a session restored straight onto this route.
   */
  useEffect(() => {
    if (phase !== 'in-room' || mediaRequested.current) return;
    if (mediaStatus !== 'idle') return;
    mediaRequested.current = true;
    callEngine.acquireMedia();
  }, [phase, mediaStatus]);

  /**
   * Leaving via the back button or a tab close has to tell the room, otherwise
   * everyone else watches a frozen tile until the socket times out.
   */
  useEffect(() => {
    const handleUnload = () => callEngine.leaveRoom();
    window.addEventListener('pagehide', handleUnload);
    return () => window.removeEventListener('pagehide', handleUnload);
  }, []);

  const handleLeave = async () => {
    await callEngine.leaveRoom();
    navigate('/', { replace: true });
  };

  // Direct link or a page refresh: the socket has no memory of this room, so
  // offer a way back in rather than bouncing to the lobby and losing the code.
  if (phase !== 'in-room') {
    return <RejoinCard roomCode={roomCode} />;
  }

  const showMediaGate =
    !mediaDismissed &&
    (mediaStatus === 'denied' ||
      mediaStatus === 'unavailable' ||
      mediaStatus === 'insecure');

  return (
    <Screen>
      <Backdrop variant='room' />

      <Header>
        <Left>
          <Brand showStatus status={socketStatus} />
          <Divider />
          <RoomInfo>
            <RoomName title={room?.name}>{room?.name}</RoomName>
            <RoomCode code={room?.code} />
          </RoomInfo>
        </Left>

        <Right>
          <Occupancy />
          <ThemeToggle />
        </Right>
      </Header>

      <Body $panelOpen={isPanelOpen}>
        <StageColumn>
          <VideoStage />
          <ControlBar onLeave={handleLeave} />
        </StageColumn>

        <SidePanel />
      </Body>

      <JoinRequests />

      {showMediaGate && (
        <MediaGate
          onDismiss={() => setMediaDismissed(true)}
          onRetry={async () => {
            const stream = await callEngine.acquireMedia();
            if (stream) setMediaDismissed(true);
          }}
        />
      )}
    </Screen>
  );
}

/** Participant count, including you. */
function Occupancy() {
  const count = useCallStore((state) => state.peerOrder.length) + 1;
  return (
    <Counter title={`${count} in this call`}>
      {count} {count === 1 ? 'person' : 'people'}
    </Counter>
  );
}

const Screen = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  /*
   * dvh rather than vh: on mobile browsers the URL bar collapses as you scroll
   * and 100vh stays at the *expanded* height, so the control dock sits
   * permanently below the fold — the single most common mobile layout bug.
   */
  height: 100dvh;
  overflow: hidden;
  background: var(--canvas);
`;

/*
 * On a phone this floats over the video rather than taking a band of its own —
 * vertical space is the scarcest thing on the screen, and a room code does not
 * deserve a row to itself when there are faces to show.
 */
const Header = styled.header`
  position: absolute;
  inset: 0 0 auto;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);

  padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--canvas) 82%, transparent),
    transparent
  );
  pointer-events: none;

  /* Only the controls inside are interactive; the gradient must not eat taps. */
  & > * {
    pointer-events: auto;
  }

  ${media.lg} {
    position: relative;
    inset: auto;
    padding: 12px clamp(var(--space-3), 2vw, var(--space-5));
    background: none;
    flex-shrink: 0;
    gap: var(--space-3);
  }
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
`;

const Divider = styled.span`
  width: 1px;
  height: 18px;
  background: var(--hairline-strong);
  display: none;

  ${media.sm} {
    display: block;
  }
`;

const RoomInfo = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
`;

/* The name goes on small screens; the code has to stay, because it is the
   only way to invite anyone. */
const RoomName = styled.span`
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.012em;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 26ch;

  /* No room for this next to the code on a phone. */
  display: none;

  ${media.sm} {
    display: block;
  }
`;

const Counter = styled.span`
  font-size: 13px;
  color: var(--ink-3);
  white-space: nowrap;
  display: none;

  ${media.sm} {
    display: inline;
  }
`;

const Body = styled.div`
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;

  display: grid;
  /* Phone: one column, video edge to edge. No page padding to compete with. */
  grid-template-columns: minmax(0, 1fr);
  padding: 0;

  ${media.lg} {
    grid-template-columns: ${({ $panelOpen }) =>
      $panelOpen ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr) 0'};
    gap: ${({ $panelOpen }) => ($panelOpen ? 'var(--space-3)' : '0')};
    padding: 0 clamp(var(--space-3), 2vw, var(--space-5)) var(--space-4);
    transition: grid-template-columns 380ms var(--ease);
  }

  ${media.motion} {
    transition: none;
  }
`;

const StageColumn = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: 0;

  ${media.lg} {
    gap: var(--space-3);
  }
`;
