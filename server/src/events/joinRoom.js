module.exports = ({ server, socket }, userName, roomCode) => {
  const room = server.rooms.get(roomCode);
  room.participants[socket.id] = userName;
  socket.join(roomCode);
  server.rooms.set(roomCode, room);
  console.log(server.rooms.get(roomCode))
  server.to(socket.id).emit('roomJoined', room);
  server.to(roomCode).emit('newUserJoined', userName, socket.id);
};
