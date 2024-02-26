module.exports = ({ server, socket }, user, roomCode) => {
  const room = server.rooms.get(roomCode);
  const userSocket = room.requests[user.id];
  room.participants[user.id] = user.name;
  server.rooms.set(roomCode, room);
  userSocket.join(roomCode);
  console.log(room);
  server
    .to(user.id)
    .emit(
      'roomJoined',
      Object.fromEntries(
        Object.entries(room).filter(([key]) => key !== 'requests')
      )
    );
  server.to(roomCode).emit('newUserJoined', user.name, user.id);
};
