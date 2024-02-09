module.exports = ({server, socket}, from) =>{
    console.log("got event")
    server.to(socket.id).emit("newStream", from)
}