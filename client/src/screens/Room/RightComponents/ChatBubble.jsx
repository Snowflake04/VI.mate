import styled from 'styled-components';
import { useCallback } from 'react';
import { useStream } from '../../../context/StreamProvider';

const UserBubble = ({ message }) => {
  const { userMap } = useStream();

  const getUser = useCallback(() => {
    return userMap[message.user];
  });

  return (
    <Container user={message.self ? true : null}>
      <Avatar></Avatar>
      <Message user={message.self ? true : null}>
        {message.content}
        <Placeholder>{message.self ? 'You' : getUser()}</Placeholder>
      </Message>
    </Container>
  );
};

export default UserBubble;

const Container = styled.div`
  margin: 10px 0;
  padding: 0 12px;
  display: flex;
  flex-direction: ${(props) => (props.user ? 'row-reverse' : 'row')};
  width: 100%;
`;
const Avatar = styled.div`
  height: 40px;
  aspect-ratio: 1;
  border: 2px solid;
  border-radius: 100dvh;
`;

const Message = styled.div`
  width: 100%;
  font-size: 16px;
  min-height: 25px;
  margin-right: ${(props) => (props.user ? '8px' : 0)};
  margin-left: ${(props) => (props.user ? 0 : '8px')};
  margin-top: 25px;
  padding: 8px 16px;
  color: #605f5f;
  background-color: ${(props) => (props.user ? '#ffffff' : '#75cdb1;')};
  border-radius: ${(props) =>
    props.user ? '20px 0px 20px 20px' : '0px 20px 20px 20px'};
  align-self: flex-end;
  position: relative;
  z-index:5;
  filter: drop-shadow(5px 5px 2px #bbbbbba9);
`;
const Placeholder = styled.div`
  height: 12px;
  filter: none;
  width: 100%;
  position: absolute;
  top: -17px;
  content: ${(props) => (props.user ? 'YOU' : 'User')};
`;
