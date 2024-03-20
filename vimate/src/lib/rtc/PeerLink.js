import { StatsSampler } from './stats.js';
import { applyTierToSender } from './constraints.js';

/**
 * ---------------------------------------------------------------------------
 * One peer-to-peer connection, negotiated properly and repaired when it breaks.
 * ---------------------------------------------------------------------------
 *
 * Two things here that the original implementation did not have:
 *
 * 1. Perfect negotiation (W3C). The old code decided who offers based on who
 *    happened to emit `createCall` first, so two people joining within the same
 *    tick produced glare — both sides call setRemoteDescription(offer) while in
 *    have-local-offer, one throws InvalidStateError, and that peer pair is dead
 *    for the rest of the call with nothing in the UI to say why. Perfect
 *    negotiation makes the roles deterministic (`polite` is derived from the
 *    two socket IDs, so both ends independently agree) and glare becomes a
 *    non-event.
 *
 * 2. Recovery. `checkPeerDisconnect` used to `console.log` that the peer had
 *    gone and then do nothing at all. A Wi-Fi handoff, a VPN blip, or a phone
 *    changing cell towers permanently froze the tile. Now `failed` triggers an
 *    ICE restart with backoff, and a link that cannot be repaired is rebuilt
 *    from scratch.
 * ---------------------------------------------------------------------------
 */

/** How long a `disconnected` link is given to heal itself before we intervene. */
const DISCONNECT_GRACE_MS = 2500;
/** ICE restarts before we give up and rebuild the whole connection. */
const MAX_ICE_RESTARTS = 3;

export class PeerLink {
  constructor({
    peerId,
    polite,
    rtcConfig,
    localStream,
    tier,
    onSignal,
    onRemoteStream,
    onStateChange,
    onRebuildRequest,
  }) {
    this.peerId = peerId;
    this.polite = polite;
    this.rtcConfig = rtcConfig;
    this.localStream = localStream;
    this.tier = tier;
    /*
     * The camera's true capture format. Needed because the published video
     * track is a mirrored derivative whose own settings may report nothing,
     * and the encoder's downscale factor is computed from capture size.
     */
    this.captureSize = null;
    /** 'text' or 'motion' — what to protect when a share cannot have both. */
    this.shareMode = 'text';

    this.onSignal = onSignal;
    this.onRemoteStream = onRemoteStream;
    this.onStateChange = onStateChange;
    this.onRebuildRequest = onRebuildRequest;

    // Perfect-negotiation bookkeeping.
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;

    this.iceRestarts = 0;
    this.disconnectTimer = null;
    this.closed = false;
    this.remoteStream = new MediaStream();
    /** ICE candidates that arrived before the remote description was set. */
    this.pendingCandidates = [];

    this.pc = new RTCPeerConnection(rtcConfig);
    this.sampler = new StatsSampler(this.pc);

    this.#wireEvents();
    this.#addLocalTracks();
  }

  // -------------------------------------------------------------- lifecycle

  #wireEvents() {
    const pc = this.pc;

    pc.onnegotiationneeded = async () => {
      // Fires on both ends when tracks are added. Whoever gets there first
      // wins; the loser's collision handling below sorts it out.
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        this.onSignal({ to: this.peerId, description: pc.localDescription });
      } catch (error) {
        if (!this.closed) console.error('[rtc] negotiation failed', error);
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      // A null candidate signals end-of-gathering and needs no relay.
      if (candidate) this.onSignal({ to: this.peerId, candidate });
    };

    pc.ontrack = ({ track, streams }) => {
      // Prefer the stream the sender grouped the track into; fall back to our
      // own container so audio-only or video-only peers still work.
      const stream = streams[0] ?? this.remoteStream;

      if (stream !== this.remoteStream) {
        this.remoteStream = stream;
      } else if (!stream.getTracks().includes(track)) {
        stream.addTrack(track);
      }

      // `unmute` is the honest "media is actually flowing now" signal;
      // `ontrack` fires as soon as the track is negotiated, often seconds
      // before the first frame. Waiting for it is what makes the skeleton
      // state end at the right moment instead of flashing to black.
      track.onunmute = () => this.#emitState();
      track.onmute = () => this.#emitState();
      track.onended = () => this.#emitState();

      this.onRemoteStream(this.peerId, stream);
      this.#emitState();
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      this.#emitState();

      if (state === 'failed') {
        // `failed` is terminal without intervention — restart immediately.
        this.#attemptIceRestart('ice-failed');
        return;
      }

      if (state === 'disconnected') {
        // Often transient (a roaming Wi-Fi client reconnects on its own).
        // Give it a moment before spending a renegotiation on it.
        this.#scheduleDisconnectRecovery();
        return;
      }

      if (state === 'connected' || state === 'completed') {
        this.#clearDisconnectTimer();
        this.iceRestarts = 0;
      }
    };

    pc.onconnectionstatechange = () => {
      this.#emitState();
      if (pc.connectionState === 'failed') this.#attemptIceRestart('pc-failed');
    };

    pc.onicecandidateerror = (event) => {
      // 701 is a benign "one STUN/TURN server in the list did not answer".
      // Anything else is worth knowing about when diagnosing a dead call.
      if (event.errorCode && event.errorCode !== 701) {
        console.warn(
          `[rtc] ICE error ${event.errorCode} from ${event.url}: ${event.errorText}`
        );
      }
    };
  }

  #addLocalTracks() {
    if (!this.localStream) return;

    for (const track of this.localStream.getTracks()) {
      const sender = this.pc.addTrack(track, this.localStream);
      if (track.kind === 'video') {
        applyTierToSender(sender, this.tier, { captureSize: this.captureSize });
      }
    }
  }

  /**
   * Attaches (or re-attaches) the local stream to an already-open connection.
   *
   * This exists because media and signalling do not arrive in a fixed order. A
   * peer who joins a populated room opens its connections the instant it learns
   * the participant list, which can be before `getUserMedia` has resolved — and
   * a connection negotiated with no tracks stays silent forever unless
   * something puts them in afterwards. It is also the path back from a denied
   * camera that the user later allows.
   *
   * `addTrack` fires `negotiationneeded`, so the re-offer is handled by the
   * perfect-negotiation logic above rather than being driven from here.
   */
  async publishStream(stream) {
    if (this.closed || !stream) return;
    this.localStream = stream;

    for (const track of stream.getTracks()) {
      const existing = this.pc
        .getSenders()
        .find((sender) => sender.track && sender.track.kind === track.kind);

      if (existing) {
        if (existing.track !== track) await existing.replaceTrack(track);
        continue;
      }

      const sender = this.pc.addTrack(track, stream);
      if (track.kind === 'video') {
        await applyTierToSender(sender, this.tier, { captureSize: this.captureSize });
      }
    }
  }

  // ------------------------------------------------------------- signalling

  /**
   * Handles an inbound offer or answer.
   *
   * This is the textbook perfect-negotiation body. The important line is the
   * collision test: an impolite peer receiving an offer while it has one in
   * flight simply drops it, and the polite peer rolls back instead.
   */
  async acceptDescription(description) {
    if (this.closed) return;
    const pc = this.pc;

    try {
      const readyForOffer =
        !this.makingOffer &&
        (pc.signalingState === 'stable' || this.isSettingRemoteAnswerPending);
      const offerCollision = description.type === 'offer' && !readyForOffer;

      this.ignoreOffer = !this.polite && offerCollision;
      if (this.ignoreOffer) return;

      this.isSettingRemoteAnswerPending = description.type === 'answer';
      await pc.setRemoteDescription(description);
      this.isSettingRemoteAnswerPending = false;

      await this.#drainPendingCandidates();

      if (description.type === 'offer') {
        await pc.setLocalDescription();
        this.onSignal({ to: this.peerId, description: pc.localDescription });
      }
    } catch (error) {
      this.isSettingRemoteAnswerPending = false;
      if (!this.closed) {
        console.error('[rtc] failed to apply remote description', error);
      }
    }
  }

  async acceptCandidate(candidate) {
    if (this.closed) return;

    // Candidates routinely beat the offer they belong to across the wire.
    // Buffering them is what prevents "InvalidStateError: remote description
    // is null" from silently costing us the best connection path.
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      // An ignored offer means its candidates are meaningless too.
      if (!this.ignoreOffer && !this.closed) {
        console.warn('[rtc] rejected ICE candidate', error);
      }
    }
  }

  async #drainPendingCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];

    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {
        // Stale candidate from a previous negotiation; safe to drop.
      }
    }
  }

  // --------------------------------------------------------------- recovery

  #scheduleDisconnectRecovery() {
    if (this.disconnectTimer) return;

    this.disconnectTimer = setTimeout(() => {
      this.disconnectTimer = null;
      const state = this.pc.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') {
        this.#attemptIceRestart('disconnect-timeout');
      }
    }, DISCONNECT_GRACE_MS);
  }

  #clearDisconnectTimer() {
    if (!this.disconnectTimer) return;
    clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
  }

  /**
   * Re-gathers candidates on the existing connection. Cheap compared to a
   * rebuild, and usually enough: it is exactly what is needed after an IP
   * change (Wi-Fi to cellular, VPN up or down).
   */
  #attemptIceRestart(reason) {
    if (this.closed) return;
    this.#clearDisconnectTimer();

    if (this.iceRestarts >= MAX_ICE_RESTARTS) {
      // Out of cheap options — ask the mesh for a brand new connection,
      // which also picks up any refreshed TURN credentials.
      console.warn(
        `[rtc] ${this.peerId}: ${MAX_ICE_RESTARTS} ICE restarts failed (${reason}); rebuilding`
      );
      this.onRebuildRequest?.(this.peerId);
      return;
    }

    this.iceRestarts += 1;
    console.info(
      `[rtc] ${this.peerId}: ICE restart ${this.iceRestarts}/${MAX_ICE_RESTARTS} (${reason})`
    );

    try {
      // Fires negotiationneeded, which re-offers with new ICE credentials.
      this.pc.restartIce();
    } catch (error) {
      console.warn('[rtc] restartIce threw', error);
      this.onRebuildRequest?.(this.peerId);
    }

    this.#emitState();
  }

  // ------------------------------------------------------------ media swaps

  /**
   * Swaps the outgoing tracks without renegotiating — used for screen share
   * and for camera device changes.
   *
   * The original `handleSourceChange` called `replaceTrack(source.getAudioTracks()[0])`
   * against a `getDisplayMedia()` stream captured with no audio constraint. That
   * array is empty, so it passed `undefined` and silently muted the user for
   * everyone else in the call for as long as they were sharing. Here a missing
   * track of a given kind simply leaves that sender alone.
   */
  async replaceTracks(stream, { isScreenShare = false, shareMode } = {}) {
    if (this.closed || !stream) return;

    /*
     * A new share starts a new decision. Without this the link keeps whatever
     * the *previous* share settled on, so sharing a video and then a document
     * encodes the document as motion until the detector happens to re-decide.
     */
    if (shareMode) this.shareMode = shareMode;

    const nextVideo = stream.getVideoTracks()[0] ?? null;
    const nextAudio = stream.getAudioTracks()[0] ?? null;

    for (const sender of this.pc.getSenders()) {
      if (!sender.track) continue;

      if (sender.track.kind === 'video' && nextVideo) {
        await sender.replaceTrack(nextVideo);
        await applyTierToSender(sender, this.tier, {
          isScreenShare,
          captureSize: this.captureSize,
          shareMode: this.shareMode,
        });
      }

      // Only swap audio when the replacement stream genuinely has audio.
      if (sender.track.kind === 'audio' && nextAudio) {
        await sender.replaceTrack(nextAudio);
      }
    }
  }

  /** The camera format the encoder should scale down from. */
  setCaptureSize(captureSize) {
    this.captureSize = captureSize;
  }

  /** Re-applies the encoder trade-off when the shared content changes kind. */
  async setShareMode(shareMode) {
    this.shareMode = shareMode;
    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind === 'video') {
        await applyTierToSender(sender, this.tier, {
          isScreenShare: true,
          captureSize: this.captureSize,
          shareMode,
        });
      }
    }
  }

  async setTier(tier, { isScreenShare = false } = {}) {
    this.tier = tier;
    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind === 'video') {
        await applyTierToSender(sender, tier, {
          isScreenShare,
          captureSize: this.captureSize,
          shareMode: this.shareMode,
        });
      }
    }
  }

  // ------------------------------------------------------------------ state

  #emitState() {
    if (this.closed) return;
    this.onStateChange?.(this.peerId, this.getState());
  }

  getState() {
    const pc = this.pc;
    const videoTrack = this.remoteStream?.getVideoTracks()[0] ?? null;

    return {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState,

      /*
       * Whether a usable inbound video track exists.
       *
       * Deliberately does NOT consult `track.muted`. That flag is documented as
       * "no media is being delivered", but after a perfect-negotiation rollback
       * Chrome leaves the rolled-back side's receiver tracks reporting
       * `muted === true` indefinitely — with RTP demonstrably flowing (verified
       * against getStats: >100 KB of inbound video on a track claiming to be
       * muted). Gating playback on it means the peer who happened to lose the
       * glare coin-flip never renders the other's video at all, which is a
       * silent, one-directional black tile.
       *
       * The honest signal for "frames are arriving" is the video element
       * itself, so the decision is made there (see VideoTile) from
       * loadedmetadata / videoWidth, and this only reports that a track exists
       * to attach.
       */
      hasVideoTrack: Boolean(videoTrack && videoTrack.readyState === 'live'),
      hasAudio: (this.remoteStream?.getAudioTracks().length ?? 0) > 0,
      recovering: this.iceRestarts > 0 && pc.connectionState !== 'connected',
      iceRestarts: this.iceRestarts,
    };
  }

  async sampleStats() {
    return this.sampler.sample();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.#clearDisconnectTimer();

    // Detach handlers before closing so teardown does not re-enter the
    // recovery paths above with a half-dead connection.
    const pc = this.pc;
    pc.onnegotiationneeded = null;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.oniceconnectionstatechange = null;
    pc.onconnectionstatechange = null;
    pc.onicecandidateerror = null;

    for (const sender of pc.getSenders()) {
      // Senders are detached, never stopped — the tracks belong to the shared
      // local stream and are still in use by every other peer link.
      try {
        sender.replaceTrack(null);
      } catch {
        // Connection already closing.
      }
    }

    try {
      pc.close();
    } catch {
      // Already closed.
    }

    this.sampler.reset();
    this.pendingCandidates = [];
  }
}

export default PeerLink;
