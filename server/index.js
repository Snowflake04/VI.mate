const { Client } = require('./src/client');

new Client(8000, {
  cors: true,
});

global.__basedir = __dirname;

console.log('Server is running successfully...');
