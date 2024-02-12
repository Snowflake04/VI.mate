import styled from 'styled-components';
import ChatBubble from './ChatBubble';
import { useCallback, useEffect, useRef } from 'react';
import { useSocket, getPeer  } from '../../../context/SocketProvider';
import sampleChat from '../../../dummyDatas/Chat.json';

const Chats = () => {
  const socket = useSocket();
  const Peer = getPeer()
  const inputRef = useRef();


  useEffect(()=>{
    socket.on('newMessage', handleMessage)
    return () => {socket.off('newMessage')}
    }, [])

    const handleMessage = useCallback(message =>{
      
    })

  const handleSendButton = () => {
    const message = inputRef.current.value;
    if (message) {
      socket.emit('message', message, Peer.roomId);
    }
  };

  return (
    <Container>
      <Header>
        Chats
        <Counter>10</Counter>
      </Header>
      <ChatArea>
        <ChatBubble user />
        <ChatBubble user />
        <ChatBubble />
        <ChatBubble user />
        <ChatBubble />
        <ChatBubble user />
        <ChatBubble />
        <ChatBubble user />
        <ChatBubble />
        <ChatBubble user />
        <ChatBubble />
        <ChatBubble user />
        <ChatBubble />
      </ChatArea>
      <TextArea>
        <Input type='text' placeholder='Type your message...' ref={inputRef} />
        <Button onClick={handleSendButton}>
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>
            <path d='M16.1 260.2c-22.6 12.9-20.5 47.3 3.6 57.3L160 376V479.3c0 18.1 14.6 32.7 32.7 32.7c9.7 0 18.9-4.3 25.1-11.8l62-74.3 123.9 51.6c18.9 7.9 40.8-4.5 43.9-24.7l64-416c1.9-12.1-3.4-24.3-13.5-31.2s-23.3-7.5-34-1.4l-448 256zm52.1 25.5L409.7 90.6 190.1 336l1.2 1L68.2 285.7zM403.3 425.4L236.7 355.9 450.8 116.6 403.3 425.4z' />
          </svg>
        </Button>
      </TextArea>
    </Container>
  );
};

export default Chats;

const Container = styled.div`
  background: white;
  border-radius: 15px;
  margin-top: 5px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  height: 12%;
  display: flex;
  align-items: center;
  padding: 15px;
  max-width: 100%;
  font-size: 1.4rem;
  position: relative;

  &::after {
    content: '';
    background: #c0bebe;
    height: 2px;
    width: 80%;
    position: absolute;
    bottom: 0;
  }
`;

const Counter = styled.div`
  border: 1px solid #dfdede;
  border-radius: 50%;
  display: grid;
  padding: 0 5px;
  place-items: center;
  font-size: 1rem;
  margin-left: 12px;
`;

const ChatArea = styled.div`
  /* margin-top:12px; */
  background: linear-gradient(#ffffff, #d7cafa);
  height: 100%;
  overflow-y: scroll;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TextArea = styled.div`
  height: 20%;
  display: flex;
  margin: 0 12px;
  display: flex;
  align-items: center;
`;
const Input = styled.input`
  outline: none;
  border: none;
  padding: 10px;
  width: 90%;
  background: transparent;
`;

const Button = styled.button`
  width: 35px;
  border: none;
  background: linear-gradient(#f96b70, #76a7f4);
  border-radius: 50%;
  display: grid;
  cursor: pointer;
  place-items: center;
  padding: 8px;
  margin: 0 10px;
  svg {
    height: 100%;
    width: 100%;
    fill: #f5f4f4;
  }
`;
