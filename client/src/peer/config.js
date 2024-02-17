export const config = {
  mediaConstraints: {
    audio: true,
    video: true,
  },
  offerOptions: {
    offerToReceiveVideo: 1,
    offerToReceiveAudio: 1,
  },
  iceServers: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  },
};
