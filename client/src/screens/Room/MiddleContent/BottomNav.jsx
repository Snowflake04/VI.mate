import styled from 'styled-components';
import { getPeer } from '../../../context/StreamProvider';
import { useNavigate } from 'react-router-dom';

const BottomNav = () => {
  const Peer = getPeer();
  const navigate = useNavigate();

  const handleLeaveButton = () => {
    Peer.emit('disconnected', Peer.roomId);
    Peer.disconnect();
    navigate('/', {
      replace: true,
    });
  };

  return (
    <Container>
      <RoomDetails>
        <Name>Room for doing something...</Name>
        <Code>{Peer.roomId}</Code>
      </RoomDetails>
      <RoomControls>
        <Control>
          <svg viewBox='0 0 384 512'>
            <path d='M192 0C139 0 96 43 96 96V256c0 53 43 96 96 96s96-43 96-96V96c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 89.1 66.2 162.7 152 174.4V464H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h72 72c13.3 0 24-10.7 24-24s-10.7-24-24-24H216V430.4c85.8-11.7 152-85.3 152-174.4V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 70.7-57.3 128-128 128s-128-57.3-128-128V216z' />
          </svg>
        </Control>
        <Control>
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

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  border-radius: 15px;
  margin: 10px;
  margin-bottom: 0;
  padding: 5px 20px;
`;
const RoomDetails = styled.div``;
const Name = styled.h4``;
const Code = styled.div`
  color: gray;
`;
const RoomControls = styled.div`
  display: flex;
  gap: 10px;
`;
const Control = styled.div`
  height: 38px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #efefef;
  display: grid;
  place-items: center;
  svg {
    height: 40%;
    width: 40%;
    fill: #8b8a8a;
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
