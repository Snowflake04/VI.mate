import styled, { keyframes } from 'styled-components';
import { useState, useRef, useCallback } from 'react';
const MainScreen = () => {
  const [room, setRoom] = useState(false);
  const [form, setForm] = useState(false);

  const handleJoin = useCallback(() => {
    setRoom((prev) => !prev);
  });

  const handleForm = useCallback(() => {
    setForm((prev) => !prev);
  });

  return (
    <Container>
      <LeftContainer>
        <Heading>Meet without a Hitch</Heading>
        <Content>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Temporibus
          placeat minus quod aut. Itaque exercitationem officiis ad ab debitis,
          distinctio molestias quos provident harum doloribus dolorem libero!
          Recusandae, facilis rerum.
        </Content>
        <FormHolder>
          <CreateButton onClick={handleForm}>Start a New Meeting</CreateButton>
          <JoinButton onClick={handleJoin}>Join a Meeting</JoinButton>
        </FormHolder>
        {room && (
          <CodeContainer>
            <Label>Room code</Label>
            <CodeInput maxLength={14} />
            <EnterButton>Join ⇨</EnterButton>
          </CodeContainer>
        )}
      </LeftContainer>
      <RightContainer>
        {form && (
          <RoomForm>
            <Name>Username:</Name>
            <Field />
            <Name>Room Purpose:</Name>
            <Field />
            <Name>Number of Participants:</Name>
            <Field />
            <CreateButton>Create</CreateButton>
          </RoomForm>
        )}
      </RightContainer>
    </Container>
  );
};

export default MainScreen;

const Drop = keyframes`
  0%{
    transform:translateY(-50px);
    opacity: 0;
  }
  30%{
    opacity:0.3;
  }
  100%{
    transform:translateX(0)
  }
`;

const SwipeRight = keyframes`
  0%{
    transform:translateX(-250px);
    opacity: 0;
  }
  100%{
    transform:translateX(0);
    opacity:1;
  }
`;
const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 100%;
  width: 100%;
`;

const LeftContainer = styled.div`
  max-width: 600px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  margin-left: 6%;
`;

const RightContainer = styled.div`
  display: grid;
  place-items: center;
`;

const Heading = styled.div`
  font-size: 3rem;
`;
const Content = styled.div`
  margin-top: 16px;
`;

const FormHolder = styled.div`
  margin-top: 16px;
  display: flex;
  gap: 16px;
`;
const CreateButton = styled.button`
  border: none;
  position: relative;
  background: transparent;
  padding: 8px 12px;
  border-radius: 12px;
  border: 2px solid rgba(250, 242, 242, 0.2);
  font-size: 12pt;
  cursor: pointer;
  overflow: hidden;
  z-index: 50;
  transition: 0.2s;

  &::after {
    transition: 0.4s;
    content: '';
    display: block;
    position: absolute;
    width: 0px;
    height: 100%;
    background-color: #4f5bda;
    left: 0px;
    top: 0;
    z-index: -1;
  }
  &:hover {
    transform: scale(1.1);
    &:after {
      width: 100%;
    }
  }
`;

const JoinButton = styled(CreateButton)``;

const CodeContainer = styled.div`
  margin-top: 40px;
  position: relative;
  animation: ${Drop} 1s;
`;

const CodeInput = styled.input`
  position: relative;
  background: transparent;
  outline: none;
  border: none;
  font-size: 14pt;
  border-bottom: 2px solid #e6e4e4;
`;

const Label = styled.label`
  position: absolute;
  font-size: 12pt;
  ${CodeContainer}:focus-within & {
    top: -20px;
    font-size: 10pt;
  }
`;

const EnterButton = styled(JoinButton)`
  margin-left: 14px;
  padding: 2px 8px;
  font-size: 12pt;
`;

const RoomForm = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.2);
  width: 350px;
  display: flex;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-direction: column;
  padding: 20px;
  border-radius: 20px;
  backdrop-filter: blur(20px);
  animation: ${SwipeRight} 1s;

  ${CreateButton} {
    align-self: flex-end;
    margin-top: 16px;
  }
`;
const Name = styled.label`
  margin: 10px 0;
`;
const Field = styled.input`
  width: 100%;
  background-color: transparent;
  outline: none;
  border: none;
  border-bottom: 2px solid rgba(0, 0, 0, 0.2);
`;
