/**
 * Icon set, drawn as inline SVG paths.
 *
 * Inline rather than an icon font or a sprite sheet: they inherit
 * `currentColor` so they follow the theme for free, they add no network
 * request, and the stroke weight can be tuned to match the hairline rules that
 * define the rest of the surface. The old build pulled in
 * `@fortawesome/react-fontawesome` and then never imported it once.
 *
 * All are 24x24, stroked (not filled), and styled by the parent.
 */

const base = {
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': 'true',
  focusable: 'false',
};

export const MicIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='9' y='2.5' width='6' height='11' rx='3' />
    <path d='M5 11a7 7 0 0 0 14 0' />
    <path d='M12 18v3.5M8.5 21.5h7' />
  </svg>
);

export const MicOffIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M15 5.5a3 3 0 0 0-6 0v4' />
    <path d='M9 12.2a3 3 0 0 0 5.2 1.6' />
    <path d='M5 11a7 7 0 0 0 10.3 6.2M19 11v.6' />
    <path d='M12 18v3.5M8.5 21.5h7' />
    <path d='M3.5 3.5l17 17' />
  </svg>
);

export const CameraIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='2.5' y='6' width='13' height='12' rx='2.5' />
    <path d='M15.5 10.5l6-3v9l-6-3z' />
  </svg>
);

export const CameraOffIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M15.5 13.5V16a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 16V8.5A2.5 2.5 0 0 1 5 6h1' />
    <path d='M10 6h3a2.5 2.5 0 0 1 2.5 2.5v1' />
    <path d='M15.5 10.5l6-3v9l-3-1.5' />
    <path d='M3.5 3.5l17 17' />
  </svg>
);

export const ScreenIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='2.5' y='4' width='19' height='13' rx='2' />
    <path d='M8 20.5h8M12 17.5v3' />
    <path d='M12 13V8m0 0l-2.2 2.2M12 8l2.2 2.2' />
  </svg>
);

export const ScreenOffIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='2.5' y='4' width='19' height='13' rx='2' />
    <path d='M8 20.5h8M12 17.5v3' />
    <path d='M9.5 10.5h5' />
  </svg>
);

export const LayoutIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='2.5' y='4' width='19' height='16' rx='2' />
    <path d='M2.5 15h19M15 15v5' />
  </svg>
);

export const GridIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='2.5' y='4' width='8.5' height='7' rx='1.5' />
    <rect x='13' y='4' width='8.5' height='7' rx='1.5' />
    <rect x='2.5' y='13' width='8.5' height='7' rx='1.5' />
    <rect x='13' y='13' width='8.5' height='7' rx='1.5' />
  </svg>
);

export const ChatIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M21 15a2.5 2.5 0 0 1-2.5 2.5H8L3 21V5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5z' />
  </svg>
);

export const RosterIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx='9' cy='8' r='3.2' />
    <path d='M3 20a6 6 0 0 1 12 0' />
    <path d='M16 5.5a3.2 3.2 0 0 1 0 5M18 20a6 6 0 0 0-2.2-4.6' />
  </svg>
);

export const LeaveIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M15 4.5h2.5A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5H15' />
    <path d='M10.5 8L14.5 12l-4 4M14.5 12H4' />
  </svg>
);

export const SunIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx='12' cy='12' r='4' />
    <path d='M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6' />
  </svg>
);

export const MoonIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z' />
  </svg>
);

export const SoundOnIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M4 9.5h3.5L12 5.5v13L7.5 14.5H4z' />
    <path d='M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10' />
  </svg>
);

export const SoundOffIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M4 9.5h3.5L12 5.5v13L7.5 14.5H4z' />
    <path d='M16 10l4 4M20 10l-4 4' />
  </svg>
);

export const CopyIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='8.5' y='8.5' width='12' height='12' rx='2' />
    <path d='M15.5 5.5A2 2 0 0 0 13.5 3.5h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2' />
  </svg>
);

export const CheckIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M4.5 12.5l5 5 10-11' />
  </svg>
);

export const CloseIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M5.5 5.5l13 13M18.5 5.5l-13 13' />
  </svg>
);

export const SendIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M21 3L10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8z' />
  </svg>
);

/** A camera with a rotation arrow: switch to the next video input. */
export const FlipCameraIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='2.5' y='6.5' width='19' height='13' rx='2.5' />
    <path d='M8.5 6.5l1.6-2.5h3.8l1.6 2.5' />
    <path d='M9.6 14.4a2.9 2.9 0 015.1-1.9' />
    <path d='M14.9 10.6v2.2h-2.2' />
  </svg>
);

/** Arrows pushing outward: take this tile full screen. */
export const FullscreenIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M9 3.5H4.5a1 1 0 00-1 1V9M15 3.5h4.5a1 1 0 011 1V9' />
    <path d='M9 20.5H4.5a1 1 0 01-1-1V15M15 20.5h4.5a1 1 0 001-1V15' />
  </svg>
);

/** Arrows pulling inward: leave full screen. */
export const ExitFullscreenIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M4 9h4.5a1 1 0 001-1V3.5M20 9h-4.5a1 1 0 01-1-1V3.5' />
    <path d='M4 15h4.5a1 1 0 011 1v4.5M20 15h-4.5a1 1 0 00-1 1v4.5' />
  </svg>
);

/** A frame with a corner mark: make this the main pane. */
export const ExpandIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='3.5' y='4.5' width='17' height='15' rx='2' />
    <path d='M8.5 15.5h7v-5' opacity='.55' />
  </svg>
);

/** The same frame, restored to the grid. */
export const CollapseIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='3.5' y='4.5' width='17' height='15' rx='2' />
    <path d='M12 4.5v15M3.5 12h17' opacity='.55' />
  </svg>
);

/** Three dots: secondary controls, folded away on small screens. */
export const MoreIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx='5.5' cy='12' r='1.5' fill='currentColor' stroke='none' />
    <circle cx='12' cy='12' r='1.5' fill='currentColor' stroke='none' />
    <circle cx='18.5' cy='12' r='1.5' fill='currentColor' stroke='none' />
  </svg>
);

export const GaugeIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M3.5 17a9 9 0 1 1 17 0' />
    <path d='M12 17l4-5' />
    <circle cx='12' cy='17' r='1.4' />
  </svg>
);

export const ShieldIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M12 2.5l7.5 3v6c0 4.5-3.1 8.6-7.5 10-4.4-1.4-7.5-5.5-7.5-10v-6z' />
    <path d='M9 12l2 2 4-4' />
  </svg>
);

export const AlertIcon = (props) => (
  <svg {...base} {...props}>
    <path d='M12 3.5l9 15.5H3z' />
    <path d='M12 9.5v4M12 16.5v.6' />
  </svg>
);

/** Arrows pulling inward: show the whole frame, letterboxed. */
export const FitIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='2.5' y='4.5' width='19' height='15' rx='2' opacity='.4' />
    <path d='M9.5 9.5h-3v-3M14.5 9.5h3v-3M9.5 14.5h-3v3M14.5 14.5h3v3' />
  </svg>
);

/** Arrows pushing outward: fill the tile, cropping the overflow. */
export const FillIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='2.5' y='4.5' width='19' height='15' rx='2' opacity='.4' />
    <path d='M6.5 6.5h3v3M17.5 6.5h-3v3M6.5 17.5h3v-3M17.5 17.5h-3v-3' />
  </svg>
);

export const LockIcon = (props) => (
  <svg {...base} {...props}>
    <rect x='4.5' y='10.5' width='15' height='10' rx='2.5' />
    <path d='M8 10.5V7.5a4 4 0 0 1 8 0v3' />
  </svg>
);

export const RelayIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx='12' cy='12' r='2.5' />
    <path d='M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4' />
    <path d='M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2' />
  </svg>
);
