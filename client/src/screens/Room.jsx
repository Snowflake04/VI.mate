import React, { useEffect, useCallback, useState } from 'react';
import ReactPlayer from 'react-player';
import { useSocket, getPeer } from '../context/SocketProvider';

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setNewRemoteStream] = useState();
  const Peer = getPeer();
  


  useEffect(() => {
    socket.on('newUserJoined', (username, id )=>{ //TODO: create a splash for displaying  new user joined message
      console.log("New user joined")
    });
    socket.on("incommingCall", handleCall)
    socket.on("RTCOffer", handleOffer)
    socket.on('RTCAnswer', handleAnswer)
    socket.on('iceCandidate', Peer.handleIceCandidate)
  },[]);



const handleCall = async(offer)=>{
  console.log("got call")
  await Peer.handleIncommingCall(offer)
}

const handleOffer = (offer)=>{
  Peer.handleRTCOffer(offer)
}
const handleAnswer = async(offer) =>{
  await Peer.handleRTCAnswer(offer)
}


  // BUTTON LISTENER ============================================================
  // connectButton.addEventListener('click', () => {
  //   joinRoom(roomInput.value);
  // });

  // // SOCKET EVENT CALLBACKS =====================================================
  // socket.on('roomCreated', async (event) => {
  //   localPeerId = event.peerId;
  //   console.log(`Current peer ID: ${localPeerId}`);
  //   console.log(
  //     `Socket event callback: room_created with by peer ${localPeerId}, created room ${event.roomId}`
  //   );

  //   await setLocalStream(mediaConstraints);
  // });

  // socket.on('room_joined', async (event) => {
  //   localPeerId = event.peerId;
  //   console.log(`Current peer ID: ${localPeerId}`);
  //   console.log(
  //     `Socket event callback: room_joined by peer ${localPeerId}, joined room ${event.roomId}`
  //   );

  //   await setLocalStream(mediaConstraints);
  //   console.log(`Emit start_call from peer ${localPeerId}`);
  //   socket.emit('start_call', {
  //     roomId: event.roomId,
  //     senderId: localPeerId,
  //   });
  // });

  // socket.on('start_call', async (event) => {
  //   const remotePeerId = event.senderId;
  //   console.log(
  //     `Socket event callback: start_call. RECEIVED from ${remotePeerId}`
  //   );

  //   peerConnections[remotePeerId] = new RTCPeerConnection(iceServers);
  //   addLocalTracks(peerConnections[remotePeerId]);
  //   peerConnections[remotePeerId].ontrack = (event) =>
  //     setRemoteStream(event, remotePeerId);
  //   peerConnections[remotePeerId].oniceconnectionstatechange = (event) =>
  //     checkPeerDisconnect(event, remotePeerId);
  //   peerConnections[remotePeerId].onicecandidate = (event) =>
  //     sendIceCandidate(event, remotePeerId);
  //   await createOffer(peerConnections[remotePeerId], remotePeerId);
  // });

  // socket.on('webrtc_offer', async (event) => {
  //   console.log(
  //     `Socket event callback: webrtc_offer. RECEIVED from ${event.senderId}`
  //   );
  //   const remotePeerId = event.senderId;

  //   peerConnections[remotePeerId] = new RTCPeerConnection(iceServers);
  //   console.log(new RTCSessionDescription(event.sdp));
  //   peerConnections[remotePeerId].setRemoteDescription(
  //     new RTCSessionDescription(event.sdp)
  //   );
  //   console.log(
  //     `Remote description set on peer ${localPeerId} after offer received`
  //   );
  //   addLocalTracks(peerConnections[remotePeerId]);

  //   peerConnections[remotePeerId].ontrack = (event) =>
  //     setRemoteStream(event, remotePeerId);
  //   peerConnections[remotePeerId].oniceconnectionstatechange = (event) =>
  //     checkPeerDisconnect(event, remotePeerId);
  //   peerConnections[remotePeerId].onicecandidate = (event) =>
  //     sendIceCandidate(event, remotePeerId);
  //   await createAnswer(peerConnections[remotePeerId], remotePeerId);
  // });

  // socket.on('webrtc_answer', async (event) => {
  //   console.log(
  //     `Socket event callback: webrtc_answer. RECEIVED from ${event.senderId}`
  //   );

  //   console.log(
  //     `Remote description set on peer ${localPeerId} after answer received`
  //   );
  //   peerConnections[event.senderId].setRemoteDescription(
  //     new RTCSessionDescription(event.sdp)
  //   );
  //   //addLocalTracks(peerConnections[event.senderId])
  //   console.log(new RTCSessionDescription(event.sdp));
  // });

  // socket.on('webrtc_ice_candidate', (event) => {
  //   const senderPeerId = event.senderId;
  //   console.log(
  //     `Socket event callback: webrtc_ice_candidate. RECEIVED from ${senderPeerId}`
  //   );

  //   // ICE candidate configuration.
  //   var candidate = new RTCIceCandidate({
  //     sdpMLineIndex: event.label,
  //     candidate: event.candidate,
  //   });
  //   peerConnections[senderPeerId].addIceCandidate(candidate);
  // });

  // // FUNCTIONS ==================================================================

  // function joinRoom(room) {
  //   if (room === '') {
  //     alert('Please type a room ID');
  //   } else {
  //     roomId = room;
  //     socket.emit('join', { room: room, peerUUID: localPeerId });
  //   }
  // }

  // async function setLocalStream(mediaConstraints) {
  //   console.log('Local stream set');
  //   let stream;
  //   try {
  //     stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
  //   } catch (error) {
  //     console.error('Could not get user media', error);
  //   }

  //   localStream = stream;
  //   // localVideoComponent.srcObject = stream;
  // }

  // function addLocalTracks(rtcPeerConnection) {
  //   localStream.getTracks().forEach((track) => {
  //     rtcPeerConnection.addTrack(track, localStream);
  //   });
  //   console.log('Local tracks added');
  // }

  // async function createOffer(rtcPeerConnection, remotePeerId) {
  //   let sessionDescription;
  //   try {
  //     sessionDescription = await rtcPeerConnection.createOffer(offerOptions);
  //     rtcPeerConnection.setLocalDescription(sessionDescription);
  //   } catch (error) {
  //     console.error(error);
  //   }

  //   console.log(
  //     `Sending offer from peer ${localPeerId} to peer ${remotePeerId}`
  //   );
  //   socket.emit('webrtc_offer', {
  //     type: 'webrtc_offer',
  //     sdp: sessionDescription,
  //     roomId: roomId,
  //     senderId: localPeerId,
  //     receiverId: remotePeerId,
  //   });
  // }

  // async function createAnswer(rtcPeerConnection, remotePeerId) {
  //   let sessionDescription;
  //   try {
  //     sessionDescription = await rtcPeerConnection.createAnswer(offerOptions);
  //     rtcPeerConnection.setLocalDescription(sessionDescription);
  //   } catch (error) {
  //     console.error(error);
  //   }

  //   console.log(
  //     `Sending answer from peer ${localPeerId} to peer ${remotePeerId}`
  //   );
  //   socket.emit('webrtc_answer', {
  //     type: 'webrtc_answer',
  //     sdp: sessionDescription,
  //     roomId: roomId,
  //     senderId: localPeerId,
  //     receiverId: remotePeerId,
  //   });
  // }

  // function setRemoteStream(event, remotePeerId) {
  //   console.log('Remote stream set');
  //   if (event.track.kind === 'video') {
  //     const videoREMOTO = document.createElement('video');
  //     videoREMOTO.srcObject = event.streams[0];
  //     videoREMOTO.id = 'remotevideo_' + remotePeerId;
  //     videoREMOTO.setAttribute('autoplay', '');
  //     videoREMOTO.style.backgroundColor = 'red';
  //     // videoChatContainer.append(videoREMOTO);
  //   }
  // }

  // function sendIceCandidate(event, remotePeerId) {
  //   if (event.candidate) {
  //     console.log(
  //       `Sending ICE Candidate from peer ${localPeerId} to peer ${remotePeerId}`
  //     );
  //     socket.emit('webrtc_ice_candidate', {
  //       senderId: localPeerId,
  //       receiverId: remotePeerId,
  //       roomId: roomId,
  //       label: event.candidate.sdpMLineIndex,
  //       candidate: event.candidate.candidate,
  //     });
  //   }
  // }

  // function checkPeerDisconnect(event, remotePeerId) {
  //   var state = peerConnections[remotePeerId].iceConnectionState;
  //   console.log(`connection with peer ${remotePeerId}: ${state}`);
  //   if (state === 'failed' || state === 'closed' || state === 'disconnected') {
  //     //Se eliminar el elemento de vídeo del DOM si se ha desconectado el par
  //     console.log(`Peer ${remotePeerId} has disconnected`);
  //     const videoDisconnected = document.getElementById(
  //       'remotevideo_' + remotePeerId
  //     );
  //     videoDisconnected.remove();
  //   }
  // }

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? 'Connected' : 'Waiting for users to join'}</h4>
      {myStream && <button>Send Stream</button>}
      {remoteSocketId && <button>CALL</button>}
      {myStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            muted
            height='100px'
            width='200px'
            url={myStream}
          />
        </>
      )}
      {remoteStream && (
        <>
          <h1>Remote Stream</h1>
          <ReactPlayer
            playing
            muted
            height='100px'
            width='200px'
            url={remoteStream}
          />
        </>
      )}
    </div>
  );
};

export default RoomPage;
