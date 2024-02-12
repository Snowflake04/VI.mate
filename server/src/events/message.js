module.exports = ({ server, socket }, message, room) => {
  socket.broadcast.to(room).emit('newMessage', message);
};
