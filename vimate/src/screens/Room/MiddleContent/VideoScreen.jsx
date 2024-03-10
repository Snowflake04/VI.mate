import styled from 'styled-components';
import VideoStream from './videoStream';
import { useEffect, useCallback, useState, useMemo } from 'react';
import { useStream, getPeer } from '../../../context/StreamProvider';

const VideoScreen = ({ layout }) => {
  const Peer = useMemo(() => getPeer());
  const lay = layout;
  const { remoteStream, setRemoteStream, localStream } = useStream();
  const [localVideo, setLocalVideo] = useState(null);
  const [remoteVideos, setRemoteVideos] = useState({});

  useMemo(() => {
    let localVideoMap = {};
    if (localStream) {
      console.log('updating local Video Map');
      //minimal Performance Impact. Max object Size = 25
      for (const [id, stream] of Object.entries(localStream)) {
        localVideoMap[id] = <VideoStream muted stream={stream} />;
      }
      setLocalVideo({ ...localVideoMap });
    }
  }, [localStream]);

  useMemo(() => {
    let remoteVideoMap = {};
    if (remoteStream) {
      console.log('updating remote Video Map');
      for (const [id, stream] of Object.entries(remoteStream)) {
        remoteVideoMap[id] = <VideoStream stream={stream} />;
      }
    } else {
      remoteVideoMap = {}; //Reset the Map
    }
    setRemoteVideos({ ...remoteVideoMap });
  }, [remoteStream]);

  // <--------Effects--------->
  useEffect(() => {
    Peer.on('remoteStreamUpdate', handleStreamUpdate);
    return () => Peer.off('remoteStreamUpdate', handleStreamUpdate);
  }, [Peer]);

  // <----------Functions--------->

  const handleStreamUpdate = useCallback(() => {
    setRemoteStream({ ...Peer.remoteStream });
  }, [Peer]);

  const remoteClickHandler = () => {}; // TODO:

  return (
    <Container expanded={lay}>
      {layout ? (
        <ExpandedLayout>
          {localVideo &&
            Object.values(localVideo).map((stream) => {
              return stream;
            })}

          {remoteVideos &&
            Object.values(remoteVideos).map((stream) => {
              return stream;
            })}
        </ExpandedLayout>
      ) : (
        <>
          <LocalStream>
            {localVideo &&
              Object.values(localVideo).map((stream) => {
                return stream;
              })}
          </LocalStream>
          <RemoteStream>
            {remoteVideos &&
              Object.values(remoteVideos).map((stream, index) => (
                <RemoteStreamContainer key={index}>
                  {stream}
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
  display: ${(props) => (props.expanded ? 'grid' : 'flex')};
  flex-direction: column;
  grid-template: auto/repeat(auto-fill, minmax(200px, 1fr));
  border-radius: 15px;
  margin: 0 10px;
  margin-top: 0;
  position: relative;
  justify-content: space-between;
  align-content: space-between;
`;

const ExpandedLayout = styled.div`
display:flex;
gap:16px;
`

const LocalStream = styled.div`
  aspect-ratio: 16/9;
  height: 0;
  width: 100%;
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
