/**
 * Confirms the client actually consumes server-supplied TURN configuration:
 * that the credentials reach RTCPeerConnection, and that the UI stops warning
 * about missing NAT traversal.
 */
const { chromium } = require('playwright');

const APP = 'http://localhost:4173';
const CHROME = process.env.CHROME_PATH || undefined;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, passed, detail = '') => {
  results.push({ name, passed });
  console.log(`  ${passed ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function until(fn, { timeout = 20000, label = '' } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* retry */ }
    await wait(300);
  }
  throw new Error(`timeout: ${label}`);
}

// Records the RTCConfiguration every PeerConnection is constructed with.
const PROBE = `
  window.__configs = [];
  const Native = window.RTCPeerConnection;
  window.RTCPeerConnection = function (config, ...rest) {
    window.__configs.push(JSON.parse(JSON.stringify(config || {})));
    return new Native(config, ...rest);
  };
  window.RTCPeerConnection.prototype = Native.prototype;
`;

(async () => {
  console.log('\nTURN configuration delivery\n' + '─'.repeat(48));

  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const make = async () => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      // Self-signed certs are expected when testing against a LAN address.
      ignoreHTTPSErrors: true,
      permissions: ['camera', 'microphone'],
    });
    await ctx.addInitScript(PROBE);
    const page = await ctx.newPage();
    await page.goto(APP, { waitUntil: 'networkidle' });
    return page;
  };

  const alice = await make();

  // The lobby readout must reflect the server's answer, not a hardcoded string.
  const readout = await until(
    async () => {
      const text = await alice.locator('body').innerText();
      return /STUN \+ TURN|STUN only/.test(text) ? text.match(/STUN[^\n]*/)[0] : null;
    },
    { label: 'ICE readout' }
  );
  check('lobby reports server-supplied NAT traversal', readout === 'STUN + TURN', readout);

  const warningGone = !(await alice.locator('text=No TURN relay is configured').count());
  check('missing-TURN warning disappears when TURN is present', warningGone);

  // Now build a real connection and confirm the credentials were handed to it.
  await alice.getByRole('tab', { name: /new room/i }).click();
  await alice.locator('#display-name').fill('Alice');
  await alice.locator('#room-name').fill('TURN check');
  await alice.getByRole('button', { name: /create room/i }).click();
  await until(() => alice.url().includes('/room/'), { label: 'room' });
  const code = alice.url().split('/room/')[1];

  const bob = await make();
  await bob.locator('#display-name').fill('Bob');
  await bob.locator('#room-code').fill(code);
  await bob.getByRole('button', { name: /enter room/i }).click();
  await until(() => bob.url().includes('/room/'), { label: 'bob' });
  await wait(5000);

  const configs = await alice.evaluate(() => window.__configs);
  check('a peer connection was constructed', configs.length > 0, `${configs.length}`);

  const turnEntry = configs
    .flatMap((c) => c.iceServers ?? [])
    .find((s) => String(s.urls).includes('turn'));

  check('TURN servers reached RTCPeerConnection', Boolean(turnEntry),
    turnEntry ? String(turnEntry.urls) : 'none');
  check('ephemeral credentials were attached', Boolean(turnEntry?.username && turnEntry?.credential),
    turnEntry ? `user=${turnEntry.username.slice(0, 18)}…` : '');
  check('credential is not a build-time constant',
    Boolean(turnEntry?.username?.includes(':')),
    'username carries an expiry');

  await browser.close();

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('crashed:', e.message);
  process.exit(2);
});
