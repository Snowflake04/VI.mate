module.exports = ({ server, socket }, userName, roomCode) => {
  socket.join(roomCode);
  server.to(socket.id).emit('roomJoined', roomCode);
  server.to(roomCode).emit('newUserJoined', { userName, id: socket.id });
};
