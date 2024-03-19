/**
 * Breakpoints, in one place.
 *
 * The call UI is written mobile-first: the base rules are the phone layout, and
 * these queries add the roomier ones. That direction is deliberate rather than
 * stylistic — the previous code described a desktop layout and then subtracted
 * from it at four ad-hoc widths (480, 520, 560, 640, 720, 1080), which is how
 * the phone ended up with a chat sheet covering the entire call and a control
 * dock that wrapped onto two rows.
 *
 * Only two width breaks are needed, because the layout only really has three
 * shapes: one column with a bottom sheet, one column with a roomier dock, and
 * two columns with a docked side panel.
 */
export const media = {
  /** ≥ 600px: bigger phones in landscape and small tablets. */
  sm: '@media (min-width: 600px)',
  /**
   * ≥ 720px: the stage stops being a single column. Must stay in step with the
   * `isNarrow` query in VideoStage — if CSS and JS disagree about this width,
   * tablets get phone-shaped tiles at desktop-computed sizes.
   */
  md: '@media (min-width: 720px)',
  /** ≥ 1080px: enough width for the side panel to sit beside the stage. */
  lg: '@media (min-width: 1080px)',

  /**
   * Touch input, independent of size. Hit areas key off this rather than off
   * width: a 1024px tablet needs 44px targets just as much as a 390px phone,
   * and a narrow desktop window does not.
   */
  touch: '@media (pointer: coarse)',
  hover: '@media (hover: hover) and (pointer: fine)',

  motion: '@media (prefers-reduced-motion: reduce)',
};

/**
 * Minimum comfortable touch target. 44px is the figure both Apple's HIG and
 * WCAG 2.2 (Target Size, Level AAA) land on.
 */
export const TAP = '44px';

/**
 * The phone sheet's geometry, shared by the panel that draws it and the stage
 * that has to make room above it.
 *
 * The sheet is `position: fixed`, so it takes no space in flow — the stage
 * would happily stay full height underneath it and render its tiles at 769px
 * tall behind the sheet, showing one corner of one person. Both sides read
 * these instead of each re-deriving the arithmetic.
 */
export const SHEET_H = 'min(58dvh, 520px)';

/** Space the floating control dock occupies at the bottom edge. */
export const DOCK_H =
  'calc(var(--control-bar-h, 56px) + env(safe-area-inset-bottom, 0px) + 18px)';

export default media;
