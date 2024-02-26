module.exports = ({ server, socket }, user, roomCode) => {
  const room = server.rooms.get(roomCode);
  delete room.requests[user.id];
  console.log(room);
  server.rooms.set(roomCode, room);
  server.to(user.id).emit('requestDenied', room.name);
};
