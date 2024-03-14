/**
 * Per-socket token buckets.
 *
 * Without this, a single malicious (or merely buggy) client can pin the event
 * loop by emitting `chat:send` in a tight loop, or flood every other peer in a
 * room with signaling traffic. Buckets are attached to the socket and die with
 * it, so there is no global map to leak.
 *
 * Limits are deliberately generous for signaling — a legitimate ICE gathering
 * burst can be dozens of candidates per peer in the first second — and tight
 * for anything that fans out to humans.
 */

const BUCKETS = {
  // Room lifecycle: creating/joining is a human-speed action.
  lifecycle: { capacity: 10, refillPerSecond: 0.5 },
  // Signaling: bursty by nature, high ceiling, still bounded.
  signaling: { capacity: 300, refillPerSecond: 50 },
  // Chat: fast enough to never annoy a real typist, slow enough to stop a flood.
  chat: { capacity: 15, refillPerSecond: 2 },
  // Presence toggles (mute/unmute/hand raise).
  presence: { capacity: 30, refillPerSecond: 5 },
  // Admin approve/deny.
  moderation: { capacity: 40, refillPerSecond: 4 },
};

class TokenBucket {
  constructor({ capacity, refillPerSecond }) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.tokens = capacity;
    this.updatedAt = Date.now();
  }

  take(cost = 1) {
    const now = Date.now();
    const elapsedSeconds = (now - this.updatedAt) / 1000;

    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsedSeconds * this.refillPerSecond
    );
    this.updatedAt = now;

    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  /** Seconds until `cost` tokens are available again. */
  retryAfter(cost = 1) {
    const deficit = Math.max(0, cost - this.tokens);
    return Math.ceil(deficit / this.refillPerSecond);
  }
}

export function createLimiter() {
  const buckets = new Map();

  return {
    /** @returns {{ok: true} | {ok: false, retryAfter: number}} */
    check(name, cost = 1) {
      const spec = BUCKETS[name];
      if (!spec) return { ok: true };

      let bucket = buckets.get(name);
      if (!bucket) {
        bucket = new TokenBucket(spec);
        buckets.set(name, bucket);
      }

      if (bucket.take(cost)) return { ok: true };
      return { ok: false, retryAfter: bucket.retryAfter(cost) };
    },
  };
}

export default createLimiter;
