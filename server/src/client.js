const { Server } = require('socket.io');
const { readdir } = require('fs');
const { join, resolve } = require('path');

class Client extends Server {
  constructor(...server) {
    super(...server);
    this.on('connection', (socket) => {
      this.registerSocketEvents(socket);
      console.log('connected socket' + socket.id);
    });

    this.rooms = new Map();
  }
  registerSocketEvents(socket) {
    const path = './src/events';
    readdir(path, (err, files) => {
      if (err) console.warn(err);

      files = files.filter((f) => f.split('.').pop() === 'js');

      if (files.length === 0) return console.warn('No events found');
      console.info(`${files.length} event(s) found...`);

      files.forEach((f) => {
        const eventName = f.substring(0, f.indexOf('.'));
        const event = require(resolve(__basedir, join(path, f)));
        socket.on(
          eventName,
          event.bind(null, { server: this, socket: socket })
        );
        // Clear cache
        delete require.cache[
          require.resolve(resolve(__basedir, join(path, f)))
        ];
        console.log(`Loading event: ${eventName}`);
      });
    });
    return this;
  }
}

module.exports = { Client: Client };
