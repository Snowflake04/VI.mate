import styled from 'styled-components';
import { RelayIcon } from '../../components/Icons.jsx';
import { useCallStore } from '../../store/callStore.js';
import { TIERS } from '../../lib/rtc/constraints.js';
import { DEPLOY_LABEL, SIGNALING_URL } from '../../lib/env.js';

/**
 * Pre-flight facts, kept small and out of the way.
 *
 * This used to be a four-cell instrument panel with its own border, which gave
 * a footnote the same visual weight as the thing you came here to do. It is a
 * footnote now — one quiet line — and it only grows into a warning when there
 * is something you actually need to know.
 *
 * The values are real: the video tier comes from an actual device profile
 * (cores, memory, network hints) and the NAT line from the signalling server's
 * /api/ice response. The TURN warning in particular predicts whether a
 * meaningful share of users will connect at all, and hiding it until a call
 * fails is how a P2P app earns a reputation for being flaky.
 */
export default function SystemReadout() {
  const iceInfo = useCallStore((state) => state.iceInfo);
  const tier = useCallStore((state) => state.tier);
  const socketStatus = useCallStore((state) => state.socketStatus);

  const turnMissing = iceInfo && !iceInfo.turnConfigured;

  return (
    <Wrap>
      <Line>
        <Item>{SOCKET_LABEL[socketStatus] ?? socketStatus}</Item>
        <Sep />
        <Item>Up to {TIERS[tier]?.label ?? '—'}</Item>
        <Sep />
        <Item>{iceInfo?.turnConfigured ? 'STUN + TURN' : 'STUN only'}</Item>
        {DEPLOY_LABEL && (
          <>
            <Sep />
            <Item>{DEPLOY_LABEL}</Item>
          </>
        )}
      </Line>

      {turnMissing && (
        <Warning>
          <RelayIcon />
          <span>
            No TURN relay configured — peers behind symmetric or carrier-grade
            NAT will join but never connect. Fine locally; see the README before
            deploying.
          </span>
        </Warning>
      )}

      <Host title={SIGNALING_URL}>{SIGNALING_URL.replace(/^https?:\/\//, '')}</Host>
    </Wrap>
  );
}

const SOCKET_LABEL = {
  idle: 'Starting',
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  offline: 'Server unreachable',
};

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
`;

const Line = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
`;

const Item = styled.span`
  font-size: 12.5px;
  color: var(--ink-3);
`;

const Sep = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ink-3);
  opacity: 0.5;
`;

const Warning = styled.div`
  display: flex;
  gap: 9px;
  align-items: flex-start;
  text-align: left;

  max-width: 46ch;
  padding: 11px 14px;

  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink-2);

  background: var(--surface-1);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--hairline);

  svg {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    margin-top: 1px;
    fill: none;
    stroke: var(--warn);
    stroke-width: 1.7;
    stroke-linecap: round;
  }
`;

const Host = styled.span`
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-3);
  opacity: 0.65;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
