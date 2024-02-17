module.exports = ({ server, socket }, room) => {

    let Room = server.rooms.get(room)
    delete Room.participants[socket.id];
    console.log(`${socket.id} has disconnected.`);

    server.to(room).emit("userDisconnected", socket.id)
};