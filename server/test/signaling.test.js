import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';

import registerSignaling from '../src/signaling.js';

/**
 * Integration tests over a real Socket.IO server.
 *
 * These exist because the bugs they cover were all *silent* in the original
 * implementation: a client could approve itself into a locked room, inject SDP
 * into a stranger's peer connection, and leave ghost participants behind, and
 * nothing in the logs would say so. Each test below names the failure it locks
 * out.
 */

let httpServer;
let port;
const clients = [];

before(async () => {
  httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: true } });
  registerSignaling(io);

  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

after(async () => {
  for (const client of clients) client.close();
  await new Promise((resolve) => httpServer.close(resolve));
});

/** Opens a client and waits for the server to acknowledge the session. */
function open() {
  return new Promise((resolve, reject) => {
    const socket = connect(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(socket);

    const timer = setTimeout(() => reject(new Error('connect timeout')), 4000);
    socket.on('session:ready', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/** Promise-wrapped emit that resolves with the server's ack. */
function call(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timeout`)), 4000);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

/** Resolves with the next payload for `event`, or rejects on timeout. */
function next(socket, event, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`waiting for ${event} timed out`)),
      timeout
    );
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Asserts `event` does NOT arrive within the window. */
async function never(socket, event, window = 600) {
  let fired = false;
  const listener = () => {
    fired = true;
  };
  socket.once(event, listener);
  await new Promise((resolve) => setTimeout(resolve, window));
  socket.off(event, listener);
  assert.equal(fired, false, `expected no "${event}" but one arrived`);
}

async function createRoom(socket, overrides = {}) {
  const response = await call(socket, 'room:create', {
    displayName: 'Owner',
    roomName: 'Test Room',
    requireAuth: false,
    ...overrides,
  });
  assert.equal(response.ok, true, response.error);
  return response.room;
}

// ---------------------------------------------------------------------------

test('creates a room and returns a well-formed, serializable payload', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  assert.match(room.code, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(room.isAdmin, true);
  assert.equal(room.participants.length, 1);

  // Regression: the original server emitted its internal room object, which
  // held live Socket instances under `requests`. This would have thrown.
  assert.doesNotThrow(() => JSON.stringify(room));
  assert.equal('requests' in room, false);
});

test('a second peer joins an open room and both sides learn about it', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  const guest = await open();
  const announced = next(owner, 'peer:joined');

  const response = await call(guest, 'room:join', {
    displayName: 'Guest',
    roomCode: room.code,
  });
  assert.equal(response.ok, true);
  assert.equal(response.status, 'joined');

  const { peer } = await announced;
  assert.equal(peer.displayName, 'Guest');
});

test('room codes are accepted case-insensitively', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  const guest = await open();
  const response = await call(guest, 'room:join', {
    displayName: 'Guest',
    roomCode: room.code.toLowerCase(),
  });
  assert.equal(response.ok, true);
});

test('SECURITY: a guest cannot approve its own join request', async () => {
  const owner = await open();
  const room = await createRoom(owner, { requireAuth: true });

  const attacker = await open();
  const knock = next(owner, 'join:request');

  const joinResponse = await call(attacker, 'room:join', {
    displayName: 'Attacker',
    roomCode: room.code,
  });
  assert.equal(joinResponse.status, 'pending');
  await knock;

  // The original requestApproval.js had no admin check whatsoever: this exact
  // call would have admitted the attacker into a locked room.
  const selfApproval = await call(attacker, 'join:approve', {
    peerId: attacker.id,
  });

  assert.equal(selfApproval.ok, false);
  assert.equal(selfApproval.code, 'NOT_IN_ROOM');

  // And it must not have been admitted as a side effect.
  await never(attacker, 'room:joined');
});

test('SECURITY: a non-admin participant cannot approve or deny', async () => {
  const owner = await open();
  const room = await createRoom(owner, { requireAuth: true });

  // Admit a regular member first, so it is genuinely *in* the room.
  const member = await open();
  const memberKnock = next(owner, 'join:request');
  await call(member, 'room:join', {
    displayName: 'Member',
    roomCode: room.code,
  });
  const { id: memberId } = await memberKnock;

  // `room:joined` is emitted to the member inside the approve handler, i.e.
  // before the owner's ack resolves — so the listener has to be armed first.
  const memberAdmitted = next(member, 'room:joined');
  await call(owner, 'join:approve', { peerId: memberId });
  await memberAdmitted;

  // Now a third party knocks, and the ordinary member tries to let them in.
  const outsider = await open();
  const outsiderKnock = next(owner, 'join:request');
  await call(outsider, 'room:join', {
    displayName: 'Outsider',
    roomCode: room.code,
  });
  const { id: outsiderId } = await outsiderKnock;

  const attempt = await call(member, 'join:approve', { peerId: outsiderId });
  assert.equal(attempt.ok, false);
  assert.equal(attempt.code, 'NOT_AUTHORIZED');

  await never(outsider, 'room:joined');
});

test('SECURITY: signaling cannot cross room boundaries', async () => {
  const ownerA = await open();
  const roomA = await createRoom(ownerA, { roomName: 'Room A' });

  const ownerB = await open();
  await createRoom(ownerB, { roomName: 'Room B' });

  // ownerB names a socket that exists, but is in someone else's room.
  // The original relay honoured any receiverId and would have delivered this.
  const attempt = await call(ownerB, 'signal:describe', {
    to: ownerA.id,
    description: { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\n' },
  });

  assert.equal(attempt.ok, false);
  assert.equal(attempt.code, 'NO_SUCH_PEER');
  await never(ownerA, 'signal:describe');

  // Same guarantee for ICE and for chat.
  const iceAttempt = await call(ownerB, 'signal:ice', {
    to: ownerA.id,
    candidate: { candidate: 'candidate:0 1 UDP 1 10.0.0.1 1 typ host' },
  });
  assert.equal(iceAttempt.code, 'NO_SUCH_PEER');

  const dmAttempt = await call(ownerB, 'chat:send', {
    to: ownerA.id,
    body: 'you should not receive this',
  });
  assert.equal(dmAttempt.code, 'NO_SUCH_PEER');
  await never(ownerA, 'chat:message');

  assert.equal(roomA.code.length, 14);
});

test('SECURITY: a socket that never joined cannot post chat into a room', async () => {
  const owner = await open();
  await createRoom(owner);

  const stranger = await open();
  const attempt = await call(stranger, 'chat:send', { body: 'hello' });

  assert.equal(attempt.ok, false);
  assert.equal(attempt.code, 'NOT_IN_ROOM');
  await never(owner, 'chat:message');
});

test('signaling is delivered between genuine peers in the same room', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  const guest = await open();
  await call(guest, 'room:join', {
    displayName: 'Guest',
    roomCode: room.code,
  });

  const delivered = next(owner, 'signal:describe');
  const response = await call(guest, 'signal:describe', {
    to: owner.id,
    description: { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\n' },
  });
  assert.equal(response.ok, true);

  const payload = await delivered;
  assert.equal(payload.from, guest.id);
  assert.equal(payload.description.type, 'offer');
});

test('group chat reaches everyone and is replayed to later joiners', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  const guest = await open();
  await call(guest, 'room:join', { displayName: 'Guest', roomCode: room.code });

  const received = next(guest, 'chat:message');
  await call(owner, 'chat:send', { body: 'hello room' });
  const { message } = await received;

  assert.equal(message.body, 'hello room');
  assert.equal(message.private, false);
  assert.equal(message.fromName, 'Owner');

  const latecomer = await open();
  const admitted = next(latecomer, 'room:joined');
  const joined = await call(latecomer, 'room:join', {
    displayName: 'Late',
    roomCode: room.code,
  });
  assert.equal(joined.ok, true);

  const history = await admitted;
  assert.equal(history.room.history.length, 1);
  assert.equal(history.room.history[0].body, 'hello room');
});

test('private chat reaches only its recipient and is never in history', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  const alice = await open();
  await call(alice, 'room:join', { displayName: 'Alice', roomCode: room.code });
  const bob = await open();
  await call(bob, 'room:join', { displayName: 'Bob', roomCode: room.code });

  const aliceGets = next(alice, 'chat:message');
  const response = await call(owner, 'chat:send', {
    to: alice.id,
    body: 'just between us',
  });
  assert.equal(response.ok, true);
  assert.equal(response.message.private, true);

  const { message } = await aliceGets;
  assert.equal(message.body, 'just between us');

  // Bob is in the same room and must not have seen it.
  await never(bob, 'chat:message');

  // Nor may a later joiner find it in replayed history.
  const latecomer = await open();
  const admitted = next(latecomer, 'room:joined');
  await call(latecomer, 'room:join', {
    displayName: 'Late',
    roomCode: room.code,
  });
  const { room: replayed } = await admitted;
  assert.equal(
    replayed.history.some((m) => m.body === 'just between us'),
    false
  );
});

test('disconnecting removes the participant and tells the room', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  const guest = await open();
  await call(guest, 'room:join', { displayName: 'Guest', roomCode: room.code });
  await next(owner, 'peer:joined');

  // Captured up front: `socket.id` is cleared once the client closes.
  const guestId = guest.id;

  // The original server had no `disconnect` handling at all — closing a tab
  // left the participant in the room list permanently.
  const departure = next(owner, 'peer:left');
  guest.close();

  const { id, reason } = await departure;
  assert.equal(id, guestId);
  assert.equal(reason, 'disconnected');
});

test('room ownership transfers when the owner leaves', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  const guest = await open();
  await call(guest, 'room:join', { displayName: 'Guest', roomCode: room.code });
  await next(owner, 'peer:joined');

  const promoted = next(guest, 'room:admin');
  owner.close();

  const { adminId } = await promoted;
  assert.equal(adminId, guest.id);
});

test('rejects malformed and oversized payloads', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  const badCode = await call(owner, 'room:join', {
    displayName: 'X',
    roomCode: 'not-a-code',
  });
  assert.equal(badCode.ok, false);

  const huge = await call(owner, 'chat:send', { body: 'x'.repeat(5000) });
  assert.equal(huge.ok, false);
  assert.equal(huge.code, 'INVALID_PAYLOAD');

  const empty = await call(owner, 'chat:send', { body: '   ' });
  assert.equal(empty.ok, false);

  const wrongType = await call(owner, 'chat:send', { body: 12345 });
  assert.equal(wrongType.ok, false);

  const hugeSdp = await call(owner, 'signal:describe', {
    to: owner.id,
    description: { type: 'offer', sdp: 'v='.repeat(200_000) },
  });
  assert.equal(hugeSdp.ok, false);

  assert.ok(room.code);
});

test('display names are stripped of control and bidi characters', async () => {
  const socket = await open();
  const response = await call(socket, 'room:create', {
    displayName: '  Ada ‮  Lovelace  ',
    roomName: 'Sanitised',
  });

  assert.equal(response.ok, true);
  assert.equal(response.room.participants[0].displayName, 'Ada Lovelace');
});

test('chat flooding is rate limited rather than relayed', async () => {
  const owner = await open();
  await createRoom(owner);

  const results = [];
  for (let i = 0; i < 40; i += 1) {
    results.push(await call(owner, 'chat:send', { body: `flood ${i}` }));
  }

  const limited = results.filter((r) => r.code === 'RATE_LIMITED');
  assert.ok(
    limited.length > 0,
    'expected the chat token bucket to reject part of a 40-message burst'
  );
});

test('the room participant ceiling is enforced', async () => {
  const owner = await open();
  const room = await createRoom(owner);

  // Default ceiling is 12 including the owner.
  for (let i = 0; i < 11; i += 1) {
    const guest = await open();
    const response = await call(guest, 'room:join', {
      displayName: `Guest ${i}`,
      roomCode: room.code,
    });
    assert.equal(response.ok, true, `guest ${i} should fit`);
  }

  const overflow = await open();
  const rejected = await call(overflow, 'room:join', {
    displayName: 'Overflow',
    roomCode: room.code,
  });

  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'ROOM_FULL');
});
