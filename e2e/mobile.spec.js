/**
 * The call UI on a phone.
 *
 * These assert the properties that were actually broken, measured on a real
 * device profile rather than a narrow desktop window: controls you can hit,
 * a chat sheet that does not bury the call, and a composer that will not make
 * iOS zoom the page.
 */
const { chromium, devices } = require('playwright');

const APP = process.env.APP_URL || 'http://localhost:4173';
const CHROME = process.env.CHROME_PATH || undefined;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (n, p, d = '') => {
  results.push({ n, p });
  console.log(`  ${p ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`);
};

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
  console.log(`\nMobile call UI — ${APP}\n${'─'.repeat(56)}`);

  const browser = await chromium.launch({
    headless: true, channel: 'chromium', ...(CHROME ? { executablePath: CHROME } : {}),
    args: [
      // Two cameras, so switching between them is a real assertion rather than
      // a no-op against a single fake device.
      '--use-fake-device-for-media-stream=device-count=2',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const open = async (name, opts, code) => {
    const ctx = await browser.newContext({ ...opts, permissions: ['camera','microphone'], ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(APP, { waitUntil: 'networkidle' });
    if (code) {
      await page.locator('#display-name').fill(name);
      await page.locator('#room-code').fill(code);
      await page.getByRole('button', { name: /enter room/i }).click();
    } else {
      await page.getByRole('tab', { name: /new room/i }).click();
      await page.locator('#display-name').fill(name);
      await page.locator('#room-name').fill('Mobile');
      await page.getByRole('button', { name: /create room/i }).click();
    }
    await until(() => page.url().includes('/room/'), { label: name });
    return page;
  };

  const desktop = await open('Ada', { viewport: { width: 1440, height: 900 } });
  const code = desktop.url().split('/room/')[1];
  const phone = await open('Grace', { ...devices['Pixel 7'] }, code);
  const third = await open('Linus', { viewport: { width: 1024, height: 768 } }, code);

  await until(() => phone.evaluate(() =>
    [...document.querySelectorAll('video')].filter((v) => v.videoWidth > 0).length >= 3),
    { label: 'three streams' });
  await wait(2500);

  /*
   * Three participants: a single scrolling column, each tile taking the shape
   * of its own source. A portrait phone camera gets a portrait tile and a
   * laptop webcam a 16:9 one — neither cropped, neither letterboxed.
   */
  const shapes = await phone.evaluate(() =>
    [...document.querySelectorAll('[data-peer]')].map((t) => {
      const v = t.querySelector('[data-role="participant-video"]');
      const r = t.getBoundingClientRect();
      return v && v.videoWidth
        ? { tile: +(r.width / r.height).toFixed(3), source: +(v.videoWidth / v.videoHeight).toFixed(3) }
        : null;
    }).filter(Boolean));
  check('each tile takes the shape of its own source',
    shapes.length > 0 && shapes.every((s) => Math.abs(s.tile - s.source) / s.source < 0.06),
    shapes.map((s) => `${s.tile} vs ${s.source}`).join(', '));

  /*
   * The sheet defaults closed on a phone — a call that opens into a chat panel
   * covering the video is the wrong first frame — so open it for the checks
   * that are about the sheet.
   */
  await phone.getByTitle('Chat').click();
  await wait(900);

  // --- controls you can actually hit ---------------------------------------
  /*
   * 44px is the figure Apple's HIG and WCAG 2.2 both land on. Six controls
   * were under it, including Send at 34px and the panel tabs at 28px tall.
   */
  const small = await phone.evaluate(() =>
    [...document.querySelectorAll('button')]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { label: (b.title || b.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((b) => b.w > 0 && (b.w < 44 || b.h < 44)));
  check('every control is at least 44px', small.length === 0,
    small.map((b) => `${b.label} ${b.w}x${b.h}`).join(', ') || 'all pass');

  // --- the composer must not trigger iOS zoom ------------------------------
  const fontSize = await phone.evaluate(() => {
    const ta = document.querySelector('textarea');
    return ta ? parseFloat(getComputedStyle(ta).fontSize) : 0;
  });
  check('composer font is 16px or larger (iOS zoom)', fontSize >= 16, `${fontSize}px`);

  // --- nothing overflows sideways ------------------------------------------
  const overflow = await phone.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal overflow', overflow <= 1, `${overflow}px`);

  // --- the dock stays reachable with the sheet up --------------------------
  /*
   * The regression this pins: the stage shrinks when the sheet opens, and a
   * dock that flowed after it rode up and vanished behind the sheet, taking
   * mute and camera with it.
   */
  const geometry = await phone.evaluate(() => {
    const mic = [...document.querySelectorAll('button')].find((b) => /microphone/i.test(b.title || ''));
    const sheet = document.querySelector('textarea')?.closest('div[class]');
    const r = (e) => (e ? e.getBoundingClientRect() : null);
    const m = r(mic);
    const tiles = [...document.querySelectorAll('[data-peer]')].map((t) => {
      const b = t.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) };
    });
    return {
      mic: m ? { top: Math.round(m.top), bottom: Math.round(m.bottom) } : null,
      innerH: window.innerHeight,
      tiles,
      sheetTop: sheet ? Math.round(sheet.getBoundingClientRect().top) : null,
    };
  });

  check('the mute button is on screen while chatting',
    geometry.mic && geometry.mic.bottom <= geometry.innerH + 1 && geometry.mic.top > 0,
    geometry.mic ? `${geometry.mic.top}–${geometry.mic.bottom} of ${geometry.innerH}` : 'not found');

  // --- everyone stays visible above the sheet ------------------------------
  const visible = geometry.tiles.filter((t) => t.h > 40 && t.bottom > 0);
  check('all three participants remain visible with chat open',
    visible.length === 3, `${visible.length} of ${geometry.tiles.length} tiles`);

  // --- the overflow sheet carries the secondary controls -------------------
  await phone.getByTitle('Close panel').click();
  await wait(700);
  await phone.getByTitle('More options').click();
  await wait(600);

  const sheetLabels = await phone.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"] button')].map((b) => b.textContent.trim()));
  check('the more sheet carries the secondary controls',
    sheetLabels.length >= 4 && sheetLabels.some((l) => /participant/i.test(l)),
    sheetLabels.join(', ') || 'empty');

  const sheetTargets = await phone.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"] button')]
      .map((b) => Math.round(b.getBoundingClientRect().height))
      .filter((h) => h < 44));
  check('its rows are comfortably tappable', sheetTargets.length === 0,
    sheetTargets.join(', ') || 'all pass');

  // --- switching camera ----------------------------------------------------
  /*
   * The control must appear only when there is something to switch to, and the
   * switch has to reach the far side: `replaceTrack` on the existing senders,
   * so no renegotiation and nobody's video freezes. Audio must survive it.
   */
  // Scoped to the open sheet: on a phone the inline copy of this control is
  // display:none, and an unscoped locator resolves to that hidden one.
  const flip = phone.locator('[role="dialog"] button', { hasText: 'Switch camera' });
  check('a switch-camera control is offered when a second camera exists',
    (await flip.count()) > 0, sheetLabels.join(', '));

  const before = await phone.evaluate(() => {
    const v = document.querySelector('[data-peer="self"] [data-role="participant-video"]');
    const t = v?.srcObject?.getVideoTracks?.()[0];
    return { device: t?.getSettings?.().deviceId ?? null, audio: v?.srcObject?.getAudioTracks?.().length ?? 0 };
  });

  await flip.click();
  await wait(2500);

  const after = await phone.evaluate(() => {
    const v = document.querySelector('[data-peer="self"] [data-role="participant-video"]');
    const t = v?.srcObject?.getVideoTracks?.()[0];
    return {
      device: t?.getSettings?.().deviceId ?? null,
      live: t?.readyState === 'live',
      audio: v?.srcObject?.getAudioTracks?.().length ?? 0,
      width: document.querySelector('[data-peer="self"] [data-role="participant-video"]')?.videoWidth ?? 0,
    };
  });

  check('the local preview is still decoding after the switch',
    after.live && after.width > 0, `${after.width}px, readyState ${after.live}`);
  check('the microphone survives the switch', after.audio === before.audio && after.audio > 0,
    `${before.audio} → ${after.audio} audio tracks`);

  // The far side must keep decoding — a switch that renegotiated would stall.
  const peerStillSees = await until(() => desktop.evaluate(() =>
    [...document.querySelectorAll('[data-peer]')]
      .filter((t) => t.dataset.peer !== 'self')
      .map((t) => t.querySelector('[data-role=\"participant-video\"]'))
      .filter((v) => v && v.videoWidth > 0).length), { label: 'peers decoding after switch' });
  check('peers keep decoding through the switch', peerStillSees >= 2, `${peerStillSees} remote videos`);

  // --- the wide layout is untouched ----------------------------------------
  const deskTiles = await desktop.evaluate(() =>
    [...document.querySelectorAll('[data-peer]')].map((t) => {
      const b = t.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    }));
  check('the desktop gallery still sizes its tiles',
    deskTiles.length === 3 && deskTiles.every((t) => t.w > 200 && t.h > 100),
    JSON.stringify(deskTiles));

  /*
   * Two people on a phone: the WhatsApp / Instagram shape. The person you are
   * talking to fills the screen and you become a small floating tile — a 50/50
   * split would give half the screen to the one face you care about least.
   */
  await third.close();
  await until(() => phone.evaluate(() =>
    document.querySelectorAll('[data-peer]').length === 2), { label: 'back to two' });
  await wait(2500);

  const duet = await phone.evaluate(() => {
    const view = { w: window.innerWidth, h: window.innerHeight };
    const tiles = [...document.querySelectorAll('[data-peer]')].map((t) => {
      const r = t.getBoundingClientRect();
      return {
        peer: t.dataset.peer === 'self' ? 'self' : 'remote',
        w: Math.round(r.width), h: Math.round(r.height),
        top: Math.round(r.top), right: Math.round(view.w - r.right),
        area: Math.round(r.width * r.height),
      };
    });
    return { view, tiles };
  });

  const big = duet.tiles.reduce((a, b) => (a.area > b.area ? a : b));
  const pip = duet.tiles.reduce((a, b) => (a.area < b.area ? a : b));

  check('the other participant fills the screen',
    big.peer === 'remote' && big.w >= duet.view.w - 2 && big.h >= duet.view.h - 2,
    `${big.peer} ${big.w}x${big.h} of ${duet.view.w}x${duet.view.h}`);
  check('you become a small floating tile',
    pip.peer === 'self' && pip.area * 12 < big.area && pip.w >= 90 && pip.top > 0,
    `${pip.peer} ${pip.w}x${pip.h} at top ${pip.top}, right ${pip.right}`);

  const filled = await phone.evaluate(() => {
    const t = [...document.querySelectorAll('[data-peer]')].find((x) => x.dataset.peer !== 'self');
    return getComputedStyle(t.querySelector('[data-role="participant-video"]')).objectFit;
  });
  check('the full-screen participant fills rather than letterboxing',
    filled === 'cover', filled);

  // Tap the small tile to trade places, as in every app that does this.
  await phone.mouse.click(
    duet.view.w - pip.right - pip.w / 2,
    pip.top + pip.h / 2
  );
  await wait(1200);

  const afterSwap = await phone.evaluate(() =>
    [...document.querySelectorAll('[data-peer]')].map((t) => {
      const r = t.getBoundingClientRect();
      return { peer: t.dataset.peer === 'self' ? 'self' : 'remote', area: Math.round(r.width * r.height) };
    }));
  const nowBig = afterSwap.reduce((a, b) => (a.area > b.area ? a : b));
  check('tapping the small tile trades places', nowBig.peer === 'self',
    `${nowBig.peer} is now large`);

  /*
   * A message you cannot see should say so.
   *
   * A chime and a badge were the only signals, and neither tells you who spoke
   * or what they said — so anyone with the chat closed had to open it to find
   * out whether it mattered.
   */
  const notified = await until(async () => {
    await desktop.locator('textarea').first().fill('Are we still on for 3pm?');
    await desktop.keyboard.press('Enter');
    await wait(900);
    return phone.evaluate(() => {
      const region = document.querySelector('[role="status"]');
      const text = region?.innerText?.replace(/\s+/g, ' ').trim();
      return text ? { text, clickable: Boolean(region.querySelector('button')) } : null;
    });
  }, { timeout: 15000, label: 'chat toast' }).catch(() => null);

  check('an incoming message raises a notification',
    notified && /Ada/.test(notified.text) && /3pm/.test(notified.text),
    notified ? notified.text : 'none');
  check('and it can be tapped to open that conversation',
    notified && notified.clickable, String(notified?.clickable));

  await phone.locator('[role="status"] button').click().catch(() => {});
  await wait(1000);

  /*
   * Chat and video at the same time.
   *
   * The sheet sat under a scrim that darkened and blurred everything above it —
   * which is the entire call — so opening chat meant losing sight of whoever
   * was speaking, and the tile controls behind it stopped responding.
   */
  const alongside = await phone.evaluate(() => {
    const tiles = [...document.querySelectorAll('[data-peer]')].map((t) => {
      const r = t.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
    });
    const first = tiles[0];
    const hit = first
      ? document.elementFromPoint(first.w / 2, first.top + first.h / 2)
      : null;
    return { tiles, tileIsOnTop: Boolean(hit?.closest('[data-peer]')) };
  });
  check('the call stays visible while the chat is open',
    alongside.tiles.length > 0 && alongside.tiles.every((t) => t.h > 40),
    JSON.stringify(alongside.tiles.map((t) => `${t.w}x${t.h}`)));
  check('and the tiles are still reachable — nothing covers them',
    alongside.tileIsOnTop, String(alongside.tileIsOnTop));

  await phone.getByTitle('Close panel').click();
  await wait(700);

  /*
   * Per-tile controls.
   *
   * Enlarging anyone used to require a double-click, which is undiscoverable
   * with a mouse and barely works on a touch screen — so on a phone there was
   * no way to read a shared screen at all. The controls must also know when
   * they do not fit: two 44px targets on a filmstrip thumbnail cover the face
   * they act on.
   */
  const tileControls = await phone.evaluate(() =>
    [...document.querySelectorAll('[data-peer]')].map((t) => ({
      w: Math.round(t.getBoundingClientRect().width),
      actions: [...t.querySelectorAll('button')].map((b) => b.title),
    })));
  check('full-size tiles offer full screen and enlarge',
    tileControls.length > 0 && tileControls.every((t) =>
      t.w < 220 || (t.actions.includes('Full screen') && t.actions.some((a) => /main view|grid/i.test(a)))),
    JSON.stringify(tileControls.map((t) => `${t.w}:${t.actions.length}`)));

  /*
   * Diagnostics is an inspection, not a preference. It used to persist, so
   * every later call opened with a table of packet-loss figures over the
   * video — and the panel had no close of its own, so the only way out was to
   * find the control that opened it, two taps deep in an overflow sheet.
   */
  await phone.getByTitle('More options').click();
  await wait(500);
  await phone.locator('[role="dialog"] button', { hasText: 'Connection stats' }).click();
  await wait(900);

  const diag = await phone.evaluate(() => ({
    open: document.body.innerText.includes('Sending at'),
    hasClose: [...document.querySelectorAll('button')].some((b) => b.title === 'Close diagnostics'),
    persisted: localStorage.getItem('vimate.diagnostics'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check('diagnostics opens with a close of its own', diag.open && diag.hasClose,
    `open ${diag.open}, close ${diag.hasClose}`);
  check('diagnostics is not remembered between calls', diag.persisted === null,
    `stored ${diag.persisted}`);
  check('diagnostics does not overflow a phone', diag.overflow <= 1, `${diag.overflow}px`);

  await phone.getByTitle('Close diagnostics').click();
  // The drawer leaves on a spring, so wait for it to actually go rather than
  // guessing a duration.
  const closed = await until(
    () => phone.evaluate(() => !document.body.innerText.includes('Sending at')),
    { timeout: 6000, label: 'diagnostics closing' }
  ).then(() => true).catch(() => false);
  check('and its close button actually closes it', closed);

  /*
   * Someone presenting, seen from a phone.
   *
   * Focus mode predates the mobile-first pass and was never revisited: its rows
   * were minmax(180px, 46vh) plus a strip, which on a tall phone came to about
   * 480px of an 839px viewport and left the bottom 40% empty, with the featured
   * pane running under the floating header and a strip thumbnail stretched to
   * the full width with a small letterboxed video adrift in it.
   */
  await desktop.evaluate(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const c = Object.assign(document.createElement('canvas'), { width: 1920, height: 1080 });
      const x = c.getContext('2d');
      let f = 0;
      setInterval(() => {
        f += 1;
        x.fillStyle = '#123'; x.fillRect(0, 0, 1920, 1080);
        x.fillStyle = '#0f0'; x.fillRect((f * 9) % 1800, 400, 120, 120);
      }, 1000 / 30);
      return c.captureStream(30);
    };
  });

  await desktop.getByTitle('Share your screen').click();
  await until(() => phone.locator('[title="Sharing screen"]').count().then((n) => n > 0),
    { label: 'share announced on the phone' });
  await wait(3000);

  const shared = await phone.evaluate(() => {
    const view = { w: window.innerWidth, h: window.innerHeight };
    const tiles = [...document.querySelectorAll('[data-peer]')].map((t) => {
      const r = t.getBoundingClientRect();
      const v = t.querySelector('[data-role="participant-video"]');
      return {
        kind: t.dataset.tile,
        w: Math.round(r.width), h: Math.round(r.height),
        top: Math.round(r.top), bottom: Math.round(r.bottom),
        aspect: r.height ? r.width / r.height : 0,
        source: v && v.videoWidth ? v.videoWidth / v.videoHeight : null,
      };
    });
    return {
      view, tiles,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  const featured = shared.tiles.find((t) => t.kind === 'featured');
  const strip = shared.tiles.find((t) => t.kind === 'strip');

  check('the presenter fills the space above the strip',
    featured && featured.h > shared.view.h * 0.55,
    featured ? `${featured.w}x${featured.h} of ${shared.view.w}x${shared.view.h}` : 'no featured tile');
  check('the featured pane clears the floating header',
    featured && featured.top >= 40, featured ? `top ${featured.top}` : '');
  check('the strip thumbnail keeps its own shape rather than stretching',
    strip && strip.source && Math.abs(strip.aspect - strip.source) / strip.source < 0.1,
    strip ? `tile ${strip.aspect.toFixed(2)} vs source ${(strip.source ?? 0).toFixed(2)}` : 'no strip tile');
  check('the strip clears the floating dock',
    strip && strip.bottom <= shared.view.h - 60,
    strip ? `bottom ${strip.bottom} of ${shared.view.h}` : '');
  check('nothing overflows while presenting', shared.overflow <= 1, `${shared.overflow}px`);

  await desktop.getByTitle('Stop sharing').click();
  await wait(800);

  await browser.close();

  /*
   * And the other half: with a single camera there is nothing to switch to, so
   * the control must not be offered at all. A no-op button that reopens the
   * same device is worse than no button.
   */
  const solo = await chromium.launch({
    headless: true, channel: 'chromium', ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'],
  });
  const soloCtx = await solo.newContext({ ...devices['Pixel 7'], permissions: ['camera','microphone'], ignoreHTTPSErrors: true });
  /*
   * A real phone browser, where screen sharing does not exist: Chrome for
   * Android has hidden getDisplayMedia since Canary 88 and iOS Safari never had
   * it. It lives on the prototype, so deleting it from the instance does
   * nothing — which is exactly the mistake that made an earlier run of this
   * check pass against a browser that still had it.
   */
  await soloCtx.addInitScript(() => {
    delete MediaDevices.prototype.getDisplayMedia;
  });
  const soloPage = await soloCtx.newPage();
  await soloPage.goto(APP, { waitUntil: 'networkidle' });
  await soloPage.getByRole('tab', { name: /new room/i }).click();
  await soloPage.locator('#display-name').fill('Solo');
  await soloPage.locator('#room-name').fill('Solo');
  await soloPage.getByRole('button', { name: /create room/i }).click();
  await until(() => soloPage.url().includes('/room/'), { label: 'solo room' });
  await until(() => soloPage.evaluate(() =>
    document.querySelector('[data-peer="self"] [data-role="participant-video"]')?.videoWidth > 0),
    { label: 'solo camera' });
  await soloPage.getByTitle('More options').click();
  await wait(600);

  const soloLabels = await soloPage.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"] button')].map((b) => b.textContent.trim()));
  check('no switch-camera control when there is only one camera',
    !soloLabels.some((l) => /switch camera/i.test(l)), soloLabels.join(', '));

  const share = await soloPage.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"] button')]
      .map((b) => ({ label: b.innerText.replace(/\s+/g, ' ').trim(), disabled: b.disabled }))
      .find((b) => /share screen/i.test(b.label)) ?? null);
  check('screen share is still listed where it cannot work, and says why',
    share && share.disabled && /not supported/i.test(share.label),
    share ? `${share.label} (disabled ${share.disabled})` : 'missing entirely');

  await solo.close();
  const failed = results.filter((r) => !r.p);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('crashed:', e.message); process.exit(2); });
