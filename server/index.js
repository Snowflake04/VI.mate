const { Client } = require('./src/client');

const io = new Client(8000, {
  cors: true,
});

global.__basedir = __dirname;

console.log("running...")
io.on('connection', (socket) => {
  io.registerSocketEvents(socket);
  console.log('connected socket' + socket.id);

  // socket.on('join-room', (roomId, userId) => {
  //   socket.join(roomId);
  //   socket.to(roomId).broadcast.emit('user-connected', userId);

  //   socket.on('disconnect', () => {
  //     socket.to(roomId).broadcast.emit('user-disconnected', userId);
  //   });
  // });
});
