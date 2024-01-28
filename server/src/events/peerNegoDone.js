module.exports = ({ server, socket }, { to, ans }) => {
  console.log('peer:nego:done', ans);
  server.to(to).emit('peerNegoFinal', { from: socket.id, ans });
};
