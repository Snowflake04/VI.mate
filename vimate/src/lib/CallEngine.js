import { io } from 'socket.io-client';

import { SIGNALING_URL, IS_SECURE_CONTEXT, SUPPORTS_WEBRTC } from './env.js';
import { PeerLink } from './rtc/PeerLink.js';
import {
  mediaConstraints,
  captureTier,
  profileDevice,
  tierForRoom,
  stepDown,
  stepUp,
  isLowerThan,
  bestTierFor,
  SCREEN_SHARE_MODES,
  TIERS,
} from './rtc/constraints.js';
import { createMirroredStream } from './media/mirror.js';
import { watchShareMotion } from './media/shareMotion.js';
import * as meter from './audio/AudioMeter.js';
import * as sound from './audio/sound.js';

import { useCallStore } from '../store/callStore.js';
import { useChatStore, GROUP_THREAD } from '../store/chatStore.js';
import { useStatsStore } from '../store/statsStore.js';
import { useUIStore } from '../store/uiStore.js';

/** How often peer telemetry is sampled. */
const STATS_INTERVAL_MS = 1000;
/**
 * How long overuse must persist before dropping a tier.
 *
 * Matches libwebrtc's QualityScaler measurement window (kMeasureMs = 2000).
 * Short, because the cost of reacting late to congestion is frozen video for
 * everyone, while the cost of reacting early is a couple of seconds of lower
 * resolution.
 */
const OVERUSE_CONFIRM_MS = 2000;

/**
 * How long headroom must hold before climbing.
 *
 * libwebrtc multiplies its 2s window by 2.5 after a downscale before it will
 * consider scaling back up, so ~5s is the figure the reference implementation
 * settled on for exactly this decision.
 */
const UPGRADE_HOLD_MS = 5000;

/**
 * Headroom required before taking a higher tier.
 *
 * Climbing the moment the estimate merely touches the next tier's cost
 * guarantees an immediate drop back — visible as flickering quality — so a
 * tier must look comfortably affordable, not just barely.
 */
const UPGRADE_HEADROOM = 1.3;

/**
 * ---------------------------------------------------------------------------
 * CallEngine
 * ---------------------------------------------------------------------------
 * Owns the socket, the local media, and the peer mesh, and writes results into
 * the zustand stores. Nothing in this file renders — React subscribes to the
 * stores and never talks to a RTCPeerConnection directly.
 *
 * It is a singleton because the resources it holds are singletons: one camera,
 * one microphone, one signaling connection. The old code approximated this with
 * a module-level `let peer` and a `getPeer()` that quietly constructed a *new*
 * socket if called before the first one settled.
 * ---------------------------------------------------------------------------
 */
class CallEngine {
  constructor() {
    this.socket = null;
    /** @type {Map<string, PeerLink>} */
    this.links = new Map();

    this.localStream = null;
    this.cameraStream = null;
    this.screenStream = null;
    /** Watches shared content so the encoder is told what to protect. */
    this.shareWatcher = null;
    this.shareMode = 'text';
    /** Holds the sender-side mirror pipeline so it can be torn down. */
    this.mirror = null;
    /** The camera's real capture format, which the mirrored track does not report. */
    this.captureSize = null;

    this.rtcConfig = { iceServers: [] };
    this.deviceProfile = null;
    this.tier = 'medium';
    this.baseTier = 'medium';

    this.statsTimer = null;
    /** Timestamps for the AIMD hold-downs; null means "not currently in that state". */
    this.overuseSince = null;
    this.underuseSince = null;

    /** Remembered so we can rejoin after a socket reconnect. */
    this.identity = null;
    this.started = false;
  }

  // ============================================================== transport

  /** Idempotent — safe to call from React effects that may run twice. */
  async start() {
    if (this.started) return;
    this.started = true;

    this.deviceProfile = profileDevice();
    this.baseTier = this.deviceProfile.tier;
    this.tier = this.baseTier;
    useCallStore.getState().setDeviceProfile(this.deviceProfile);
    useCallStore.getState().setTier(this.tier);

    await this.#loadIceConfig();
    this.#connectSocket();
  }

  /**
   * ICE configuration comes from the server so TURN credentials never ship in
   * the bundle. A failure here is survivable — we fall back to public STUN and
   * flag that TURN is unavailable, rather than refusing to start a call.
   */
  async #loadIceConfig() {
    try {
      const response = await fetch(`${SIGNALING_URL}/api/ice`, {
        credentials: 'omit',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const config = await response.json();
      this.rtcConfig = {
        iceServers: config.iceServers ?? [],
        iceTransportPolicy: config.iceTransportPolicy ?? 'all',
        iceCandidatePoolSize: config.iceCandidatePoolSize ?? 0,
        bundlePolicy: config.bundlePolicy ?? 'max-bundle',
        rtcpMuxPolicy: config.rtcpMuxPolicy ?? 'require',
      };
      useCallStore.getState().setIceInfo({
        turnConfigured: Boolean(config.turnConfigured),
        transportPolicy: config.iceTransportPolicy,
        serverCount: config.iceServers?.length ?? 0,
        source: 'server',
      });
    } catch (error) {
      console.warn('[rtc] falling back to public STUN', error);
      this.rtcConfig = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        iceTransportPolicy: 'all',
      };
      useCallStore.getState().setIceInfo({
        turnConfigured: false,
        transportPolicy: 'all',
        serverCount: 1,
        source: 'fallback',
      });
    }
  }

  #connectSocket() {
    const store = useCallStore.getState();
    store.setSocketStatus('connecting');

    this.socket = io(SIGNALING_URL, {
      transports: ['websocket', 'polling'],
      // Socket.IO's own backoff. The original client configured none of this
      // and had no visible reconnection behaviour at all — a dropped signaling
      // socket meant the call was over with no indication why.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.5,
      timeout: 10_000,
    });

    this.#wireSocket();
  }

  #wireSocket() {
    const socket = this.socket;
    const call = () => useCallStore.getState();
    const chat = () => useChatStore.getState();

    socket.on('connect', () => {
      call().setSocketStatus('connected', 0);
      call().setSelfId(socket.id);

      // `recovered` means the server replayed our session — room membership
      // and any missed events survived, so there is nothing to rebuild.
      if (socket.recovered) {
        useUIStore.getState().pushToast({
          tone: 'nominal',
          text: 'Signal restored — session recovered',
        });
        return;
      }

      // A fresh session means a new socket id, so every peer must rebuild.
      if (this.identity) this.#rejoinAfterReconnect();
    });

    socket.on('session:ready', ({ id }) => call().setSelfId(id));

    socket.io.on('reconnect_attempt', (attempt) => {
      call().setSocketStatus('reconnecting', attempt);
    });

    socket.on('disconnect', (reason) => {
      // An explicit client/server disconnect is not a failure state.
      if (reason === 'io client disconnect') {
        call().setSocketStatus('idle');
        return;
      }
      call().setSocketStatus('reconnecting');
      useUIStore.getState().pushToast({
        tone: 'caution',
        text: 'Signal lost — reconnecting',
      });
    });

    socket.io.on('reconnect_failed', () => {
      call().setSocketStatus('offline');
      useUIStore.getState().pushToast({
        tone: 'critical',
        text: 'Could not reach the signaling server',
      });
    });

    socket.on('connect_error', () => {
      if (call().socketStatus !== 'reconnecting') {
        call().setSocketStatus('reconnecting');
      }
    });

    // ------------------------------------------------------------- room ---

    socket.on('room:joined', ({ room, selfId }) => {
      call().setSelfId(selfId);
      call().setRoom({
        code: room.code,
        name: room.name,
        requireAuth: room.requireAuth,
        adminId: room.adminId,
        isAdmin: room.isAdmin,
        createdAt: room.createdAt,
      });
      call().replaceParticipants(room.participants, selfId);
      call().setJoinRequests(room.pending ?? []);
      chat().hydrateGroup(room.history ?? []);

      this.#retune(room.participants.length);

      // We are the newcomer: open a link to everyone already here. Perfect
      // negotiation means it does not matter that they are doing the same.
      for (const participant of room.participants) {
        if (participant.id === selfId) continue;
        this.#openLink(participant.id);
      }
    });

    socket.on('peer:joined', ({ peer }) => {
      call().addPeer(peer);
      this.#retune();
      this.#openLink(peer.id);
      sound.play('join');
      useUIStore.getState().pushToast({
        tone: 'nominal',
        text: `${peer.displayName} joined`,
      });
    });

    socket.on('peer:left', ({ id }) => {
      const peer = useCallStore.getState().peers[id];
      this.#closeLink(id);
      call().removePeer(id);
      useStatsStore.getState().drop(id);
      chat().closeThread(id);
      meter.detach(id);
      this.#retune();

      if (useUIStore.getState().spotlightId === id) {
        useUIStore.getState().setSpotlight(null);
      }

      sound.play('leave');
      if (peer) {
        useUIStore.getState().pushToast({
          tone: 'caution',
          text: `${peer.displayName} left`,
        });
      }
    });

    socket.on('peer:state', ({ id, state }) => {
      call().patchPeerState(id, state);
    });

    socket.on('room:admin', ({ adminId }) => {
      call().updateRoom({ adminId, isAdmin: adminId === socket.id });
      if (adminId === socket.id) {
        useUIStore.getState().pushToast({
          tone: 'caution',
          text: 'You are now the room owner',
        });
      }
    });

    // ------------------------------------------------------- moderation ---

    socket.on('join:request', (request) => {
      call().addJoinRequest(request);
      sound.play('request');
    });

    socket.on('join:withdrawn', ({ id }) => call().removeJoinRequest(id));
    socket.on('join:backlog', ({ pending }) => call().setJoinRequests(pending));

    socket.on('join:denied', ({ roomName }) => {
      call().setPhase('denied');
      call().setError({
        code: 'DENIED',
        message: `The owner of "${roomName}" declined your request.`,
      });
    });

    // -------------------------------------------------------- signalling ---

    socket.on('signal:describe', async ({ from, description }) => {
      const link = this.links.get(from) ?? this.#openLink(from);
      await link?.acceptDescription(description);
    });

    socket.on('signal:ice', async ({ from, candidate }) => {
      const link = this.links.get(from) ?? this.#openLink(from);
      await link?.acceptCandidate(candidate);
    });

    // -------------------------------------------------------------- chat ---

    socket.on('chat:message', ({ message }) => {
      const selfId = useCallStore.getState().selfId;
      chat().ingest(message, selfId);
      if (message.from === selfId) return;

      sound.play(message.private ? 'whisper' : 'message');

      /*
       * Tell them a message arrived, if they cannot already see it.
       *
       * A chime and a badge were the only signals, and neither says *what* was
       * said or *who* said it — so anyone who had the chat closed had to open
       * it to find out whether it mattered. Nothing is shown when the relevant
       * thread is already on screen, because then they are looking at it.
       */
      const ui = useUIStore.getState();
      const thread = message.private ? message.from : GROUP_THREAD;
      const alreadyVisible =
        ui.isPanelOpen &&
        ui.sidePanel === 'chat' &&
        useChatStore.getState().activeThread === thread;
      if (alreadyVisible) return;

      /*
       * Never preview a message while the screen is being shared.
       *
       * The notification is on your own display, which during a share is
       * everybody's display. A private message is exactly the thing that must
       * not be broadcast to the room because it happened to arrive at the wrong
       * moment, so while sharing the toast says that something arrived and
       * nothing about what it said.
       */
      const sharing = useCallStore.getState().screenOn;

      ui.pushToast({
        tone: message.private ? 'accent' : 'ink-3',
        title: message.private
          ? `${message.fromName} · privately`
          : message.fromName,
        text: sharing ? 'New message' : message.body,
        onAction: () => {
          useChatStore.getState().setActiveThread(thread);
          useUIStore.getState().openPanel('chat');
        },
      });
    });

    socket.on('rate:limited', ({ retryAfter }) => {
      useUIStore.getState().pushToast({
        tone: 'caution',
        text: `Too fast — try again in ${retryAfter}s`,
      });
    });
  }

  /** Re-enters the room after the socket came back with a new identity. */
  async #rejoinAfterReconnect() {
    const { roomCode, displayName } = this.identity;

    // Every peer link is bound to our old socket id and is now unreachable.
    for (const id of [...this.links.keys()]) this.#closeLink(id);
    useStatsStore.getState().reset();

    const response = await this.#emit('room:join', { displayName, roomCode });

    if (!response.ok) {
      useCallStore.getState().setError({
        code: response.code,
        message:
          response.code === 'NO_ROOM'
            ? 'The room ended while you were disconnected.'
            : response.error,
      });
      return;
    }

    if (response.status === 'pending') {
      useCallStore.getState().setPendingRoom(response.roomName);
    }
  }

  // ================================================================ media

  /**
   * Acquires camera and microphone, degrading rather than failing.
   *
   * Every branch below is a real state a user lands in, and each one gets a
   * specific message. The original code responded to all of them with a single
   * `alert('Please enable audio and video')` and then left `localStream`
   * undefined, so the next `addLocalTracks` threw and the call rendered as a
   * blank screen.
   */
  async acquireMedia() {
    const call = useCallStore.getState();

    if (!IS_SECURE_CONTEXT) {
      call.setMedia({
        mediaStatus: 'insecure',
        mediaError: {
          title: 'Insecure connection',
          detail:
            'Browsers only allow camera and microphone access over HTTPS. Open this page on https:// or localhost.',
        },
      });
      return null;
    }

    if (!SUPPORTS_WEBRTC) {
      call.setMedia({
        mediaStatus: 'unavailable',
        mediaError: {
          title: 'Unsupported browser',
          detail:
            'This browser does not support WebRTC. Try a current version of Chrome, Edge, Firefox, or Safari.',
        },
      });
      return null;
    }

    call.setMedia({ mediaStatus: 'requesting', mediaError: null });

    // Capture at the top of the ladder regardless of device score; the device
    // score governs the *encoder* tier, never the capture format. See
    // captureTier for why the two must not be the same decision.
    const openTier = captureTier(this.deviceProfile);

    const attempts = [
      mediaConstraints(openTier),
      // A camera that cannot satisfy the ideal ladder still works unconstrained.
      { audio: true, video: true },
      // Audio-only is a legitimate way to be in a meeting.
      { audio: true, video: false },
    ];

    let lastError = null;

    for (const constraints of attempts) {
      try {
        const camera = await navigator.mediaDevices.getUserMedia(constraints);

        /*
         * Everything downstream — preview, publishing, the audio meter — uses
         * the mirrored stream. `cameraStream` stays the raw device, because
         * that is what has to be stopped to release the camera and what
         * reports the true capture format to the quality ladder.
         */
        this.#disposeMirror();
        this.mirror = createMirroredStream(camera);

        const stream = this.mirror.stream;
        this.cameraStream = camera;
        this.localStream = stream;
        this.captureSize = camera.getVideoTracks()[0]?.getSettings?.() ?? null;
        for (const link of this.links.values()) link.setCaptureSize(this.captureSize);
        await this.#refreshCameras();

        call.setLocalStream(stream);
        call.setMedia({
          mediaStatus: 'ready',
          mediaError:
            constraints.video === false
              ? {
                  tone: 'caution',
                  title: 'Microphone only',
                  detail:
                    'No camera was available, so you have joined with audio only.',
                }
              : null,
        });

        meter.attach('self', stream);
        await meter.resumeAudioContext();
        this.#watchDeviceChanges();

        // Any connection opened before the camera resolved has no outbound
        // tracks yet. Push them in now — otherwise a peer who joined a busy
        // room would be seen and heard by nobody, with every indicator
        // insisting the call was healthy.
        await this.#publishToAllLinks(stream);

        return stream;
      } catch (error) {
        lastError = error;
        // Permission refusal is final — retrying with looser constraints just
        // prompts the user again for something they already declined.
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          break;
        }
      }
    }

    call.setMedia({
      mediaStatus: lastError?.name === 'NotAllowedError' ? 'denied' : 'unavailable',
      mediaError: describeMediaError(lastError),
    });
    return null;
  }

  /**
   * Enumerates video inputs.
   *
   * Only meaningful once permission has been granted — before that, labels come
   * back empty and some browsers report a single placeholder device, so calling
   * this earlier would hide the switch on a phone that plainly has two cameras.
   */
  async #refreshCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));

      const live = this.cameraStream?.getVideoTracks()[0]?.getSettings?.().deviceId;
      useCallStore.getState().setCameras(cameras, live ?? null);
    } catch {
      // Enumeration is a nicety; failing it must not affect the call.
    }
  }

  /** Cycles to the next video input. Returns its label, or null if it failed. */
  async switchCamera() {
    const { cameras, cameraId } = useCallStore.getState();
    if (cameras.length < 2) return null;

    const index = cameras.findIndex((camera) => camera.deviceId === cameraId);
    const next = cameras[(index + 1) % cameras.length];
    return this.#useCamera(next);
  }

  /**
   * Opens a specific camera and swaps it into the call.
   *
   * `replaceTrack` rather than a fresh offer: swapping the track on the existing
   * senders needs no renegotiation, so nobody's video freezes while SDP goes
   * round trip. The microphone track is carried across untouched — switching
   * camera must not drop your audio mid-sentence.
   */
  async #useCamera(camera) {
    const previous = this.cameraStream?.getVideoTracks()[0];
    const wasEnabled = previous?.enabled ?? true;

    const base = mediaConstraints(captureTier(this.deviceProfile));
    // deviceId and facingMode fight each other; the explicit device wins.
    const { facingMode: _ignored, ...video } = base.video;

    let opened;
    try {
      opened = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...video, deviceId: { exact: camera.deviceId } },
      });
    } catch (error) {
      useUIStore.getState().pushToast({
        tone: 'caution',
        text: `Could not open ${camera.label}`,
      });
      console.warn('[media] camera switch failed', error);
      return null;
    }

    const videoTrack = opened.getVideoTracks()[0];
    if (!videoTrack) return null;
    videoTrack.enabled = wasEnabled;

    // Release the old device before publishing the new one, or a phone with a
    // single ISP refuses the second camera while the first is still held.
    previous?.stop();
    this.#disposeMirror();

    const audio = this.cameraStream?.getAudioTracks() ?? [];
    const combined = new MediaStream([videoTrack, ...audio]);

    this.cameraStream = combined;
    this.mirror = createMirroredStream(combined);
    this.localStream = this.mirror.stream;
    this.captureSize = videoTrack.getSettings?.() ?? null;

    useCallStore.getState().setLocalStream(this.localStream);
    meter.attach('self', this.localStream);

    for (const link of this.links.values()) link.setCaptureSize(this.captureSize);

    /*
     * While a screen share is live the senders carry the shared surface, and
     * replacing their video track would swap the presentation for a face. The
     * new camera is still adopted locally, so stopping the share returns to it.
     */
    if (!this.screenStream) {
      await Promise.all(
        [...this.links.values()].map((link) =>
          link.replaceTracks(this.localStream, { isScreenShare: false })
        )
      );
    }

    await this.#refreshCameras();
    return camera.label;
  }

  /** Tears down the mirror pipeline, if one is running. */
  #disposeMirror() {
    this.mirror?.stop();
    this.mirror = null;
  }

  async #publishToAllLinks(stream) {
    await Promise.all(
      [...this.links.values()].map((link) => link.publishStream(stream))
    );
  }

  /** A camera being unplugged mid-call should not freeze the tile silently. */
  #watchDeviceChanges() {
    if (this.deviceListener || !navigator.mediaDevices) return;

    this.deviceListener = () => {
      this.#refreshCameras();
      const track = this.cameraStream?.getVideoTracks()[0];
      if (track && track.readyState === 'ended') {
        useUIStore.getState().pushToast({
          tone: 'caution',
          text: 'Camera disconnected',
        });
        useCallStore.getState().setMedia({ camOn: false });
      }
    };
    navigator.mediaDevices.addEventListener(
      'devicechange',
      this.deviceListener
    );
  }

  toggleMic() {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return false;

    track.enabled = !track.enabled;
    useCallStore.getState().setMedia({ micOn: track.enabled });
    sound.play(track.enabled ? 'unmute' : 'mute');
    this.#publishState();
    return track.enabled;
  }

  toggleCamera() {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return false;

    track.enabled = !track.enabled;
    /*
     * Gate the camera itself as well as the track we publish. With sender-side
     * mirroring those are two different tracks, and disabling only the
     * published one would leave the device capturing and the mirror pipeline
     * transforming frames that go nowhere.
     */
    for (const source of this.cameraStream?.getVideoTracks() ?? []) {
      source.enabled = track.enabled;
    }
    useCallStore.getState().setMedia({ camOn: track.enabled });
    this.#publishState();
    return track.enabled;
  }

  async startScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) return false;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          /*
           * 30, not the 8 this used to ask for. getDisplayMedia fixes the
           * capture format exactly as getUserMedia does, so a share opened at 8
           * can never carry video however the encoder is later configured. A
           * static document still costs nothing at this ceiling: screen capture
           * only produces a frame when the surface changes.
           */
          frameRate: { ideal: 30, max: 30 },
          // Prefers the whole window/screen rather than cropping to the tab.
          displaySurface: 'monitor',
        },
        // Requested, but frequently refused by the OS or the user — which is
        // exactly the case the old code mishandled.
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
        },
      });

      this.screenStream = stream;

      const shareTrack = stream.getVideoTracks()[0];

      /*
       * Start as text and let the measurement move us. A share that opens on a
       * document and is encoded as motion looks wrong immediately; the reverse
       * corrects itself within a couple of seconds of playback starting.
       */
      this.shareMode = 'text';
      if (shareTrack) shareTrack.contentHint = 'text';

      this.shareWatcher = watchShareMotion(shareTrack, (mode) => {
        if (!this.screenStream || mode === this.shareMode) return;
        this.shareMode = mode;
        if (shareTrack) shareTrack.contentHint = SCREEN_SHARE_MODES[mode].contentHint;
        for (const link of this.links.values()) link.setShareMode(mode);
        useCallStore.getState().setMedia({ shareMode: mode });
      });

      useCallStore.getState().setMedia({ shareMode: 'text', screenStream: stream });

      await Promise.all(
        [...this.links.values()].map((link) =>
          link.replaceTracks(stream, { isScreenShare: true, shareMode: 'text' })
        )
      );

      // The browser's own "Stop sharing" bar is outside our UI, so the track's
      // end event is the only reliable signal that sharing finished.
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopScreenShare();
      });

      useCallStore.getState().setMedia({ screenOn: true });
      this.#publishState();
      return true;
    } catch (error) {
      // AbortError/NotAllowedError here means the user dismissed the picker,
      // which is a normal outcome and must not surface as an error.
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        console.error('[rtc] screen share failed', error);
        useUIStore.getState().pushToast({
          tone: 'critical',
          text: 'Screen share unavailable',
        });
      }
      return false;
    }
  }

  async stopScreenShare() {
    if (!this.screenStream) return;

    for (const track of this.screenStream.getTracks()) track.stop();
    this.screenStream = null;

    if (this.localStream) {
      await Promise.all(
        [...this.links.values()].map((link) =>
          link.replaceTracks(this.localStream, { isScreenShare: false })
        )
      );
    }

    useCallStore.getState().setMedia({ screenOn: false });
    this.#publishState();
  }

  #publishState() {
    if (!this.socket?.connected) return;
    const { micOn, camOn, screenOn } = useCallStore.getState();
    this.socket.emit('peer:state', {
      state: { audio: micOn, video: camOn, screen: screenOn, handRaised: false },
    });
  }

  // ================================================================= mesh

  #openLink(peerId) {
    if (this.links.has(peerId)) return this.links.get(peerId);
    if (!this.socket?.connected) return null;

    const selfId = this.socket.id;

    // Both ends compute this from the same two strings and always disagree,
    // which is precisely what perfect negotiation requires.
    const polite = selfId > peerId;

    const link = new PeerLink({
      peerId,
      polite,
      rtcConfig: this.rtcConfig,
      localStream: this.localStream,
      tier: this.tier,
      onSignal: ({ to, description, candidate }) => {
        if (description) this.socket.emit('signal:describe', { to, description });
        if (candidate) this.socket.emit('signal:ice', { to, candidate });
      },
      onRemoteStream: (id, stream) => {
        useCallStore.getState().setPeerStream(id, stream);
        meter.attach(id, stream);
      },
      onStateChange: (id, state) => {
        useCallStore.getState().patchPeerLink(id, state);
      },
      onRebuildRequest: (id) => this.#rebuildLink(id),
    });

    link.setCaptureSize(this.captureSize);
    this.links.set(peerId, link);
    this.#ensureStatsLoop();
    return link;
  }

  #closeLink(peerId) {
    const link = this.links.get(peerId);
    if (!link) return;
    link.close();
    this.links.delete(peerId);
    if (this.links.size === 0) this.#stopStatsLoop();
  }

  /**
   * Last-resort recovery: tear the connection down and negotiate a new one.
   * Picks up refreshed ICE (including new TURN credentials) on the way.
   */
  async #rebuildLink(peerId) {
    if (!useCallStore.getState().peers[peerId]) return;

    this.#closeLink(peerId);
    useCallStore.getState().patchPeerLink(peerId, {
      connectionState: 'connecting',
      recovering: true,
      hasVideoTrack: false,
    });

    await this.#loadIceConfig();
    // A short pause avoids a tight rebuild loop against a network that is
    // still down.
    setTimeout(() => {
      if (useCallStore.getState().peers[peerId]) this.#openLink(peerId);
    }, 1200);
  }

  // ============================================================ telemetry

  #ensureStatsLoop() {
    if (this.statsTimer) return;
    this.statsTimer = setInterval(() => this.#sampleStats(), STATS_INTERVAL_MS);
  }

  #stopStatsLoop() {
    if (!this.statsTimer) return;
    clearInterval(this.statsTimer);
    this.statsTimer = null;
  }

  async #sampleStats() {
    if (this.links.size === 0) return;

    const entries = await Promise.all(
      [...this.links.entries()].map(async ([id, link]) => [
        id,
        await link.sampleStats(),
      ])
    );

    useStatsStore.getState().updateMany(entries);
    this.#adaptQuality(entries.map(([, stats]) => stats));
  }

  /**
   * Closed-loop bitrate adaptation driven by measured quality.
   *
   * Asymmetric on purpose: drop after three bad samples (fast, because a
   * struggling call needs relief now) and climb back only after fifteen clean
   * ones (slow, because oscillating between tiers looks worse than sitting one
   * step low).
   */
  /**
   * Chooses the encode tier from what the transport actually measured.
   *
   * The design follows the algorithm already running underneath us. Every
   * browser runs Google Congestion Control — delay-based plus loss-based, with
   * an AIMD rate controller — and publishes its estimate as
   * `availableOutgoingBitrate`. Re-deriving "quality" from loss and RTT up here
   * and acting on that is a second, slower control loop stacked on a better
   * one, and it cannot see what GCC sees: one-way delay gradients and its own
   * probing.
   *
   * Three properties are borrowed from GCC and from libwebrtc's QualityScaler,
   * because the previous hand-rolled version got each of them backwards:
   *
   *   - **Asymmetry, but bounded.** Down is near-immediate; up waits out a
   *     hold-down. libwebrtc uses a 2s measurement window and multiplies it by
   *     2.5 after a downscale, so ~5s. The old code wanted 15 consecutive
   *     samples per rung.
   *   - **Hold, never reset.** GCC's rate controller has a Hold state; an
   *     ambiguous sample stops the climb, it does not erase the evidence. The
   *     old code zeroed a 14-sample streak because sample 15 was merely "good",
   *     which on a normally-jittery link meant it almost never completed.
   *   - **Jump, don't step.** GCC increases multiplicatively while far from
   *     convergence. If the measured headroom fits three rungs up, going there
   *     directly is correct; climbing one rung per hold-down is what turned a
   *     recovery into minutes.
   *
   * `qualityLimitationReason` separates the two causes that loss and RTT cannot
   * tell apart. CPU limitation and bandwidth limitation want opposite
   * responses, and only the encoder knows which is happening.
   */
  #adaptQuality(samples) {
    const now = Date.now();
    const ceiling = tierForRoom(this.baseTier, this.links.size + 1);

    // The encoder telling us directly that it cannot keep up. Believe it.
    const cpuBound = samples.some((s) => s.qualityLimitationReason === 'cpu');

    /*
     * Per-link, because in a mesh each peer connection runs its own estimator
     * and each carries its own copy of our video. The worst link governs: a
     * tier we cannot deliver to one participant is not a tier we are at.
     */
    const estimates = samples
      .map((s) => s.availableOutgoingBitrate)
      .filter((value) => typeof value === 'number' && value > 0);

    if (estimates.length === 0) {
      // Firefox and Safari do not expose the estimate. Fall back to the
      // heuristic, which is worse but is not nothing.
      this.#adaptFromQualityRank(samples, ceiling, cpuBound, now);
      return;
    }

    const available = Math.min(...estimates);
    const current = TIERS[this.tier] ?? TIERS.medium;

    /*
     * Down when the estimate falls below what this tier costs.
     *
     * 0.85 is GCC's own multiplicative decrease factor (beta), which keeps this
     * in step with the controller underneath rather than fighting it.
     */
    if (available < current.maxBitrate * 0.85 || cpuBound) {
      if (this.overuseSince == null) this.overuseSince = now;

      if (now - this.overuseSince >= OVERUSE_CONFIRM_MS) {
        this.overuseSince = null;
        this.underuseSince = null;
        const next = cpuBound
          ? stepDown(this.tier)
          : (bestTierFor(available, ceiling) ?? stepDown(this.tier));
        if (next !== this.tier) {
          this.#applyTier(next, cpuBound ? 'encoder is CPU bound' : 'less bandwidth available');
        }
      }
      return;
    }

    this.overuseSince = null;

    /*
     * Up when there is headroom for a better tier and it has held.
     *
     * The 1.3 margin is hysteresis: climbing the instant the estimate merely
     * touches the next tier's cost guarantees an immediate drop back, which
     * reads as flickering quality.
     */
    const target = bestTierFor(available / UPGRADE_HEADROOM, ceiling);
    if (!target || target === this.tier || isLowerThan(target, this.tier)) {
      this.underuseSince = null;
      return;
    }

    if (this.underuseSince == null) this.underuseSince = now;
    if (now - this.underuseSince >= UPGRADE_HOLD_MS) {
      this.underuseSince = null;
      this.#applyTier(target, 'more bandwidth available');
    }
  }

  /**
   * Fallback for browsers that do not publish a bandwidth estimate.
   *
   * Same shape as the measured path — hold rather than reset, and a bounded
   * hold-down — but reading the derived quality rank instead.
   */
  #adaptFromQualityRank(samples, ceiling, cpuBound, now) {
    const scored = samples.filter((s) => s.quality.rank >= 0);
    if (scored.length === 0) return;

    const struggling = scored.filter((s) => s.quality.rank <= 1).length;
    const healthy = scored.every((s) => s.quality.rank >= 3);

    if (struggling / scored.length >= 0.5 || cpuBound) {
      if (this.overuseSince == null) this.overuseSince = now;
      if (now - this.overuseSince >= OVERUSE_CONFIRM_MS) {
        this.overuseSince = null;
        this.underuseSince = null;
        const next = stepDown(this.tier);
        if (next !== this.tier) this.#applyTier(next, 'network degraded');
      }
      return;
    }

    this.overuseSince = null;

    // "Good or better", not "excellent from everyone on every sample" — the
    // latter is a bar a real connection rarely clears for long enough.
    if (!healthy) return;

    const next = stepUp(this.tier);
    if (next === this.tier || isLowerThan(next, ceiling)) {
      this.underuseSince = null;
      return;
    }

    if (this.underuseSince == null) this.underuseSince = now;
    if (now - this.underuseSince >= UPGRADE_HOLD_MS) {
      this.underuseSince = null;
      this.#applyTier(next, 'network recovered');
    }
  }


  /**
   * Recomputes the ceiling when the participant count changes.
   *
   * Bidirectional on purpose. Dropping the tier as a room grows is the obvious
   * half; raising it again as people leave is the half that is easy to forget,
   * and forgetting it means a call that briefly had four people stays at 360p
   * for the rest of its life after three of them hang up.
   *
   * Climbing back up is refused while the network is actively struggling —
   * we are currently backing off — so a room emptying out because everyone had a
   * bad connection does not immediately ask more of the one left behind.
   */
  #retune(participantCount) {
    /*
     * Counted from the store, not from `this.links`.
     *
     * `#retune()` runs from the `peer:joined` handler *before* the link to that
     * peer is opened, so `links.size` is one behind and a third arrival looked
     * like a second one — the room never stepped down off 1080p. The store has
     * already been updated by `addPeer`/`removePeer` at every call site.
     */
    const peers =
      participantCount ?? useCallStore.getState().peerOrder.length + 1;
    const ceiling = tierForRoom(this.baseTier, peers);

    if (isLowerThan(ceiling, this.tier)) {
      this.#applyTier(ceiling, `room grew to ${peers}`);
      return;
    }

    if (isLowerThan(this.tier, ceiling) && this.overuseSince === null) {
      this.#applyTier(ceiling, `room down to ${peers}`);
    }
  }

  #applyTier(tier, reason) {
    this.tier = tier;
    useCallStore.getState().setTier(tier);
    console.info(`[rtc] video tier → ${TIERS[tier].label} (${reason})`);

    const isScreenShare = Boolean(this.screenStream);
    for (const link of this.links.values()) {
      link.setTier(tier, { isScreenShare });
    }

    /*
     * The camera is deliberately left alone.
     *
     * Tier changes are applied at the encoder (see applyTierToSender), because
     * re-constraining a live camera lets it re-pick a mode with a different
     * orientation — which is how a portrait phone ends up sideways in
     * everyone else's grid. The capture is opened once at the best resolution
     * the call could need and scaled down from there.
     */
  }

  // ================================================================ rooms

  /** Promise-wrapped emit with ack, so callers can await a server decision. */
  #emit(event, payload) {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, code: 'OFFLINE', error: 'Not connected.' });
        return;
      }

      const timer = setTimeout(
        () => resolve({ ok: false, code: 'TIMEOUT', error: 'Server timed out.' }),
        10_000
      );

      this.socket.emit(event, payload, (response) => {
        clearTimeout(timer);
        resolve(response ?? { ok: false, code: 'NO_RESPONSE' });
      });
    });
  }

  /**
   * Camera and microphone are acquired before entering a room, not after.
   *
   * Ordering matters twice over. Technically, it means every peer connection is
   * built with tracks already in hand, so the common case needs no
   * renegotiation. From the user's side, it means the browser's permission
   * prompt appears while they are still looking at the lobby — where a prompt
   * makes sense — rather than over the top of a call they have already joined.
   */
  async #ensureMedia() {
    const { mediaStatus } = useCallStore.getState();
    if (mediaStatus === 'ready' || mediaStatus === 'requesting') return;
    await this.acquireMedia();
  }

  async createRoom({ displayName, roomName, requireAuth }) {
    sound.unlock();
    const call = useCallStore.getState();
    call.setPhase('working');
    call.clearError();

    await this.#ensureMedia();

    const response = await this.#emit('room:create', {
      displayName,
      roomName,
      requireAuth,
    });

    if (!response.ok) {
      call.setError({ code: response.code, message: response.error });
      return response;
    }

    this.identity = { displayName, roomCode: response.room.code };
    call.setSelfId(response.selfId);
    call.setRoom({
      code: response.room.code,
      name: response.room.name,
      requireAuth: response.room.requireAuth,
      adminId: response.room.adminId,
      isAdmin: true,
      createdAt: response.room.createdAt,
    });
    call.replaceParticipants(response.room.participants, response.selfId);
    useChatStore.getState().hydrateGroup([]);

    return response;
  }

  async joinRoom({ displayName, roomCode }) {
    sound.unlock();
    const call = useCallStore.getState();
    call.setPhase('working');
    call.clearError();

    await this.#ensureMedia();

    const response = await this.#emit('room:join', { displayName, roomCode });

    if (!response.ok) {
      call.setError({ code: response.code, message: response.error });
      return response;
    }

    this.identity = { displayName, roomCode };

    if (response.status === 'pending') {
      call.setPendingRoom(response.roomName);
    }
    // The 'joined' case is completed by the `room:joined` event, which carries
    // the participant list and history.

    return response;
  }

  approve(peerId) {
    useCallStore.getState().removeJoinRequest(peerId);
    return this.#emit('join:approve', { peerId });
  }

  deny(peerId) {
    useCallStore.getState().removeJoinRequest(peerId);
    return this.#emit('join:deny', { peerId });
  }

  sendMessage(body, to = null) {
    const selfId = useCallStore.getState().selfId;

    // Optimistic echo: the sender sees their own message immediately, and the
    // server's copy is deduped on id when it arrives.
    return this.#emit('chat:send', { body, to }).then((response) => {
      if (response.ok && response.message) {
        useChatStore.getState().ingest(response.message, selfId);
      } else if (!response.ok) {
        useUIStore.getState().pushToast({
          tone: 'critical',
          text: response.error ?? 'Message not delivered',
        });
      }
      return response;
    });
  }

  async leaveRoom() {
    for (const id of [...this.links.keys()]) this.#closeLink(id);
    this.#stopStatsLoop();

    await this.stopScreenShare();
    await this.#emit('room:leave', {});

    this.identity = null;
    useCallStore.getState().resetCall();
    useChatStore.getState().reset();
    useStatsStore.getState().reset();
    meter.detachAll();
  }

  /** Full teardown — releases the camera and microphone. */
  dispose() {
    for (const id of [...this.links.keys()]) this.#closeLink(id);
    this.#stopStatsLoop();

    this.#disposeMirror();
    this.captureSize = null;
    for (const stream of [this.cameraStream, this.screenStream]) {
      stream?.getTracks().forEach((track) => track.stop());
    }
    this.cameraStream = null;
    this.screenStream = null;
    this.localStream = null;

    if (this.deviceListener) {
      navigator.mediaDevices?.removeEventListener(
        'devicechange',
        this.deviceListener
      );
      this.deviceListener = null;
    }

    meter.teardown();
    sound.teardown();
    this.socket?.disconnect();
    this.socket = null;
    this.started = false;
  }
}

/** Maps a DOMException from getUserMedia onto something a person can act on. */
function describeMediaError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
      return {
        title: 'Camera and microphone blocked',
        detail:
          'Your browser denied access. Open the padlock or camera icon in the address bar, allow this site, then retry.',
        recoverable: true,
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        title: 'No camera or microphone found',
        detail:
          'Nothing is connected. Plug in a device and retry, or continue without one.',
        recoverable: true,
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        title: 'Device already in use',
        detail:
          'Another application is holding the camera. Close it — video conferencing apps are the usual culprit — and retry.',
        recoverable: true,
      };
    case 'OverconstrainedError':
      return {
        title: 'Camera cannot meet the requested format',
        detail: `No available device satisfies "${error.constraint}".`,
        recoverable: true,
      };
    case 'SecurityError':
      return {
        title: 'Blocked by browser policy',
        detail: 'Media capture is disabled in this context.',
        recoverable: false,
      };
    default:
      return {
        title: 'Could not start your camera',
        detail: error?.message ?? 'An unknown media error occurred.',
        recoverable: true,
      };
  }
}

export const callEngine = new CallEngine();
export { GROUP_THREAD };
export default callEngine;
