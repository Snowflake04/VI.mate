import { createContext, useContext, useState } from 'react';
import { getPeer as Peer } from '../peer';
import { AsyncQueue } from '@snowflake04/async-queue';

const server_url = "http://localhost:8000";
const StreamContext = createContext(null);
let peer;
let queue;

export const getQueue = () => {
  return queue ? queue : new AsyncQueue();
};

export const getPeer = () => {
  if (peer) {
    return peer;
  } else {
    peer = Peer(server_url);
    return peer;
  }
};

export const StreamProvider = ({ children }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userMap, setUserMap] = useState({});

  let data = {
    localStream: localStream,
    remoteStream: remoteStream,
    setLocalStream: setLocalStream,
    setRemoteStream: setRemoteStream,
    messages: messages,
    setMessages: setMessages,
    userMap: userMap,
    setUserMap: setUserMap,
  };

  return (
    <StreamContext.Provider value={data}>{children}</StreamContext.Provider>
  );
};

export const useStream = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStream must be used within a StreamProvider');
  }
  return context;
};
