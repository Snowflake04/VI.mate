module.exports = ({ server, socket }, user, room) => {
  server.to(room).emit('userJoined', { user, id: socket.id });
  socket.join(room);
  server.to(socket.id).emit('roomJoined', room);
};
