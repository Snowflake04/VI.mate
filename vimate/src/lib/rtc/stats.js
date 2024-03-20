/**
 * ---------------------------------------------------------------------------
 * Real connection telemetry, from RTCPeerConnection.getStats()
 * ---------------------------------------------------------------------------
 * Every number this module produces is measured. Nothing here is smoothed from
 * a timer, faked while "connecting", or interpolated to look busy — if the
 * browser has no sample, the reading is `null` and the UI says so.
 *
 * getStats returns cumulative counters, so throughput and loss only mean
 * anything as deltas between two polls. That bookkeeping is what this file is.
 * ---------------------------------------------------------------------------
 */

/**
 * Human-facing quality bands, worst-first when combined.
 *
 * Labels are plain words because they are read aloud by screen readers and
 * shown in tooltips to ordinary people mid-call. `token` names a semantic
 * colour; healthy states map to neutral ink so the indicator only takes on
 * colour when something is actually wrong.
 */
export const QUALITY = {
  excellent: { id: 'excellent', label: 'Excellent', rank: 4, token: 'ink-2' },
  good: { id: 'good', label: 'Good', rank: 3, token: 'ink-2' },
  fair: { id: 'fair', label: 'Fair', rank: 2, token: 'warn' },
  poor: { id: 'poor', label: 'Poor', rank: 1, token: 'warn' },
  critical: { id: 'critical', label: 'Failing', rank: 0, token: 'bad' },
  unknown: { id: 'unknown', label: 'Measuring', rank: -1, token: 'ink-3' },
};

const EMPTY = {
  quality: QUALITY.unknown,
  bitrateDown: null,
  bitrateUp: null,
  packetLoss: null,
  roundTripTime: null,
  jitter: null,
  framesPerSecond: null,
  resolution: null,
  candidateType: null,
  usingRelay: false,
  freezeCount: null,
  audioLevel: null,
  availableOutgoingBitrate: null,
  qualityLimitationReason: null,
  sampledAt: null,
};

/**
 * Per-peer sampler. Holds the previous counters so each call can return rates
 * rather than lifetime totals.
 */
export class StatsSampler {
  constructor(peerConnection) {
    this.pc = peerConnection;
    this.previous = null;
    this.latest = { ...EMPTY };
  }

  async sample() {
    if (!this.pc || this.pc.connectionState === 'closed') {
      this.latest = { ...EMPTY };
      return this.latest;
    }

    let report;
    try {
      report = await this.pc.getStats();
    } catch {
      return this.latest;
    }

    const now = performance.now();
    const current = {
      at: now,
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsLost: 0,
    };

    let jitter = null;
    let roundTripTime = null;
    let framesPerSecond = null;
    let resolution = null;
    let candidateType = null;
    let availableOutgoingBitrate = null;
    let qualityLimitationReason = null;
    let freezeCount = null;
    let audioLevel = null;

    // --- inbound: what we are receiving from this peer ---------------------
    report.forEach((stat) => {
      if (stat.type === 'inbound-rtp' && !stat.isRemote) {
        current.bytesReceived += stat.bytesReceived ?? 0;
        current.packetsReceived += stat.packetsReceived ?? 0;
        // packetsLost can be negative when packets arrive out of order.
        current.packetsLost += Math.max(0, stat.packetsLost ?? 0);

        if (stat.kind === 'video') {
          if (typeof stat.framesPerSecond === 'number') {
            framesPerSecond = stat.framesPerSecond;
          }
          if (stat.frameWidth && stat.frameHeight) {
            resolution = `${stat.frameWidth}×${stat.frameHeight}`;
          }
          if (typeof stat.freezeCount === 'number') {
            freezeCount = stat.freezeCount;
          }
        }

        if (stat.kind === 'audio') {
          if (typeof stat.jitter === 'number') jitter = stat.jitter;
          if (typeof stat.audioLevel === 'number') audioLevel = stat.audioLevel;
        }
      }

      if (stat.type === 'outbound-rtp' && !stat.isRemote) {
        current.bytesSent += stat.bytesSent ?? 0;

        /*
         * Why the encoder is holding back, straight from the encoder: 'cpu',
         * 'bandwidth', 'other', or 'none'. Worth far more than inferring it
         * from loss and RTT, which cannot tell the two apart — and CPU and
         * bandwidth want opposite responses.
         */
        if (stat.kind === 'video' && typeof stat.qualityLimitationReason === 'string') {
          if (stat.qualityLimitationReason !== 'none') {
            qualityLimitationReason = stat.qualityLimitationReason;
          }
        }
      }

      // --- transport: RTT and, crucially, whether TURN is in use -----------
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        // `nominated` is the pair actually carrying media; some browsers report
        // several succeeded pairs.
        if (stat.nominated || roundTripTime === null) {
          if (typeof stat.currentRoundTripTime === 'number') {
            roundTripTime = stat.currentRoundTripTime * 1000;
          }

          /*
           * The browser's own send-side bandwidth estimate — the output of the
           * Google Congestion Control loop that is already running underneath
           * every connection. It is a far better signal than anything derived
           * from loss and RTT at this level, because GCC also sees one-way
           * delay gradients and its own probing. Chromium-only in practice;
           * the heuristic path remains for browsers that omit it.
           */
          if (typeof stat.availableOutgoingBitrate === 'number') {
            availableOutgoingBitrate = stat.availableOutgoingBitrate;
          }
          const local = report.get(stat.localCandidateId);
          const remote = report.get(stat.remoteCandidateId);
          if (local) {
            candidateType = local.candidateType;
            // "relay" on either end means the media is going through TURN.
            if (local.candidateType === 'relay' || remote?.candidateType === 'relay') {
              candidateType = 'relay';
            }
          }
        }
      }

      // Remote-inbound tells us the RTT *the far end* measured, which is the
      // better number when our own candidate-pair stats are missing.
      if (stat.type === 'remote-inbound-rtp') {
        if (roundTripTime === null && typeof stat.roundTripTime === 'number') {
          roundTripTime = stat.roundTripTime * 1000;
        }
      }
    });

    const previous = this.previous;
    this.previous = current;

    // First sample establishes a baseline; rates need two points.
    if (!previous) {
      this.latest = {
        ...EMPTY,
        candidateType,
        usingRelay: candidateType === 'relay',
        roundTripTime,
        availableOutgoingBitrate,
        qualityLimitationReason,
        sampledAt: Date.now(),
      };
      return this.latest;
    }

    const elapsedSeconds = (current.at - previous.at) / 1000;
    if (elapsedSeconds <= 0) return this.latest;

    const bitrateDown = Math.max(
      0,
      ((current.bytesReceived - previous.bytesReceived) * 8) / elapsedSeconds
    );
    const bitrateUp = Math.max(
      0,
      ((current.bytesSent - previous.bytesSent) * 8) / elapsedSeconds
    );

    const deltaReceived = current.packetsReceived - previous.packetsReceived;
    const deltaLost = current.packetsLost - previous.packetsLost;
    const deltaTotal = deltaReceived + deltaLost;

    const packetLoss =
      deltaTotal > 0 ? Math.min(100, (deltaLost / deltaTotal) * 100) : 0;

    this.latest = {
      quality: scoreQuality({
        packetLoss,
        roundTripTime,
        bitrateDown,
        jitter,
        connectionState: this.pc.connectionState,
      }),
      bitrateDown,
      bitrateUp,
      packetLoss,
      roundTripTime,
      jitter: jitter === null ? null : jitter * 1000,
      framesPerSecond,
      resolution,
      candidateType,
      usingRelay: candidateType === 'relay',
      freezeCount,
      audioLevel,
      availableOutgoingBitrate,
      qualityLimitationReason,
      sampledAt: Date.now(),
    };

    return this.latest;
  }

  reset() {
    this.previous = null;
    this.latest = { ...EMPTY };
  }
}

/**
 * Collapses the measurements into one band.
 *
 * Worst-metric-wins rather than an average: a call with perfect bitrate and 12%
 * packet loss is a bad call, and averaging would hide exactly the thing the
 * indicator exists to surface.
 */
export function scoreQuality({
  packetLoss,
  roundTripTime,
  bitrateDown,
  jitter,
  connectionState,
}) {
  if (connectionState === 'failed' || connectionState === 'closed') {
    return QUALITY.critical;
  }
  if (connectionState === 'disconnected') return QUALITY.poor;
  if (packetLoss == null && roundTripTime == null) return QUALITY.unknown;

  const bands = [];

  if (packetLoss != null) {
    if (packetLoss < 1) bands.push(QUALITY.excellent);
    else if (packetLoss < 3) bands.push(QUALITY.good);
    else if (packetLoss < 7) bands.push(QUALITY.fair);
    else if (packetLoss < 15) bands.push(QUALITY.poor);
    else bands.push(QUALITY.critical);
  }

  if (roundTripTime != null) {
    if (roundTripTime < 100) bands.push(QUALITY.excellent);
    else if (roundTripTime < 200) bands.push(QUALITY.good);
    else if (roundTripTime < 350) bands.push(QUALITY.fair);
    else if (roundTripTime < 600) bands.push(QUALITY.poor);
    else bands.push(QUALITY.critical);
  }

  if (jitter != null) {
    const ms = jitter * 1000;
    if (ms < 20) bands.push(QUALITY.excellent);
    else if (ms < 40) bands.push(QUALITY.good);
    else if (ms < 80) bands.push(QUALITY.fair);
    else bands.push(QUALITY.poor);
  }

  // A stream carrying almost nothing is stalled regardless of its other stats,
  // but only judge that once we know media was expected at all.
  if (bitrateDown != null && bitrateDown > 0 && bitrateDown < 30_000) {
    bands.push(QUALITY.poor);
  }

  if (bands.length === 0) return QUALITY.unknown;
  return bands.reduce((worst, band) => (band.rank < worst.rank ? band : worst));
}

/** 1_540_000 → "1.5 Mbps" */
export function formatBitrate(bitsPerSecond) {
  if (bitsPerSecond == null) return '—';
  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
  }
  if (bitsPerSecond >= 1000) {
    return `${Math.round(bitsPerSecond / 1000)} kbps`;
  }
  return `${Math.round(bitsPerSecond)} bps`;
}

export function formatMs(value) {
  if (value == null) return '—';
  return `${Math.round(value)} ms`;
}

export function formatPercent(value) {
  if (value == null) return '—';
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

export const EMPTY_STATS = EMPTY;
