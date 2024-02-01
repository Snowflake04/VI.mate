import { createContext, useMemo, useContext } from 'react';
import { io } from 'socket.io-client';
import Peer from '../service/peer';
const SocketContext = createContext(null);
let peer;

export const getPeer = () => {
  if (peer) {
    return peer;
  } else {
    peer = new Peer();
    return peer;
  }
};

export const useSocket = () => {
  const socket = useContext(SocketContext);
  return socket;
};

export const SocketProvider = ({ children }) => {
  const socket = useMemo(() => io('http://localhost:8000'), []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
