import styled, { keyframes } from 'styled-components';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPeer, useStream } from '../../context/StreamProvider';
import phone from '../../images/phone.png';
import laptop from '../../images/laptop.png';
const MainScreen = () => {
  // <-------------------DECLERATIONS--------------->
  const Peer = getPeer();
  console.log(Peer);
  const [room, setRoom] = useState(false);
  const [form, setForm] = useState(false);
  const [info, setInfo] = useState(false);
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
    // Peer.emit('createCall', {
    //   roomId: Peer.roomId,
    //   from: Peer.id,
    // });
  };

  const joinNewRoom = async (room) => {
    setUserMap(room.participants);
    Peer.roomId = room.roomCode;
    Peer.roomDetails = room;
    navigate(`/room/${room.roomCode}`, { replace: true });
  };

  const handleWait = (room) => {
    setInfo({ name: room, status: 'is Pending...' });
  };

  const handleReject = (room) => {
    setInfo({ name: room, status: 'is Declined.' });
  };

  const handleNoRoom = (room) => {
    setInfo({
      name: 'room',
      status:
        'is Rejected. Make sure the room code is correct or the room is not closed.',
    });
  };

  // <-----------------------EFFECTS------------------->

  useEffect(() => {
    Peer.on('newRoomCreated', joinNewRoom);
    Peer.on('roomJoined', joinRoom);
    Peer.on('approvalPending', handleWait);
    Peer.on('requestDenied', handleReject);
    Peer.on('roomNotFound', handleNoRoom);
    return () => {
      Peer.off('newRoomCreated', joinNewRoom);
      Peer.off('roomJoined', joinRoom);
      Peer.off('approvalPending', handleWait);
      Peer.off('requestDenied', handleReject);
      Peer.on('roomNotFound', handleNoRoom);
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
            {info && (
              <Message>
                Your request to join {info.name} {info.status}
              </Message>
            )}
            <EnterButton onClick={handleJoinRoom}>Join ⇨</EnterButton>
          </RoomForm>
        )}
        <Images>
          <Phone>
            <img src={phone} />
          </Phone>
          <Laptop>
            <img src={laptop} />
          </Laptop>
        </Images>
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
  overflow: hidden;
`;

const PhoneAnimation = keyframes`
  0%{
    transform:translate(200px ,0);
    opacity:0;
  }
  15%{
    opacity:0;
  }
  100%{
    transform:translate(0,0)
  }
`;
const LaptopAnimation = keyframes`
  0%{
    transform:translate(300px, 0);
    opacity:0;
  }
  100%{
    transform:translate(0,0)
  }
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
  display: flex;
  justify-content: flex-end;
  align-items: center;
  position: relative;
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
  position: absolute;
  left: 0;
  border: 1px solid rgba(250, 245, 245, 0.2);
  width: 350px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-direction: column;
  padding: 20px;
  border-radius: 20px;
  background-color: rgba(217, 215, 215, 0.556);
  backdrop-filter: blur(3px);
  box-shadow: 20px 2px 50px #08080895;
  animation-name: ${SwipeRight};
  animation-duration: 1s;
  z-index: 20;

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

const Images = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  filter: drop-shadow(0 15px 5px rgba(0, 0, 0, 0.5));
  margin-right: 50px;
`;

const Phone = styled.div`
  height: 240px;
  position: absolute;
  left: -3.5rem;
  animation: ${PhoneAnimation} 2s;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;
const Laptop = styled.div`
  height: 280px;
  z-index: 5;
  filter: drop-shadow(-5px 0 5px rgba(0, 0, 0, 0.5));
  animation: ${LaptopAnimation} 0.8s;

  img {
    height: 100%;
    width: 100%;
    object-fit: contain;
  }
`;
