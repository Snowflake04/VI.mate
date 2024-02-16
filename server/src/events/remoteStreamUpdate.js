module.exports = ({ server, socket }, from) => {
  server.to(socket.id).emit('remoteStreamUpdate', from);
};
