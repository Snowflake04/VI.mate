import { Socket } from 'socket.io-client';
import { config } from './config';

class Peer extends Socket {
  constructor(io, nsp, opts) {
    super(io, nsp, opts);
    this.peerConnections = {};
    this.remoteStream = {};
    this.roomId = '';
    this.roomDetails = {};
    this.localStream = '';
  }
  async setLocalStream() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        config.mediaConstraints
      );
    } catch (error) {
      if (error.toString().startsWith('NotAllowedError'))
        return alert('Please enable audio and video');
    }

    this.localStream = stream;
  }

  addLocalTracks(rtcPeerConnection) {
    this.localStream.getTracks().forEach((track) => {
      rtcPeerConnection.addTrack(track, this.localStream);
    });
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

    this.emit('newRTCOffer', {
      type: 'webrtc_offer',
      sdp: sessionDescription,
      roomId: this.roomId,
      senderId: this.id,
      receiverId: remotePeerId,
    });
  }

  setRemoteStream(event, remotePeerId) {
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
      console.log('nego needed on incoming call', event);
    this.peerConnections[remotePeer] = rtcPeerConnection;
    await this.createOffer(rtcPeerConnection, remotePeer);
  }

  async handleRTCOffer(offer) {
    const remotePeerId = offer.senderId;
    const rtcPeerConnection = new RTCPeerConnection(config.iceServers);
    rtcPeerConnection.setRemoteDescription(
      new RTCSessionDescription(offer.sdp)
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
      console.log('nego needed on rtc offer', event);
    this.peerConnections[remotePeerId] = rtcPeerConnection;
    await this.createAnswer(rtcPeerConnection, remotePeerId);
  }

  async handleScreenShare() {
    const stream = await navigator.mediaDevices.getDisplayMedia();
    this.handleSourceChange(stream);

    stream.getVideoTracks()[0].onended = async () => {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia(
          config.mediaConstraints
        );
        this.handleSourceChange(videoStream);
      } catch (error) {
        console.log(error);
        if (error.toString().startsWith('NotAllowedError'))
          return alert('Please enable audio and video');
      }
    };
  }

  handleSourceChange(source) {
    this.localStream.getTracks().forEach((track) => {
      this.localStream.removeTrack(track);
      track.stop();
    });
    source.getTracks().forEach((track) => {
      this.localStream.addTrack(track);
    });
    for (let Peer in this.peerConnections) {
      this.peerConnections[Peer].getSenders().forEach((sender) => {
        if (sender.track?.kind === 'video') {
          sender.replaceTrack(source.getVideoTracks()[0]);
        }
        if (sender.track?.kind === 'audio') {
          sender.replaceTrack(source.getAudioTracks()[0]);
        }
      });
    }
  }

  async handleRTCAnswer(offer) {
    this.peerConnections[offer.senderId].setRemoteDescription(
      new RTCSessionDescription(offer.sdp)
    );
  }

  handleIceCandidate(offer) {
    const senderPeerId = offer.senderId;
    // ICE candidate configuration.
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: offer.label,
      candidate: offer.candidate,
    });
    this.peerConnections[senderPeerId].addIceCandidate(candidate);
  }
}

export default Peer;
