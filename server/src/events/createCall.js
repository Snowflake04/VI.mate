module.exports = ({ server, socket }, { roomId, from }) => {
  socket.broadcast.to(roomId).emit('incommingCall', from);
};
