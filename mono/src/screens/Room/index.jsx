import styled from 'styled-components';
import LeftNav from './LeftNav/LeftNav';
import MiddleContent from './MiddleContent';
import RightComponent from './RightComponents';
import { useEffect, useCallback } from 'react';
import { useStream, getPeer } from '../../context/StreamProvider';

const Splash = () => {
  const Peer = getPeer();
  const { setUserMap } = useStream();

  console.log('room re-render');
  useEffect(() => {
    Peer.on('incommingCall', handleCall);
    Peer.on('RTCOffer', handleOffer);
    Peer.on('RTCAnswer', handleAnswer);
    Peer.on('iceCandidate', handleICECandidate);
    Peer.on('userDisconnected', removeUser);
    return () => {
      Peer.off('incommingCall', handleCall);
      Peer.off('RTCOffer', handleOffer);
      Peer.off('RTCAnswer', handleAnswer);
      Peer.off('iceCandidate', handleICECandidate);
      Peer.off('userDisconnected', removeUser);
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

  const removeUser = useCallback(
    (userId) => {
      setUserMap((prevUserMap) => {
        const newUserMap = { ...prevUserMap };
        delete newUserMap[userId];
        return newUserMap;
      });

      Peer.removeRemoteStream(userId);
    },
    [setUserMap]
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
  grid-template-columns: 1fr 4fr 1.4fr;
  height:100dvh;
  max-height: 100dvh;
  background-color: #e0dfdf;
  padding: 12px;
`;
