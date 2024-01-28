module.exports = ({ server, socket }, data) => {
  const { email, room } = data;
  server.to(room).emit('userJoined', { email, id: socket.id });
  socket.join(room);
  server.to(socket.id).emit('roomJoin', data);
};
