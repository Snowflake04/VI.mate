module.exports = ({ server, socket }, message, room) => {
  let Room = server.rooms.get(room);
  let messageObj = { user: socket.id, content: message };
  Room.messages.push(messageObj);
  server.rooms.set(room, Room);
  socket.broadcast.to(room).emit('newMessage', messageObj);
};
