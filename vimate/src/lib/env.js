/**
 * Single point of truth for build-time configuration.
 *
 * The signaling URL used to be a `const server_url = "http://localhost:8000"`
 * sitting in the middle of a React context file, which meant every deploy
 * needed a source edit (the old README literally instructed people to do this).
 * It is an environment variable now, with a sane origin-relative default so a
 * same-domain deployment needs no configuration at all.
 */

const raw = import.meta.env.VITE_SIGNALING_URL?.trim();

/** Absolute base URL of the signaling server, without a trailing slash. */
export const SIGNALING_URL = (raw || window.location.origin).replace(/\/+$/, '');

export const DEPLOY_LABEL = import.meta.env.VITE_DEPLOY_LABEL?.trim() || null;

export const IS_DEV = import.meta.env.DEV;

/**
 * getUserMedia, getDisplayMedia, and the Web Audio API are all gated behind a
 * secure context. Without this check the failure surfaces as an inscrutable
 * "undefined is not an object" deep inside the media stack, so it is detected
 * up front and reported as the configuration problem it actually is.
 */
export const IS_SECURE_CONTEXT =
  window.isSecureContext ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

export const SUPPORTS_WEBRTC =
  typeof window.RTCPeerConnection === 'function' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function';

export const SUPPORTS_SCREEN_SHARE =
  typeof navigator.mediaDevices?.getDisplayMedia === 'function';
