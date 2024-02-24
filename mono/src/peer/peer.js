import { Socket } from 'socket.io-client';
import { config } from './config';

class Peer extends Socket {
  constructor(io, nsp, opts) {
    super(io, nsp, opts);
    this.peerConnections = {};
    this.remoteStream = {};
    this.rtcPeerConnection = '';
    this.roomId = '';
    this.localStream = '';
    this.setLocalStream();
  }
  async setLocalStream() {
    console.log('Local stream set');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        config.mediaConstraints
      );
    } catch (error) {
      console.error('Could not get user media', error);
    }

    this.localStream = stream;
    console.log(stream);
  }

  addLocalTracks(rtcPeerConnection) {
    this.localStream.getTracks().forEach((track) => {
      rtcPeerConnection.addTrack(track, this.localStream);
    });
    console.log('Local tracks added');
  }

  async createOffer(rtcPeerConnection, remotePeerId) {
    let sessionDescription;
    try {
      sessionDescription = await rtcPeerConnection.createOffer(
        config.offerOptions
      );
      rtcPeerConnection.setLocalDescription(sessionDescription);
    } catch (error) {
      console.error(error);
    }

    console.log(`Sending offer from peer ${this.id} to peer ${remotePeerId}`);
    this.emit('newRTCOffer', {
      type: 'webrtc_offer',
      sdp: sessionDescription,
      roomId: this.roomId,
      senderId: this.id,
      receiverId: remotePeerId,
    });
  }

  setRemoteStream(event, remotePeerId) {
    console.log('Remote stream set');
    if (!event.track.kind === 'video') return;
    this.remoteStream[remotePeerId] = event.streams[0];
    this.emit('remoteStreamUpdate', this.id);
  }

  removeRemoteStream(remotePeerId) {
    delete this.remoteStream[remotePeerId];
    this.emit('remoteStreamUpdate', this.id);
  }

  async createAnswer(rtcPeerConnection, remotePeerId) {
    let sessionDescription;
    try {
      sessionDescription = await rtcPeerConnection.createAnswer(
        config.offerOptions
      );
      rtcPeerConnection.setLocalDescription(sessionDescription);
    } catch (error) {
      console.error(error);
    }

    console.log(`Sending answer from peer ${this.id} to peer ${remotePeerId}`);
    this.emit('RTCAnswer', {
      type: 'webrtc_answer',
      sdp: sessionDescription,
      roomId: this.roomId,
      senderId: this.id,
      receiverId: remotePeerId,
    });
  }

  sendIceCandidate(event, remotePeerId) {
    if (event.candidate) {
      console.log(
        `Sending ICE Candidate from peer ${this.id} to peer ${remotePeerId}`
      );
      this.emit('iceCandidate', {
        senderId: this.id,
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

  async handleIncommingCall(remotePeer) {
    const rtcPeerConnection = new RTCPeerConnection(config.iceServers);
    this.addLocalTracks(rtcPeerConnection);
    rtcPeerConnection.ontrack = (event) =>
      this.setRemoteStream(event, remotePeer);
    rtcPeerConnection.oniceconnectionstatechange = (event) =>
      this.checkPeerDisconnect(event, remotePeer);
    rtcPeerConnection.onicecandidate = (event) =>
      this.sendIceCandidate(event, remotePeer);
    rtcPeerConnection.onnegotiationneeded = (event) =>
      console.log('nego needed', event);
    this.peerConnections[remotePeer] = rtcPeerConnection;
    await this.createOffer(rtcPeerConnection, remotePeer);
  }

  async handleRTCOffer(offer) {
    console.log(
      `Socket event callback: webrtc_offer. RECEIVED from ${offer.senderId}`
    );
    const remotePeerId = offer.senderId;
    const rtcPeerConnection = new RTCPeerConnection(config.iceServers);
    rtcPeerConnection.setRemoteDescription(
      new RTCSessionDescription(offer.sdp)
    );
    console.log(
      `Remote description set on peer ${this.id} after offer received`
    );
    this.addLocalTracks(rtcPeerConnection);
    rtcPeerConnection.ontrack = (event) => {
      console.log('track Chnaged');
      this.setRemoteStream(event, remotePeerId);
    };
    rtcPeerConnection.oniceconnectionstatechange = (event) =>
      this.checkPeerDisconnect(event, remotePeerId);

    rtcPeerConnection.onicecandidate = (event) =>
      this.sendIceCandidate(event, remotePeerId);

    rtcPeerConnection.onnegotiationneeded = (event) =>
      console.log('nego needed', event);

    this.peerConnections[remotePeerId] = rtcPeerConnection;

    await this.createAnswer(rtcPeerConnection, remotePeerId);
  }

  async handleScreenShare() {
    const stream = await navigator.mediaDevices.getDisplayMedia();
    this.localStream.getTracks().forEach((track) => {
      this.localStream.removeTrack(track);
      track.stop();
    });
    stream.getTracks().forEach((track) => {
      this.localStream.addTrack(track);
    });

    for (let Peer in this.peerConnections) {
      this.peerConnections[Peer].getSenders().forEach((sender) => {
        if (sender.track.kind === 'video') {
          sender.replaceTrack(stream.getVideoTracks()[0]);
        }
      });
    }
  }

  async handleRTCAnswer(offer) {
    console.log(
      `Socket event callback: webrtc_answer. RECEIVED from ${offer.senderId}`
    );
    console.log(
      `Remote description set on peer ${this.id} after answer received`
    );
    this.peerConnections[offer.senderId].setRemoteDescription(
      new RTCSessionDescription(offer.sdp)
    );
  }

  handleIceCandidate(offer) {
    const senderPeerId = offer.senderId;
    console.log(
      `Socket event callback: webrtc_ice_candidate. RECEIVED from ${senderPeerId}`
    );

    // ICE candidate configuration.
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: offer.label,
      candidate: offer.candidate,
    });
    this.peerConnections[senderPeerId].addIceCandidate(candidate);
  }
}

export default Peer;
