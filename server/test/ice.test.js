import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';

import { buildIceServers } from '../src/ice.js';

/**
 * TURN credential generation.
 *
 * A TURN misconfiguration is invisible until it is catastrophic: the room
 * loads, participants appear, and then nobody can see anybody. These assert the
 * exact contract coturn's `use-auth-secret` mode expects, because "we set some
 * env vars" is not evidence that the relay will actually authenticate.
 */

const BASE = {
  stunUrls: ['stun:stun.example.com:3478'],
  turnUrls: [],
  turnUsername: '',
  turnCredential: '',
  turnSecret: '',
  turnTtlSeconds: 86400,
  transportPolicy: 'all',
};

const loadIce = (overrides = {}) => buildIceServers({ ...BASE, ...overrides });

test('STUN only when no TURN is configured, and it says so', () => {
  const config = loadIce();

  assert.equal(config.turnConfigured, false);
  assert.equal(config.iceServers.length, 1);
  assert.deepEqual(config.iceServers[0].urls, ['stun:stun.example.com:3478']);
  assert.equal(config.iceServers[0].username, undefined);
});

test('static TURN credentials are passed through', () => {
  const config = loadIce({
    turnUrls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
    turnUsername: 'vimate',
    turnCredential: 'hunter2',
  });

  assert.equal(config.turnConfigured, true);

  const turn = config.iceServers.find((server) =>
    String(server.urls).includes('turn:')
  );
  assert.ok(turn, 'expected a TURN entry');
  assert.equal(turn.username, 'vimate');
  assert.equal(turn.credential, 'hunter2');
  assert.equal(turn.urls.length, 2);
});

test('ephemeral TURN credentials match the coturn REST contract', () => {
  const secret = 'a-long-random-shared-secret';
  const before = Math.floor(Date.now() / 1000);

  const config = loadIce({
    turnUrls: ['turn:turn.example.com:3478'],
    turnSecret: secret,
    turnTtlSeconds: 3600,
  });

  const turn = config.iceServers.find((server) =>
    String(server.urls).includes('turn:')
  );
  assert.ok(turn, 'expected a TURN entry');

  // Username must be "<unix-expiry>:<id>".
  const [expiryText, id] = turn.username.split(':');
  const expiry = Number(expiryText);

  assert.ok(Number.isInteger(expiry), 'expiry must be an integer timestamp');
  assert.ok(id && id.length > 0, 'username must carry an id component');
  assert.ok(
    expiry >= before + 3600 && expiry <= before + 3601 + 5,
    `expiry ${expiry} should be ~1h out (base ${before})`
  );

  // Password must be base64(HMAC-SHA1(secret, username)) — this is precisely
  // what coturn recomputes to authenticate the client.
  const expected = createHmac('sha1', secret)
    .update(turn.username)
    .digest('base64');
  assert.equal(turn.credential, expected);

  assert.equal(config.ttlSeconds, 3600);
  assert.equal(config.turnConfigured, true);
});

test('ephemeral credentials are unique per request', () => {
  const env = {
    turnUrls: ['turn:turn.example.com:3478'],
    turnSecret: 'shared',
  };

  const first = loadIce(env);
  const second = loadIce(env);

  const usernameOf = (config) =>
    config.iceServers.find((s) => String(s.urls).includes('turn:')).username;

  assert.notEqual(
    usernameOf(first),
    usernameOf(second),
    'each client must get its own credential so one leak is not universal'
  );
});

test('relay-only transport policy is honoured', () => {
  const config = loadIce({
    turnUrls: ['turn:turn.example.com:3478'],
    turnSecret: 'shared',
    transportPolicy: 'relay',
  });

  // This is the switch used to prove a TURN server actually works — it forbids
  // host and server-reflexive candidates entirely.
  assert.equal(config.iceTransportPolicy, 'relay');
});

test('config normalises an unrecognised transport policy to "all"', async () => {
  // Normalisation happens in config.js when the env is parsed, so this asserts
  // the parsed default rather than round-tripping a bad value through ice.js.
  process.env.ICE_TRANSPORT_POLICY = 'nonsense';
  const { config } = await import(`../src/config.js?case=${Math.random()}`);
  assert.equal(config.ice.transportPolicy, 'all');
  delete process.env.ICE_TRANSPORT_POLICY;
});
