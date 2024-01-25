import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketProvider";
import styled from 'styled-components'
import './Lobby.css'
const LobbyScreen = () => {
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");

  const socket = useSocket();
  const navigate = useNavigate();

  const handleSubmitForm = useCallback(
    (e) => {
      e.preventDefault();
      socket.emit("room:join", { email, room });
    },
    [email, room, socket]
  );

  const handleJoinRoom = useCallback(
    (data) => {
      const { email, room } = data;
      navigate(`/room/${room}`);
    },
    [navigate]
  );

  useEffect(() => {
    socket.on("room:join", handleJoinRoom);
    return () => {
      socket.off("room:join", handleJoinRoom);
    };
  }, [socket, handleJoinRoom]);

  return (
    <div class="login-box">
    <h2>Join Room</h2>
    <form>
      <div class="user-box">
        <input type="text" name="" onChange={e => setEmail(e.target.value)} required=""/>
        <label>Username</label>
      </div>
      <div class="user-box">
        <input type="text" name="" onChange={e => setRoom(e.target.value)} required=""/>
        <label>Room code</label>
      </div>
      <a href="#" onClick={handleSubmitForm}>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        join
      </a>
    </form>
  </div>
  );
};

//created a styled login section
const LoginSection = styled.section`
display: flex;
flex-direction: column;
justify-content: center;
align-items: center;
height: calc(100vh - 64px);
`;

const StyledForm = styled.form`
display:flex;
flex-direction: column;
border:2px solid red;
padding:20px;
`

export default LobbyScreen;
