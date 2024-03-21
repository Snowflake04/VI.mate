import { create } from 'zustand';

/**
 * Chat lives in its own store so an incoming message never re-renders the
 * video grid, and a peer reconnecting never re-renders the transcript.
 *
 * Threads are keyed by conversation: `'group'` for the room, and a peer id for
 * each private 1:1. That shape is what makes DMs a first-class feature rather
 * than a flag on a message — unread counts, drafts, and the active thread all
 * fall out of it.
 */

export const GROUP_THREAD = 'group';

const initialState = {
  /** @type {Record<string, Message[]>} */
  threads: { [GROUP_THREAD]: [] },
  /** @type {Record<string, number>} */
  unread: {},
  activeThread: GROUP_THREAD,
  /** Preserved per thread so switching conversations does not lose a draft. */
  drafts: {},
};

/** Chooses the thread a message belongs to from the perspective of `selfId`. */
function threadIdFor(message, selfId) {
  if (!message.private) return GROUP_THREAD;
  return message.from === selfId ? message.to : message.from;
}

export const useChatStore = create((set, get) => ({
  ...initialState,

  ingest: (message, selfId) =>
    set((state) => {
      const threadId = threadIdFor(message, selfId);
      const existing = state.threads[threadId] ?? [];

      // The sender echoes its own message locally for instant feedback, and
      // the server may also deliver it. Dedupe on the server-assigned id.
      if (message.id && existing.some((entry) => entry.id === message.id)) {
        return {};
      }

      const isMine = message.from === selfId;
      const isActive = state.activeThread === threadId;

      return {
        threads: { ...state.threads, [threadId]: [...existing, message] },
        unread:
          isMine || isActive
            ? state.unread
            : {
                ...state.unread,
                [threadId]: (state.unread[threadId] ?? 0) + 1,
              },
      };
    }),

  hydrateGroup: (messages) =>
    set((state) => ({ threads: { ...state.threads, [GROUP_THREAD]: messages } })),

  setActiveThread: (threadId) =>
    set((state) => {
      const unread = { ...state.unread };
      delete unread[threadId];
      return { activeThread: threadId, unread };
    }),

  setDraft: (threadId, value) =>
    set((state) => ({ drafts: { ...state.drafts, [threadId]: value } })),

  /** Drops a private thread when the other party leaves the room. */
  closeThread: (threadId) =>
    set((state) => {
      if (threadId === GROUP_THREAD) return {};
      const unread = { ...state.unread };
      delete unread[threadId];
      return {
        activeThread:
          state.activeThread === threadId ? GROUP_THREAD : state.activeThread,
        unread,
      };
    }),

  totalUnread: () =>
    Object.values(get().unread).reduce((sum, count) => sum + count, 0),

  reset: () => set({ ...initialState, threads: { [GROUP_THREAD]: [] } }),
}));

export const selectActiveThread = (state) => state.activeThread;
export const selectUnread = (state) => state.unread;

export default useChatStore;
