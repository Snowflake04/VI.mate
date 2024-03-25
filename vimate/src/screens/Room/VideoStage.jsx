import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { LayoutGroup } from 'motion/react';

import VideoTile from './VideoTile.jsx';
import { useCallStore } from '../../store/callStore.js';
import { media, DOCK_H, SHEET_H } from '../../design/media.js';
import { useUIStore } from '../../store/uiStore.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';

/**
 * ---------------------------------------------------------------------------
 * The stage: grid ⇄ spotlight ⇄ screen share
 * ---------------------------------------------------------------------------
 * Two architectural decisions drive this file.
 *
 * **Every tile lives in the same flat container, always, in a stable order.**
 * The obvious implementation — a "featured" container and a separate filmstrip
 * container — reparents a tile in the DOM when the layout changes. React then
 * unmounts and remounts the `<video>`, which drops `srcObject`, and every
 * participant flashes black on every layout change. Here the layout is
 * expressed purely as size and grid placement on children that never move in
 * the tree, and Motion's `layout` prop springs them between their old and new
 * rectangles. No remount, no black frames, real physics.
 *
 * **Tile size is computed, not stretched.** Dividing the stage evenly between
 * participants is the intuitive approach and it is wrong: with two people on a
 * wide screen it produces two square tiles, and a 16:9 camera in a square tile
 * is mostly letterbox. Google Meet sizes tiles to a target aspect and centres
 * whatever is left over, which is what `fitTiles` below does.
 * ---------------------------------------------------------------------------
 */

/** Springs, not durations — an inertial settle rather than a timed slide. */
const LAYOUT_SPRING = {
  type: 'spring',
  stiffness: 340,
  damping: 34,
  mass: 0.9,
};

const GAP = 12;
/** Tiles aim for 16:9, the shape of almost every webcam. */
const TARGET_ASPECT = 16 / 9;

/**
 * Largest uniform tile that fits `count` tiles of `aspect` into `width`×`height`.
 *
 * Tries every column count and keeps the arrangement giving the biggest tile.
 * Worth doing exactly rather than approximating in CSS: `aspect-ratio` combined
 * with a flex basis cannot express "shrink until you fit in both axes", so the
 * browser silently breaks one constraint or the other.
 */
function fitTiles({ width, height, count, aspect = TARGET_ASPECT, gap = GAP }) {
  if (!width || !height || count === 0) return null;

  let best = { width: 0, height: 0, columns: 1 };

  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);

    // Width-constrained candidate…
    let tileWidth = (width - (columns - 1) * gap) / columns;
    let tileHeight = tileWidth / aspect;

    // …clamped if that makes the stack too tall to fit.
    const stackedHeight = tileHeight * rows + (rows - 1) * gap;
    if (stackedHeight > height) {
      tileHeight = (height - (rows - 1) * gap) / rows;
      tileWidth = tileHeight * aspect;
    }

    if (tileWidth > best.width) {
      best = { width: tileWidth, height: tileHeight, columns };
    }
  }

  return best.width > 0 ? best : null;
}

/** Guard against a degenerate source producing an unusable tile. */
const clampAspect = (a) => Math.min(Math.max(a || TARGET_ASPECT, 0.4), 2.6);

/**
 * Justified rows for a call with mixed portrait and landscape participants.
 *
 * Forcing one shape on everybody is the thing that breaks a mixed call: a
 * phone held upright is roughly 9:16, and putting that in a 16:9 cell means
 * either cropping most of the person away or shrinking them into a narrow
 * column between two grey bars. Neither is "visible".
 *
 * So tiles are not uniform. Every row shares a height, each tile's width is
 * that height times *its own* aspect, and the row is scaled to fill the
 * available width — the same justified layout photo galleries use for mixed
 * orientations. A portrait participant simply gets a portrait tile.
 *
 * Rows are tried from 1..n and the arrangement with the largest smallest-tile
 * wins, so nobody ends up as a postage stamp to make the packing tidy.
 *
 * @param {{id: string, aspect: number}[]} items
 * @returns {Map<string, {width: number, height: number}> | null}
 */
function justifiedRows({ width, height, items, gap = GAP }) {
  const count = items.length;
  if (!width || !height || count === 0) return null;

  let best = null;

  for (let rows = 1; rows <= count; rows += 1) {
    const perRow = Math.ceil(count / rows);

    // Order is preserved: 'self' first, then join order. Reshuffling people
    // between renders to pack better would be deeply disorienting.
    const partition = [];
    for (let i = 0; i < count; i += perRow) {
      partition.push(items.slice(i, i + perRow));
    }

    const verticalGaps = (partition.length - 1) * gap;
    const availableHeight = height - verticalGaps;
    if (availableHeight <= 0) continue;

    // A row scaled to exactly fill the width has
    //   rowHeight = (width - gaps) / Σ aspect
    const rowHeights = partition.map((row) => {
      const sumAspect = row.reduce((sum, item) => sum + item.aspect, 0);
      return (width - (row.length - 1) * gap) / sumAspect;
    });

    const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);
    // If the rows are collectively too tall, scale them all down together —
    // which leaves horizontal slack, and the stage centres it.
    const scale = totalHeight > availableHeight ? availableHeight / totalHeight : 1;

    const scaled = rowHeights.map((h) => h * scale);
    const smallest = Math.min(...scaled);

    if (!best || smallest > best.smallest) {
      best = { partition, heights: scaled, smallest };
    }
  }

  if (!best) return null;

  const sizes = new Map();
  best.partition.forEach((row, index) => {
    const rowHeight = best.heights[index];
    for (const item of row) {
      sizes.set(item.id, { width: rowHeight * item.aspect, height: rowHeight });
    }
  });
  return sizes;
}

export default function VideoStage() {
  const peerOrder = useCallStore((state) => state.peerOrder);
  const peers = useCallStore((state) => state.peers);
  const screenOn = useCallStore((state) => state.screenOn);

  const spotlightId = useUIStore((state) => state.spotlightId);
  const layoutMode = useUIStore((state) => state.layout);
  const videoFit = useUIStore((state) => state.videoFit);
  const isPanelOpen = useUIStore((state) => state.isPanelOpen);

  // Below this the stage becomes a single scrolling column and tiles take the
  // shape of their own source instead of a computed uniform size.
  const isNarrow = useMediaQuery('(max-width: 719.98px)');

  /**
   * Resolves what the stage should show. Screen share always wins — someone
   * presenting is unambiguously the thing to look at, and having to manually
   * spotlight them would be a bug, not a feature.
   */
  const { tiles, featuredId, mode } = useMemo(() => {
    const ids = ['self', ...peerOrder];

    const sharingPeer = peerOrder.find((id) => peers[id]?.state?.screen);
    const sharerId = screenOn ? 'self' : (sharingPeer ?? null);

    let featured = null;
    let resolvedMode = 'grid';

    if (sharerId) {
      featured = sharerId;
      resolvedMode = 'screen';
    } else if (spotlightId && (spotlightId === 'self' || peers[spotlightId])) {
      featured = spotlightId;
      resolvedMode = 'spotlight';
    } else if (layoutMode === 'spotlight' && ids.length > 1) {
      // Explicit spotlight with nothing chosen: feature the first remote peer.
      featured = peerOrder[0] ?? null;
      resolvedMode = featured ? 'spotlight' : 'grid';
    }

    return { tiles: ids, featuredId: featured, mode: resolvedMode };
  }, [peerOrder, peers, screenOn, spotlightId, layoutMode]);

  const isFocusMode = mode !== 'grid' && featuredId && tiles.length > 1;

  /*
   * Two people on a phone: the other person fills the screen and you become a
   * small floating tile, the way WhatsApp, Instagram and FaceTime all do it.
   *
   * A 50/50 split is the wrong answer at this size. It gives half the screen to
   * the person you are least interested in — yourself — and leaves both faces
   * small. One-to-one is also by far the most common call, so it is worth its
   * own layout rather than being the n=2 case of a grid.
   *
   * A screen share still wins: someone presenting is what you want filling the
   * screen, so focus mode takes over. So does the chat sheet — with only the
   * band above it left, the compact grid shows both of you rather than one
   * face and a thumbnail.
   */
  const isDuet = isNarrow && !isFocusMode && !isPanelOpen && tiles.length === 2;

  /**
   * Tap the small tile to trade places, as in every app that does this.
   *
   * Deliberately not reset when the layout stops being a duet: someone who put
   * themselves large, had a third person join, and then watched them leave
   * expects to find it as they left it.
   */
  const [swapped, setSwapped] = useState(false);

  const duet = useMemo(() => {
    if (!isDuet) return null;
    const remoteId = tiles.find((id) => id !== 'self');
    if (!remoteId) return null;
    return swapped
      ? { big: 'self', small: remoteId }
      : { big: remoteId, small: 'self' };
  }, [isDuet, tiles, swapped]);

  // --- measured stage box, for computed tile sizing -------------------------
  const stageRef = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /*
   * Each participant's true aspect ratio, reported by their tile once a frame
   * has decoded. Until then they are assumed to be a 16:9 webcam, which is
   * right far more often than not and avoids a visible reflow for the common
   * case.
   */
  const [aspects, setAspects] = useState({});

  const reportAspect = useCallback((id, aspect) => {
    const next = clampAspect(aspect);
    setAspects((current) =>
      // Ignore sub-percent jitter; re-laying out the whole stage because a
      // decoder rounded differently would be a permanent shimmer.
      Math.abs((current[id] ?? 0) - next) < 0.01 ? current : { ...current, [id]: next }
    );
  }, []);

  /**
   * Gallery sizing.
   *
   *   fit  — justified rows, each tile taking its own participant's shape.
   *   fill — one uniform 16:9 tile for everyone, cropped to match.
   *
   * These are genuinely different layouts, not just a different `object-fit`:
   * when tiles already match their source there is nothing to letterbox and
   * nothing to crop, so the choice is really "everyone fully visible" versus
   * "a tidy uniform grid".
   */
  const sizes = useMemo(() => {
    if (isFocusMode || isNarrow || !box.width) return null;

    if (videoFit === 'fill') {
      const uniform = fitTiles({ ...box, count: tiles.length });
      if (!uniform) return null;
      return new Map(tiles.map((id) => [id, uniform]));
    }

    return justifiedRows({
      ...box,
      items: tiles.map((id) => ({ id, aspect: aspects[id] ?? TARGET_ASPECT })),
    });
  }, [box, tiles, aspects, isFocusMode, isNarrow, videoFit]);

  /**
   * Grid placement for focus mode only.
   *
   * Gallery sizing deliberately does NOT go here. Motion's `layout` projection
   * owns the element's width and height — it measures them and writes them
   * during the animation — so an inline `width` on the tile is silently
   * discarded. (Grid placement survives because Motion does not animate
   * `grid-column`.) Size is handed to CSS instead, via custom properties on the
   * stage, which Motion leaves alone and still animates the resulting box
   * change for.
   */
  const placements = useMemo(() => {
    if (!isFocusMode) return {};

    const map = {};
    let stripIndex = 0;
    for (const id of tiles) {
      if (id === featuredId) {
        map[id] = { gridColumn: '1 / -1', gridRow: '1' };
      } else {
        stripIndex += 1;
        map[id] = { gridColumn: String(stripIndex), gridRow: '2' };
      }
    }
    return map;
  }, [tiles, featuredId, isFocusMode]);

  const stripCount = isFocusMode ? tiles.length - 1 : 0;

  return (
    <Stage
      ref={stageRef}
      $columns={Math.max(stripCount, 1)}
      $focus={Boolean(isFocusMode)}
      $filmstrip={isNarrow && isPanelOpen}
      $duet={Boolean(duet)}
      data-mode={mode}
    >
      <LayoutGroup>
        {duet
          ? [duet.big, duet.small].map((id, index) => (
              <VideoTile
                key={id}
                id={id}
                isSelf={id === 'self'}
                // The big one fills the screen: letterboxing a single remote
                // participant on a phone leaves bars down both sides.
                immersive={index === 0}
                onActivate={index === 1 ? () => setSwapped((v) => !v) : undefined}
                onAspect={reportAspect}
                transition={LAYOUT_SPRING}
              />
            ))
          : tiles.map((id) => {
          const isFeatured = isFocusMode && id === featuredId;

          return (
            <VideoTile
              key={id}
              id={id}
              isSelf={id === 'self'}
              featured={isFeatured}
              compact={isFocusMode && !isFeatured}
              isScreenShare={mode === 'screen' && isFeatured}
              placement={placements[id]}
              size={sizes?.get(id)}
              onAspect={reportAspect}
              transition={LAYOUT_SPRING}
            />
          );
        })}
      </LayoutGroup>
    </Stage>
  );
}

const Stage = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  gap: ${GAP}px;

  /* ------------------------------------------------------------------ phone
   * A single scrolling column. Each tile takes the shape of its own source
   * (published as --tile-aspect by VideoTile), so a portrait phone camera gets
   * a portrait tile and a laptop webcam a 16:9 one — neither cropped, neither
   * letterboxed. Nothing here uses !important: the base *is* the phone layout,
   * and the wider layouts below simply come later in the cascade.
   *
   * Focus mode keeps its grid at every width — the strip is a row of thumbnails
   * and collapsing it would scatter the explicit column placements into rows.
   */
  ${({ $focus, $columns }) =>
    $focus
      ? `
        /*
         * Someone is presenting. The featured pane takes every row of space
         * that is left, and the strip is a fixed band beneath it.
         *
         * The rows used to be minmax(180px, 46vh) + a strip, which on a tall
         * phone came to about 480px of an 839px viewport and left the bottom
         * 40% of the screen empty. 1fr is the fix: fill what is there.
         */
        display: grid;
        grid-template-columns: repeat(${$columns}, minmax(0, 1fr));
        grid-template-rows: minmax(0, 1fr) clamp(72px, 12vh, 104px);

        /* Clear the floating header above and the floating dock below. */
        padding: calc(env(safe-area-inset-top, 0px) + 52px) 8px ${DOCK_H};

        > * {
          min-width: 0;
          min-height: 0;
        }

        /*
         * Strip thumbnails take the shape of their own source and centre in
         * their column, rather than stretching to fill it. With one other
         * participant the column is the whole width, so stretching produced a
         * 412x92 box with a small letterboxed video adrift in the middle of it.
         */
        > [data-tile='strip'] {
          height: 100%;
          width: auto;
          aspect-ratio: var(--tile-aspect, 16 / 9);
          justify-self: center;
          align-self: center;
        }
      `
      : `
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-content: flex-start;
        overflow-x: hidden;
        overflow-y: auto;
        /* Clear the floating header above and the floating dock below. */
        padding: calc(env(safe-area-inset-top, 0px) + 52px) 0 ${DOCK_H};

        > * {
          flex: 0 0 100%;
          width: 100%;
          height: auto;
          aspect-ratio: var(--tile-aspect, 16 / 9);
        }
      `}

  /* ------------------------------------------------------------ sheet open
   * With the sheet up the stage keeps only the band above it — about a third
   * of the screen. A column of full-width tiles would show one person and hide
   * everyone else, so it becomes a compact two-up grid: four people fit without
   * scrolling, and beyond that it scrolls as normal.
   */
  ${({ $filmstrip, $focus }) =>
    $filmstrip &&
    !$focus &&
    `
      max-height: calc(100dvh - ${SHEET_H} - ${DOCK_H});
      align-content: center;
      padding: calc(env(safe-area-inset-top, 0px) + 48px) 10px 6px;

      > * {
        flex: 0 0 auto;
        width: calc(50% - ${GAP}px);
      }

      /* One person on the call: no reason to shrink them into a corner. */
      > *:only-child {
        width: 100%;
      }
    `}

  /* ---------------------------------------------------------------- duet
   * One-to-one on a phone. The first child fills the stage; the second floats
   * over it, clear of the header above and the dock below.
   */
  ${({ $duet }) =>
    $duet &&
    `
      display: block;
      overflow: hidden;
      padding: 0;

      > *:first-child {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        aspect-ratio: auto;
      }

      > *:last-child {
        position: absolute;
        top: calc(env(safe-area-inset-top, 0px) + 60px);
        right: 12px;
        z-index: 4;

        width: clamp(96px, 27vw, 132px);
        height: auto;
        aspect-ratio: var(--tile-aspect, 3 / 4);

        border-radius: var(--radius-md);
        overflow: hidden;
        box-shadow: var(--shadow-3);
        cursor: pointer;
      }
    `}

  /* ------------------------------------------------------------- md and up
   * Enough width for the computed gallery: uniform tiles from fitTiles, or
   * per-participant widths from justifiedRows, centred in the space left over.
   * Flex rather than grid so an odd participant count centres its final row —
   * a grid leaves the orphan hard against the left edge with a hole beside it,
   * which reads as a missing person, and with 3, 5, or 7 people that is the
   * common case rather than the edge case.
   */
  ${media.md} {
    ${({ $focus }) =>
      $focus
        ? `
          /* No floating header or dock to clear at this width. */
          padding: 0;
          grid-template-rows: minmax(0, 1fr) clamp(76px, 13vh, 128px);
        `
        : `
          align-content: center;
          overflow: visible;
          padding: 0;

          /*
           * Size comes from --tile-w / --tile-h, computed by fitTiles and set
           * on the tile. Every child of a tile is absolutely positioned, so a
           * tile has no natural height — the fallbacks keep it from collapsing
           * to nothing in the frame before the stage has been measured.
           */
          > * {
            flex: 0 0 auto;
            width: var(--tile-w, 320px);
            height: var(--tile-h, 180px);
            aspect-ratio: auto;
          }
        `}
  }
`;
