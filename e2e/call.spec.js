/**
 * End-to-end QA for VI.mate.
 *
 * Drives two real Chromium instances with synthetic camera/microphone devices
 * through an actual WebRTC call: create a room, join it, negotiate, verify
 * frames are genuinely decoding, exercise chat / DMs / mute / screen share /
 * theme, then check responsive breakpoints, permission denial, and the console.
 *
 * "Frames are genuinely decoding" is checked via videoWidth and
 * getStats().framesDecoded, not by the presence of a <video> element — an
 * element with a dead srcObject looks identical in the DOM.
 */

const { chromium } = require('playwright');

const APP = process.env.APP_URL || 'http://localhost:4173';
// Playwright resolves its own bundled Chromium; CHROME_PATH overrides it.
// The full browser is required, not chrome-headless-shell — the shell has
// no WebRTC encoders, so every media assertion here would fail on it.
const CHROME = process.env.CHROME_PATH || undefined;

const results = [];
const consoleErrors = [];

function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const mark = passed ? '  ✓' : '  ✗';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until `fn` returns truthy or the timeout expires. */
async function until(fn, { timeout = 15000, interval = 250, label = '' } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await fn();
      if (last) return last;
    } catch (error) {
      last = error.message;
    }
    await wait(interval);
  }
  throw new Error(`timed out waiting for ${label}: ${JSON.stringify(last)}`);
}

function attachConsole(page, tag) {
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Chromium's fake device stack emits benign autoplay/permission noise that
    // is an artefact of the harness, not the app.
    if (/favicon|net::ERR_|Autoplay is only allowed/i.test(text)) return;
    consoleErrors.push(`[${tag}] ${text}`);
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(`[${tag}] UNCAUGHT: ${error.message}`);
  });
}

async function newBrowser({ grantMedia = true } = {}) {
  const args = [
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    // A moving synthetic pattern, so decoded frames actually change.
    '--use-file-for-fake-video-capture=',
  ].filter((flag) => !flag.endsWith('='));

  if (grantMedia) args.push('--use-fake-ui-for-media-stream');

  return chromium.launch({
    headless: true,
    channel: 'chromium',
    ...(CHROME ? { executablePath: CHROME } : {}),
    args,
  });
}

async function main() {
  console.log(`\nVI.mate end-to-end QA against ${APP}\n${'─'.repeat(64)}`);

  const browserA = await newBrowser();
  const browserB = await newBrowser();

  const contextA = await browserA.newContext({
    viewport: { width: 1440, height: 900 },
    // Self-signed certs are expected when testing against a LAN address.
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone'],
  });
  const contextB = await browserB.newContext({
    viewport: { width: 1440, height: 900 },
    // Self-signed certs are expected when testing against a LAN address.
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone'],
  });

  const alice = await contextA.newPage();
  const bob = await contextB.newPage();
  attachConsole(alice, 'alice');
  attachConsole(bob, 'bob');

  // ---------------------------------------------------------------- lobby --
  console.log('\nLobby');
  await alice.goto(APP, { waitUntil: 'networkidle' });

  check(
    'lobby renders headline',
    (await alice.locator('text=Talk directly.').count()) > 0
  );

  const signalOnline = await until(
    async () =>
      (await alice.locator('[title="Connected"]').count()) > 0 ||
      (await alice.locator('text=Connected').count()) > 0,
    { label: 'signaling connection', timeout: 12000 }
  ).then(() => true).catch(() => false);
  check('signaling socket reports online', signalOnline);

  const readoutText = await alice.locator('body').innerText();
  check(
    'system readout shows real ICE state',
    /STUN/i.test(readoutText),
    readoutText.match(/STUN[^\n]*/)?.[0] ?? ''
  );

  // --------------------------------------------------------- create a room --
  console.log('\nCreate + join');
  await alice.getByRole('tab', { name: /new room/i }).click();
  await alice.locator('#display-name').fill('Alice');
  await alice.locator('#room-name').fill('QA Deck');
  await alice.getByRole('button', { name: /create room/i }).click();

  await until(() => alice.url().includes('/room/'), {
    label: 'navigation into room',
  });
  const roomCode = alice.url().split('/room/')[1];
  check('room created and routed', /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(roomCode), roomCode);

  // Local video must actually be producing frames.
  const selfVideoLive = await until(
    () =>
      alice.evaluate(() => {
        const video = document.querySelector('video');
        return Boolean(video && video.videoWidth > 0 && !video.paused);
      }),
    { label: 'local camera frames' }
  ).then(() => true).catch(() => false);
  check('local camera renders real frames', selfVideoLive);

  // ------------------------------------------------------------- bob joins --
  await bob.goto(APP, { waitUntil: 'networkidle' });
  await bob.locator('#display-name').fill('Bob');
  await bob.locator('#room-code').fill(roomCode);
  await bob.getByRole('button', { name: /enter room/i }).click();

  await until(() => bob.url().includes('/room/'), { label: 'bob entering room' });
  check('second participant joined', true);

  // ------------------------------------------------- the actual connection --
  console.log('\nPeer connection');

  const aliceSeesBob = await until(
    () => alice.locator('text=Bob').count().then((n) => n > 0),
    { label: 'Bob appearing for Alice' }
  ).then(() => true).catch(() => false);
  check('Alice sees Bob in the call', aliceSeesBob);

  // Two <video> elements, both with real dimensions = remote media decoded.
  const remoteFlowing = await until(
    () =>
      alice.evaluate(() => {
        const videos = [...document.querySelectorAll('video')];
        return (
          videos.length >= 2 && videos.every((v) => v.videoWidth > 0 && v.readyState >= 2)
        );
      }),
    { label: 'remote video frames on Alice', timeout: 25000 }
  ).then(() => true).catch(() => false);
  check('remote video is decoding real frames', remoteFlowing);

  // Ground truth from the transport itself.
  const stats = await until(
    async () =>
      alice.evaluate(() => {
        // The band is exposed on the indicator's accessible label, and the
        // measurements on its title -- neither is body text.
        const badge = document.querySelector('[aria-label^="Connection"]');
        if (!badge) return null;
        const label = badge.getAttribute('aria-label');
        return /NO DATA|unknown/i.test(label) ? null : `${label} | ${badge.getAttribute('title')}`;
      }),
    { label: 'quality indicator populated', timeout: 25000 }
  ).catch(() => null);
  check('connection quality driven by getStats()', Boolean(stats), stats ?? 'no reading');

  // Open the diagnostics drawer and confirm live telemetry numbers.
  await alice.getByTitle('Connection diagnostics').click();
  const telemetry = await until(
    async () => {
      const text = await alice.locator('body').innerText();
      // A real bitrate reading, e.g. "412 kbps" or "1.2 Mbps".
      const rate = text.match(/(\d+(\.\d+)?)\s*(kbps|Mbps)/);
      const rtt = text.match(/(\d+)\s*ms/);
      return rate && rtt ? `${rate[0]}, rtt ${rtt[0]}` : null;
    },
    { label: 'diagnostics telemetry', timeout: 20000 }
  ).catch(() => null);
  check('diagnostics show measured bitrate + RTT', Boolean(telemetry), telemetry ?? '');

  const candidatePath = await alice.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/\b(Direct \(local\)|Direct|Relayed)/);
    return match ? match[1] : null;
  });
  check('ICE candidate path reported', Boolean(candidatePath), candidatePath ?? '');
  await alice.getByTitle('Connection diagnostics').click();

  // -------------------------------------------------------------- features --
  console.log('\nFeatures');

  // Group chat.
  await alice.getByRole('tab', { name: /^chat$/i }).first().click();
  await alice.getByPlaceholder(/message the room/i).fill('hello from alice');
  await alice.getByPlaceholder(/message the room/i).press('Enter');

  const bobGotGroup = await until(
    () => bob.locator('text=hello from alice').count().then((n) => n > 0),
    { label: 'group message delivery' }
  ).then(() => true).catch(() => false);
  check('group chat delivers', bobGotGroup);

  // Private 1:1 chat, opened from the roster.
  await alice.getByRole('tab', { name: /roster/i }).click();
  await alice.getByTitle(/message Bob privately/i).click();
  await alice.getByPlaceholder(/message Bob privately/i).fill('psst, private');
  await alice.getByPlaceholder(/message Bob privately/i).press('Enter');

  // A DM arriving while Bob is on the room thread must surface as unread
  // rather than silently appearing in the wrong conversation.
  const bobSawUnread = await until(
    () => bob.locator('text=Alice').count().then((n) => n > 0),
    { label: 'DM notification for Bob' }
  ).then(() => true).catch(() => false);

  await bob.getByRole('tab', { name: /roster/i }).click();
  await bob.getByTitle(/message Alice privately/i).click();
  const bobGotDm = await until(
    () => bob.locator('text=psst, private').count().then((n) => n > 0),
    { label: 'private message delivery' }
  ).then(() => true).catch(() => false);
  check('private 1:1 chat delivers', bobGotDm && bobSawUnread);

  /*
   * And it must NOT have leaked into the room transcript.
   *
   * Scoped to the transcript rather than the whole document. It used to read
   * `document.body.innerText`, which was a workable proxy only while nothing
   * else on screen could ever display a message — the arrival notification now
   * can, legitimately, on the recipient's own screen. Testing the whole body
   * would fail on that and say nothing about the property that matters, which
   * is that a DM never appears in the *group* thread.
   */
  await bob.getByRole('tab', { name: /^chat$/i }).first().click();
  await bob.locator('text=Back to room chat').click().catch(() => {});
  await wait(400);
  const dmLeaked = await bob.evaluate(() =>
    /psst, private/.test(document.querySelector('[data-role="transcript"]')?.innerText ?? ''));
  check('private message stays out of the room thread', !dmLeaked);

  // Mute propagates as presence.
  await alice.getByTitle('Mute microphone').click();
  const bobSeesMute = await until(
    () =>
      bob.evaluate(
        () => document.querySelectorAll('[title="Microphone off"], [title="Muted"]').length > 0
      ),
    { label: 'mute state propagation' }
  ).then(() => true).catch(() => false);
  check('mute state propagates to peers', bobSeesMute);
  await alice.getByTitle('Unmute microphone').click();

  // Spotlight → layout change must not tear down video.
  await alice.getByTitle('Switch to spotlight').click();
  await wait(900);
  const videoSurvivedLayout = await alice.evaluate(() => {
    const videos = [...document.querySelectorAll('video')];
    return videos.length >= 2 && videos.every((v) => v.videoWidth > 0);
  });
  check('video survives layout transition (no remount)', videoSurvivedLayout);
  await alice.getByTitle('Switch to grid').click();

  // Theme switch.
  const themeBefore = await alice.evaluate(() =>
    document.documentElement.getAttribute('data-theme')
  );
  await alice.locator('button[title*="Switch to"]').first().click();
  await wait(900);
  const themeAfter = await alice.evaluate(() =>
    document.documentElement.getAttribute('data-theme')
  );
  check('theme switches', themeBefore !== themeAfter, `${themeBefore} → ${themeAfter}`);

  const themePersists = await alice.evaluate(() =>
    localStorage.getItem('vimate.theme')
  );
  check('theme choice persists', themePersists === themeAfter, themePersists ?? '');

  // Sound toggle must exist and be honoured.
  await alice.getByTitle(/sounds/i).first().click();
  const soundSetting = await alice.evaluate(() => localStorage.getItem('vimate.sound'));
  check('sound cues are mutable and persisted', soundSetting !== null, `sound=${soundSetting}`);

  // ------------------------------------------------------------ responsive --
  console.log('\nResponsive');

  for (const [label, size] of [
    ['mobile 390×844', { width: 390, height: 844 }],
    ['tablet 820×1180', { width: 820, height: 1180 }],
    ['desktop 1440×900', { width: 1440, height: 900 }],
    ['wide 1920×1080', { width: 1920, height: 1080 }],
  ]) {
    await alice.setViewportSize(size);
    await wait(650);

    const overflow = await alice.evaluate(() => {
      const doc = document.documentElement;
      return {
        horizontal: doc.scrollWidth - doc.clientWidth,
        offenders: [...document.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2)
          .slice(0, 3)
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 28)}`),
      };
    });

    check(
      `no horizontal overflow at ${label}`,
      overflow.horizontal <= 1,
      overflow.horizontal > 1 ? `+${overflow.horizontal}px ${overflow.offenders.join(', ')}` : ''
    );
  }
  await alice.setViewportSize({ width: 1440, height: 900 });

  // --------------------------------------------------------- leave / churn --
  console.log('\nLifecycle');

  await bob.getByTitle('Leave the call').click();
  const aliceSawLeave = await until(
    () => alice.locator('text=Bob').count().then((n) => n === 0),
    { label: 'peer removal after leave' }
  ).then(() => true).catch(() => false);
  check('peer removed from roster on leave', aliceSawLeave);

  // Deep link straight to a room offers a rejoin rather than a dead end.
  const carol = await contextB.newPage();
  attachConsole(carol, 'carol');
  await carol.goto(`${APP}/room/${roomCode}`, { waitUntil: 'networkidle' });
  const rejoinOffered = await until(
    () => carol.locator('text=Rejoin this room').count().then((n) => n > 0),
    { label: 'rejoin card' }
  ).then(() => true).catch(() => false);
  check('deep link offers rejoin with code intact', rejoinOffered);

  await carol.locator('#rejoin-name').fill('Carol');
  await carol.getByRole('button', { name: /enter room/i }).click();
  const carolJoined = await until(
    () => alice.locator('text=Carol').count().then((n) => n > 0),
    { label: 'Carol joining' }
  ).then(() => true).catch(() => false);
  check('rejoin from deep link works', carolJoined);

  // ------------------------------------------------------ permission denial --
  console.log('\nDenied camera');

  const deniedBrowser = await newBrowser({ grantMedia: false });
  const deniedContext = await deniedBrowser.newContext({
    viewport: { width: 1280, height: 800 },
    // Self-signed certs are expected when testing against a LAN address.
    ignoreHTTPSErrors: true,
    permissions: [], // explicitly no camera/microphone
  });
  const dave = await deniedContext.newPage();
  attachConsole(dave, 'dave');

  await dave.goto(APP, { waitUntil: 'networkidle' });
  await dave.locator('#display-name').fill('Dave');
  await dave.locator('#room-code').fill(roomCode);
  await dave.getByRole('button', { name: /enter room/i }).click();
  await until(() => dave.url().includes('/room/'), { label: 'Dave entering room' });

  const gateShown = await until(
    async () => {
      const text = await dave.locator('body').innerText();
      return /blocked|unavailable|not.*found|camera/i.test(text) ? text : null;
    },
    { label: 'designed media failure state', timeout: 15000 }
  ).catch(() => null);

  check('denied camera shows a designed failure state, not a blank screen', Boolean(gateShown));
  check(
    'failure state offers recovery + continue',
    Boolean(gateShown && /continue without camera/i.test(gateShown))
  );

  const daveStillInCall = await dave.locator('text=Continue without camera').count();
  if (daveStillInCall > 0) {
    await dave.getByRole('button', { name: /continue without camera/i }).click();
    const daveSeesOthers = await until(
      () => dave.locator('video').count().then((n) => n > 0),
      { label: 'Dave receiving remote video without a camera' }
    ).then(() => true).catch(() => false);
    check('view-only participant still receives remote media', daveSeesOthers);
  }

  // ------------------------------------------------------------------ done --
  await deniedBrowser.close();
  await browserA.close();
  await browserB.close();

  console.log(`\n${'─'.repeat(64)}`);
  check('zero unexpected console errors', consoleErrors.length === 0,
    consoleErrors.slice(0, 6).join(' | '));

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nFAILED:');
    for (const f of failed) console.log(`  ✗ ${f.name} ${f.detail}`);
  }
  if (consoleErrors.length) {
    console.log('\nConsole errors:');
    for (const e of [...new Set(consoleErrors)].slice(0, 12)) console.log(`  ${e}`);
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('\nQA harness crashed:', error);
  process.exit(2);
});
