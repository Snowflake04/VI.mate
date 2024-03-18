import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CERT_DIR = fileURLToPath(new URL('./certs', import.meta.url));

/**
 * Optional TLS for local network testing.
 *
 * `getUserMedia` and `getDisplayMedia` only exist in a secure context, and
 * `localhost` is the *only* insecure origin browsers exempt. That means the
 * moment you open the app from a phone at http://192.168.x.x the camera is
 * refused — the app detects this and says so, but it cannot work around it.
 *
 * Drop a cert here and both the dev server and preview server switch to HTTPS.
 * Generate one with:
 *
 *   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
 *     -keyout certs/dev-key.pem -out certs/dev-cert.pem \
 *     -subj "/CN=<your-lan-ip>" \
 *     -addext "subjectAltName=IP:<your-lan-ip>,IP:127.0.0.1,DNS:localhost"
 *
 * Self-signed means one click through a browser warning per device. `mkcert`
 * avoids even that if you would rather install it.
 */
function devHttps() {
  const key = resolve(CERT_DIR, 'dev-key.pem');
  const cert = resolve(CERT_DIR, 'dev-cert.pem');
  if (!existsSync(key) || !existsSync(cert)) return undefined;
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

/**
 * Signalling is proxied through the frontend origin rather than being a second
 * origin the client dials directly.
 *
 * This is what makes the app work unchanged on a LAN address. With a proxy the
 * client can fall back to `window.location.origin` (see lib/env.js), so nothing
 * about the signalling host is baked into the bundle at build time — which was
 * the actual bug: a bundle built with `localhost:8000` makes every device
 * resolve that to *itself*.
 *
 * It also collapses three problems into zero: no CORS preflight, no second TLS
 * certificate to trust, and no mixed-content block from an HTTPS page opening a
 * `ws://` socket.
 */
const signalingProxy = {
  '/socket.io': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    // Socket.IO upgrades to a WebSocket; without this only long-polling works.
    ws: true,
  },
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    // Bind on all interfaces so the call can be QA'd from a phone on the same
    // network — a video app that has only ever been opened in two tabs on one
    // machine has not actually been tested.
    host: true,
    https: devHttps(),
    proxy: signalingProxy,
  },

  preview: {
    port: 4173,
    host: true,
    https: devHttps(),
    proxy: signalingProxy,
  },

  build: {
    target: 'es2022',
    // Source maps make production WebRTC failures debuggable. They cost
    // nothing at runtime; browsers only fetch them when devtools is open.
    sourcemap: true,
    rollupOptions: {
      output: {
        /*
         * The lobby is the first paint and must not wait on the call runtime.
         * Splitting the heavy, rarely-changing vendor code into its own chunks
         * also means a UI tweak does not invalidate the whole cached bundle.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router)/.test(id)) {
            return 'react';
          }
          if (/[\\/]node_modules[\\/](motion|framer-motion)/.test(id)) {
            return 'motion';
          }
          if (/[\\/]node_modules[\\/](socket\.io|engine\.io)/.test(id)) {
            return 'realtime';
          }
          return undefined;
        },
      },
    },
  },
});
