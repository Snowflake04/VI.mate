import styled from 'styled-components';
import VideoScreen from './VideoScreen';
import BottomNav from './BottomNav';
import React, { useEffect, useCallback, useState } from 'react';
import { useSocket, getPeer } from '../../../context/SocketProvider';

const MiddleContent = () => {
  const socket = useSocket();
  const Peer = getPeer();
  const [remoteStream, setRemoteStream] = useState('');
  const myStream = Peer.localStream;

  console.log('room re-render');
  useEffect(() => {
    socket.on('newUserJoined', (username, id) => {
      //TODO: create a splash for displaying  new user joined message
      console.log('New user joined');
    });
    socket.on('incommingCall', handleCall);
    socket.on('RTCOffer', handleOffer);
    socket.on('RTCAnswer', handleAnswer);
    socket.on('iceCandidate', handleICECandidate);
    socket.on('newStream', handleNewStream);
    return () => {
      socket.off('incommingCall', handleCall);
      socket.off('RTCOffer', handleOffer);
      socket.off('RTCAnswer', handleAnswer);
      socket.off('iceCandidate', handleICECandidate);
      socket.off('newStream', handleNewStream);
    };
  }, []);

  const handleCall = useCallback(
    async (offer) => {
      console.log('got call');
      await Peer.handleIncommingCall(offer);
    },
    [Peer]
  );

  const handleOffer = useCallback(
    (offer) => {
      Peer.handleRTCOffer(offer);
    },
    [Peer]
  );
  const handleAnswer = useCallback(
    async (offer) => {
      await Peer.handleRTCAnswer(offer);
    },
    [Peer]
  );
  const handleNewStream = useCallback(() => {
    console.log('got new remote stream');
    setRemoteStream(Peer.remoteStream);
  }, [Peer]);

  const handleICECandidate = useCallback(
    (offer) => {
      Peer.handleIceCandidate(offer);
    },
    [Peer]
  );

  return (
    <Container>
      <VideoScreen localStream={myStream} remoteStreams={remoteStream} />
      <BottomNav />
    </Container>
  );
};

export default MiddleContent;

const Container = styled.div`
  display: grid;
  grid-template: 8.5fr 1.2fr /1fr;
  border-radius: 15px;
  margin: 0 5px;
`;
