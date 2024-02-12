module.exports = ({ server, socket }, userName, roomCode) => {
  const room = server.rooms.get(roomCode);
  room.participants[userName] = socket.id;
  socket.join(roomCode);
  server.rooms.set(roomCode, room);
  server.to(socket.id).emit('roomJoined', room);
  server.to(roomCode).emit('newUserJoined', userName ,{id: socket.id} );

};
