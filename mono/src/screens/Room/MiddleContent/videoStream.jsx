import { useEffect, useRef } from 'react';
import styled from 'styled-components';

const VideoStream = ({ stream }) => {
  const videoRef = useRef();
console.log("re render")
  useEffect(() => {
    videoRef.current.srcObject = stream;
  },[stream]);

  return (
    <>
      <Player ref={videoRef} autoPlay />
    </>
  );
};

export default VideoStream;

const Player = styled.video`
  border-radius: 15px;
  padding: 0;
  width: 100%;
  background-color: #4b4b4b;
  aspect-ratio: 16/9;
`;
