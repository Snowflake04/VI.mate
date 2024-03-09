import styled from 'styled-components';
import { useCallback, useEffect, useRef } from 'react';
import { useStream } from '/src/context/StreamProvider';

const UserBubble = ({ message }) => {
  const { userMap } = useStream();
  const containerRef = useRef();

  useEffect(() => {
    containerRef.current.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const getUser = useCallback(() => {
    return userMap[message.user] || 'user';
  }, [userMap]);

  return (
    <Container ref={containerRef} user={message.self ? true : null}>
      <Avatar></Avatar>
      <ChatContainer user={message.self ? true : null}>
        <Placeholder user={message.self ? true : null}>
          {message.self ? 'You' : getUser()}
        </Placeholder>
        <Message user={message.self ? true : null}>{message.content}</Message>
      </ChatContainer>
    </Container>
  );
};

export default UserBubble;

const Container = styled.div`
  margin: 18px 0;
  padding: 0 12px;
  display: flex;
  flex-direction: ${(props) => (props.user ? 'row-reverse' : 'row')};
  width: 100%;
  position: relative;
`;

const ChatContainer = styled.div`
  margin-right: ${(props) => (props.user ? '8px' : 0)};
  margin-left: ${(props) => (props.user ? 0 : '6px')};
`;

const Avatar = styled.div`
  height: 40px;
  aspect-ratio: 1;
  z-index: 5;
  border: 2px solid rgba(0,0,0,0.2);
  border-radius: 100dvh;
  filter: drop-shadow(0 5px 2px rgba(0, 0, 0, 0.05));
  img {
    width: 100%;
  }
`;

const Message = styled.div`
  width: auto;
  font-size:12pt;
  display: flex;
  text-align: justify;
  word-break: break-all;
  align-items: center;
  min-height: 40px;
  padding: 8px;
  color: #605f5f;
  background-color: ${(props) => (props.user ? '#ffffff' : '#9cefd5;')};
  border-radius: ${(props) =>
    props.user ? '20px 0px 20px 20px' : '0px 20px 20px 20px'};
  align-self: flex-end;
  z-index: 5;
  filter: drop-shadow(3px 3px 2px #bbbbbba9);
`;

const Placeholder = styled.div`
  height: 14px;
  font-size:10pt;
  filter: none;
  width: 100%;
  display: flex;
  justify-content: ${(props) => (props.user ? 'flex-end' : 'flex-start')};
  margin-bottom: 4px;
`;
