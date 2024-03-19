import { memo } from 'react';
import styled from 'styled-components';
import { useStatsStore, makeSelectStats } from '../store/statsStore.js';
import { formatBitrate, formatMs, formatPercent } from '../lib/rtc/stats.js';

/**
 * Per-participant connection quality, driven entirely by
 * RTCPeerConnection.getStats().
 *
 * Every bar reflects a measurement — packet loss, round-trip time, jitter —
 * combined worst-metric-first (see lib/rtc/stats.js). When the browser has
 * produced no sample it renders nothing at all rather than inventing a
 * comfortable three bars. A meter that lies is worse than no meter.
 *
 * Visually it stays quiet: three thin bars that are neutral at full strength
 * and only take on colour as things degrade. A connection indicator that is
 * bright green while everything is fine trains you to ignore it.
 */

const Wrap = styled.div`
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 11px;
  cursor: help;
`;

const Bar = styled.span`
  width: 2.5px;
  border-radius: var(--radius-pill);
  height: ${({ $index }) => 5 + $index * 3}px;
  background: ${({ $lit, $tone }) =>
    $lit ? `var(--${$tone})` : 'currentColor'};
  opacity: ${({ $lit }) => ($lit ? 1 : 0.22)};
  transition: background-color 400ms var(--ease), opacity 400ms var(--ease);
`;

const LIT = { excellent: 3, good: 3, fair: 2, poor: 1, critical: 1, unknown: 0 };

export const SignalBars = memo(function SignalBars({ peerId }) {
  const stats = useStatsStore(makeSelectStats(peerId));
  const quality = stats.quality;

  // No sample yet means no claim.
  if (quality.id === 'unknown') return null;

  const lit = LIT[quality.id] ?? 0;
  const tone = quality.token;

  const title = [
    quality.label,
    `↓ ${formatBitrate(stats.bitrateDown)}`,
    `loss ${formatPercent(stats.packetLoss)}`,
    `rtt ${formatMs(stats.roundTripTime)}`,
    stats.usingRelay ? 'relayed via TURN' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Wrap title={title} role='img' aria-label={`Connection ${quality.label}`}>
      {[0, 1, 2].map((index) => (
        <Bar key={index} $index={index} $lit={index < lit} $tone={tone} />
      ))}
    </Wrap>
  );
});

export default SignalBars;
