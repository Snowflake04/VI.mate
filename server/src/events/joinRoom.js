module.exports = ({ server, socket }, userName, roomCode) => {
  const room = server.rooms.get(roomCode);
  if (!room) return server.to(socket.id).emit('roomNotFound', roomCode);
  if (room.requireAuth) {
    room.requests[socket.id] = socket;
    server.rooms.set(roomCode, room);
    server
      .to(room.admin)
      .emit('userRequest', { id: socket.id, name: userName });
    server.to(socket.id).emit('approvalPending', room.name);
    return;
  }
  room.participants[socket.id] = userName;
  socket.join(roomCode);
  server.rooms.set(roomCode, room);
  server.to(socket.id).emit('roomJoined', room);
  server.to(roomCode).emit('newUserJoined', userName, socket.id);
};
