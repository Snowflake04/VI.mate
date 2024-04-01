# End-to-end QA

These drive **real Chromium instances through real WebRTC calls** using synthetic
camera and microphone devices. They are not DOM snapshot tests — every media
assertion is checked against `videoWidth`, `readyState`, and
`RTCPeerConnection.getStats()`, because a `<video>` element with a dead
`srcObject` looks exactly like a working one in the DOM.

## Running

```sh
# once
npm install
npm run setup          # downloads Chromium

# in two other terminals
cd ../server && npm start
cd ../vimate && npm run build && npm run preview

# then
npm test
```

`APP_URL` (default `http://localhost:4173`) points the suites at another build.
`CHROME_PATH` overrides the browser binary. `SETTLE_MS` lengthens the pause
`tiers.spec.js` takes before measuring.

**Run the suites one at a time.** `tiers.spec.js` asserts on adaptive
behaviour driven by real `getStats()` measurements, so several suites encoding
concurrently will legitimately push the ladder down and fail it — the loop
working, not a flake. `npm test` sequences them and inserts the pause.

> The **full** Chromium build is required — `chrome-headless-shell` ships without
> WebRTC encoders and every media assertion fails against it.

## What each suite covers

### `call.spec.js` — 30 checks
Lobby rendering and live ICE readout · room creation and routing · local camera
producing real frames · a second participant joining · **remote video actually
decoding** · connection quality derived from `getStats()` · measured bitrate and
RTT in the diagnostics drawer · ICE candidate path · group chat delivery ·
private 1:1 delivery *and* confirmation it never leaks into the room thread ·
mute presence propagation · video surviving a layout transition without
remounting · theme switching and persistence · sound-cue toggle persistence ·
horizontal overflow at four breakpoints · peer removal on leave · deep-link
rejoin · **denied camera producing a designed failure state** and a view-only
participant still receiving remote media · zero console errors.

### `resilience.spec.js` — 19 checks
Three-participant mesh with all three decoding both peers · adaptive encode tier ·
TURN relay reporting · screen share announcement · **audio surviving the start of
a screen share** · peers continuing to decode while sharing · shares encoded at
up to 30fps rather than the old 8 · a share opening in text mode and **switching
to protect frame rate once the shared surface is actually moving**, driven by an
animated canvas because the headless desktop is not static · **a message
arriving mid-share announced without its contents**, because the sharer's screen
is everybody's screen · clean stop ·
signalling socket severed via CDP `Network.emulateNetworkConditions` producing a
reconnecting state, reconnecting unattended, and the call surviving · the call
holding together on a 150 kbit/400 ms throttled link.

### `framing.spec.js` — 12 checks
Nothing is cropped by default at any tile aspect · desktop tiles hold 16:9
rather than stretching to fill · mobile tiles take the shape of their source ·
**mirroring is proven to happen at the sender** — no element carries a flip
transform, and a participant publishing a deliberately lopsided frame (bright
left, dark right) is decoded bright-*right* both in its own preview and by every
receiver, so the flip is in the transmitted pixels rather than in CSS · **and a
rear-facing camera is left alone** — the same lopsided source, reported as
`facingMode: 'environment'`, stays bright-*left* for its own sender and for
everyone receiving it · the fit/fill toggle switches both ways and is
remembered.

### `mixed.spec.js` — 13 checks
A laptop and an Android phone in one call. The portrait participant keeps a
portrait source end to end, gets a portrait tile matching its shape, the
landscape participant still gets a landscape tile, neither is shrunk into a
postage stamp, nothing overflows, and nothing is cropped.

Then it switches to **fill**, where every tile is a uniform 16:9 and a portrait
source has a landscape box it must fit into: the landscape participant is still
cropped edge to edge, the portrait one is embedded whole and pillarboxed with
the blurred backdrop behind it. The drawn image box is derived the way the
browser derives it, because `getBoundingClientRect` measures the element — which
always fills the tile — and can never see what `object-fit` actually painted.

The phone's video is a canvas `captureStream()` rather than the fake camera, so
the frame is exactly 720×1280 and immune to capture-format negotiation. It is
still a real track through the real encoder; the audio still comes from the fake
device.

### `mobile.spec.js` — 33 checks
The call UI on a Pixel 7 profile, not a narrow desktop window. Every control is
at least 44px · the composer is ≥16px, below which **iOS Safari zooms the page
on focus and does not zoom back** · nothing overflows sideways · the mute button
stays on screen with the chat sheet up · all three participants remain visible
above the sheet · the overflow sheet carries the secondary controls at a
tappable size · and the desktop gallery still sizes its tiles, because the
mobile-first rewrite is exactly the kind of change that silently guts the wide
layout.

It also covers the **one-to-one layout**: with two people on a phone the other
participant fills the viewport edge to edge and *fills* rather than letterboxes,
you shrink to a floating tile under a twelfth of the area, and tapping that tile
trades places.

It also covers **chat alongside the call**: an incoming message raises a
notification naming the sender and quoting it, that notification is tappable,
the tiles stay visible with the sheet open, and — via `elementFromPoint` — that
nothing covers them. Plus **screen share on a phone**: listed, disabled, and
labelled with the reason, on a context where `getDisplayMedia` has been removed
from `MediaDevices.prototype` (removing it from the *instance* does nothing,
which is how an earlier version of this check passed against a browser that
still had it).

It also covers the **per-tile controls** — full-size tiles offer full screen and
enlarge, thumbnails correctly offer neither — and **diagnostics**: that it opens
with a close of its own, that the close works, that it does not overflow a
phone, and that it leaves nothing in `localStorage` to reopen itself on the next
call.

It also covers **someone presenting, seen from a phone**: the featured pane
fills the space above the strip, clears the floating header, and the strip
thumbnail keeps its own shape instead of stretching to the full column width.

It also covers **switching camera**, launched with
`--use-fake-device-for-media-stream=device-count=2` so there is genuinely a
second device: the control appears, the local preview keeps decoding, the
microphone survives, and peers keep decoding throughout — a switch that
renegotiated instead of calling `replaceTrack` would stall them. A second
browser with one camera confirms the control is *absent* when there is nothing
to switch to.

### `tiers.spec.js` — 11 checks
Two participants negotiate 1080p · a third arrival steps the room down · that
peer leaving restores it. Asserted against `track.getSettings()` and the
sender's `scaleResolutionDownBy`, not the label the UI prints — and it checks
that the *camera* format never changes, since re-constraining a live camera is
what breaks a portrait participant's orientation.

It also times the **ramp**, which is what the adaptive loop exists for. The
squeeze is applied by capping `availableOutgoingBitrate` on the candidate-pair
stats rather than through CDP — `Network.emulateNetworkConditions` shapes HTTP
in the renderer and leaves the UDP media path untouched, so it cannot throttle
WebRTC at all. Everything downstream of the cap is the real code path. Asserts
that the drop lands on the tier that fits rather than one rung down, and that
the climb back is measured in seconds: the old rule took minutes.

### `turn.spec.js` — 6 checks
Run this one against a server started with TURN configured:

```sh
cd ../server
TURN_URLS=turn:turn.example.com:3478 TURN_SECRET=some-secret npm start
```

Confirms the lobby reports `STUN + TURN`, the missing-TURN warning clears, and
the ephemeral credentials actually reach `RTCPeerConnection` rather than being
cosmetic.

## Regressions these lock down

Each of the following was a real defect found by running these suites, not a
hypothetical:

| Symptom | Cause |
|---|---|
| Joiner is seen by nobody | Peer links were opened before `getUserMedia` resolved, so they negotiated with no tracks |
| One side of every pair shows a permanent placeholder | Rendering was gated on `MediaStreamTrack.muted`, which stays `true` after a perfect-negotiation rollback even while RTP flows |
| Sharer is silenced for everyone | `replaceTrack(undefined)` on the audio sender, because `getDisplayMedia()` returned no audio track |
| Lobby headline twice its intended size | `<h1>` inheriting the browser's default `2em` on top of the design system's size |
| Layout button labelled and moving the wrong way | The default `auto` layout was treated as "not grid" |
| Lobby renders, then the socket never connects — over LAN or from `preview` | The CORS allowlist defaulted to the Vite **dev** origin only, so every other host/port/scheme the proxy is served on was rejected with a bare `400`. `curl` hid it by sending no `Origin` header |
| A portrait phone is clipped top and bottom in a uniform tile, and `object-fit` has no effect | `Surface` centres its children, so the centred `<video>` never stretched and `height: 100%` had no definite height to resolve against. The element took its intrinsic aspect, grew taller than its tile, and was cut off by the tile's `overflow: hidden` — with `object-fit` powerless because the element already matched the source |
| Chat sheet buries the entire call on a phone | The sheet is `position: fixed` and the stage kept its full height underneath, rendering tiles taller than the viewport behind it |
| Mute and camera vanish when the chat sheet opens | The dock flowed after the stage, so shrinking the stage rode the dock up behind the sheet |
| Desktop stage renders no tiles at all | The phone rules carried `!important` from the old max-width block, so they beat the wider-layout restore and collapsed every tile to zero height |
| Presenting leaves the bottom 40% of a phone empty, the presenter under the header, and the thumbnail adrift in a stretched box | Focus mode predated the mobile-first pass. Its rows were `minmax(180px, 46vh)` plus a strip — about 480px of an 839px viewport — with no insets for the floating header and dock, and strip tiles stretched to their grid column instead of taking their source's shape |
| The connection panel reappears on every call and cannot be dismissed | It was persisted to `localStorage` like a preference, and had no close control of its own — the only way out was the control that opened it, two taps inside an overflow sheet |
| A shared screen cannot be read on a phone | There was no fullscreen control anywhere, and the only way to enlarge a tile was a double-click |
| Opening chat on a phone makes the call unwatchable and the tiles unresponsive | The sheet sat under a scrim covering everything above the dock — the whole video area — with a background tint and a blur |
| A message arrives and you never find out | The only signals were a chime and an unread badge; neither says who spoke or what they said |
| This suite silently stopped testing portrait at all | The app probes camera capabilities before opening the device for real; the second open got a `crop-and-scale` view of the already-negotiated format and landed at 720×720. Every portrait assertion then found nothing and the ones that remained still passed |
