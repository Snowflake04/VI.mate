import styled, { keyframes } from 'styled-components';
import { getPeer, useStream } from '../../../context/StreamProvider';
import { useNavigate } from 'react-router-dom';

import { useEffect, useState, useCallback } from 'react';

const BottomNav = ({ setLayout }) => {
  const Peer = getPeer();
  const navigate = useNavigate();
  const [newUser, setNewUser] = useState(null);
  const { setUserMap } = useStream();

  const handleLeaveButton = () => {
    Peer.emit('disconnected', Peer.roomId);
    Peer.disconnect();
    navigate('/', {
      replace: true,
    });
  };

  useEffect(() => {
    Peer.on('newUserJoined', (username, id) => {
      setUserMap((prev) => ({ ...prev, [id]: username }));
      setNewUser(username);

      setTimeout(() => {
        setNewUser(null);
      }, 3000);

      console.log('New user joined');
    });
  }, []);

  const muteAudio = useCallback(() => {
    let audioTrack = Peer.localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
  });

  const muteVideo = useCallback(() => {
    let videoTrack = Peer.localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
  });

  const changeLayout = useCallback(() => {
    setLayout((prev) => !prev);
  });

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(Peer.roomId);
  });

  return (
    <Container>
      <RoomDetails>
        <Name>Room for doing something...</Name>
        <Code>
          {Peer.roomId}
          <svg
            onClick={handleCopy}
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 448 512'
          >
            <path d='M384 336H192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16l140.1 0L400 115.9V320c0 8.8-7.2 16-16 16zM192 384H384c35.3 0 64-28.7 64-64V115.9c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1H192c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H256c35.3 0 64-28.7 64-64V416H272v32c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16H96V128H64z' />
          </svg>
        </Code>
      </RoomDetails>
      {newUser && <UserToast>{`${newUser} joined`}</UserToast>}
      <RoomControls>
        <Control onClick={changeLayout}>
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>
            <path d='M447.8 64H64c-23.6 0-42.7 19.1-42.7 42.7v63.9H64v-63.9h383.8v298.6H298.6V448H448c23.6 0 42.7-19.1 42.7-42.7V106.7C490.7 83.1 471.4 64 447.8 64zM21.3 383.6L21.3 383.6l0 63.9h63.9C85.2 412.2 56.6 383.6 21.3 383.6L21.3 383.6zM21.3 298.6V341c58.9 0 106.6 48.1 106.6 107h42.7C170.7 365.6 103.7 298.7 21.3 298.6zM213.4 448h42.7c-.5-129.5-105.3-234.3-234.8-234.6l0 42.4C127.3 255.6 213.3 342 213.4 448z' />
          </svg>
        </Control>

        <Control onClick={muteAudio}>
          <svg viewBox='0 0 384 512'>
            <path d='M192 0C139 0 96 43 96 96V256c0 53 43 96 96 96s96-43 96-96V96c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 89.1 66.2 162.7 152 174.4V464H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h72 72c13.3 0 24-10.7 24-24s-10.7-24-24-24H216V430.4c85.8-11.7 152-85.3 152-174.4V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 70.7-57.3 128-128 128s-128-57.3-128-128V216z' />
          </svg>
        </Control>
        <Control onClick={muteVideo}>
          <svg viewBox='0 0 576 512'>
            <path d='M0 128C0 92.7 28.7 64 64 64H320c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM559.1 99.8c10.4 5.6 16.9 16.4 16.9 28.2V384c0 11.8-6.5 22.6-16.9 28.2s-23 5-32.9-1.6l-96-64L416 337.1V320 192 174.9l14.2-9.5 96-64c9.8-6.5 22.4-7.2 32.9-1.6z' />
          </svg>
        </Control>
        <Control>
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>
            <path d='M0 128C0 92.7 28.7 64 64 64H448c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zm64 32v64c0 17.7 14.3 32 32 32H416c17.7 0 32-14.3 32-32V160c0-17.7-14.3-32-32-32H96c-17.7 0-32 14.3-32 32zM80 320c-13.3 0-24 10.7-24 24s10.7 24 24 24h56c13.3 0 24-10.7 24-24s-10.7-24-24-24H80zm136 0c-13.3 0-24 10.7-24 24s10.7 24 24 24h48c13.3 0 24-10.7 24-24s-10.7-24-24-24H216z' />
          </svg>
        </Control>
        <LeaveButton onClick={handleLeaveButton}>
          <svg viewBox='0 0 24 24'>
            <path
              xmlns='http://www.w3.org/2000/svg'
              d='M23.2929 12.7071L20.818 15.182C20.4291 15.5709 19.7927 15.5709 19.4038 15.182C18.5199 14.2981 17.53 13.591 16.4764 13.0607C16.1511 12.891 15.9319 12.5586 15.9319 12.1626V9.05137C12.9126 8.06849 9.63867 8.07556 6.61226 9.05137V12.1626C6.60519 12.4384 6.49912 12.6859 6.31527 12.8697C6.24456 12.9405 6.15971 13.0112 6.06071 13.0536C5.00713 13.5839 4.0101 14.2981 3.13329 15.1749C2.74438 15.5638 2.10799 15.5638 1.71908 15.1749L-0.748724 12.7071C-1.13763 12.3182 -1.13763 11.6818 -0.748724 11.2929C5.89101 4.65316 16.6532 4.65316 23.2929 11.2929C23.6818 11.6818 23.6818 12.3182 23.2929 12.7071Z'
            />
          </svg>
          <div>Leave Session</div>
        </LeaveButton>
      </RoomControls>
    </Container>
  );
};

export default BottomNav;

const reveal = keyframes`
    0% {
        visibility: hidden;
    }

    25% {
        visibility: hidden;
    }

    50% {
        visibility: hidden;
    }

    75% {
        visibility: visible;
        border-radius: 100%;
        width: 24px;
        height: 24px;
        color: transparent;
    }

    100% {
        visibility: visible;
    }
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  border-radius: 15px;
  margin: 10px;
  margin-bottom: 0;
  padding: 5px 20px;
  min-height: 30px;
`;
const RoomDetails = styled.div``;
const Name = styled.h4``;

const Code = styled.div`
  display: flex;
  color: gray;
  svg {
    height: 14px;
    fill: gray;
    margin-left: 16px;
    margin-top:2px;
    cursor: pointer;
    &:active {
      transition: 0.2s;
      transform: scale(1.3);
      fill: #f52e2e;
    }
  }
`;
const RoomControls = styled.div`
  display: flex;
  gap: 10px;
`;
const Control = styled.button`
  height: 38px;
  aspect-ratio: 1;
  cursor: pointer;
  border: none;
  border-radius: 50%;
  background: #efefef;
  display: grid;
  transition: 0.4s;
  place-items: center;
  svg {
    height: 40%;
    width: 40%;
    fill: #8b8a8a;
  }
  &:hover {
    background-color: #44fd11;
    svg {
      transition: 0.8s;
      fill: #3f3f3f;
      transform: scale(1.1);
    }
  }
`;
const LeaveButton = styled.button`
  border-radius: 20px;
  padding: 5px 20px;
  border: none;
  background-color: red;
  color: #e1dede;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  letter-spacing: 1px;
  svg {
    height: 18px;
    fill: white;
  }
`;
const UserToast = styled.div`
  display: grid;
  place-items: center;
  border: 1px solid #6dabd2;
  border-radius: 100px;
  background-color: #6dabd2;
  color: #ffffff;
  padding: 15px;
  animation: ${reveal} 1.2s;
`;