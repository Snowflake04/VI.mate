/**
 * Framing: nothing may be cropped by default, at any tile aspect.
 *
 * The check that matters is `object-fit`, because it is the property that
 * decides whether pixels are discarded. A portrait source in a landscape tile
 * is the case that was cutting heads off.
 */
const { chromium } = require('playwright');

const APP = process.env.APP_URL || 'http://localhost:4173';
const CHROME = process.env.CHROME_PATH || undefined;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (n, p, d = '') => { results.push({ n, p }); console.log(`  ${p ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };

async function until(fn, { timeout = 30000, label = '' } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e.message; }
    await wait(400);
  }
  throw new Error(`timeout ${label}: ${JSON.stringify(last)}`);
}

(async () => {
  console.log(`\nTile framing — ${APP}\n${'─'.repeat(56)}`);

  const browser = await chromium.launch({
    headless: true, channel: 'chromium', ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'],
  });


  /*
   * A camera whose frame is unmistakably lopsided: bright left, dark right.
   * Deterministic, unlike the fake device's moving pattern, so "which side is
   * brighter" is a real assertion rather than a coin flip.
   */
  const LOPSIDED = `
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c = {}) => {
      if (!c.video) return real(c);
      const canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 360 });
      const ctx = canvas.getContext('2d');
      let f = 0;
      setInterval(() => {
        f += 1;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 320, 360);
        ctx.fillStyle = '#000000'; ctx.fillRect(320, 0, 320, 360);
        // Motion, so the encoder keeps producing frames.
        ctx.fillStyle = '#808080'; ctx.fillRect(300, (f * 3) % 360, 40, 20);
      }, 40);
      const stream = canvas.captureStream(30);
      if (c.audio) {
        const mic = await real({ audio: c.audio });
        mic.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
      return stream;
    };
  `;

  /*
   * The same lopsided camera, but reporting itself as rear-facing. Added to
   * what the track already returns rather than faked wholesale, so everything
   * else about it stays real.
   */
  const REAR_LOPSIDED = LOPSIDED + `
    const realSettings = MediaStreamTrack.prototype.getSettings;
    MediaStreamTrack.prototype.getSettings = function () {
      const s = realSettings.call(this);
      if (this.kind === 'video') s.facingMode = 'environment';
      return s;
    };
  `;

  const open = async (name, viewport, code, { source } = {}) => {
    const ctx = await browser.newContext({ viewport, permissions: ['camera','microphone'], ignoreHTTPSErrors: true });
    if (source) await ctx.addInitScript(source);
    const page = await ctx.newPage();
    await page.goto(APP, { waitUntil: 'networkidle' });
    if (code) {
      await page.locator('#display-name').fill(name);
      await page.locator('#room-code').fill(code);
      await page.getByRole('button', { name: /enter room/i }).click();
    } else {
      await page.getByRole('tab', { name: /new room/i }).click();
      await page.locator('#display-name').fill(name);
      await page.locator('#room-name').fill('Framing');
      await page.getByRole('button', { name: /create room/i }).click();
    }
    await until(() => page.url().includes('/room/'), { label: name });
    return page;
  };

  const desktop = await open('Ada', { width: 1440, height: 900 });
  const code = desktop.url().split('/room/')[1];
  const phone = await open('Grace', { width: 390, height: 844 }, code);

  await until(() => desktop.evaluate(() =>
    [...document.querySelectorAll('video')].filter(v => v.videoWidth > 0).length >= 2), { label: 'streams' });
  await wait(3500);

  // --- default must not crop -----------------------------------------------
  const fits = await desktop.evaluate(() =>
    [...document.querySelectorAll('video')]
      .filter(v => v.videoWidth > 0 && v.dataset.role === 'participant-video')
      .map(v => getComputedStyle(v).objectFit));
  check('default framing shows the whole frame', fits.length > 0 && fits.every(f => f === 'contain'), fits.join(', '));

  // No pixels lost: rendered box must contain the full source aspect.
  const intact = await desktop.evaluate(() =>
    [...document.querySelectorAll('video')].filter(v => v.videoWidth > 0 && v.dataset.role === 'participant-video')
      .every(v => {
        const r = v.getBoundingClientRect();
        const src = v.videoWidth / v.videoHeight;
        const box = r.width / r.height;
        // With `contain` the drawn image is inset, never clipped.
        return getComputedStyle(v).objectFit === 'contain' || Math.abs(src - box) < 0.01;
      }));
  check('no participant is clipped', intact);

  // --- desktop tiles keep a camera-shaped box ------------------------------
  const deskTile = await desktop.evaluate(() => {
    const t = document.querySelector('[data-peer]');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return +(r.width / r.height).toFixed(3);
  });
  check('desktop tiles are 16:9, not stretched square', deskTile && Math.abs(deskTile - 16 / 9) < 0.08,
    `tile aspect ${deskTile}`);

  // --- one-to-one on a phone is immersive ----------------------------------
  /*
   * Two people on a phone get the WhatsApp / Instagram shape rather than a
   * column of tiles, so the remote participant fills the viewport. The
   * single-column rule — each tile taking the shape of its own source — applies
   * from three participants up and is asserted in mobile.spec.js.
   */
  const duet = await phone.evaluate(() => {
    const view = { w: window.innerWidth, h: window.innerHeight };
    const tiles = [...document.querySelectorAll('[data-peer]')].map((t) => {
      const r = t.getBoundingClientRect();
      return { peer: t.dataset.peer === 'self' ? 'self' : 'remote', w: Math.round(r.width), h: Math.round(r.height) };
    });
    return { view, tiles };
  });
  const bigTile = duet.tiles.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
  check('one-to-one on a phone fills the screen with the other person',
    bigTile.peer === 'remote' && bigTile.w >= duet.view.w - 2 && bigTile.h >= duet.view.h - 2,
    `${bigTile.peer} ${bigTile.w}x${bigTile.h} of ${duet.view.w}x${duet.view.h}`);

  // --- mirroring happens at the sender, in the pixels -----------------------
  /*
   * The claim is that the flip lives in the transmitted video, not in CSS on
   * the receiver. Asserting "no element has a flip transform" only proves the
   * second half, so this also reads the decoded pixels.
   *
   * A third participant publishes a deliberately lopsided frame — bright on
   * the left, dark on the right. If mirroring happens before encoding, then
   * *everyone*, including that participant's own preview, sees it bright on
   * the right.
   */
  const cssTransforms = await Promise.all([desktop, phone].map(page => page.evaluate(() =>
    [...document.querySelectorAll('[data-peer]')].flatMap(t =>
      [...t.querySelectorAll('video')].map(v => getComputedStyle(v).transform)))));
  const cssFlipped = cssTransforms.flat().filter(t => t.includes('matrix(-1'));
  check('no CSS flip anywhere — the mirroring is not a render trick',
    cssFlipped.length === 0, cssFlipped.join(' | ') || 'all none');

  const lopsided = await open('Lop', { width: 1280, height: 720 }, code, { source: LOPSIDED });
  await until(() => desktop.evaluate(() =>
    [...document.querySelectorAll('video')].filter(v => v.videoWidth > 0).length >= 3),
    { label: 'third stream' });
  await wait(2500);

  // Mean luminance of each half of a decoded frame.
  const HALVES = `(video) => {
    const w = 64, h = 36;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    const mean = (x0, x1) => {
      const d = ctx.getImageData(x0, 0, x1 - x0, h).data;
      let t = 0;
      for (let i = 0; i < d.length; i += 4) t += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return t / (d.length / 4);
    };
    return { left: mean(0, w / 2), right: mean(w / 2, w) };
  }`;

  const ownPreview = await lopsided.evaluate(
    `(${HALVES})(document.querySelector('[data-peer="self"] [data-role="participant-video"]'))`);
  check('the sender\'s own preview is mirrored', ownPreview.right > ownPreview.left + 20,
    `left ${ownPreview.left.toFixed(0)}, right ${ownPreview.right.toFixed(0)}`);

  /*
   * On the receiver, pick the tile showing the lopsided source: it is the one
   * whose two halves differ most. Identifying it by contrast rather than by
   * peer id keeps this independent of join order.
   */
  /*
   * On the receiver, pick the tile showing the lopsided source: it is the one
   * whose two halves differ most. Identifying it by contrast rather than by
   * peer id keeps this independent of join order.
   */
  const asReceived = await desktop.evaluate(
    'const halves = ' + HALVES + ';' +
    '[...document.querySelectorAll("[data-peer]")]' +
    '  .map(t => t.querySelector(\'[data-role="participant-video"]\'))' +
    '  .filter(v => v && v.videoWidth)' +
    '  .map(v => halves(v))' +
    '  .sort((a, b) => Math.abs(b.left - b.right) - Math.abs(a.left - a.right))[0]'
  );
  check('and every receiver decodes it already mirrored',
    asReceived && asReceived.right > asReceived.left + 20,
    asReceived ? `left ${asReceived.left.toFixed(0)}, right ${asReceived.right.toFixed(0)}` : 'no tile');

  /*
   * A rear camera must not be mirrored. Mirroring exists so a preview behaves
   * like a mirror; point the lens away and the same flip reverses the scene and
   * makes text in shot read backwards. Same lopsided source, same assertions,
   * opposite expectation — bright stays on the left, for the sender and for
   * everyone receiving them.
   */
  await lopsided.close();
  const rearCam = await open('Rear', { width: 1280, height: 720 }, code, { source: REAR_LOPSIDED });
  await until(() => rearCam.evaluate(() =>
    document.querySelector('[data-peer=\"self\"] [data-role=\"participant-video\"]')?.videoWidth > 0),
    { label: 'rear camera frames' });
  await wait(2500);

  const rearOwn = await rearCam.evaluate(
    `(${HALVES})(document.querySelector('[data-peer="self"] [data-role="participant-video"]'))`);
  check('a rear camera is not mirrored for its own sender',
    rearOwn.left > rearOwn.right + 20,
    `left ${rearOwn.left.toFixed(0)}, right ${rearOwn.right.toFixed(0)}`);

  const rearAsReceived = await desktop.evaluate(
    'const halves = ' + HALVES + ';' +
    '[...document.querySelectorAll("[data-peer]")]' +
    '  .map(t => t.querySelector(\'[data-role="participant-video"]\'))' +
    '  .filter(v => v && v.videoWidth)' +
    '  .map(v => halves(v))' +
    '  .sort((a, b) => Math.abs(b.left - b.right) - Math.abs(a.left - a.right))[0]'
  );
  check('and receivers get it unmirrored too',
    rearAsReceived && rearAsReceived.left > rearAsReceived.right + 20,
    rearAsReceived ? `left ${rearAsReceived.left.toFixed(0)}, right ${rearAsReceived.right.toFixed(0)}` : 'no tile');

  await rearCam.close();

  // --- the toggle genuinely switches to cropping ---------------------------
  await desktop.getByTitle(/Fill the tile/i).click();
  await wait(900);
  const filled = await desktop.evaluate(() =>
    [...document.querySelectorAll('video')].filter(v => v.videoWidth > 0 && v.dataset.role === 'participant-video')
      .map(v => getComputedStyle(v).objectFit));
  check('toggle switches to fill', filled.every(f => f === 'cover'), filled.join(', '));

  const persisted = await desktop.evaluate(() => localStorage.getItem('vimate.videoFit'));
  check('choice is remembered', persisted === 'fill', `stored ${persisted}`);

  await desktop.getByTitle(/Show the whole frame/i).click();
  await wait(700);
  const back = await desktop.evaluate(() =>
    [...document.querySelectorAll('video')].filter(v => v.videoWidth > 0 && v.dataset.role === 'participant-video')
      .map(v => getComputedStyle(v).objectFit));
  check('toggle switches back to fit', back.every(f => f === 'contain'), back.join(', '));

  await browser.close();
  const failed = results.filter(r => !r.p);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(2); });
