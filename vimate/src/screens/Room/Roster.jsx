import { memo } from 'react';
import styled from 'styled-components';

import Avatar from '../../components/Avatar.jsx';
import SignalBars from '../../components/SignalBars.jsx';
import { AudioLevel } from '../../components/AudioLevel.jsx';
import { Chip } from '../../components/Primitives.jsx';
import {
  ChatIcon,
  MicOffIcon,
  ScreenIcon,
} from '../../components/Icons.jsx';

import { useCallStore } from '../../store/callStore.js';
import { useChatStore } from '../../store/chatStore.js';
import { useUIStore } from '../../store/uiStore.js';

/**
 * Who is here, and how well each of them is connected.
 *
 * This is also where private chat starts: every remote participant has a
 * whisper button that opens a 1:1 thread. Putting it on the person rather than
 * behind a menu is what makes DMs discoverable at all.
 */
export default function Roster() {
  const peerOrder = useCallStore((state) => state.peerOrder);
  const room = useCallStore((state) => state.room);

  return (
    <Scroll>
      <SelfRow />

      {peerOrder.length === 0 ? (
        <Alone>
          <AloneTitle>Nobody else yet</AloneTitle>
          <AloneHint>
            Share the code <Mono>{room?.code}</Mono> to get someone in here.
          </AloneHint>
        </Alone>
      ) : (
        peerOrder.map((id) => <PeerRow key={id} id={id} />)
      )}
    </Scroll>
  );
}

function SelfRow() {
  const micOn = useCallStore((state) => state.micOn);
  const screenOn = useCallStore((state) => state.screenOn);
  const isAdmin = useCallStore((state) => state.room?.isAdmin);


  return (
    <Row>
      <Avatar name='You' size={34} />
      <Details>
        <NameLine>
          <Name>You</Name>
          {isAdmin && <Chip $tone='accent'>Host</Chip>}
        </NameLine>
        <Sub>
          {!micOn && (
            <Muted title='Muted'>
              <MicOffIcon />
            </Muted>
          )}
          {screenOn && (
            <Sharing title='Sharing screen'>
              <ScreenIcon />
            </Sharing>
          )}
          <SubText>{micOn ? 'Mic on' : 'Muted'}</SubText>
        </Sub>
      </Details>
      <Trailing>
        <AudioLevel peerId='self' muted={!micOn} height={14} bars={4} />

      </Trailing>
    </Row>
  );
}

const PeerRow = memo(function PeerRow({ id }) {
  const peer = useCallStore((state) => state.peers[id]);
  const adminId = useCallStore((state) => state.room?.adminId);

  const setActiveThread = useChatStore((state) => state.setActiveThread);
  const unread = useChatStore((state) => state.unread[id] ?? 0);
  const openPanel = useUIStore((state) => state.openPanel);
  const toggleSpotlight = useUIStore((state) => state.toggleSpotlight);
  const spotlightId = useUIStore((state) => state.spotlightId);

  if (!peer) return null;

  const muted = !peer.state?.audio;
  const connecting =
    peer.link?.connectionState !== 'connected' && !peer.link?.hasVideoTrack;

  return (
    <Row
      $interactive
      $active={spotlightId === id}
      onClick={() => toggleSpotlight(id)}
      title='Spotlight this participant'
    >
      <Avatar name={peer.displayName} size={34} />

      <Details>
        <NameLine>
          <Name>{peer.displayName}</Name>
          {adminId === id && <Chip $tone='accent'>Host</Chip>}
        </NameLine>
        <Sub>
          {muted && (
            <Muted title='Muted'>
              <MicOffIcon />
            </Muted>
          )}
          {peer.state?.screen && (
            <Sharing title='Sharing screen'>
              <ScreenIcon />
            </Sharing>
          )}
          <SubText>{connecting ? 'Connecting…' : muted ? 'Muted' : 'Mic on'}</SubText>
        </Sub>
      </Details>

      <Trailing>
        <AudioLevel peerId={id} muted={muted} height={14} bars={4} />
        <SignalBars peerId={id} />

        <Whisper
          onClick={(event) => {
            // The row itself spotlights; the button must not do both.
            event.stopPropagation();
            setActiveThread(id);
            openPanel('chat');
          }}
          title={`Message ${peer.displayName} privately`}
        >
          <ChatIcon />
          {unread > 0 && <Dot />}
        </Whisper>
      </Trailing>
    </Row>
  );
});

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 2px var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 10px;
  min-width: 0;

  border-radius: var(--radius-sm);
  cursor: ${({ $interactive }) => ($interactive ? 'pointer' : 'default')};
  background: ${({ $active }) => ($active ? 'var(--accent-soft)' : 'transparent')};
  transition: background-color 180ms var(--ease);

  &:hover {
    background: ${({ $interactive, $active }) =>
      $active ? 'var(--accent-soft)' : $interactive ? 'var(--surface-3)' : 'transparent'};
  }
`;

const Details = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const NameLine = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
`;

const Name = styled.span`
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.012em;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Sub = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SubText = styled.span`
  font-size: 12.5px;
  color: var(--ink-3);
`;

const IconMark = styled.span`
  display: grid;
  place-items: center;

  svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const Muted = styled(IconMark)`
  svg {
    stroke: var(--bad);
  }
`;

const Sharing = styled(IconMark)`
  svg {
    stroke: var(--accent);
  }
`;

const Trailing = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  color: var(--ink-2);
`;

/** A small action on a roster row. */

const Whisper = styled.button`
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;

  color: var(--ink-3);
  border-radius: var(--radius-pill);
  transition: color 180ms var(--ease), background-color 180ms var(--ease);

  &:hover {
    color: var(--accent);
    background: var(--accent-soft);
  }

  svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linejoin: round;
  }
`;

const Dot = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
`;

const Alone = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  text-align: center;
  padding: var(--space-6) var(--space-4);
  margin: auto 0;
`;

const AloneTitle = styled.p`
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
`;

const AloneHint = styled.p`
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ink-3);
`;

const Mono = styled.span`
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.03em;
  color: var(--ink-2);
`;
