module.exports = ({ server, socket }, offer) => {
  console.log(
    `Sending webrtc_ice_candidate event to peers in room ${offer.roomId} from peer ${offer.senderId} to peer ${offer.receiverId}`
  );
  socket.broadcast.to(offer.receiverId).emit('iceCandidate', offer);
};
