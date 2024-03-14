import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Minimal .env loader. Deliberately dependency-free — this is the only file
 * that touches the filesystem for configuration, and `dotenv` is not worth a
 * supply-chain surface for thirty lines of parsing.
 *
 * Real environment variables always win over the file, so container/PaaS
 * config (fly secrets, Render env groups) overrides a stray local .env.
 */
function loadEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return; // No .env is a normal, supported state.
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (!key || key in process.env) continue;

    let value = trimmed.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);

    process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, '.env'));

const list = (value) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const int = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
};

const corsOrigins = list(process.env.CORS_ORIGIN);

export const config = {
  root: ROOT,
  port: int(process.env.PORT, 8000),
  trustProxy: bool(process.env.TRUST_PROXY, false),

  /**
   * `true` means "reflect any origin" and is only tolerable in development.
   * In production an explicit allowlist is required, because Socket.IO is
   * configured with credentials enabled.
   */
  corsOrigins: corsOrigins.length
    ? corsOrigins
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],

  ice: {
    stunUrls: list(process.env.STUN_URLS).length
      ? list(process.env.STUN_URLS)
      : ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    turnUrls: list(process.env.TURN_URLS),
    turnUsername: process.env.TURN_USERNAME || '',
    turnCredential: process.env.TURN_CREDENTIAL || '',
    turnSecret: process.env.TURN_SECRET || '',
    turnTtlSeconds: int(process.env.TURN_TTL_SECONDS, 86400),
    transportPolicy:
      process.env.ICE_TRANSPORT_POLICY === 'relay' ? 'relay' : 'all',
  },

  limits: {
    maxParticipants: int(process.env.MAX_PARTICIPANTS, 12),
    maxMessageLength: int(process.env.MAX_MESSAGE_LENGTH, 2000),
    maxRoomHistory: int(process.env.MAX_ROOM_HISTORY, 200),
    maxDisplayNameLength: 32,
    maxRoomNameLength: 48,
    emptyRoomTtlMs: int(process.env.EMPTY_ROOM_TTL_SECONDS, 60) * 1000,
  },

  isProduction: process.env.NODE_ENV === 'production',
};

/**
 * Loopback and RFC1918 hosts. Matched against the hostname only, so the scheme
 * and port are deliberately irrelevant.
 */
const PRIVATE_HOSTNAME =
  /^(localhost|[\w-]+\.localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/i;

const isPrivateOrigin = (origin) => {
  let hostname;
  try {
    ({ hostname } = new URL(origin));
  } catch {
    return false;
  }
  // new URL() keeps IPv6 literals bracketed; PRIVATE_HOSTNAME matches bare.
  return PRIVATE_HOSTNAME.test(hostname.replace(/^\[|\]$/g, ''));
};

/**
 * In production this is an exact allowlist and nothing else — Socket.IO runs
 * with credentials enabled, so a reflected origin would be a real hole.
 *
 * In development the allowlist is widened to any loopback or private-network
 * host on any port. A fixed list cannot work there: the app is served through
 * Vite's proxy, so the browser's Origin is whatever host and port Vite happens
 * to be on — `:5173` when running `dev`, `:4173` under `preview`, `https` once
 * a dev certificate exists, and the machine's LAN IP when a phone joins the
 * call. Hardcoding those meant every one of them was rejected at the handshake
 * with an opaque 400.
 */
export const isOriginAllowed = (origin) => {
  if (config.corsOrigins.includes(origin)) return true;
  return !config.isProduction && isPrivateOrigin(origin);
};

export default config;
