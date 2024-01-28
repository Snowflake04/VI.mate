module.exports = ({ server, socket }, { to, offer }) => {
  server.to(to).emit('incommingCall', { from: socket.id, offer });
};
