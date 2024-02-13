import styled from 'styled-components';
import LeftNav from './LeftNav/LeftNav';
import MiddleContent from './MiddleContent';
import RightComponent from './RightComponents';
import { useEffect, useCallback } from 'react';
import { useSocket, getPeer } from '../../context/SocketProvider';
import { useStream } from '../../context/StreamProvider';

const Splash = () => {
  const socket = useSocket();
  const Peer = getPeer();
  const { setUserMap } = useStream();

  console.log('room re-render');
  useEffect(() => {
    socket.on('newUserJoined', (username, id) => {
      setUserMap((prev) => ({ ...prev, [id]: username }));
      //TODO: create a splash for displaying  new user joined message
      console.log('New user joined');
    });
    socket.on('incommingCall', handleCall);
    socket.on('RTCOffer', handleOffer);
    socket.on('RTCAnswer', handleAnswer);
    socket.on('iceCandidate', handleICECandidate);
    return () => {
      socket.off('incommingCall', handleCall);
      socket.off('RTCOffer', handleOffer);
      socket.off('RTCAnswer', handleAnswer);
      socket.off('iceCandidate', handleICECandidate);
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

  const handleICECandidate = useCallback(
    (offer) => {
      Peer.handleIceCandidate(offer);
    },
    [Peer]
  );

  return (
    <MainContainer>
      <LeftNav />
      <MiddleContent />
      <RightComponent />
    </MainContainer>
  );
};

export default Splash;

const MainContainer = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 4fr 1.5fr;
  height: 100dvh;
  background-color: #e0dfdf;
  padding: 12px;
`;
