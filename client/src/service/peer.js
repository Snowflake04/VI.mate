class Peer {
  constructor() {
    this.mediaConstraints = {
      audio: true,
      video: true,
    };
    this.offerOptions = {
      offerToReceiveVideo: 1,
      offerToReceiveAudio: 1,
    };

    this.peerConnections = {};
    this.iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
    this.setLocalStream();

    this.localPeerId = '';
    this.localStream = {};
    this.remoteStream = {};
    this.rtcPeerConnection = '';
    this.roomId = '';
  }

  async setLocalStream() {
    let mediaConstraints = this.mediaConstraints;
    console.log('Local stream set');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    } catch (error) {
      console.error('Could not get user media', error);
    }

    this.localStream = stream;
    console.log(stream);
  }

  addLocalTracks(rtcPeerConnection) {
    console.log(this.localStream);
    this.localStream.getTracks().forEach((track) => {
      rtcPeerConnection.addTrack(track, this.localStream);
    });
    console.log('Local tracks added');
  }

  async createOffer(rtcPeerConnection, remotePeerId) {
    let sessionDescription;
    try {
      sessionDescription = await rtcPeerConnection.createOffer(
        this.offerOptions
      );
      rtcPeerConnection.setLocalDescription(sessionDescription);
    } catch (error) {
      console.error(error);
    }

    console.log(
      `Sending offer from peer ${this.localPeerId} to peer ${remotePeerId}`
    );
    this.socket.emit('newRTCOffer', {
      type: 'webrtc_offer',
      sdp: sessionDescription,
      roomId: this.roomId,
      senderId: this.localPeerId,
      receiverId: remotePeerId,
    });
  }

  setRemoteStream(event, remotePeerId) {
    console.log('Remote stream set');
    if (!event.track.kind === 'video') return;
    this.remoteStream[remotePeerId] = event.streams[0];
    this.socket.emit('newRemoteStream', this.socket.id);
  }

  async createAnswer(rtcPeerConnection, remotePeerId) {
    let sessionDescription;
    try {
      sessionDescription = await rtcPeerConnection.createAnswer(
        this.offerOptions
      );
      rtcPeerConnection.setLocalDescription(sessionDescription);
    } catch (error) {
      console.error(error);
    }

    console.log(
      `Sending answer from peer ${this.localPeerId} to peer ${remotePeerId}`
    );
    this.socket.emit('RTCAnswer', {
      type: 'webrtc_answer',
      sdp: sessionDescription,
      roomId: this.roomId,
      senderId: this.localPeerId,
      receiverId: remotePeerId,
    });
  }

  sendIceCandidate(event, remotePeerId) {
    if (event.candidate) {
      console.log(
        `Sending ICE Candidate from peer ${this.localPeerId} to peer ${remotePeerId}`
      );
      this.socket.emit('iceCandidate', {
        senderId: this.localPeerId,
        receiverId: remotePeerId,
        roomId: this.roomId,
        label: event.candidate.sdpMLineIndex,
        candidate: event.candidate.candidate,
      });
    }
  }

  checkPeerDisconnect(event, remotePeerId) {
    var state = this.peerConnections[remotePeerId].iceConnectionState;
    console.log(`connection with peer ${remotePeerId}: ${state}`);
    if (state === 'failed' || state === 'closed' || state === 'disconnected') {
      console.log(`Peer ${remotePeerId} has disconnected`);
    }
  }

  async handleIncommingCall(from) {
    const remotePeer = from;
    this.peerConnections[remotePeer] = new RTCPeerConnection(this.iceServers);
    this.addLocalTracks(this.peerConnections[remotePeer]);
    this.peerConnections[remotePeer].ontrack = (event) =>
      this.setRemoteStream(event, remotePeer);
    this.peerConnections[remotePeer].oniceconnectionstatechange = (event) =>
      this.checkPeerDisconnect(event, remotePeer);
    this.peerConnections[remotePeer].onicecandidate = (event) =>
      this.sendIceCandidate(event, remotePeer);
    await this.createOffer(this.peerConnections[remotePeer], remotePeer);
    this.peerConnections[remotePeer].onnegotiationneeded = (event) =>
      console.log('nego needed', event);
    console.log(this.peerConnections);
  }

  async handleRTCOffer(offer) {
    console.log(
      `Socket event callback: webrtc_offer. RECEIVED from ${offer.senderId}`
    );
    const remotePeerId = offer.senderId;
    this.peerConnections[remotePeerId] = new RTCPeerConnection(this.iceServers);
    console.log(new RTCSessionDescription(offer.sdp));
    this.peerConnections[remotePeerId].setRemoteDescription(
      new RTCSessionDescription(offer.sdp)
    );
    console.log(
      `Remote description set on peer ${this.localPeerId} after offer received`
    );
    this.addLocalTracks(this.peerConnections[remotePeerId]);
    this.peerConnections[remotePeerId].ontrack = (event) =>
      this.setRemoteStream(event, remotePeerId);
    this.peerConnections[remotePeerId].oniceconnectionstatechange = (event) =>
      this.checkPeerDisconnect(event, remotePeerId);
    this.peerConnections[remotePeerId].onicecandidate = (event) =>
      this.sendIceCandidate(event, remotePeerId);
    await this.createAnswer(this.peerConnections[remotePeerId], remotePeerId);
    this.peerConnections[remotePeerId].onnegotiationneeded = (event) =>
      console.log('nego needed', event);
    console.log(this.peerConnections);
  }

  async handleRTCAnswer(offer) {
    console.log(
      `Socket event callback: webrtc_answer. RECEIVED from ${offer.senderId}`
    );
    console.log(
      `Remote description set on peer ${this.localPeerId} after answer received`
    );
    this.peerConnections[offer.senderId].setRemoteDescription(
      new RTCSessionDescription(offer.sdp)
    );
    //addLocalTracks(peerConnections[event.senderId])
  }

  handleIceCandidate(offer) {
    const senderPeerId = offer.senderId;
    console.log(
      `Socket event callback: webrtc_ice_candidate. RECEIVED from ${senderPeerId}`
    );

    // ICE candidate configuration.
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: offer.label,
      candidate: offer.candidate,
    });
    this.peerConnections[senderPeerId].addIceCandidate(candidate);
  }
}

export default Peer;
