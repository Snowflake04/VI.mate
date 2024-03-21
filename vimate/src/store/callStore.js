import { create } from 'zustand';

/**
 * Room, media, and peer state.
 *
 * Deliberately separate from chat and telemetry. The video grid subscribes
 * here, and telemetry updates twice a second — if they shared a store, every
 * bitrate sample would re-render every `<video>` wrapper in the call. Splitting
 * by update frequency is the cheapest performance win available.
 */

const initialState = {
  // --- signaling transport -------------------------------------------------
  socketStatus: 'idle', // idle | connecting | connected | reconnecting | offline
  reconnectAttempt: 0,
  selfId: null,

  // --- room ----------------------------------------------------------------
  phase: 'idle', // idle | working | pending | in-room | denied | error
  room: null,
  error: null,
  pendingRoomName: null,

  // --- local media ---------------------------------------------------------
  mediaStatus: 'idle', // idle | requesting | ready | denied | unavailable | insecure
  mediaError: null,
  localStream: null,
  micOn: true,
  camOn: true,
  screenOn: false,
  /**
   * What you are sharing, so your own featured tile shows it.
   *
   * Without this the sharer sees their camera in the slot where everyone else
   * sees their screen — so the one person who cannot tell whether the share is
   * working is the one doing it.
   */
  screenStream: null,
  /**
   * While sharing: 'text' or 'motion', measured from the shared surface's own
   * frame rate. Null when not sharing. Drives what the encoder protects under
   * pressure, not the frame rate — see SCREEN_SHARE_MODES.
   */
  shareMode: null,

  /**
   * Video input devices, and which one is live.
   *
   * Populated only after permission is granted — before that the browser
   * returns entries with empty labels and, in Firefox, a single placeholder.
   * The switch control keys off `cameras.length > 1` rather than off being on a
   * phone: plenty of laptops have two, and plenty of phones expose more than
   * the obvious pair.
   */
  cameras: [],
  cameraId: null,


  // --- peers ---------------------------------------------------------------
  /** @type {Record<string, Peer>} */
  peers: {},
  peerOrder: [],

  // --- moderation ----------------------------------------------------------
  joinRequests: [],

  // --- diagnostics ---------------------------------------------------------
  iceInfo: null,
  tier: 'medium',
  deviceProfile: null,
};

export const useCallStore = create((set, get) => ({
  ...initialState,

  setSocketStatus: (socketStatus, reconnectAttempt) =>
    set((state) => ({
      socketStatus,
      reconnectAttempt: reconnectAttempt ?? state.reconnectAttempt,
    })),

  setSelfId: (selfId) => set({ selfId }),
  setPhase: (phase) => set({ phase }),
  setError: (error) => set({ error, phase: error ? 'error' : get().phase }),
  clearError: () => set({ error: null }),

  setPendingRoom: (pendingRoomName) =>
    set({ pendingRoomName, phase: 'pending', error: null }),

  setRoom: (room) =>
    set({
      room,
      phase: 'in-room',
      error: null,
      pendingRoomName: null,
    }),

  updateRoom: (patch) =>
    set((state) => (state.room ? { room: { ...state.room, ...patch } } : {})),

  setMedia: (patch) => set(patch),

  setCameras: (cameras, cameraId) =>
    set((state) => ({ cameras, cameraId: cameraId ?? state.cameraId })),

  setLocalStream: (localStream) =>
    set({
      localStream,
      micOn: localStream?.getAudioTracks()[0]?.enabled ?? false,
      camOn: localStream?.getVideoTracks()[0]?.enabled ?? false,
    }),

  // --- peers ---------------------------------------------------------------

  addPeer: (peer) =>
    set((state) => {
      if (state.peers[peer.id]) return {};
      return {
        peers: {
          ...state.peers,
          [peer.id]: {
            id: peer.id,
            displayName: peer.displayName,
            joinedAt: peer.joinedAt,
            // What the peer says about itself (mic/cam/screen).
            state: peer.state ?? {
              audio: true,
              video: true,
              screen: false,
              handRaised: false,
            },
            // What the transport says about the connection to them.
            link: {
              connectionState: 'new',
              iceConnectionState: 'new',
              hasVideoTrack: false,
              hasAudio: false,
              recovering: false,
            },
            stream: null,
          },
        },
        peerOrder: [...state.peerOrder, peer.id],
      };
    }),

  removePeer: (id) =>
    set((state) => {
      if (!state.peers[id]) return {};
      const peers = { ...state.peers };
      delete peers[id];
      return {
        peers,
        peerOrder: state.peerOrder.filter((peerId) => peerId !== id),
      };
    }),

  /**
   * Patches one peer without cloning the others.
   *
   * Returning `{}` when nothing actually changed matters: zustand bails out of
   * notifying subscribers on an unchanged snapshot, so a redundant transport
   * event costs zero renders.
   */
  patchPeer: (id, patch) =>
    set((state) => {
      const existing = state.peers[id];
      if (!existing) return {};
      return { peers: { ...state.peers, [id]: { ...existing, ...patch } } };
    }),

  patchPeerLink: (id, link) =>
    set((state) => {
      const existing = state.peers[id];
      if (!existing) return {};

      const merged = { ...existing.link, ...link };
      const unchanged = Object.keys(merged).every(
        (key) => merged[key] === existing.link[key]
      );
      if (unchanged) return {};

      return {
        peers: { ...state.peers, [id]: { ...existing, link: merged } },
      };
    }),

  patchPeerState: (id, peerState) =>
    set((state) => {
      const existing = state.peers[id];
      if (!existing) return {};
      return {
        peers: {
          ...state.peers,
          [id]: { ...existing, state: { ...existing.state, ...peerState } },
        },
      };
    }),

  setPeerStream: (id, stream) =>
    set((state) => {
      const existing = state.peers[id];
      if (!existing || existing.stream === stream) return {};
      return { peers: { ...state.peers, [id]: { ...existing, stream } } };
    }),

  replaceParticipants: (participants, selfId) =>
    set(() => {
      const peers = {};
      const peerOrder = [];

      for (const participant of participants) {
        if (participant.id === selfId) continue;
        peers[participant.id] = {
          id: participant.id,
          displayName: participant.displayName,
          joinedAt: participant.joinedAt,
          state: participant.state,
          link: {
            connectionState: 'new',
            iceConnectionState: 'new',
            hasVideoTrack: false,
            hasAudio: false,
            recovering: false,
          },
          stream: null,
        };
        peerOrder.push(participant.id);
      }

      return { peers, peerOrder };
    }),

  // --- moderation ----------------------------------------------------------

  addJoinRequest: (request) =>
    set((state) =>
      state.joinRequests.some((r) => r.id === request.id)
        ? {}
        : { joinRequests: [...state.joinRequests, request] }
    ),

  removeJoinRequest: (id) =>
    set((state) => ({
      joinRequests: state.joinRequests.filter((request) => request.id !== id),
    })),

  setJoinRequests: (joinRequests) => set({ joinRequests }),

  // --- diagnostics ---------------------------------------------------------

  setIceInfo: (iceInfo) => set({ iceInfo }),
  setTier: (tier) => set({ tier }),
  setDeviceProfile: (deviceProfile) => set({ deviceProfile }),

  /** Full reset when leaving a call, so a second call never inherits stale peers. */
  resetCall: () =>
    set((state) => ({
      ...initialState,
      // Transport and hardware survive; only call-scoped state is cleared.
      socketStatus: state.socketStatus,
      selfId: state.selfId,
      iceInfo: state.iceInfo,
      deviceProfile: state.deviceProfile,
      localStream: state.localStream,
      mediaStatus: state.mediaStatus,
      micOn: state.micOn,
      camOn: state.camOn,
      cameras: state.cameras,
      cameraId: state.cameraId,
    })),
}));

// --- selectors ------------------------------------------------------------
// Exported as stable references so components can subscribe to one slice
// rather than the whole store.

export const selectPeerIds = (state) => state.peerOrder;
export const selectRoom = (state) => state.room;
export const selectPhase = (state) => state.phase;
export const selectSelfId = (state) => state.selfId;
export const selectLocalStream = (state) => state.localStream;

export const makeSelectPeer = (id) => (state) => state.peers[id];

export default useCallStore;
