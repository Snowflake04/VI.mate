import { useEffect, useRef, memo } from 'react';
import styled from 'styled-components';

const VideoStream = ({ stream, muted }) => {
  const videoRef = useRef();
  useEffect(() => {
    console.log('video re rendered');
    if (stream instanceof MediaStream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <>
      <Player ref={videoRef} muted={muted ? true : false} autoPlay />
    </>
  );
};

export default memo(VideoStream);

const Player = styled.video`
  padding: 0;
  border-radius: 15px;
  max-width: 100%;
  background-color: #4b4b4b;
  aspect-ratio: 16/9;
`;
