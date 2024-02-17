import React, { useEffect, useCallback, useState } from 'react';
import ReactPlayer from 'react-player';
import { useSocket, getPeer } from '../context/SocketProvider';

const RoomPage = () => {
  const socket = useSocket();
  const Peer = getPeer();
  const [remoteStream, setRemoteStream] = useState('');
  const myStream = Peer.localStream;

  console.log('room re-render');
  useEffect(() => {
    socket.on(
      'newUserJoined',
      (username, id) => {
        //TODO: create a splash for displaying  new user joined message
        console.log('New user joined');
      },
 
    );
    socket.on('incommingCall', handleCall);
    socket.on('RTCOffer', handleOffer);
    socket.on('RTCAnswer', handleAnswer);
    socket.on('iceCandidate', handleICECandidate);
    socket.on('newStream', handleNewStream);
    return () => {
      socket.off('incommingCall', handleCall);
      socket.off('RTCOffer', handleOffer);
      socket.off('RTCAnswer', handleAnswer);
      socket.off('iceCandidate', handleICECandidate);
      socket.off('newStream', handleNewStream);
    };
  }, []);

  const handleCall = useCallback(
    async (offer) => {
      console.log('got call');
      await Peer.handleIncommingCall(offer);
    },
    [Peer]
  );

  const handleOffer = useCallback(
    (offer) => {
      Peer.handleRTCOffer(offer);
    },
    [Peer]
  );
  const handleAnswer = useCallback(
    async (offer) => {
      await Peer.handleRTCAnswer(offer);
    },
    [Peer]
  );
  const handleNewStream = useCallback(() => {
    console.log('got new remote stream');
    setRemoteStream(Peer.remoteStream);
  }, [Peer]);

  const handleICECandidate = useCallback(
    (offer) => {
      Peer.handleIceCandidate(offer);
    },
    [Peer]
  );

  console.log('remote peers', remoteStream);
  return (
    <div>
      <h1>Room Page</h1>

      {myStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            muted
            height='100px'
            width='200px'
            url={myStream}
          />
        </>
      )}

      {remoteStream && (
        <>
          <h1>Remote Stream</h1>

          {Object.values(remoteStream).map((stream) => (
            <ReactPlayer
              key={stream.id}
              playing
              muted
              height='100px'
              width='200px'
              url={stream}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default RoomPage;
