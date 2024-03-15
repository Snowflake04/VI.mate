import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import config, { isOriginAllowed } from './config.js';
import buildIceServers from './ice.js';
import registerSignaling, { registry } from './signaling.js';

/**
 * VI.mate signaling server.
 *
 * This process is a switchboard and nothing else. It relays SDP and ICE so two
 * browsers can find each other, then gets out of the way — every byte of audio,
 * video, and screen share travels directly between peers over WebRTC and never
 * touches this machine. That property is load-bearing for the product's privacy
 * story and its hosting costs, and no feature should ever be added here that
 * changes it.
 */

const app = express();

if (config.trustProxy) {
  // Required for correct client IPs behind fly.io / Render / nginx.
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

const corsOptions = {
  origin(origin, callback) {
    // Same-origin and non-browser callers (curl, health checks) send no Origin.
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed.`));
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    rooms: registry.size,
    participants: registry.participantCount,
  });
});

/**
 * ICE configuration, fetched by every client before it opens a peer connection.
 *
 * Served at runtime rather than compiled into the frontend so that TURN
 * credentials stay out of a bundle anyone can download, and so they can be
 * rotated (or made ephemeral) without a redeploy of the client.
 */
app.get('/api/ice', (_req, res) => {
  // Ephemeral credentials must not be cached by proxies or the browser.
  res.set('Cache-Control', 'no-store');
  res.json(buildIceServers());
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Express error handler — keeps a thrown CORS rejection from killing the process.
// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  console.error('[http]', error?.message);
  res.status(400).json({ error: 'Bad request' });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: corsOptions,
  // Clients that vanish (laptop lid, tunnel death) are detected in ~25s
  // instead of hanging around as ghosts.
  pingInterval: 10_000,
  pingTimeout: 15_000,
  // Signaling payloads are small; anything larger is abuse, and this caps it
  // at the transport layer before a handler ever sees it.
  maxHttpBufferSize: 256 * 1024,
  connectionStateRecovery: {
    // Lets a client that drops for a few seconds (tunnel, subway, Wi-Fi
    // handoff) resume with its session and missed events intact rather than
    // reconnecting as a stranger.
    maxDisconnectionDuration: 30_000,
    skipMiddlewares: false,
  },
});

registerSignaling(io);

httpServer.listen(config.port, () => {
  console.log(`VI.mate signaling server listening on :${config.port}`);
  console.log(`  allowed origins : ${config.corsOrigins.join(', ')}`);
  if (!config.isProduction) {
    console.log('                    + any loopback / LAN origin (development)');
  }

  const ice = buildIceServers();
  const turnMode = config.ice.turnSecret
    ? 'ephemeral HMAC credentials'
    : config.ice.turnUsername
      ? 'static credentials'
      : 'none';
  console.log(`  ICE             : ${ice.iceServers.length} server group(s)`);
  console.log(`  TURN            : ${turnMode}`);

  if (!ice.turnConfigured) {
    console.warn(
      '\n  ⚠  No TURN server configured. STUN alone cannot traverse symmetric\n' +
        '     or carrier-grade NAT, so a real share of users will connect to\n' +
        '     the room and then never see or hear anyone. Fine for local\n' +
        '     development; configure TURN before production. See the TURN\n' +
        '     section of README.md.\n'
    );
  }

  if (config.isProduction && config.corsOrigins.some((o) => o.includes('localhost'))) {
    console.warn(
      '  ⚠  NODE_ENV=production but CORS_ORIGIN still allows localhost.\n'
    );
  }
});

/** Close listeners cleanly so in-flight sockets are told, not dropped. */
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down.`);
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
  // Never hang forever waiting on a wedged socket.
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled rejection:', reason);
});
