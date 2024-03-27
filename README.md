<a name="readme-top"></a>

<div align="center">
  <h3 align="center">VI.mate</h3>
  <p align="center">
    Peer-to-peer video conferencing.<br />
    Audio, video, and screen share travel directly between browsers over WebRTC —
    there is no media server, and there never will be.
  </p>
</div>

---

## Contents

- [What it is](#what-it-is)
- [Architecture](#architecture)
- [Running it locally](#running-it-locally)
- [Configuration](#configuration)
- [TURN — required for production](#turn--required-for-production)
- [Design](#design)
- [Testing](#testing)
- [Deploying](#deploying)
- [Roadmap](#roadmap)
- [License](#license)

---

## What it is

A multi-participant video calling app built on a full mesh of WebRTC peer
connections. Every participant connects directly to every other participant.
The Node/Express/Socket.IO service in `server/` is a **switchboard only**: it
relays SDP offers, answers, and ICE candidates so two browsers can find each
other, then gets out of the way.

That property is load-bearing. It is why calls have no server-side hop, why the
hosting bill is a rounding error, and why the operator genuinely cannot watch
your call. Nothing should ever be added to `server/` that changes it.

**Features**

- Multi-participant calls (mesh; ceiling of 12, configurable)
- Adaptive video up to **1080p** — one-to-one calls get the full ladder
- Group chat, and private 1:1 chat alongside it
- Optional join approval — the room owner admits each person
- Screen sharing
- Front / rear camera switching, when more than one is present
- Expandable / spotlit tiles, with grid ⇄ spotlight ⇄ screen-share layouts
- Light and dark themes
- Per-participant connection telemetry from `RTCPeerConnection.getStats()`
- Per-participant audio levels from the Web Audio API
- Generated avatars — deterministic, no image assets

**Constraints, deliberately**

- The mesh is O(n²) connections. It is the right topology for small calls and
  the wrong one for large ones; the participant ceiling exists because *clients*
  fall over before the server does. Anything larger wants an SFU, which would
  mean routing media through a server, which is the one thing this project
  will not do.
- Media requires a secure context. Over plain `http://` (other than
  `localhost`) the browser refuses camera access entirely.

---

## Architecture

```
┌────────────┐   SDP / ICE (Socket.IO)   ┌────────────┐
│  Browser A │ ◄───────────────────────► │   server/  │
└────────────┘                           └────────────┘
      ▲                                        ▲
      │                                        │ SDP / ICE
      │    audio · video · screen (SRTP)       │
      │  ═══════════════════════════════►      ▼
      │                                  ┌────────────┐
      └───────────────────────────────── │  Browser B │
                                         └────────────┘
```

Media takes the double line. Signalling takes the single line. They never mix.

### `server/`

| File | Responsibility |
|---|---|
| `src/index.js` | Express app, health check, `/api/ice`, Socket.IO wiring, graceful shutdown |
| `src/signaling.js` | Every socket event. Authority comes from server state, never from the payload |
| `src/rooms.js` | Room registry, lifecycle, owner succession, bounded history, wire serialization |
| `src/validation.js` | Sanitises and bounds everything crossing the socket boundary |
| `src/ratelimit.js` | Per-socket token buckets per event class |
| `src/ice.js` | Builds the ICE configuration, including ephemeral TURN credentials |
| `src/config.js` | Environment parsing, with a dependency-free `.env` loader |

**The authority rule.** A client never tells the server which room it is in.
`socket.data.roomCode` is assigned server-side at join time and is the only
membership fact any handler consults. Signalling and DM targets are resolved
*within the sender's own room*, and privileged actions re-check ownership at
call time. That is what makes cross-room injection and self-approval into a
locked room inexpressible rather than merely unimplemented.

### `vimate/`

| Path | Responsibility |
|---|---|
| `src/lib/CallEngine.js` | Owns the socket, the local media, and the peer mesh; writes into the stores |
| `src/lib/rtc/PeerLink.js` | One peer connection: perfect negotiation, ICE restart, track replacement |
| `src/lib/rtc/stats.js` | `getStats()` → bitrate, loss, RTT, jitter, candidate type |
| `src/lib/rtc/constraints.js` | Adaptive resolution / framerate / bitrate ladder |
| `src/lib/audio/AudioMeter.js` | Shared AudioContext, one analyser per stream, rAF sampling |
| `src/lib/audio/sound.js` | Cues synthesised from oscillators — no audio files |
| `src/store/*.js` | Zustand stores, split by update frequency |
| `src/design/*` | Tokens, themes, the animated theme transition |

No React component talks to a `RTCPeerConnection`. The engine writes to stores;
components subscribe to the narrowest slice they need.

---

## Running it locally

Requires **Node 20.19+**.

```sh
git clone https://github.com/snowflake04/VI.mate.git
cd VI.mate
```

**1. Signalling server**

```sh
cd server
npm install
cp .env.example .env     # works as-is for local development
npm start                # http://localhost:8000
```

**2. Frontend**

```sh
cd vimate
npm install
cp .env.example .env     # points at http://localhost:8000
npm run dev              # http://localhost:5173
```

Open two browser windows, create a room in one, paste the code into the other.
`npm run dev` binds all interfaces, so you can also open it from a phone on the
same network — worth doing, since a video app tested only in two tabs on one
machine has not really been tested.

---

## Configuration

Every setting is an environment variable. Both `.env.example` files document
each one; there is no configuration in source.

### `server/.env`

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | Listen port |
| `CORS_ORIGIN` | `localhost:5173` | Comma-separated allowlist. Never `*` — credentials are enabled. See below |
| `TRUST_PROXY` | `0` | Set to `1` behind nginx / fly.io / Render |
| `STUN_URLS` | Google STUN | Comma-separated STUN URLs |
| `TURN_URLS` | — | Comma-separated TURN URLs |
| `TURN_USERNAME` / `TURN_CREDENTIAL` | — | Static TURN credentials |
| `TURN_SECRET` | — | Shared secret for ephemeral credentials (preferred) |
| `TURN_TTL_SECONDS` | `86400` | Lifetime of an ephemeral credential |
| `ICE_TRANSPORT_POLICY` | `all` | `relay` forces all media through TURN |
| `MAX_PARTICIPANTS` | `12` | Mesh ceiling |
| `MAX_MESSAGE_LENGTH` | `2000` | Chat character cap |
| `MAX_ROOM_HISTORY` | `200` | Messages retained and replayed |
| `EMPTY_ROOM_TTL_SECONDS` | `60` | Grace period before an empty room is destroyed |

**`CORS_ORIGIN` behaves differently in development.** Because the app is served
through Vite's proxy, the browser's `Origin` is whatever host and port Vite is
on — `:5173` under `dev`, `:4173` under `preview`, `https` once a dev
certificate exists, and the machine's LAN address when a phone joins. A fixed
list cannot name all of those, and a missing entry fails as an opaque `400` at
the socket handshake with a lobby that looks fine. So outside
`NODE_ENV=production`, any loopback or RFC1918 origin is accepted on any port
and either scheme. Public origins are rejected in both modes, and in production
the allowlist is exact and nothing else. Pinned by `server/test/cors.test.js`.

### `vimate/.env`

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SIGNALING_URL` | page origin | Base URL of the signalling server |
| `VITE_DEPLOY_LABEL` | — | Label shown in the lobby diagnostics readout |

Anything prefixed `VITE_` is readable in the shipped bundle. **Never put a
secret there.** TURN credentials are served at runtime from `/api/ice` for
exactly this reason.

---

## TURN — required for production

STUN alone tells a browser its public address. That is enough for most home
networks, and **not** enough for symmetric NAT, carrier-grade NAT, or corporate
firewalls that block UDP. Somewhere between 8% and 20% of real users need a TURN
relay, and without one their experience is the worst possible failure mode: they
join the room, see the participant list, and then nothing ever connects, with no
error anywhere.

VI.mate will tell you when this is unconfigured — the lobby readout says
`STUN only` and warns — but it cannot fix it for you.

### Standing up coturn

```sh
sudo apt install coturn
```

`/etc/turnserver.conf`:

```conf
listening-port=3478
tls-listening-port=5349

# Your server's PUBLIC address. Behind NAT (EC2, etc.), set both:
listening-ip=0.0.0.0
external-ip=203.0.113.10

realm=turn.example.com
server-name=turn.example.com

# Ephemeral credentials. Must match TURN_SECRET in server/.env.
use-auth-secret
static-auth-secret=a-long-random-shared-secret

# TLS on 5349 lets TURN traverse firewalls that only permit 443/tcp traffic.
cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem

fingerprint
no-multicast-peers
# Keeps your relay from being used to reach internal services.
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
total-quota=100
```

Then in `server/.env`:

```sh
TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:5349?transport=tcp
TURN_SECRET=a-long-random-shared-secret
TURN_TTL_SECONDS=86400
```

**Firewall:** open `3478/udp`, `3478/tcp`, `5349/tcp`, and the relay range
(`49152–65535/udp` by default).

### How credentials work

With `TURN_SECRET` set, `/api/ice` mints a fresh credential per request:

```
username   = <unix-expiry>:<random-id>
credential = base64(HMAC-SHA1(secret, username))
```

This is coturn's `use-auth-secret` REST contract. coturn recomputes the HMAC to
authenticate — the secret itself never leaves your server, and a leaked
credential expires on its own. Static `TURN_USERNAME`/`TURN_CREDENTIAL` also
work, but hand the same credential to every visitor; only use them behind an
access-controlled relay.

### Verifying it actually works

The point of failure is silent, so test it deliberately:

```sh
# Forbid host and server-reflexive candidates entirely — if the call still
# connects, media is genuinely traversing your TURN server.
ICE_TRANSPORT_POLICY=relay npm start
```

Join from two devices. If video flows, TURN works. If it does not, TURN is
misconfigured and you have just found out on your own terms rather than from a
user who could not join a meeting. `e2e/turn.spec.js` automates the client half
of this check. Set it back to `all` afterwards — relaying every call costs
bandwidth you do not need to spend.

---

## Design

The interface is called **Aperture**. It is quiet, soft-lit, and built around
the idea that the people on the call are the content and everything else should
recede.

Four principles, in the order they matter:

1. **Surfaces are lit, not outlined.** Depth comes from layered elevation, a
   soft shadow, and a 1px highlight along the top edge — the way a real object
   sits under a light source. Borders are a last resort. An interface made of
   boxes reads as a wireframe.
2. **Type carries the hierarchy.** Size, weight, and colour do the work. There
   is no uppercase-letterspaced-monospace label style, because applying one to
   every noun flattens hierarchy into texture. Monospace appears only on actual
   numbers, where tabular figures stop digits from jittering.
3. **One accent, used sparingly.** Warm coral on a cool neutral ground. The
   warmth belongs to a product about talking to people, and reserving it means
   it always means something when it appears.
4. **Generous radii and generous space.** 14–20px corners and real breathing
   room are most of what separates "considered" from "assembled".

Two schemes named for light rather than for theatre: **low light** and
**daylight**. Neither is an inversion of the other — the light theme is warm
off-white, because a `#FFF` ground is what makes a light theme read as an
unstyled document.

Switching between them is a designed moment: a circular wipe grows from the
toggle you pressed, implemented on the View Transitions API where available so
the entire document — live video included — is captured into one snapshot.
Reduced-motion users get an instant flip.

Typography uses `system-ui` first, which resolves to SF Pro on macOS and Segoe
UI Variable on Windows. Both are excellent, properly hinted, and already on the
machine; shipping a webfont to replace them would cost a render-blocking request
to look different rather than better.

All visual chrome is generated in-browser. The ambient light is two very wide
CSS gradient fields drifting against each other, dithered with an inline SVG
noise filter to stop the gradients banding. Icons and the wordmark are inline
SVG. Avatars are hashed gradient discs. There are no image files in the project.

### In-call controls

Every tile carries its own controls — **enlarge** and **full screen** — revealed
on hover where there is a pointer and always visible on touch. Before this the
only way to make anyone bigger was a double-click: undiscoverable with a mouse
and unreliable on a touch screen, which meant a shared screen on a phone simply
could not be read. They hide themselves on tiles narrower than 220px, measured
rather than guessed, because two 44px targets on a filmstrip thumbnail cover the
face they are meant to act on.

Full screen goes through the standard API, WebKit's prefixed one, and — where
neither exists — iOS Safari's `video.webkitEnterFullscreen`, which is the only
route Safari on iOS offers. The button is only rendered where one of the three
is actually available.

**Diagnostics is not remembered.** It is an inspection, not a preference: you
open it because a call is bad and you are done a minute later. Persisting it
meant every later call opened with a table of packet-loss figures over the
video — and the panel had no close of its own, so the only way out was to find
the control that opened it, two taps deep in an overflow sheet. It now has a
header with a close, answers Escape, stacks into labelled blocks on a phone
rather than scrolling 640px of table sideways, and ends above the floating dock.

**Chat is usable alongside the call.** The phone sheet is deliberately
non-modal. It used to sit under a scrim that darkened and blurred everything
above it — which is the entire call — so opening chat meant losing sight of
whoever was speaking, and the tile controls behind it stopped responding. A
sheet that only takes the bottom 58% exists precisely so the call stays
watchable; a scrim over the other 42% defeats the point of it.

**An incoming message raises a notification** naming the sender and quoting the
message, and tapping it opens that conversation. A chime and an unread badge
were the only signals before, and neither tells you who spoke or what they
said — so anyone with the chat closed had to open it to find out whether it
mattered. Nothing is shown when the relevant thread is already on screen.

**While you are sharing your screen, the notification names the sender and
withholds the message.** The toast renders on your own display, which during a
share is everyone's display, and a private message is exactly the thing that
must not be broadcast to the room because it happened to arrive at the wrong
moment.

**Screen sharing is listed even where it cannot work**, disabled and labelled
*Not supported on this browser*. It genuinely is unavailable from a phone —
Chrome for Android has hidden `getDisplayMedia` since Canary 88, and iOS Safari
never implemented it — but silently dropping the control made that read as a
missing feature of this app rather than of the platform, and left anyone hunting
for it with nothing to find.

**While you are sharing, your own tile shows your share** rather than your
camera — the person who most needs to know whether the share is working was the
only one who could not see it.

### Mobile first

The call surface is written phone-first: the base rules *are* the phone layout,
and `sm` / `md` / `lg` in `src/design/media.js` add the roomier ones. That
direction is not stylistic. The previous code described a desktop layout and
subtracted from it at six ad-hoc widths, and the phone ended up with a chat
panel covering the entire call, a control dock wrapped onto two rows of 36px
icons, and six controls below the 44px minimum.

- **Video is full-bleed.** The header floats over it as a translucent strip
  rather than taking a band of its own, and both it and the dock respect
  `env(safe-area-inset-*)`.
- **The dock is one row of five**: mic, camera, chat, more, leave. Everything
  else folds into a labelled bottom sheet — a phone dock holds about five
  targets at a comfortable size, and the rest were unhittable at 36px.
- **It is pinned to the viewport, not to the stage.** The stage shrinks when
  the sheet opens; a dock that flowed after it rode up and disappeared behind
  the sheet, taking mute with it.
- **Presenting fills the screen too.** Focus mode gives the presenter every
  row of space left over (`1fr`, not a fixed `46vh` that left the bottom of a
  tall phone empty), insets for the floating header and dock, and strip
  thumbnails that take their source's shape rather than stretching to their
  grid column. A share is still letterboxed rather than cropped — cropping a
  shared window loses the edges of whatever someone is trying to show you.
- **One-to-one gets its own layout.** Two people on a phone is the most common
  call there is, and it is not the n=2 case of a grid: a 50/50 split gives half
  the screen to the face you care about least and leaves both small. The other
  participant fills the viewport and you become a floating tile, tap to trade
  places — the shape WhatsApp, Instagram and FaceTime all converged on. A screen
  share still takes over, and so does the chat sheet, where the compact grid
  shows both of you in the band above it.
- **The panel starts closed below `lg`.** Joining a call into a chat sheet
  covering the video is the wrong first frame — and its scrim was swallowing
  taps on the floating tile behind it.
- **The chat sheet leaves the call visible.** It caps at `58dvh` and stops above
  the dock, and the stage becomes a compact two-up grid in the band above, so
  four people stay on screen while you read. The sheet is `position: fixed`, so
  its geometry is shared with the stage through `SHEET_H` / `DOCK_H` rather than
  derived twice.
- **The composer is 16px.** Below that, iOS Safari zooms the page on focus and
  does not zoom back out, leaving the call scaled up and scrolling sideways.
- **Heights use `dvh`.** `100vh` stays at the expanded height while the mobile
  URL bar collapses, which parks the controls below the fold.

Pinned by `e2e/mobile.spec.js`, which runs against a Pixel 7 device profile.

### Switching camera

Offered whenever `enumerateDevices()` reports more than one video input — keyed
off the device count rather than off being on a phone, since laptops often have
two and a phone with one usable camera should not be given a no-op button. It
cycles through the inputs by `deviceId`, which works on desktop and mobile
alike; `facingMode` alone cannot express a third camera.

The swap goes through `replaceTrack` on the existing senders, so there is **no
renegotiation** and nobody's video freezes while SDP goes round trip. The
microphone track is carried across untouched, the old device is released before
the new one is opened (a phone with a single ISP will refuse the second camera
while the first is still held), and while a screen share is live the senders
keep the shared surface — the new camera is adopted locally and appears when
sharing stops.

### Video quality

Resolution, frame rate and bitrate come from a five-rung ladder — 1080p30 /
720p30 / 540p30 / 360p24 / 240p15 — and the rung is chosen by a closed loop over
real measurements rather than a guess.

**The camera is always opened at the top of the ladder.** Chromium fixes the
capture format when `getUserMedia` resolves: `applyConstraints` can downscale
from it but will never re-open the device higher. A camera opened at 360p is a
360p source for the rest of the session, so climbing to "1080p" later would
raise a label and a bitrate ceiling over a picture with 360 lines in it. Capture
is therefore decided once, high; the device score governs the *encoder* tier
instead. This costs almost nothing, because `scaleResolutionDownBy` shrinks the
frame before the encoder sees it — only capture-and-scale runs at full size, and
that is far cheaper than encoding. It is what Jitsi and libwebrtc both do.

**The loop follows the transport rather than second-guessing it.** Every browser
already runs [Google Congestion Control][gcc] — delay-based plus loss-based,
with an AIMD rate controller — and publishes its estimate as
`availableOutgoingBitrate`. Re-deriving "quality" from packet loss and RTT and
acting on that is a second, slower control loop stacked on a better one, and it
cannot see what GCC sees. So the tier is the best one whose bitrate budget fits
the measured estimate, and `qualityLimitationReason` separates CPU limitation
from bandwidth limitation — two causes that loss and RTT cannot tell apart, and
which want opposite responses.

Three properties are borrowed from GCC and from libwebrtc's [QualityScaler][qs]:

| | Rule | Where it comes from |
|---|---|---|
| Down | 2 s of overuse, straight to the tier that fits | `kMeasureMs` = 2000 |
| Up | 5 s of headroom, ×1.3 margin | QualityScaler's 2 s × `kSamplePeriodScaleFactor` 2.5 |
| Ambiguity | **hold**, never reset | GCC's Hold state |
| Distance | jump rungs, do not step | GCC increases multiplicatively far from convergence |

The previous version got each of these backwards: it required 15 *consecutive*
samples in which every peer was ranked "excellent", zeroed that count on a
single ordinary sample, and bought one rung per completed run. On a normally
jittery link the count almost never completed, and a full recovery took minutes.
Measured now: a fallen estimate drops the tier in ~2 s, and a recovery climbs
three rungs back to 1080p in ~7 s. Pinned by `e2e/tiers.spec.js`.

Device profiling scores **compute only** — cores, memory, whether it is a phone.
It used to fold `effectiveType` and `downlink` in as well, which was the main
reason a good connection started at 360p: `downlink` is a rolling estimate at
its most pessimistic in the first seconds after load, which is exactly when the
profile is taken, and a cold reading below 1.5 Mbps cost two points. The link is
now measured for real, so guessing it up front adds nothing and cannot be
corrected. `Save-Data` is still honoured, because that is an instruction rather
than a measurement.

[gcc]: https://datatracker.ietf.org/doc/html/draft-ietf-rmcat-gcc-02
[qs]: https://chromium.googlesource.com/external/webrtc/+/master/video/g3doc/adaptation.md

### Screen share

Shares run at **up to 30fps**, at both capture and encoder. They used to be
capped at 8, which made shared video a slideshow and saved nothing on
documents — a frame rate cap is a ceiling rather than a target, and screen
capture only produces a frame when the captured surface actually changes, so a
static slide costs one or two frames a second at any ceiling.

What genuinely depends on the content is the trade-off *when a share cannot have
everything*, and the two answers are opposites: text wants every pixel and will
happily drop to a couple of frames a second to keep them; video wants smooth
motion and would rather lose resolution than stutter. So that, rather than the
frame rate, is what adapts — `contentHint` plus `degradationPreference`.

The content type is measured rather than guessed, and screen capture makes it an
easy measurement: a static document delivers a couple of frames a second, a
playing video delivers thirty. Counting frames off the source track separates
them with no heuristics about window titles. A share opens in text mode and
moves within a couple of seconds of playback starting; the thresholds are 12fps
in and 5fps out, so scrolling and window-dragging do not flip it back and forth.

Counted through `MediaStreamTrackProcessor`, **not**
`requestVideoFrameCallback`. The detector's video element is deliberately
detached, and the browser throttles frame *presentation* for anything not on
screen: measured against a 30fps source, `requestVideoFrameCallback` reported
9.7fps — below the motion threshold, so the detector could never have fired.
The track processor reported 30.7. Where it is unavailable the decoded-frame
counter is accurate too, because decoding happens regardless of presentation.

### Framing

Tiles are **not** a uniform grid. Every row shares a height, each tile's width is
that height times *its own* participant's aspect ratio, and the row is scaled to
fill the width — the justified layout photo galleries use for mixed
orientations. A phone held upright is roughly 9:16, and forcing that into a 16:9
cell means either cropping most of the person away or shrinking them into a
column between two grey bars. Neither is "visible". So a portrait participant
simply gets a portrait tile, next to landscape ones, at the same height.

Nothing is cropped by default: video is fitted, matching Google Meet's tiled
view (which letterboxes "to show you everything your camera sees") and Zoom's
Original Ratio. Where a letterbox does appear, a blurred copy of the frame fills
it rather than leaving dead bars. A fit/fill toggle in the control dock switches
to a uniform cropped grid for anyone who prefers it, and the choice is
remembered.

**Fill mode crops, but it will not gut a frame to do it.** `object-fit: cover`
keeps `min(source/tile, tile/source)` of the image: a 4:3 webcam in a 16:9 tile
keeps 75%, the ordinary crop nobody notices, while a 9:16 phone keeps 32% — a
vertical slice through the middle of a person. Below a retention floor of 0.62
the source is embedded whole instead, pillarboxed against the blurred backdrop,
the way Meet and Zoom seat a phone in a landscape grid. The floor sits under
4:3-in-16:9 and far above any orientation mismatch, so in practice it reads as
"crop within an orientation, embed across one" without special-casing
orientation itself.

**Every camera is mirrored, and the flip happens at the sender.** The outgoing
track is transformed before it is encoded, so the mirrored frame *is* the
content of the call: every participant receives it already flipped and no
receiver applies anything. A CSS transform on each `<video>` would have been far
cheaper, but it is a rendering trick — the bytes on the wire stay unflipped,
anything consuming the track outside our components sees the original, and every
client has to be told to apply it.

Two implementations, chosen at runtime:

- **Insertable Streams** (`MediaStreamTrackProcessor`), on Chromium. Frames are
  transformed on the media pipeline, so it is unaffected by tab visibility and
  never touches the main thread's animation clock.
- **Canvas capture** everywhere else, driven by `requestVideoFrameCallback` so
  exactly one draw happens per decoded frame. This path inherits a real
  limitation — frame callbacks are throttled in a hidden tab, so a backgrounded
  sender's video slows for everyone else. That is most of why the first path
  exists.

Two things are deliberately **not** mirrored, for the same reason — the mirror
metaphor only holds while the lens points at you:

- **Screen sharing.** Text would read backwards.
- **A rear-facing camera.** Turning the lens around reverses the scene and
  makes anything written in shot unreadable. The decision reads `facingMode`
  from the live track, not from what was requested, because a camera is free to
  satisfy a `facingMode` hint with whichever device it likes. A camera that
  reports no `facingMode` at all — most desktop webcams — is treated as
  front-facing, which is what it almost always is.

Because the published track is a derivative, the camera's true capture format is
passed to the encoder explicitly — a `MediaStreamTrackGenerator` reports no
width or height, which would read as "capture is 0 wide" and silently disable
the whole downscaling ladder.

Everything that looks live *is* live:

- **Connection quality** — worst-metric-first over measured loss, RTT, and
  jitter. Healthy states render in neutral ink; the indicator only takes on
  colour when something is genuinely wrong, and it renders nothing at all when
  the browser has not produced a sample yet.
- **Audio levels** — an `AnalyserNode` on the real stream, RMS per frame with a
  VU-style attack/release envelope. Silence reads zero. These never enter React
  state; a shared rAF loop writes transforms directly, because a speech envelope
  at 60fps through `setState` would re-render the call continuously.
- **Connection panel** — the raw `getStats()` numbers in plain language,
  including whether each peer is direct or relayed through TURN.

Sound cues are synthesised from oscillators at play time — no audio assets — and
are one click from off, with the choice remembered.

## Testing

```sh
cd server && npm test     # 22 checks
cd e2e     && npm test    # 44 checks across two suites
```

`e2e/tiers.spec.js` verifies the adaptive ladder against real encoders: two
participants negotiate 1080p, a third arrival steps the room to 720p, and that
peer leaving restores 1080p — asserted against `track.getSettings()`, not the
label the UI happens to print.

`server/test/` covers the signalling protocol over a real Socket.IO server,
including four security regressions: a guest cannot approve itself into a locked
room, a non-owner cannot approve anyone, signalling cannot cross room
boundaries, and a socket that never joined cannot post into a room. Plus the
TURN credential contract, verified against a recomputed HMAC.

`e2e/` drives real browsers through real calls with synthetic devices. See
[`e2e/README.md`](e2e/README.md) for what each suite covers and the list of
genuine defects they caught.

---

## Deploying

**Frontend** — any static host. `cd vimate && npm run build`, serve `dist/`.
Configure a SPA rewrite (all paths → `index.html`) or deep links to `/room/CODE`
will 404.

**Server** — any Node host. Set `CORS_ORIGIN` to your real frontend origin, set
`TRUST_PROXY=1` if proxied, and configure TURN. `GET /health` is a ready-made
health check.

**HTTPS is mandatory.** `getUserMedia` and `getDisplayMedia` only exist in a
secure context; over plain HTTP the app cannot access a camera at all.

Room state is in memory. A restart ends every live call, and running more than
one instance requires sticky sessions or a Socket.IO adapter — rooms on
instance A are invisible to instance B.

---

## Roadmap

- [x] Multi-participant calls
- [x] Chat
- [x] Join approval
- [x] Expanded and spotlight video layouts
- [x] User avatars
- [x] Screen sharing
- [x] Expand a participant's stream on click
- [x] **Private 1:1 chat**
- [x] **Theme switching**
- [ ] Recording (local, client-side — media still never reaches the server)
- [ ] Virtual backgrounds via `MediaStreamTrackProcessor`
- [ ] Optional SFU mode for calls above the mesh ceiling

---

## License

Apache 2.0 — see [`LICENSE`](LICENSE).

<p align="right"><a href="#readme-top">Top</a></p>
