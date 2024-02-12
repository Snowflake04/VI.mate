import { createContext, useContext, useState } from 'react';

const StreamContext = createContext();

export const StreamProvider = ({ children }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  return (
    <StreamContext.Provider
      value={{
        localStream: localStream,
        remoteStream: remoteStream,
        setLocalStream: setLocalStream,
        setRemoteStream: setRemoteStream,
      }}
    >
      {children}
    </StreamContext.Provider>
  );
};

export const useStream = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStream must be used within a StreamProvider');
  }
  return context;
};
