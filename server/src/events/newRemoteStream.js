module.exports = ({ server, socket }, from) => {
  server.to(socket.id).emit('newStream', from);
};
