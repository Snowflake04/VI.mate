import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket, getPeer } from '../../context/SocketProvider';
import dotSquare from '../../images/squaredot.png';
import { TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useStream } from '../../context/StreamProvider';
import './Lobby.css';

const LobbyScreen = () => {
  const [username, setUsername] = useState('');
  const [userError, setUserError] = useState(false);
  const [newRoom, setNewRoom] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [roomError, setRoomError] = useState({
    error: false,
    errorMessage: '',
  });
  const socket = useSocket();
  const navigate = useNavigate();
  const peer = getPeer();
  const { setMessages, setUserMap } = useStream();
  peer.socket = socket;
  peer.localPeerId = socket.id;

  const validateUsername = () => {
    if (username === '') {
      setUserError(true);
      return false;
    } else return true;
  };

  const ValidateRoomCode = () => {
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

  const createRoom = useCallback((e) => {
    if (validateUsername()) socket.emit('createRoom', username);
  });

  const handleJoinButton = () => {
    if (validateUsername() && ValidateRoomCode()) {
      socket.emit('joinRoom', username, roomCode);
    }
  };

  const joinNewRoom = async (room) => {
    setUserMap(room.participants);
    peer.roomId = room.roomCode;
    navigate(`/room/${room.roomCode}`, { replace: true });
  };

  const joinRoom = async (room) => {
    peer.roomId = room.roomCode;
    setUserMap(room.participants);
    setMessages(room.messages);
    navigate(`/room/${room.roomCode}`, { replace: true });
    socket.emit('createCall', {
      roomId: peer.roomId,
      from: peer.localPeerId,
    });
  };

  useEffect(() => {
    socket.on('newRoomCreated', joinNewRoom);
    socket.on('roomJoined', joinRoom);
    return () => {
      socket.off('newRoomCreated', joinNewRoom);
      socket.off('roomJoined', joinRoom);
    };
  }, [socket]);

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
          error={userError}
          label='username'
          variant='standard'
          helperText={userError ? 'Username is required' : ''}
          onChange={(e) => {
            setUsername(e.target.value);
            setUserError(false);
          }}
          style={{ maxWidth: '250px' }}
        />
        <div className='button_holder'>
          <button type='button' onClick={createRoom}>
            Create Room
          </button>
          <button type='button' onClick={(e) => setNewRoom(true)}>
            Join Room
          </button>
        </div>
        {newRoom && (
          <div className='meeting_section'>
            <Room
              error={roomError.error}
              helperText={roomError.errorMessage}
              size='small'
              onChange={(e) => setRoomCode(e.target.value)}
              label='Room Code'
              variant='standard'
            />
            <button type='button' onClick={handleJoinButton}>
              enter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Room = styled(TextField)({
  '& label.Mui-focused': {
    color: '#A0AAB4',
  },
  '& .MuiInput-underline:after': {
    borderBottomColor: '#B2BAC2',
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: '#E0E3E7',
    },
    '&:hover fieldset': {
      borderColor: '#B2BAC2',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#6F7E8C',
    },
  },
});

export default LobbyScreen;
