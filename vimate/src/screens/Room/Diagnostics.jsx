import { useEffect } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'motion/react';

import { CloseIcon, RelayIcon } from '../../components/Icons.jsx';
import { VisuallyHidden } from '../../components/Primitives.jsx';
import { DOCK_H, media, TAP } from '../../design/media.js';
import { useUIStore } from '../../store/uiStore.js';
import { formatBitrate, formatMs, formatPercent } from '../../lib/rtc/stats.js';
import { TIERS } from '../../lib/rtc/constraints.js';
import { useCallStore } from '../../store/callStore.js';
import { useStatsStore } from '../../store/statsStore.js';

/**
 * The connection panel. Every number comes from `getStats()` on the live peer
 * connection, sampled once a second.
 *
 * Most conferencing apps hide this behind a support ticket. Showing it answers
 * the two questions that actually matter when a call is bad — *whose*
 * connection is the problem, and is media going peer-to-peer or being relayed
 * through TURN — without anyone having to open devtools.
 *
 * It is off by default and reads as a settings sheet rather than an instrument
 * cluster: this is reference material, not the main event.
 */
export default function Diagnostics({ open }) {
  const peerOrder = useCallStore((state) => state.peerOrder);
  const peers = useCallStore((state) => state.peers);
  const tier = useCallStore((state) => state.tier);
  const iceInfo = useCallStore((state) => state.iceInfo);
  const byPeer = useStatsStore((state) => state.byPeer);
  const closeDiagnostics = useUIStore((state) => state.closeDiagnostics);

  // Escape closes it, like any other transient panel.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeDiagnostics();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeDiagnostics]);

  const relayed = peerOrder.filter((id) => byPeer[id]?.usingRelay).length;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <Drawer
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 36 }}
        >
          <Card role='region' aria-label='Connection diagnostics'>
            {/*
              * The panel had no close of its own. The only way out was to find
              * the control that opened it, which on a phone is two taps inside
              * an overflow sheet — so it read as something that had appeared by
              * itself and could not be dismissed.
              */}
            <Head>
              <Title>Connection</Title>
              <Close onClick={closeDiagnostics} title='Close diagnostics'>
                <CloseIcon />
                <VisuallyHidden>Close diagnostics</VisuallyHidden>
              </Close>
            </Head>

            <Summary>
              <Stat>
                <StatLabel>Sending at</StatLabel>
                <StatValue>{TIERS[tier]?.label ?? '—'}</StatValue>
              </Stat>
              <Stat>
                <StatLabel>Connections</StatLabel>
                <StatValue>{peerOrder.length}</StatValue>
              </Stat>
              <Stat>
                <StatLabel>TURN relay</StatLabel>
                <StatValue $tone={iceInfo?.turnConfigured ? 'ok' : 'warn'}>
                  {iceInfo?.turnConfigured ? 'Available' : 'Not configured'}
                </StatValue>
              </Stat>
              <Stat>
                <StatLabel>Relayed</StatLabel>
                <StatValue $tone={relayed > 0 ? 'warn' : undefined}>
                  {relayed} of {peerOrder.length || 0}
                </StatValue>
              </Stat>
            </Summary>

            {peerOrder.length > 0 && (
              <Table>
                <HeadRow>
                  <span>Participant</span>
                  <span>Quality</span>
                  <span>Receiving</span>
                  <span>Loss</span>
                  <span>Latency</span>
                  <span>Jitter</span>
                  <span>FPS</span>
                  <span>Route</span>
                </HeadRow>

                {peerOrder.map((id) => {
                  const stats = byPeer[id];
                  const peer = peers[id];
                  if (!peer) return null;

                  return (
                    <DataRow key={id}>
                      <PeerName title={peer.displayName}>{peer.displayName}</PeerName>
                      <Value data-label='Quality' $tone={stats?.quality?.token}>
                        {stats?.quality?.label ?? 'Measuring'}
                      </Value>
                      <Value data-label='Receiving'>{formatBitrate(stats?.bitrateDown)}</Value>
                      <Value data-label='Loss' $tone={stats?.packetLoss > 3 ? 'warn' : undefined}>
                        {formatPercent(stats?.packetLoss)}
                      </Value>
                      <Value data-label='Latency'>{formatMs(stats?.roundTripTime)}</Value>
                      <Value data-label='Jitter'>{formatMs(stats?.jitter)}</Value>
                      <Value data-label='FPS'>
                        {stats?.framesPerSecond != null
                          ? Math.round(stats.framesPerSecond)
                          : '—'}
                      </Value>
                      <Route data-label='Route' $relay={stats?.usingRelay}>
                        {stats?.usingRelay && <RelayIcon />}
                        {ROUTE_TEXT[stats?.candidateType] ?? '—'}
                      </Route>
                    </DataRow>
                  );
                })}
              </Table>
            )}

            <Note>
              Sampled from the browser once a second. “Direct” means the media
              flows straight between you; “relayed” means it is passing through a
              TURN server.
            </Note>
          </Card>
        </Drawer>
      )}
    </AnimatePresence>
  );
}

const ROUTE_TEXT = {
  host: 'Direct (local)',
  srflx: 'Direct',
  prflx: 'Direct',
  relay: 'Relayed',
};

const Drawer = styled(motion.div)`
  overflow: hidden;
  flex-shrink: 0;
`;

const Card = styled.div`
  padding: var(--space-4);
  /*
   * The dock floats over the bottom of the screen on a phone, so the panel has
   * to end above it — otherwise its last rows and the footnote sit underneath
   * the controls.
   */
  margin: 0 10px calc(${DOCK_H} + 8px);
  max-height: 60dvh;
  overflow-y: auto;
  overscroll-behavior: contain;

  ${media.lg} {
    margin: 0 0 var(--space-3);
    max-height: none;
    overflow-y: visible;
  }

  background: var(--surface-1);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2), inset 0 1px 0 var(--edge-light);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
`;

const Title = styled.h2`
  font-size: 14px;
  font-weight: 550;
  letter-spacing: -0.012em;
  color: var(--ink);
`;

const Close = styled.button`
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;

  color: var(--ink-3);
  border-radius: var(--radius-pill);
  transition: color 180ms var(--ease), background-color 180ms var(--ease);

  &:hover {
    color: var(--ink);
    background: var(--surface-3);
  }

  ${media.touch} {
    width: ${TAP};
    height: ${TAP};
  }

  svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
`;

const Summary = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-4);
  padding-bottom: var(--space-4);
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`;

const StatLabel = styled.span`
  font-size: 12.5px;
  color: var(--ink-3);
`;

const StatValue = styled.span`
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.014em;
  color: ${({ $tone }) => ($tone ? `var(--${$tone})` : 'var(--ink)')};
`;

/*
 * A grid rather than a <table>: columns stay aligned across rows while
 * individual cells re-render at 1 Hz, and row height stays fixed so nothing
 * jumps as digits change width.
 */
const rowTemplate = `
  display: grid;
  grid-template-columns:
    minmax(96px, 1.5fr) minmax(76px, 1fr) minmax(82px, 1fr)
    minmax(52px, 0.7fr) minmax(64px, 0.8fr) minmax(60px, 0.8fr)
    minmax(40px, 0.5fr) minmax(88px, 1fr);
  gap: var(--space-3);
  align-items: center;
  min-width: 640px;
`;

const Table = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--hairline);

  ${media.sm} {
    overflow-x: auto;
  }
`;

/*
 * Column headings only make sense once the rows are actually columns. Below
 * `sm` each participant becomes a stacked block that names its own values, so
 * a shared heading row would be describing a layout that is not there.
 */
const HeadRow = styled.div`
  display: none;

  ${media.sm} {
    ${rowTemplate}
    padding: 10px 0 8px;

    span {
      font-size: 12px;
      color: var(--ink-3);
    }
  }
`;

/*
 * Phone: one block per participant, each value labelled by itself. The wide
 * version is 640px of table on a 412px screen, which meant the last three
 * columns — latency, jitter, route — sat off the edge behind a scrollbar
 * nobody finds.
 */
const DataRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 10px 0;
  border-top: 1px solid var(--hairline);

  > [data-label]::before {
    content: attr(data-label) ' ';
    color: var(--ink-3);
    font-weight: 400;
  }

  ${media.sm} {
    ${rowTemplate}
    padding: 7px 0;
    flex-wrap: nowrap;

    > [data-label]::before {
      content: none;
    }
  }
`;

const PeerName = styled.span`
  flex-basis: 100%;

  ${media.sm} {
    flex-basis: auto;
  }

  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Value = styled.span`
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
  color: ${({ $tone }) => ($tone ? `var(--${$tone})` : 'var(--ink-2)')};
`;

const Route = styled.span`
  display: flex;
  align-items: center;
  gap: 5px;

  font-size: 12.5px;
  color: ${({ $relay }) => ($relay ? 'var(--warn)' : 'var(--ink-2)')};

  svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
  }
`;

const Note = styled.p`
  margin-top: var(--space-3);
  font-size: 12px;
  line-height: 1.55;
  color: var(--ink-3);
  text-wrap: pretty;
`;
