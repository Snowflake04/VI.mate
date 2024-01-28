module.exports = ({ server, socket }, { to, offer }) => {
  console.log('peer:ego:needed', offer);
  server.to(to).emit('peerNegoNeeded', { from: socket.id, offer });
};
