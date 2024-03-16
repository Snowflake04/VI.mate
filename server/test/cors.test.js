import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Origin policy.
 *
 * This is the check that decides whether a browser is allowed to open a socket
 * at all, so both directions matter. Too narrow and the app is dead on arrival:
 * the page loads, the lobby renders, and the socket silently 400s — which is
 * exactly what shipped, because the default allowlist named `:5173` and the app
 * is actually served through Vite's proxy on whatever host and port Vite chose.
 * Too wide and, with Socket.IO credentials enabled, any site on the internet
 * can drive the signaling server on a visitor's behalf.
 *
 * `isOriginAllowed` reads NODE_ENV once at import, so each mode is loaded in
 * its own module instance via a cache-busting query.
 */
const load = async (nodeEnv) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  const mod = await import(`../src/config.js?cors-test=${nodeEnv}`);
  process.env.NODE_ENV = previous;
  return mod.isOriginAllowed;
};

const PRIVATE_ORIGINS = [
  'http://localhost:5173',
  'https://localhost:4173',
  'http://127.0.0.1:4173',
  'https://192.168.220.36:4173',
  'http://10.0.0.14:8080',
  'https://172.16.4.9:4173',
  'http://[::1]:4173',
];

const PUBLIC_ORIGINS = [
  'https://evil.example.com',
  'http://vimate.example.com',
  'https://localhost.evil.example.com',
  'https://192.168.220.36.evil.example.com',
  'http://8.8.8.8',
];

test('development accepts any loopback or LAN origin, on any port or scheme', async () => {
  const isOriginAllowed = await load('development');
  for (const origin of PRIVATE_ORIGINS) {
    assert.equal(isOriginAllowed(origin), true, `${origin} should be allowed`);
  }
});

test('SECURITY: development still rejects public origins', async () => {
  const isOriginAllowed = await load('development');
  for (const origin of PUBLIC_ORIGINS) {
    assert.equal(isOriginAllowed(origin), false, `${origin} must be rejected`);
  }
});

test('SECURITY: production honours the explicit allowlist and nothing else', async () => {
  const isOriginAllowed = await load('production');

  // The default list, which production inherits when CORS_ORIGIN is unset.
  assert.equal(isOriginAllowed('http://localhost:5173'), true);

  // Private, but not named — allowed in development, never in production.
  for (const origin of ['https://192.168.220.36:4173', 'https://localhost:4173']) {
    assert.equal(isOriginAllowed(origin), false, `${origin} must be rejected`);
  }
  for (const origin of PUBLIC_ORIGINS) {
    assert.equal(isOriginAllowed(origin), false, `${origin} must be rejected`);
  }
});

test('SECURITY: malformed origins are rejected rather than throwing', async () => {
  const isOriginAllowed = await load('development');
  for (const origin of ['', 'not-a-url', 'null', '//localhost:4173', 'javascript:alert(1)']) {
    assert.equal(isOriginAllowed(origin), false, `${origin} must be rejected`);
  }
});
