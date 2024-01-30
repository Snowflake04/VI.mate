const { webcrypto: crypto } = require('crypto');

module.exports = ({ server, socket }, user) => {
  const GenerateUUID = () => {
    const CharNumSet =
      'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict';
    let pool, poolOffset;
    let size = 12;

    const fillPool = (bytes) => {
      if (!pool || pool.length < bytes) {
        pool = Buffer.allocUnsafe(bytes * 128);
        crypto.getRandomValues(pool);
        poolOffset = 0;
      } else if (poolOffset + bytes > pool.length) {
        crypto.getRandomValues(pool);
        poolOffset = 0;
      }
      poolOffset += bytes;
    };

    fillPool((size -= 0));
    let id = '';
    for (let i = poolOffset - size; i < poolOffset; i++) {
      id += CharNumSet[pool[i] & 63];
    }
    return id;
  };

  let room = GenerateUUID()
  room = room.match(/.{1,4}/g).join("-")
  socket.join(room)
  server.to(socket.id).emit("newRoomCreated", room)
};
