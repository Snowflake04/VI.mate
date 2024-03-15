import config from './config.js';
import createLimiter from './ratelimit.js';
import { RoomRegistry, createMessage, serializeRoom } from './rooms.js';
import {
  ValidationError,
  cleanDisplayName,
  cleanIceCandidate,
  cleanMessageBody,
  cleanObject,
  cleanPeerState,
  cleanRoomCode,
  cleanRoomName,
  cleanSessionDescription,
  cleanSocketId,
  cleanBoolean,
} from './validation.js';

const { limits } = config;

/**
 * ---------------------------------------------------------------------------
 * The authority rule
 * ---------------------------------------------------------------------------
 * A client never tells the server which room it is in. `socket.data.roomCode`
 * is assigned by the server at join time and is the only membership fact any
 * handler consults.
 *
 * The original implementation took `roomId` straight off the wire and relayed
 * to any `receiverId` the caller named, which let any connected client inject
 * SDP into any other client's peer connection and post chat into rooms it had
 * never joined. Everything below is written so that class of bug is not
 * expressible: authority comes from server state, targets are resolved inside
 * the sender's own room, and privileged actions re-check ownership at call time
 * rather than trusting a flag handed out earlier.
 * ---------------------------------------------------------------------------
 */

const registry = new RoomRegistry();

/** Wraps a handler with validation, rate limiting, and ack plumbing. */
function handler(socket, bucket, fn) {
  const limiter = socket.data.limiter;

  return async (rawPayload, rawAck) => {
    const ack = typeof rawAck === 'function' ? rawAck : () => {};

    const allowed = limiter.check(bucket);
    if (!allowed.ok) {
      socket.emit('rate:limited', {
        bucket,
        retryAfter: allowed.retryAfter,
      });
      ack({ ok: false, code: 'RATE_LIMITED', error: 'Slow down.' });
      return;
    }

    try {
      const payload = rawPayload == null ? {} : cleanObject(rawPayload);
      const result = await fn(payload);
      ack({ ok: true, ...(result ?? {}) });
    } catch (error) {
      if (error instanceof ValidationError) {
        ack({ ok: false, code: error.code, error: error.message });
        return;
      }
      // An unexpected throw is our bug, not the client's. Log it, but never
      // leak internals (stack traces, file paths) back over the socket.
      console.error(`[signal] ${bucket} handler failed:`, error);
      ack({ ok: false, code: 'SERVER_ERROR', error: 'Something went wrong.' });
    }
  };
}

/** Resolves the caller's room from server-held state only. */
function currentRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) {
    throw new ValidationError('You are not in a room.', 'NOT_IN_ROOM');
  }

  const room = registry.get(code);
  if (!room || !room.participants.has(socket.id)) {
    // State drifted (room expired, or we were removed). Reset rather than
    // leaving the socket believing it is still a member.
    socket.data.roomCode = null;
    throw new ValidationError('That room is no longer available.', 'NO_ROOM');
  }
  return room;
}

function requireAdmin(socket, room) {
  if (room.adminId !== socket.id) {
    throw new ValidationError(
      'Only the room owner can do that.',
      'NOT_AUTHORIZED'
    );
  }
}

/**
 * Resolves a signaling/DM target. The target must be a *current participant of
 * the caller's own room* — this single check is what stops cross-room injection.
 */
function resolveTarget(room, rawId) {
  const targetId = cleanSocketId(rawId, 'Target');
  if (!room.participants.has(targetId)) {
    throw new ValidationError('That peer is not in this room.', 'NO_SUCH_PEER');
  }
  return targetId;
}

function participantView(participant) {
  return {
    id: participant.id,
    displayName: participant.displayName,
    joinedAt: participant.joinedAt,
    state: participant.state,
  };
}

/** Attaches a socket to a room and announces it. */
function admitParticipant(io, socket, room, displayName) {
  registry.cancelCleanup(room);

  const participant = {
    id: socket.id,
    displayName,
    joinedAt: Date.now(),
    state: { audio: true, video: true, screen: false, handRaised: false },
  };

  room.participants.set(socket.id, participant);
  room.pending.delete(socket.id);

  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.displayName = displayName;

  socket.emit('room:joined', {
    room: serializeRoom(room, { forSocketId: socket.id }),
    selfId: socket.id,
  });

  socket.to(room.code).emit('peer:joined', {
    peer: participantView(participant),
  });
}

/** Detaches a socket from its room and announces it. Idempotent. */
function releaseParticipant(io, socket, { reason = 'left' } = {}) {
  const code = socket.data.roomCode;
  if (!code) return;

  socket.data.roomCode = null;

  const room = registry.get(code);
  if (!room) return;

  const wasPending = room.pending.delete(socket.id);
  const { removed, newAdminId } = registry.removeParticipant(room, socket.id);

  if (wasPending && !removed) {
    // Someone abandoned the waiting room; retract the knock so the owner's
    // approval queue does not fill with people who are already gone.
    io.to(room.adminId).emit('join:withdrawn', { id: socket.id });
  }

  if (!removed) {
    socket.leave(code);
    return;
  }

  socket.leave(code);
  io.to(code).emit('peer:left', { id: socket.id, reason });

  if (newAdminId) {
    io.to(code).emit('room:admin', { adminId: newAdminId });
    // The new owner inherits the pending queue and needs to see it.
    const pending = [...room.pending.values()].map(
      ({ id, displayName, requestedAt }) => ({ id, displayName, requestedAt })
    );
    if (pending.length) io.to(newAdminId).emit('join:backlog', { pending });
  }
}

export function registerSignaling(io) {
  io.on('connection', (socket) => {
    socket.data.limiter = createLimiter();
    socket.data.roomCode = null;
    socket.data.displayName = null;

    socket.emit('session:ready', { id: socket.id });

    // ---------------------------------------------------------------- rooms

    socket.on(
      'room:create',
      handler(socket, 'lifecycle', (payload) => {
        if (socket.data.roomCode) {
          throw new ValidationError('Leave your current room first.', 'IN_ROOM');
        }

        const displayName = cleanDisplayName(payload.displayName);
        const roomName = cleanRoomName(payload.roomName);
        const requireAuth = cleanBoolean(payload.requireAuth, false);

        const room = registry.create({
          name: roomName,
          requireAuth,
          adminId: socket.id,
          adminName: displayName,
        });

        socket.join(room.code);
        socket.data.roomCode = room.code;
        socket.data.displayName = displayName;

        return {
          room: serializeRoom(room, { forSocketId: socket.id }),
          selfId: socket.id,
        };
      })
    );

    socket.on(
      'room:join',
      handler(socket, 'lifecycle', (payload) => {
        if (socket.data.roomCode) {
          throw new ValidationError('Leave your current room first.', 'IN_ROOM');
        }

        const displayName = cleanDisplayName(payload.displayName);
        const roomCode = cleanRoomCode(payload.roomCode);

        const room = registry.get(roomCode);
        if (!room) {
          throw new ValidationError(
            'No room with that code. It may have ended.',
            'NO_ROOM'
          );
        }

        // Mesh WebRTC is O(n²) connections; past a dozen peers the *clients*
        // fall over, so the ceiling is enforced here rather than discovered
        // by everyone's laptop fans.
        if (room.participants.size >= limits.maxParticipants) {
          throw new ValidationError('That room is full.', 'ROOM_FULL');
        }

        if (room.requireAuth) {
          room.pending.set(socket.id, {
            id: socket.id,
            displayName,
            requestedAt: Date.now(),
          });
          socket.data.roomCode = null;
          socket.data.pendingRoom = room.code;
          socket.data.displayName = displayName;

          io.to(room.adminId).emit('join:request', {
            id: socket.id,
            displayName,
            requestedAt: Date.now(),
          });

          return { status: 'pending', roomName: room.name };
        }

        admitParticipant(io, socket, room, displayName);
        return { status: 'joined' };
      })
    );

    socket.on(
      'room:leave',
      handler(socket, 'lifecycle', () => {
        releaseParticipant(io, socket, { reason: 'left' });
        // Also withdraw any outstanding knock on an auth-gated room.
        const pendingCode = socket.data.pendingRoom;
        if (pendingCode) {
          const room = registry.get(pendingCode);
          if (room?.pending.delete(socket.id)) {
            io.to(room.adminId).emit('join:withdrawn', { id: socket.id });
          }
          socket.data.pendingRoom = null;
        }
        return {};
      })
    );

    // ----------------------------------------------------------- moderation

    socket.on(
      'join:approve',
      handler(socket, 'moderation', (payload) => {
        const room = currentRoom(socket);
        requireAdmin(socket, room);

        const peerId = cleanSocketId(payload.peerId, 'Peer id');
        const request = room.pending.get(peerId);
        if (!request) {
          throw new ValidationError(
            'That request is no longer waiting.',
            'NO_SUCH_REQUEST'
          );
        }

        if (room.participants.size >= limits.maxParticipants) {
          throw new ValidationError('That room is full.', 'ROOM_FULL');
        }

        // Resolved against the live socket registry rather than a stored
        // Socket reference — the original code stashed the whole Socket object
        // inside room state, which both leaked memory and made the room
        // un-serializable.
        const peerSocket = io.sockets.sockets.get(peerId);
        room.pending.delete(peerId);

        if (!peerSocket) {
          throw new ValidationError(
            'That person disconnected before you answered.',
            'PEER_GONE'
          );
        }

        peerSocket.data.pendingRoom = null;
        admitParticipant(io, peerSocket, room, request.displayName);
        return {};
      })
    );

    socket.on(
      'join:deny',
      handler(socket, 'moderation', (payload) => {
        const room = currentRoom(socket);
        requireAdmin(socket, room);

        const peerId = cleanSocketId(payload.peerId, 'Peer id');
        if (!room.pending.delete(peerId)) {
          throw new ValidationError(
            'That request is no longer waiting.',
            'NO_SUCH_REQUEST'
          );
        }

        const peerSocket = io.sockets.sockets.get(peerId);
        if (peerSocket) peerSocket.data.pendingRoom = null;
        io.to(peerId).emit('join:denied', { roomName: room.name });
        return {};
      })
    );

    // ------------------------------------------------------------ signaling

    // SDP offers and answers ride the same channel; the description carries
    // its own type and the client's perfect-negotiation logic handles glare.
    socket.on(
      'signal:describe',
      handler(socket, 'signaling', (payload) => {
        const room = currentRoom(socket);
        const targetId = resolveTarget(room, payload.to);
        const description = cleanSessionDescription(payload.description);

        io.to(targetId).emit('signal:describe', {
          from: socket.id,
          description,
        });
        return {};
      })
    );

    socket.on(
      'signal:ice',
      handler(socket, 'signaling', (payload) => {
        const room = currentRoom(socket);
        const targetId = resolveTarget(room, payload.to);
        const candidate = cleanIceCandidate(payload.candidate);

        io.to(targetId).emit('signal:ice', { from: socket.id, candidate });
        return {};
      })
    );

    // ------------------------------------------------------------- presence

    socket.on(
      'peer:state',
      handler(socket, 'presence', (payload) => {
        const room = currentRoom(socket);
        const state = cleanPeerState(payload.state ?? payload);

        const participant = room.participants.get(socket.id);
        participant.state = state;

        socket.to(room.code).emit('peer:state', { id: socket.id, state });
        return {};
      })
    );

    // ----------------------------------------------------------------- chat

    socket.on(
      'chat:send',
      handler(socket, 'chat', (payload) => {
        const room = currentRoom(socket);
        const body = cleanMessageBody(payload.body);

        const sender = room.participants.get(socket.id);
        const isPrivate = payload.to != null;

        if (!isPrivate) {
          const message = registry.appendMessage(
            room,
            createMessage({
              from: socket.id,
              fromName: sender.displayName,
              body,
            })
          );
          io.to(room.code).emit('chat:message', { message });
          return { message };
        }

        // Private messages are relayed to exactly two sockets and never
        // written to room history, so they cannot be replayed to a later
        // joiner or read out of room state.
        const targetId = resolveTarget(room, payload.to);
        if (targetId === socket.id) {
          throw new ValidationError('You cannot message yourself.');
        }

        const message = createMessage({
          from: socket.id,
          fromName: sender.displayName,
          body,
          to: targetId,
        });

        io.to(targetId).emit('chat:message', { message });
        return { message };
      })
    );

    // ------------------------------------------------------------ teardown

    socket.on('disconnecting', () => {
      // Fires while room membership is still intact, which is what makes a
      // clean broadcast possible. The original server had no disconnect
      // handling at all, so a closed tab left a ghost participant forever.
      releaseParticipant(io, socket, { reason: 'disconnected' });

      const pendingCode = socket.data.pendingRoom;
      if (pendingCode) {
        const room = registry.get(pendingCode);
        if (room?.pending.delete(socket.id)) {
          io.to(room.adminId).emit('join:withdrawn', { id: socket.id });
        }
      }
    });

    socket.on('error', (error) => {
      console.error(`[signal] socket ${socket.id} error:`, error?.message);
    });
  });

  return registry;
}

export { registry };
export default registerSignaling;
