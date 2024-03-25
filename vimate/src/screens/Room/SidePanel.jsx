import styled from 'styled-components';
import { motion } from 'motion/react';

import ChatPanel from './ChatPanel.jsx';
import Roster from './Roster.jsx';
import { CloseIcon } from '../../components/Icons.jsx';
import { media, DOCK_H, SHEET_H, TAP } from '../../design/media.js';
import { useUIStore } from '../../store/uiStore.js';
import { useChatStore } from '../../store/chatStore.js';

/**
 * Chat and roster: docked beside the stage on wide screens, a sheet below
 * 1080px — where taking 340px from the video would leave the tiles too small
 * to be worth having.
 *
 * The sheet is deliberately **non-modal**. It used to sit under a scrim that
 * darkened and blurred everything above it — which is the whole call — so
 * opening chat meant you could no longer see who was talking, and the tile
 * controls behind it stopped responding. A sheet that only takes the bottom
 * 58% exists precisely so the call stays watchable; a scrim over the other 42%
 * defeats the point of it. It closes from its own control or from the dock.
 */
export default function SidePanel() {
  const isPanelOpen = useUIStore((state) => state.isPanelOpen);
  const sidePanel = useUIStore((state) => state.sidePanel);
  const openPanel = useUIStore((state) => state.openPanel);
  const togglePanel = useUIStore((state) => state.togglePanel);

  const unread = useChatStore((state) => state.unread);
  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);

  return (
    <>
      <Dock $open={isPanelOpen} aria-hidden={!isPanelOpen}>
        <Shell>
          <Grabber />
          <Head>
            <Tabs role='tablist'>
              {[
                ['chat', 'Chat'],
                ['roster', 'Roster'],
              ].map(([value, labelText]) => (
                <Tab
                  key={value}
                  role='tab'
                  aria-selected={sidePanel === value}
                  $active={sidePanel === value}
                  onClick={() => openPanel(value)}
                >
                  {sidePanel === value && (
                    <TabBg
                      layoutId='panel-tab'
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <TabLabel>
                    {labelText}
                    {value === 'chat' && totalUnread > 0 && sidePanel !== 'chat' && (
                      <Badge>{totalUnread > 9 ? '9+' : totalUnread}</Badge>
                    )}
                  </TabLabel>
                </Tab>
              ))}
            </Tabs>

            <Close onClick={togglePanel} title='Close panel'>
              <CloseIcon />
            </Close>
          </Head>

          <Content>{sidePanel === 'chat' ? <ChatPanel /> : <Roster />}</Content>
        </Shell>
      </Dock>
    </>
  );
}

const Dock = styled.div`
  /*
   * Phone: a bottom sheet anchored *above* the control dock, not over it.
   *
   * Covering the dock would put mute and camera behind a chat panel, which is
   * the wrong trade in a live call — you mute far more urgently than you read.
   * The height is capped so the stage above stays usable rather than a sliver.
   */
  position: fixed;
  inset: auto 0 ${DOCK_H} 0;
  z-index: 60;
  height: ${SHEET_H};
  min-height: 0;
  overflow: hidden;
  padding: 0 10px;

  transform: translateY(
    ${({ $open }) =>
      $open ? '0' : 'calc(100% + var(--control-bar-h, 56px) + var(--space-6))'}
  );
  transition: transform 380ms var(--ease);
  pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};

  ${media.lg} {
    position: relative;
    inset: auto;
    height: auto;
    z-index: auto;
    padding: 0;
    transform: none;
    opacity: ${({ $open }) => ($open ? 1 : 0)};
    transition: opacity 240ms var(--ease);
  }

  ${media.motion} {
    transition: none;
  }
`;

/** Sheet grab affordance. Phone only — on desktop the panel is docked. */
const Grabber = styled.div`
  width: 36px;
  height: 4px;
  margin: 8px auto 2px;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  background: var(--hairline-strong);

  ${media.lg} {
    display: none;
  }
`;

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;

  background: var(--surface-1);
  /* Square-bottomed on a phone: the sheet rises from the bottom edge. */
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3), inset 0 1px 0 var(--edge-light);

  ${media.lg} {
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2), inset 0 1px 0 var(--edge-light);
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 10px 10px 10px 12px;
  flex-shrink: 0;
`;

/** Segmented pill, matching the lobby's mode switch. */
const Tabs = styled.div`
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--surface-sunken);
  border-radius: var(--radius-pill);
`;

const Tab = styled.button`
  position: relative;
  height: 38px;
  padding: 0 18px;

  ${media.touch} {
    height: ${TAP};
    padding: 0 22px;
  }
  border-radius: var(--radius-pill);

  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: ${({ $active }) => ($active ? 'var(--ink)' : 'var(--ink-3)')};
  transition: color 180ms var(--ease);

  &:hover {
    color: var(--ink);
  }
`;

const TabBg = styled(motion.span)`
  position: absolute;
  inset: 0;
  background: var(--surface-1);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-1);
`;

const TabLabel = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const Badge = styled.span`
  display: inline-grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;

  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  color: var(--accent-ink);
  background: var(--accent);
  border-radius: var(--radius-pill);
`;

const Close = styled.button`
  display: grid;
  place-items: center;
  width: ${TAP};
  height: ${TAP};
  flex-shrink: 0;

  color: var(--ink-3);
  border-radius: var(--radius-pill);
  transition: color 180ms var(--ease), background-color 180ms var(--ease);

  &:hover {
    color: var(--ink);
    background: var(--surface-3);
  }

  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
`;


const Content = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;
