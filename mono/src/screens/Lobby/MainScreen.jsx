import styled, { keyframes } from 'styled-components';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPeer, useStream } from '../../context/StreamProvider';

const MainScreen = () => {
  // <-------------------DECLERATIONS--------------->
  const Peer = getPeer();
  console.log(Peer);
  const [room, setRoom] = useState(false);
  const [form, setForm] = useState(false);
  const [wait, setWait] = useState(false);
  const navigate = useNavigate();
  const joinUserRef = useRef();
  const joinCodeRef = useRef();
  const CreateUserRef = useRef();
  const description = useRef();
  const authRef = useRef();

  const { setMessages, setUserMap } = useStream();

  // <----------------------FUNCTIONS-------------------->

  const handleJoin = useCallback(() => {
    setForm(false);
    setRoom((prev) => !prev);
  });

  const handleForm = useCallback(() => {
    setRoom(false);
    setForm((prev) => !prev);
  });

  const handleRoomCreate = useCallback(() => {
    let err = {};
    if (CreateUserRef.current.value === '') {
      CreateUserRef.current.placeholder = 'Username is required';
      err['user'] = true;
    }

    if (description.current.value === '') {
      description.current.placeholder = 'Add a description!';
      err['des'] = true;
    }

    if (Object.values(err).every((val) => val === null)) {
      Peer.emit(
        'createRoom',
        CreateUserRef.current.value,
        description.current.value,
        authRef.current.checked
      );
    }
  });

  const handleJoinRoom = useCallback(() => {
    const err = {};
    const regEx = /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/;

    if (joinUserRef.current.value === '') {
      joinUserRef.current.placeholder = 'Username is required!';
      err['user'] = true;
    }
    if (joinCodeRef.current.value === '') {
      joinCodeRef.current.placeholder = 'Please enter Room Code';
      err['code'] = true;
    } else if (!regEx.test(joinCodeRef.current.value)) {
      joinCodeRef.current.value = '';
      err['code'] = true;
      joinCodeRef.current.placeholder = 'Please a Valid Code';
    }

    if (Object.values(err).every((val) => val === null)) {
      Peer.emit(
        'joinRoom',
        joinUserRef.current.value,
        joinCodeRef.current.value
      );
    }
  });

  const joinRoom = async (room) => {
    Peer.roomId = room.roomCode;
    Peer.roomDetails = room;
    setUserMap(room.participants);
    setMessages(room.messages);
    navigate(`/room/${room.roomCode}`, { replace: true });
    Peer.emit('createCall', {
      roomId: Peer.roomId,
      from: Peer.id,
    });
  };

  const joinNewRoom = async (room) => {
    setUserMap(room.participants);
    Peer.roomId = room.roomCode;
    Peer.roomDetails = room;
    navigate(`/room/${room.roomCode}`, { replace: true });
  };

  const handleWait = (room) => {
    setWait({ name: room, status: 'is Pending...' });
  };

  const handleReject = (room) => {
    setWait({ name: room, status: 'is Declined.' });
  };

  // <-----------------------EFFECTS------------------->

  useEffect(() => {
    Peer.on('newRoomCreated', joinNewRoom);
    Peer.on('roomJoined', joinRoom);
    Peer.on('approvalPending', handleWait);
    Peer.on('requestDenied', handleReject);
    return () => {
      Peer.off('newRoomCreated', joinNewRoom);
      Peer.off('roomJoined', joinRoom);
      Peer.off('approvalPending', handleWait);
      Peer.off('requestDenied', handleReject);
    };
  }, [Peer]);

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
      </LeftContainer>
      <RightContainer>
        {form && (
          <RoomForm>
            <Name>Username:</Name>
            <Field ref={CreateUserRef} />
            <Name>Room Name:</Name>
            <Field ref={description} />
            {/* <Name>Number of Participants:</Name>
            <Field type='number' /> */}
            <Authorization>
              <Field ref={authRef} type='checkbox' />
              <Name>Require Authorization</Name>
            </Authorization>

            <CreateButton onClick={handleRoomCreate}>Create</CreateButton>
          </RoomForm>
        )}
        {room && (
          <RoomForm>
            <Name>Username:</Name>
            <Field ref={joinUserRef} />
            <Name>Room Code:</Name>
            <Field ref={joinCodeRef} />
            {wait && (
              <Message>
                Your request to join {wait.name} {wait.status}
              </Message>
            )}
            <EnterButton onClick={handleJoinRoom}>Join ⇨</EnterButton>
          </RoomForm>
        )}
      </RightContainer>
    </Container>
  );
};

export default MainScreen;

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
  background: #ecebeb57;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 12pt;
  cursor: pointer;
  overflow: hidden;
  z-index: 50;
  transition: 0.2s;
  box-shadow: 1px 1px 5px #434343;

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

const EnterButton = styled(JoinButton)`
  margin-left: 14px;
  padding: 2px 8px;
  font-size: 12pt;
`;

const Message = styled.div`
  margin-top: 8px;
  color: #114b8e;
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
  box-shadow: 2px 2px 50px #7e7e7e58;
  animation-name: ${SwipeRight};
  animation-duration: 1s;

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

  &::placeholder {
    color: red;
  }

  &::-webkit-inner-spin-button {
    display: none;
  }
`;

const Authorization = styled.div`
  margin-top: 16px;

  ${Field} {
    width: auto;
    margin-right: 8px;
  }
`;
