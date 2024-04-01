/**
 * Resilience QA: three-way mesh, screen share, and recovery from a dropped
 * signalling socket.
 *
 * The network interruption is driven through CDP's Network.emulateNetworkConditions,
 * which severs the WebSocket the way a tunnel death or a Wi-Fi handoff does.
 * That is exactly the failure the original client had no answer for.
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
  console.log(`${passed ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, { timeout = 20000, interval = 300, label = '' } = {}) {
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
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/favicon|net::ERR_|Autoplay/i.test(text)) return;
    consoleErrors.push(`[${tag}] ${text}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`[${tag}] UNCAUGHT: ${e.message}`));
}

function launch(extraArgs = []) {
  return chromium.launch({
    headless: true,
    channel: 'chromium',
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      ...extraArgs,
    ],
  });
}

async function openParticipant(browser, { name, roomCode, create = false }) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    // Self-signed certs are expected when testing against a LAN address.
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone'],
  });
  /*
   * Records every peer connection so the encoder parameters can be inspected.
   * Sender encodings are not reachable from the DOM, and asserting on the tier
   * label the UI prints would only prove the UI agrees with itself.
   */
  await context.addInitScript(() => {
    window.__pcs = [];
    const Real = window.RTCPeerConnection;
    window.RTCPeerConnection = function (...args) {
      const pc = new Real(...args);
      window.__pcs.push(pc);
      return pc;
    };
    window.RTCPeerConnection.prototype = Real.prototype;
  });

  const page = await context.newPage();
  attachConsole(page, name);
  await page.goto(APP, { waitUntil: 'networkidle' });

  if (create) {
    await page.getByRole('tab', { name: /new room/i }).click();
    await page.locator('#display-name').fill(name);
    await page.locator('#room-name').fill('Resilience');
    await page.getByRole('button', { name: /create room/i }).click();
  } else {
    await page.locator('#display-name').fill(name);
    await page.locator('#room-code').fill(roomCode);
    await page.getByRole('button', { name: /enter room/i }).click();
  }

  await until(() => page.url().includes('/room/'), { label: `${name} entering` });
  return page;
}

/** Counts peer connections that are actually delivering decoded video. */
function liveVideoCount(page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('video')].filter(
        (v) => v.videoWidth > 0 && v.readyState >= 2
      ).length
  );
}

async function main() {
  console.log(`\nVI.mate resilience QA against ${APP}\n${'─'.repeat(64)}`);

  // Screen capture needs a source auto-selected; there is no picker headless.
  const browser = await launch(['--auto-select-desktop-capture-source=Entire screen']);

  // ------------------------------------------------------ three-way mesh --
  console.log('\nThree-participant mesh');

  const alice = await openParticipant(browser, { name: 'Alice', create: true });
  const roomCode = alice.url().split('/room/')[1];

  const bob = await openParticipant(browser, { name: 'Bob', roomCode });
  const carol = await openParticipant(browser, { name: 'Carol', roomCode });

  // Each participant should see themselves plus two others, all with frames.
  for (const [page, who] of [
    [alice, 'Alice'],
    [bob, 'Bob'],
    [carol, 'Carol'],
  ]) {
    const ok = await until(() => liveVideoCount(page).then((n) => n >= 3), {
      label: `${who} receiving both peers`,
      timeout: 35000,
    })
      .then(() => true)
      .catch(() => false);
    const count = await liveVideoCount(page);
    check(`${who} decodes video from both peers`, ok, `${count} live streams`);
  }

  // Adaptive ladder should have stepped down for a 3-person mesh.
  await alice.getByTitle('Connection diagnostics').click();
  const tier = await alice.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/(1080p|720p|540p|360p|240p)/);
    return match ? match[1] : null;
  });
  check('adaptive encode tier is applied', Boolean(tier), `tier ${tier}`);

  const relayLine = await alice.evaluate(() => {
    const match = document.body.innerText.match(/Relayed[\s\S]{0,24}/i);
    return match ? match[0].replace(/\s+/g, ' ').trim() : null;
  });
  check('TURN relay usage is reported', Boolean(relayLine), relayLine ?? '');
  await alice.getByTitle('Connection diagnostics').click();

  // --------------------------------------------------------- screen share --
  console.log('\nScreen share');

  await alice.getByTitle('Share your screen').click();
  const sharingSeen = await until(
    () => bob.locator('[title="Sharing screen"]').count().then((n) => n > 0),
    { label: 'screen share presence on Bob', timeout: 20000 }
  )
    .then(() => true)
    .catch(() => false);
  check('screen share is announced to peers', sharingSeen);

  if (sharingSeen) {
    // The critical regression: the old code replaced the audio sender with
    // undefined because getDisplayMedia returned no audio track, silencing the
    // sharer for everyone. Audio must still be flowing.
    const audioAlive = await alice.evaluate(async () => {
      const stream = document.querySelector('video')?.srcObject;
      const track = stream?.getAudioTracks?.()[0];
      return Boolean(track && track.readyState === 'live' && track.enabled);
    });
    check('audio survives starting a screen share', audioAlive);

    const stillLive = await liveVideoCount(bob);
    check('peers keep decoding video while sharing', stillLive >= 3, `${stillLive} streams`);

    /*
     * Frame rate is a ceiling, not a target.
     *
     * This used to be capped at 8 both at capture and at the encoder, which
     * made shared video a slideshow and saved nothing on documents — screen
     * capture only emits a frame when the surface changes, so a static slide
     * costs one or two a second at any ceiling.
     */
    const readShare = () => alice.evaluate(() => {
      for (const pc of window.__pcs ?? []) {
        for (const sender of pc.getSenders()) {
          if (sender.track?.kind !== 'video') continue;
          const params = sender.getParameters();
          const encoding = params.encodings?.[0] ?? {};
          return {
            maxFramerate: encoding.maxFramerate ?? null,
            maxBitrate: encoding.maxBitrate ?? null,
            degradationPreference: params.degradationPreference ?? null,
            contentHint: sender.track.contentHint ?? null,
          };
        }
      }
      return null;
    });

    const share = await readShare();
    check('a share is encoded at up to 30fps, not 8',
      share && share.maxFramerate === 30, JSON.stringify(share));
    /*
     * A share opens in text mode and stays there until the measurement says
     * otherwise. Asserted immediately, because the headless desktop is *not*
     * static — its compositor produces ~30fps, so the detector legitimately
     * flips this share to motion a couple of seconds later.
     */
    check('a share starts by protecting resolution',
      share && share.degradationPreference === 'maintain-resolution'
        && share.contentHint === 'text',
      share ? `${share.degradationPreference}, hint ${share.contentHint}` : 'no sender');

    await alice.getByTitle('Stop sharing').click();
    const stopped = await until(
      () => bob.locator('[title="Sharing screen"]').count().then((n) => n === 0),
      { label: 'screen share ending' }
    )
      .then(() => true)
      .catch(() => false);
    check('screen share stops cleanly and camera returns', stopped);

    /*
     * And the other content type. The headless desktop is static, so sharing it
     * can only ever exercise the text path — this replaces getDisplayMedia with
     * an animated canvas so the detector has real motion to measure. Everything
     * downstream is the real code path: the frame counter, the hysteresis, the
     * encoder reconfiguration on every peer.
     */
    await alice.evaluate(() => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = Object.assign(document.createElement('canvas'), {
          width: 1280, height: 720,
        });
        const ctx = canvas.getContext('2d');
        let f = 0;
        setInterval(() => {
          f += 1;
          ctx.fillStyle = `hsl(${f * 7 % 360}, 70%, 45%)`;
          ctx.fillRect(0, 0, 1280, 720);
          ctx.fillStyle = '#fff';
          ctx.fillRect((f * 17) % 1200, 300, 80, 80);
        }, 1000 / 30);
        return canvas.captureStream(30);
      };
    });

    await alice.getByTitle('Share your screen').click();
    await until(
      () => bob.locator('[title="Sharing screen"]').count().then((n) => n > 0),
      { label: 'second share announced', timeout: 20000 }
    ).catch(() => {});

    /*
     * Wait on the content hint, not on degradationPreference. A new share
     * resets the trade-off to text; waiting on the preference alone would have
     * been satisfied by the *previous* share's value before this one had
     * decided anything — which is exactly the stale-state bug this pins.
     */
    const motion = await until(async () => {
      const s = await readShare();
      return s && s.contentHint === 'motion' ? s : null;
    }, { label: 'share switches to motion', timeout: 25000 }).catch(() => readShare());

    check('a moving share switches to protecting frame rate',
      motion && motion.degradationPreference === 'maintain-framerate'
        && motion.contentHint === 'motion',
      motion ? `${motion.degradationPreference}, hint ${motion.contentHint}` : 'no sender');
    check('and still caps at 30fps', motion && motion.maxFramerate === 30,
      motion ? String(motion.maxFramerate) : 'n/a');


    /*
     * A message arriving mid-share must not put its contents on the projector.
     *
     * The arrival notification renders on the sharer's own screen, which during
     * a share is everybody's screen. A private message is precisely the thing
     * that must not be broadcast to the room because it happened to land at the
     * wrong moment.
     */
    // Close the sharer's chat, or the message is already on screen and the
    // notification is correctly suppressed for a different reason.
    await alice.getByTitle('Close panel').click().catch(() => {});
    await wait(500);

    await bob.getByTitle(/message Alice privately/i).click().catch(() => {});
    await wait(400);
    await bob.locator('textarea').first().fill('salary review at four');
    await bob.keyboard.press('Enter');

    const shownWhileSharing = await until(
      () => alice.evaluate(() => {
        const region = document.querySelector('[role="status"]');
        const text = region?.innerText?.replace(/\s+/g, ' ').trim();
        return text || null;
      }),
      { timeout: 12000, label: 'notification during a share' }
    ).catch(() => null);

    check('a message arriving mid-share is announced without its contents',
      shownWhileSharing && !/salary review/i.test(shownWhileSharing),
      shownWhileSharing ?? 'no notification');

    await alice.getByTitle('Stop sharing').click();
    await wait(800);
  }

  // ------------------------------------------------- signalling recovery --
  console.log('\nDropped signalling socket');

  const cdp = await bob.context().newCDPSession(bob);
  await cdp.send('Network.enable');

  // Sever the socket the way a tunnel death does.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });

  // Connection state is a status dot with a title, not body text.
  const statusOf = (page) =>
    page.evaluate(() => {
      const el = document.querySelector('[title="Connected"], [title="Reconnecting"], [title="Offline"], [title="Connecting"]');
      return el ? el.getAttribute('title') : null;
    });

  const showedReconnecting = await until(
    async () => {
      const status = await statusOf(bob);
      return status === 'Reconnecting' || status === 'Offline';
    },
    { label: 'reconnecting indicator', timeout: 25000 }
  )
    .then(() => true)
    .catch(() => false);
  check('dropped socket surfaces a reconnecting state', showedReconnecting);

  await wait(3000);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  const recovered = await until(
    async () => (await statusOf(bob)) === 'Connected',
    { label: 'socket recovery', timeout: 40000 }
  )
    .then(() => true)
    .catch(() => false);
  check('signalling socket reconnects on its own', recovered);

  // And the call must still be a call afterwards.
  const callIntact = await until(() => liveVideoCount(bob).then((n) => n >= 2), {
    label: 'media intact after reconnect',
    timeout: 40000,
  })
    .then(() => true)
    .catch(() => false);
  const finalCount = await liveVideoCount(bob);
  check('call survives the reconnect', callIntact, `${finalCount} live streams`);

  // --------------------------------------------------------- throttling ---
  console.log('\nDegraded network');

  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: (150 * 1024) / 8,
    uploadThroughput: (100 * 1024) / 8,
  });
  await wait(6000);

  const stillConnected = await bob.evaluate(
    () => [...document.querySelectorAll('video')].filter((v) => v.videoWidth > 0).length
  );
  check('call holds together under a throttled link', stillConnected >= 2, `${stillConnected} streams`);

  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  await browser.close();

  console.log(`\n${'─'.repeat(64)}`);
  check('zero unexpected console errors', consoleErrors.length === 0,
    [...new Set(consoleErrors)].slice(0, 5).join(' | '));

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nFAILED:');
    for (const f of failed) console.log(`  ✗ ${f.name} ${f.detail}`);
  }
  if (consoleErrors.length) {
    console.log('\nConsole errors:');
    for (const e of [...new Set(consoleErrors)].slice(0, 10)) console.log(`  ${e}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('\nHarness crashed:', error);
  process.exit(2);
});
