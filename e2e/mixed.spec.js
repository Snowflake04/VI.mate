/**
 * A laptop and an Android phone in the same call.
 *
 * Chromium's fake device honours whatever resolution is requested, so a peer
 * that asks for 720x1280 behaves like a phone held upright. The question is
 * whether the desktop grid gives that person a shape they fit in.
 */
const { chromium } = require('playwright');

const APP = process.env.APP_URL || 'http://localhost:4173';
const CHROME = process.env.CHROME_PATH || undefined;
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (n, p, d = '') => { results.push({ n, p }); console.log(`  ${p ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };

async function until(fn, { timeout = 30000, label = '' } = {}) {
  const end = Date.now() + timeout; let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e.message; }
    await wait(400);
  }
  throw new Error(`timeout ${label}: ${JSON.stringify(last)}`);
}

(async () => {
  console.log(`\nMixed portrait + landscape call — ${APP}\n${'─'.repeat(58)}`);

  const browser = await chromium.launch({
    headless: true, channel: 'chromium',
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'],
  });

  /*
   * Forces this context's getUserMedia to hand back a 720x1280 portrait frame —
   * a phone held upright.
   *
   * The video comes from a canvas rather than the fake camera. Asking the fake
   * device for portrait does work in isolation, but the app probes the camera's
   * capabilities before opening it for real, and a device already open at one
   * format hands the second caller a `crop-and-scale` view of it — which landed
   * at 720x720 and quietly made this whole suite assert nothing about portrait.
   * A canvas track has no format negotiation to lose: the dimensions are exactly
   * what is asked for, and it is still a real MediaStreamTrack going through the
   * real encoder, so nothing downstream is simulated.
   *
   * Audio still comes from the fake device, so the audio path stays genuine.
   */
  const PORTRAIT = `
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c = {}) => {
      if (!c.video) return real(c);

      const canvas = Object.assign(document.createElement('canvas'), {
        width: 720, height: 1280,
      });
      const ctx = canvas.getContext('2d');
      // Moving, high-contrast content: a static canvas gives the encoder
      // nothing to do and getStats() reports a stream that looks stalled.
      let f = 0;
      setInterval(() => {
        f += 1;
        ctx.fillStyle = '#101820';
        ctx.fillRect(0, 0, 720, 1280);
        ctx.fillStyle = \`hsl(\${f % 360}, 80%, 55%)\`;
        ctx.fillRect(60, 200 + ((f * 4) % 700), 600, 320);
        ctx.fillStyle = '#fff';
        ctx.font = '64px sans-serif';
        ctx.fillText('PORTRAIT ' + f, 60, 140);
      }, 40);

      const stream = canvas.captureStream(30);
      if (c.audio) {
        const mic = await real({ audio: c.audio });
        mic.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
      return stream;
    };
  `;

  const open = async (name, { portrait, code } = {}) => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      permissions: ['camera','microphone'], ignoreHTTPSErrors: true,
    });
    if (portrait) await ctx.addInitScript(PORTRAIT);
    const page = await ctx.newPage();
    await page.goto(APP, { waitUntil: 'networkidle' });
    if (code) {
      await page.locator('#display-name').fill(name);
      await page.locator('#room-code').fill(code);
      await page.getByRole('button', { name: /enter room/i }).click();
    } else {
      await page.getByRole('tab', { name: /new room/i }).click();
      await page.locator('#display-name').fill(name);
      await page.locator('#room-name').fill('Mixed');
      await page.getByRole('button', { name: /create room/i }).click();
    }
    await until(() => page.url().includes('/room/'), { label: name });
    return page;
  };

  const laptop = await open('Laptop');
  const code = laptop.url().split('/room/')[1];
  const phone = await open('Phone', { portrait: true, code });

  await until(() => laptop.evaluate(() =>
    [...document.querySelectorAll('video')].filter(v => v.videoWidth > 0).length >= 2), { label: 'streams' });
  await wait(5000);

  const tiles = await laptop.evaluate(() =>
    [...document.querySelectorAll('[data-peer]')].map(t => {
      const v = t.querySelector('[data-role="participant-video"]');
      const r = t.getBoundingClientRect();
      return {
        peer: t.dataset.peer === 'self' ? 'self' : 'remote',
        tile: +(r.width / r.height).toFixed(2),
        source: v && v.videoWidth ? +(v.videoWidth / v.videoHeight).toFixed(2) : null,
        area: Math.round(r.width * r.height),
      };
    }));

  // What the phone is actually capturing and sending.
  console.log('    phone local track:', await phone.evaluate(() => {
    const v = document.querySelector('[data-peer="self"] [data-role="participant-video"]');
    const t = v?.srcObject?.getVideoTracks?.()[0];
    const s = t?.getSettings?.();
    return s ? `${s.width}x${s.height}` : 'none';
  }));
  console.log('    laptop receives:', await laptop.evaluate(() => {
    const v = [...document.querySelectorAll('[data-peer]')]
      .filter(t => t.dataset.peer !== 'self')
      .map(t => t.querySelector('[data-role="participant-video"]'))[0];
    return v ? `${v.videoWidth}x${v.videoHeight}` : 'none';
  }));
  // Printed because when this suite fails the first question is always
  // "did the phone actually capture portrait", and the answer decides whether
  // the bug is in the app or in the harness.
  console.log('    phone captured:', await phone.evaluate(() => {
    const v = document.querySelector('[data-peer="self"] [data-role="participant-video"]');
    const t = v?.srcObject?.getVideoTracks?.()[0]?.getSettings?.();
    return t ? `${t.width}x${t.height}` : 'none';
  }));
  console.log('    laptop received:', await laptop.evaluate(() => {
    const v = [...document.querySelectorAll('[data-peer]')]
      .filter((t) => t.dataset.peer !== 'self')
      .map((t) => t.querySelector('[data-role="participant-video"]'))[0];
    return v ? `${v.videoWidth}x${v.videoHeight}` : 'none';
  }));
  console.log('   ', JSON.stringify(tiles));

  const portraitTile = tiles.find(t => t.source && t.source < 1);
  const landscapeTile = tiles.find(t => t.source && t.source > 1);

  check('the portrait participant exists', Boolean(portraitTile),
    portraitTile ? `source ${portraitTile.source}` : 'not found');
  check('portrait gets a portrait tile', portraitTile && portraitTile.tile < 1,
    portraitTile ? `tile ${portraitTile.tile}` : '');
  check('its tile matches its source shape',
    portraitTile && Math.abs(portraitTile.tile - portraitTile.source) / portraitTile.source < 0.06,
    portraitTile ? `${portraitTile.tile} vs ${portraitTile.source}` : '');
  check('landscape still gets a landscape tile', landscapeTile && landscapeTile.tile > 1.4,
    landscapeTile ? `tile ${landscapeTile.tile}` : '');
  check('neither is shrunk into a postage stamp',
    portraitTile && landscapeTile &&
    Math.min(portraitTile.area, landscapeTile.area) / Math.max(portraitTile.area, landscapeTile.area) > 0.25,
    portraitTile && landscapeTile ? `areas ${portraitTile.area} / ${landscapeTile.area}` : '');

  // Nothing may be cropped, and nothing may overflow the stage.
  const overflow = await laptop.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  check('no horizontal overflow', overflow <= 1, `${overflow}px`);

  const fits = await laptop.evaluate(() =>
    [...document.querySelectorAll('[data-role="participant-video"]')].map(v => getComputedStyle(v).objectFit));
  check('still nothing cropped', fits.every(f => f === 'contain'), fits.join(', '));

  /*
   * Fill mode must embed the phone rather than crop it.
   *
   * `cover` on a 9:16 source in a 16:9 tile keeps about a third of the frame —
   * a vertical slice through the middle of a person. So fill is expected to
   * crop the laptop (a modest, ordinary crop) and to leave the phone contained,
   * pillarboxed against the blurred backdrop.
   */
  // Gallery mode is the case that matters: it is the only layout that hands
  // every participant an identical 16:9 tile, so it is the only one where a
  // portrait source has a landscape box it must be embedded into. Focus mode
  // already sizes each tile to its own source.
  const toGrid = laptop.getByTitle('Switch to grid');
  if (await toGrid.count()) await toGrid.click();
  await laptop.getByTitle(/Fill the tile/i).click();
  await wait(1200);

  const framed = await laptop.evaluate(() =>
    [...document.querySelectorAll('[data-peer]')]
      .map((t) => {
        const v = t.querySelector('[data-role="participant-video"]');
        if (!v || !v.videoWidth) return null;
        const tileBox = t.getBoundingClientRect();
        const source = v.videoWidth / v.videoHeight;
        const fit = getComputedStyle(v).objectFit;

        /*
         * The element always fills the tile — `object-fit` decides what is
         * painted inside it, and getBoundingClientRect cannot see that. So
         * derive the drawn image box the way the browser does: `contain` fits
         * the source inside the box, `cover` fills the box and overflows.
         */
        const byWidth = tileBox.width / source <= tileBox.height;
        const containedByWidth = fit === 'contain' ? byWidth : !byWidth;
        const drawnWidth = containedByWidth ? tileBox.width : tileBox.height * source;
        const drawnHeight = drawnWidth / source;

        return {
          source,
          tile: tileBox.width / tileBox.height,
          fit,
          // Visible bars: the drawn image is narrower/shorter than the tile.
          pillarboxed: drawnWidth < tileBox.width - 1,
          letterboxed: drawnHeight < tileBox.height - 1,
          // Nothing is lost only when the whole frame fits within the tile.
          whole: drawnWidth <= tileBox.width + 1 && drawnHeight <= tileBox.height + 1,
          backdrop: Boolean(t.querySelector('[data-role="backdrop"]')),
        };
      })
      .filter(Boolean));
  console.log('   ', JSON.stringify(framed));

  const portrait = framed.find((f) => f.source < 1);
  const landscape = framed.find((f) => f.source > 1);

  check('fill still crops the landscape source', landscape && landscape.fit === 'cover',
    landscape ? landscape.fit : 'not found');
  check('fill embeds the portrait source instead of cropping it',
    portrait && portrait.fit === 'contain', portrait ? portrait.fit : 'not found');
  check('the embedded portrait sits in a landscape tile', portrait && portrait.tile > 1.4,
    portrait ? `tile ${portrait.tile.toFixed(2)}` : '');
  check('the whole portrait frame is kept, pillarboxed inside it',
    portrait && portrait.whole && portrait.pillarboxed,
    portrait ? `whole ${portrait.whole}, bars ${portrait.pillarboxed}` : '');
  check('the pillarbox is filled by the blurred backdrop', portrait && portrait.backdrop,
    portrait ? String(portrait.backdrop) : '');
  check('the landscape source still fills its tile edge to edge',
    landscape && !landscape.pillarboxed && !landscape.letterboxed,
    landscape ? `bars ${landscape.pillarboxed}/${landscape.letterboxed}` : '');

  await browser.close();
  const failed = results.filter(r => !r.p);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(2); });
