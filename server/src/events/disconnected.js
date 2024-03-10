module.exports = ({ server, socket }, room) => {
  let Room = server.rooms.get(room);
  delete Room.participants[socket.id];
  if (Room.participants.size === 0) server.rooms.delete(room);
  console.log(`${socket.id} has disconnected.`);
  socket.leave(room);
  server.to(room).emit('userDisconnected', socket.id);
};
