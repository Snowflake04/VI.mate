module.exports = ({ server, socket }, { to, ans }) => {
  server.to(to).emit('callAccepted', { from: socket.id, ans });
};
