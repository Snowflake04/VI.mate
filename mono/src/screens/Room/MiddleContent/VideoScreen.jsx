import styled from 'styled-components';
import VideoStream from './videoStream';
import { useEffect, useCallback } from 'react';
import { useStream, getPeer } from '../../../context/StreamProvider';

const VideoScreen = ({ layout }) => {
  const Peer = getPeer();
  const { remoteStream, setRemoteStream } = useStream();

  console.log('video screen re-render');

  const handleStreamUpdate = useCallback(() => {
    console.log('updating...');
    setRemoteStream({ ...Peer.remoteStream });
  }, [Peer]);

  useEffect(() => {
    Peer.on('remoteStreamUpdate', handleStreamUpdate);
    return () => Peer.off('remoteStreamUpdate', handleStreamUpdate);
  }, [Peer]);
  return (
    <Container layout={layout}>
      {layout ? (
        <>
          <VideoStream stream={Peer.localStream} />
          {remoteStream &&
            Object.values(remoteStream).map((stream) => (
              <VideoStream stream={stream} />
            ))}
        </>
      ) : (
        <>
          <LocalStream>
            <VideoStream stream={Peer.localStream} />
          </LocalStream>
          <RemoteStream>
            {remoteStream &&
              Object.values(remoteStream).map((stream) => (
                <RemoteStreamContainer key={stream.id}>
                  <VideoStream stream={stream} />
                </RemoteStreamContainer>
              ))}
          </RemoteStream>
        </>
      )}
    </Container>
  );
};

export default VideoScreen;

const Container = styled.div`
  display: ${(props) => (props.layout ? 'grid' : 'flex')};
  flex-direction: column;
  grid-template: auto/repeat(auto-fill, minmax(200px, 1fr));
  gap:8px;
  border-radius: 15px;
  margin: 5px 10px;
  margin-top: 0;
  position: relative;
  justify-content: space-between;
  align-content: space-between;
`;

const LocalStream = styled.div`
  aspect-ratio: 16/9;
  height: 0;
  padding-bottom: 56%;
  border-radius: 15px;
  overflow: hidden;
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
