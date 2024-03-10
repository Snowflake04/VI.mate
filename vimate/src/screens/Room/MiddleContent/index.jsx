import styled from 'styled-components';
import VideoScreen from './VideoScreen';
import BottomNav from './BottomNav';
import { memo, useCallback, useEffect, useState, useRef } from 'react';
import { getPeer } from '../../../context/StreamProvider';
import { AsyncQueue } from '@snowflake04/async-queue';

const MiddleContent = memo(() => {
  const [queue] = useState(() => new AsyncQueue());

  const [expandedLayout, setExpandedLayout] = useState(false);
  const [showRequest, setShowRequest] = useState(null);
  const socket = useRef(null);
  const [Peer] = useState(getPeer());

  useEffect(() => {
    Peer.on('userRequest', handleJoinRequest);
    return () => Peer.off('userRequest', handleJoinRequest);
  }, [Peer]);

  const handleJoinRequest = useCallback(async (user) => {
    console.log(queue);
    await queue.wait();
    setShowRequest(user.name);
    socket.current = user;
  });
  const handleApproval = useCallback(() => {
    Peer.emit('requestApproval', socket.current, Peer.roomId);
    queue.shift();
    if (!queue.promises[0]) setShowRequest('');
  });

  const handleReject = useCallback(() => {
    Peer.emit('requestDecline', socket.current, Peer.roomId);
    queue.shift();
    if (!queue.promises[0]) setShowRequest('');
  });

  return (
    <Container>
      {showRequest && (
        <Request>
          {showRequest} requested to join
          <Buttons>
            <AcceptButton onClick={handleApproval}>Accept</AcceptButton>
            <RejectButton onClick={handleReject}>Reject</RejectButton>
          </Buttons>
        </Request>
      )}
      <VideoScreen layout={expandedLayout} />
      <BottomNav setLayout={setExpandedLayout} />
    </Container>
  );
});

export default MiddleContent;

const Container = styled.div`
  display: grid;
  grid-template: 8.5fr 1.5fr / auto;
  border-radius: 15px;
  margin: 0 5px;
  overflow: hidden;
  position: relative;
`;
const Request = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  font-size: 13pt;
  background-color: white;
  border: 2px solid white;
  padding: 5px 20px;
  margin: 0 5px;
  border-radius: 4px;
  right: 0;
  top: 2%;
  z-index: 500;
`;

const Buttons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  margin: 4px 0;
`;

const AcceptButton = styled.button`
  outline: none;
  border: none;
  background-color: transparent;
  color: green;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 8px;
  transition: 0.1s;
  &:hover {
    transform: scale(1.05);
    background-color: #edeaea;
  }
`;
const RejectButton = styled(AcceptButton)`
  color: red;
`;
