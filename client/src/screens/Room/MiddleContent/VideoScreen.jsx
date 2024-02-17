import styled from 'styled-components';
import ReactPlayer from 'react-player';
import { useEffect, useCallback } from 'react';
import { useStream, getPeer } from '../../../context/StreamProvider';

const VideoScreen = () => {
  const Peer = getPeer();
  const { remoteStream, setRemoteStream } = useStream();

  console.log('video screen re-render');

  const handleStreamUpdate = useCallback(() => {
    console.log('updating...');
    setRemoteStream({ ...Peer.remoteStream });
  });

  useEffect(() => {
    Peer.on('remoteStreamUpdate', handleStreamUpdate);
    return () => Peer.off('remoteStreamUpdate', handleStreamUpdate);
  }, [handleStreamUpdate]);

  return (
    <Container>
      <LocalStream>
        <Player url={Peer.localStream} playing width={'100%'} muted />
      </LocalStream>
      <RemoteStream>
        {remoteStream &&
          Object.values(remoteStream).map((stream) => (
            <RemoteStreamContainer key={stream.id}>
              <Player playing width={'100%'} url={stream} />
            </RemoteStreamContainer>
          ))}
      </RemoteStream>
    </Container>
  );
};

export default VideoScreen;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 15px;
  margin: 5px 10px;
  margin-top: 0;
  position: relative;
  justify-content: space-between;
  align-content: space-between;
`;
const LocalStream = styled.div`
  height: 0;
  padding-bottom: 56.25%;
  border-radius: 15px;
  margin-bottom: 5px;
  max-height: 55%;
  overflow: hidden;
  img {
    width: 100%;
    border-radius: 15px;
  }
`;

const RemoteStream = styled.div`
  border-radius: 15px;
  margin-top: 5px;
  display: grid;
  gap: 12px;
  max-height: 100%;
  grid-template: 1fr/ 1fr 1fr 1fr 1fr;
  overflow: hidden;
  img {
    width: 100%;
  }
  & > div:nth-child(n + 5) {
    display: none;
  }
`;

const RemoteStreamContainer = styled.div`
  border-radius: 15px;
  overflow: hidden;
  img {
    height: 100%;
  }
`;

const Player = styled(ReactPlayer)`
  transform: scaleX(-1);
  border-radius: 15px;
  background-color: #4b4b4b;
  aspect-ratio: 16/9;
  height: auto !important;
`;
