import { randomBytes, randomUUID } from 'node:crypto';
import config from './config.js';
import { ROOM_CODE_PATTERN } from './validation.js';

const { limits } = config;

// Deliberately excludes I, O, 0, 1 — room codes get read aloud over the phone
// and typed from memory, and those four are where transcription errors live.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Cryptographically uniform room code, formatted ABCD-1234-EFGH.
 *
 * Rejection sampling rather than `byte % alphabet.length`, which would bias
 * toward the first 8 characters of a 32-symbol alphabet. 60 bits of entropy is
 * far beyond guessable for a resource that also expires.
 */
function generateRoomCode() {
  const chars = [];

  while (chars.length < 12) {
    for (const byte of randomBytes(32)) {
      // 256 is a clean multiple of 32, so masking is already unbiased here;
      // the mask is kept explicit so the alphabet can change safely.
      const index = byte & (CODE_ALPHABET.length - 1);
      if (index >= CODE_ALPHABET.length) continue;
      chars.push(CODE_ALPHABET[index]);
      if (chars.length === 12) break;
    }
  }

  const code = chars.join('').match(/.{4}/g).join('-');
  // Belt and braces: the alphabet guarantees this, but the client contract
  // depends on it, so it is asserted rather than assumed.
  return ROOM_CODE_PATTERN.test(code) ? code : generateRoomCode();
}

export class RoomRegistry {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  create({ code = generateRoomCode(), name, requireAuth, adminId, adminName }) {
    // Collisions are astronomically unlikely, but "astronomically unlikely"
    // still means "handle it" when the failure mode is hijacking a live call.
    let roomCode = code;
    while (this.rooms.has(roomCode)) roomCode = generateRoomCode();

    const room = {
      code: roomCode,
      name,
      requireAuth,
      adminId,
      createdAt: Date.now(),
      participants: new Map(),
      pending: new Map(),
      history: [],
      destroyTimer: null,
    };

    room.participants.set(adminId, {
      id: adminId,
      displayName: adminName,
      joinedAt: Date.now(),
      state: { audio: true, video: true, screen: false, handRaised: false },
    });

    this.rooms.set(roomCode, room);
    return room;
  }

  get(code) {
    return this.rooms.get(code) ?? null;
  }

  /**
   * A room with no participants is not destroyed immediately — the last person
   * out may simply be reloading the page, and nuking the room under them (plus
   * everyone's chat history) is a worse failure than a minute of memory.
   */
  scheduleCleanup(room) {
    if (room.participants.size > 0) {
      this.cancelCleanup(room);
      return;
    }
    if (room.destroyTimer) return;

    room.destroyTimer = setTimeout(() => {
      if (room.participants.size === 0) this.rooms.delete(room.code);
    }, limits.emptyRoomTtlMs);

    // Never let a pending cleanup hold the process open.
    room.destroyTimer.unref?.();
  }

  cancelCleanup(room) {
    if (!room.destroyTimer) return;
    clearTimeout(room.destroyTimer);
    room.destroyTimer = null;
  }

  /**
   * Removes a participant and returns what the caller must broadcast.
   * Handles the case the original code did not: the room owner leaving.
   */
  removeParticipant(room, socketId) {
    const removed = room.participants.delete(socketId);
    room.pending.delete(socketId);

    let newAdminId = null;
    if (removed && room.adminId === socketId && room.participants.size > 0) {
      // Ownership passes to whoever has been in the room longest, so a room
      // never ends up with join-auth enabled and nobody able to approve.
      const [next] = [...room.participants.values()].sort(
        (a, b) => a.joinedAt - b.joinedAt
      );
      room.adminId = next.id;
      newAdminId = next.id;
    }

    this.scheduleCleanup(room);
    return { removed, newAdminId };
  }

  appendMessage(room, message) {
    room.history.push(message);
    // Bounded history: an all-day room must not become an unbounded array.
    if (room.history.length > limits.maxRoomHistory) {
      room.history.splice(0, room.history.length - limits.maxRoomHistory);
    }
    return message;
  }

  get size() {
    return this.rooms.size;
  }

  get participantCount() {
    let total = 0;
    for (const room of this.rooms.values()) total += room.participants.size;
    return total;
  }
}

export function createMessage({ from, fromName, body, to = null }) {
  return {
    id: randomUUID(),
    from,
    fromName,
    to,
    body,
    at: Date.now(),
    private: to !== null,
  };
}

/**
 * The wire shape of a room.
 *
 * This function is the reason the original `roomJoined` bug cannot recur: the
 * old server emitted its internal room object directly, which held live Socket
 * instances under `requests`. Serialization is explicit and allowlisted here —
 * internal fields cannot leak by being added to the model later.
 */
export function serializeRoom(room, { forSocketId } = {}) {
  const isAdmin = room.adminId === forSocketId;

  return {
    code: room.code,
    name: room.name,
    requireAuth: room.requireAuth,
    adminId: room.adminId,
    isAdmin,
    createdAt: room.createdAt,
    participants: [...room.participants.values()].map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      joinedAt: participant.joinedAt,
      state: participant.state,
    })),
    // Only the room owner ever sees who is waiting at the door.
    pending: isAdmin
      ? [...room.pending.values()].map(({ id, displayName, requestedAt }) => ({
          id,
          displayName,
          requestedAt,
        }))
      : [],
    // Private messages are never replayed from history — a joiner must not
    // receive DMs that were exchanged between other people before they arrived.
    history: room.history.filter((message) => !message.private),
  };
}

export { generateRoomCode };
export default RoomRegistry;
