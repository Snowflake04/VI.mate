import { createHmac, randomBytes } from 'node:crypto';
import config from './config.js';

/**
 * Builds the RTCConfiguration handed to browsers.
 *
 * This lives on the server for one reason: TURN credentials must not be baked
 * into the frontend bundle, where anyone can lift them and use your relay as
 * free bandwidth. Clients fetch this at runtime from GET /api/ice.
 *
 * Two TURN credential modes are supported:
 *
 *   1. Static  — TURN_USERNAME / TURN_CREDENTIAL, handed to every client.
 *   2. Ephemeral — TURN_SECRET, implementing coturn's REST API
 *      (`use-auth-secret`). Username is `<unix-expiry>:<opaque-id>` and the
 *      password is base64(HMAC-SHA1(secret, username)). Credentials expire on
 *      their own, so a leak has a bounded blast radius. This is the mode you
 *      want in production.
 *
 * See server/.env.example and the TURN section of the README for the coturn
 * configuration that pairs with this.
 *
 * Takes its configuration as an argument (defaulting to the process config) so
 * it stays a pure function — the credential contract is the kind of thing that
 * has to be testable without standing up a coturn instance.
 *
 * @param {typeof config.ice} [ice]
 */
export function buildIceServers(ice = config.ice) {
  const iceServers = [];

  if (ice.stunUrls.length) {
    iceServers.push({ urls: ice.stunUrls });
  }

  if (ice.turnUrls.length) {
    if (ice.turnSecret) {
      const expiry = Math.floor(Date.now() / 1000) + ice.turnTtlSeconds;
      const username = `${expiry}:${randomBytes(8).toString('hex')}`;
      const credential = createHmac('sha1', ice.turnSecret)
        .update(username)
        .digest('base64');

      iceServers.push({ urls: ice.turnUrls, username, credential });
    } else if (ice.turnUsername && ice.turnCredential) {
      iceServers.push({
        urls: ice.turnUrls,
        username: ice.turnUsername,
        credential: ice.turnCredential,
      });
    }
  }

  return {
    iceServers,
    iceTransportPolicy: ice.transportPolicy,
    // Pre-gathering a small pool shaves a visible chunk off time-to-first-frame.
    iceCandidatePoolSize: 2,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    // Surfaced so the client can warn honestly instead of silently failing
    // for the ~8-20% of users who sit behind symmetric or carrier-grade NAT.
    turnConfigured: ice.turnUrls.length > 0,
    ttlSeconds: ice.turnSecret ? ice.turnTtlSeconds : null,
  };
}

export default buildIceServers;
