import styled from 'styled-components';
import ChatBubble from './ChatBubble';
import { useCallback, useEffect, useRef } from 'react';
import { useStream, getPeer } from '/src/context/StreamProvider';

const Chats = () => {
  const Peer = getPeer();
  const inputRef = useRef();
  const chatAreaRef = useRef();
  const { messages, setMessages } = useStream();

  console.log(messages);
  useEffect(() => {
    Peer.on('newMessage', handleMessage);
    return () => {
      Peer.off('newMessage', handleMessage);
    };
  }, []);

  const handleMessage = useCallback((message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  });

  const handleKeyPress = useCallback((e) => {
    if (e.shiftKey) return;
    if (e.key === 'Enter') {
      handleSendButton();
    }
  });

  const handleSendButton = () => {
    const message = inputRef.current.value.trim();
    if (message) {
      Peer.emit('message', message, Peer.roomId);
      setMessages((prevMessages) => [
        ...prevMessages,
        { content: message, self: true },
      ]);
      inputRef.current.value = '';
    }
  };

  return (
    <Container>
      <Header>
        Chats
        <Counter>{messages.length}</Counter>
      </Header>
      <ChatArea ref={chatAreaRef}>
        {messages.map((msg, index) => (
          <ChatBubble key={index} message={msg} />
        ))}
      </ChatArea>
      <TextArea>
        <Input
          onKeyDown={handleKeyPress}
          type='text'
          placeholder='Type your message...'
          ref={inputRef}
        />
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
  border-radius: 10px;
  margin-top: 5px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(-0.75turn, #ffffff, #e5eefc);
`;

const Header = styled.div`
  height: 12%;
  display: flex;
  align-items: center;
  padding: 15px;
  max-width: 100%;
  font-size: 1.4rem;
  position: relative;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
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
  height: 100%;
  padding: 0 10vpx;
  overflow-y: scroll;
  position: relative;
  padding-bottom: 60px;
  &::-webkit-scrollbar {
    display: none;
    scroll-behavior: smooth;
  }
`;

const TextArea = styled.div`
  height: 60px;
  display: flex;
  padding: 0 12px;
  align-items: center;
  position: absolute;
  bottom: 0;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.252);
  backdrop-filter: blur(3px);
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
  z-index: 5;
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
  background: linear-gradient(0.25turn, #cd09f4, #76a7f4);
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
