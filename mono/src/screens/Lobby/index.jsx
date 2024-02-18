import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import dotSquare from '../../images/squaredot.png';
import styled from 'styled-components'
import { useStream, getPeer } from '../../context/StreamProvider';
import './Lobby.css';

const LobbyScreen = () => {
  const nameRef = useRef();
  const codeRef = useRef();

  const [userError, setUserError] = useState(false);
  const [newRoom, setNewRoom] = useState(false);
  const [roomError, setRoomError] = useState({
    error: false,
    errorMessage: '',
  });

  const { setMessages, setUserMap } = useStream();
  const navigate = useNavigate();
  const Peer = getPeer();
  console.log(Peer);

  const validateUsername = () => {
    let username = nameRef.current.value;
    if (!username) {
      setUserError(true);
      return false;
    } else return true;
  };

  const ValidateRoomCode = () => {
    let roomCode = codeRef.current.value;
    if (roomCode === '') {
      return setRoomError({
        error: true,
        errorMessage: 'Please enter a room code',
      });
    } else if (
      !/^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/.test(roomCode)
    ) {
      return setRoomError({ error: true, errorMessage: 'Invalid format!' });
    } else return true;
  };

  const createRoom = useCallback(() => {
    if (validateUsername()) Peer.emit('createRoom', nameRef.current.value);
  },);

  const handleJoinButton = () => {
    if (validateUsername() && ValidateRoomCode()) {
      Peer.emit('joinRoom', nameRef.current.value, codeRef.current.value);
    }
  };

  const joinNewRoom = async (room) => {
    setUserMap(room.participants);
    Peer.roomId = room.roomCode;
    navigate(`/room/${room.roomCode}`, { replace: true });
  };

  const joinRoom = async (room) => {
    Peer.roomId = room.roomCode;
    setUserMap(room.participants);
    setMessages(room.messages);
    navigate(`/room/${room.roomCode}`, { replace: true });
    Peer.emit('createCall', {
      roomId: Peer.roomId,
      from: Peer.id,
    });
  };

  useEffect(() => {
    Peer.on('newRoomCreated', joinNewRoom);
    Peer.on('roomJoined', joinRoom);
    return () => {
      Peer.off('newRoomCreated', joinNewRoom);
      Peer.off('roomJoined', joinRoom);
    };
  }, [Peer, joinNewRoom, joinRoom]);

  return (
    <div className='lobby'>
      <div className='left_content'>
        <div className='image_container'>
          <img src={dotSquare} alt='img' />
          <img src={dotSquare} alt='img' />
          <img src='https://picsum.photos/320/400' alt='' />
        </div>
      </div>
      <div className='right_content'>
        <div className='head'>Get Started...</div>
        <div className='sub_text'>
          Join a existing meeting or create a new meeting with your coleagues or
          friends. Enjoy state of the art video calling service thats completely
          free
        </div>
        <Room
          ref={nameRef}
          placeholder='Enter username'
        />
        {userError && <div style={{color:"red", marginTop: "5px"}}> username is required</div>}
        <div className='button_holder'>
          <button type='button' onClick={createRoom}>
            Create Room
          </button>
          <button type='button' onClick={() => setNewRoom(true)}>
            Join Room
          </button>
        </div>
        {newRoom && (
          <div className='meeting_section'>
            <Room
              ref={codeRef}
              placeholder='Room code'
            />
             {roomError.error && <div style={{color:"red", marginTop: "5px"}}>{roomError.errorMessage} </div>}
            <button type='button' onClick={handleJoinButton}>
              enter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Room = styled.input`
background:transparent;
border:none;
padding:8px;
border-bottom:2px solid  #686869;
outline:none;
//change placeholder color
&::placeholder{
color:#dddcdc;
}
`;

export default LobbyScreen;
