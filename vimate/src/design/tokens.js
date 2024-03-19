/**
 * ---------------------------------------------------------------------------
 * VI.mate — "Aperture"
 * ---------------------------------------------------------------------------
 * A calm, soft-lit interface built around the idea that the people on the call
 * are the content and everything else should recede.
 *
 * The principles, in the order they matter:
 *
 *   1. Surfaces are lit, not outlined. Depth comes from layered elevation, a
 *      soft shadow, and a 1px highlight along the top edge — the way a real
 *      object sits under a light source. Borders are a last resort, not the
 *      primary means of separation, because an interface made of boxes reads
 *      as a wireframe.
 *
 *   2. Type carries the hierarchy. Size, weight, and colour do the work.
 *      There is no uppercase-letterspaced-monospace label style, because
 *      applying one to every noun in the UI flattens hierarchy into texture.
 *      Monospace is reserved for actual numbers, where tabular figures stop
 *      digits from jittering.
 *
 *   3. One accent, used sparingly. Warm coral against a cool neutral ground:
 *      the warmth belongs to a product about talking to people, and reserving
 *      it means it always means something when it appears.
 *
 *   4. Generous radii and generous space. 14–20px corners and real breathing
 *      room are most of what separates "considered" from "assembled".
 *
 * Two schemes named for light, not for theatre: low light and daylight.
 *
 * Tokens are CSS custom properties so the theme flips atomically inside a View
 * Transition without re-rendering a single React component.
 * ---------------------------------------------------------------------------
 */

export const themes = {
  dark: {
    name: 'low light',
    colorScheme: 'dark',

    // A cool near-black rather than pure black — pure black flattens shadows
    // and makes every surface above it look like a sticker.
    canvas: '#08080B',
    'surface-1': '#101014',
    'surface-2': '#17171D',
    'surface-3': '#1F1F27',
    'surface-sunken': '#0C0C10',

    // Glass used over video, where a solid panel would block the thing you
    // are trying to look at.
    'glass': 'rgba(20, 20, 26, 0.72)',
    'glass-strong': 'rgba(16, 16, 20, 0.88)',

    ink: '#F3F3F6',
    'ink-2': '#9C9CA8',
    'ink-3': '#63636E',
    'ink-inverse': '#0B0B0E',

    hairline: 'rgba(255, 255, 255, 0.07)',
    'hairline-strong': 'rgba(255, 255, 255, 0.13)',
    // The top-edge highlight that makes a surface read as lit from above.
    'edge-light': 'rgba(255, 255, 255, 0.06)',

    accent: '#FF8A5B',
    'accent-hover': '#FF9E76',
    'accent-soft': 'rgba(255, 138, 91, 0.13)',
    'accent-line': 'rgba(255, 138, 91, 0.32)',
    'accent-ink': '#160A04',

    ok: '#43D6A0',
    warn: '#F2B84B',
    bad: '#FF6B6B',
    'ok-soft': 'rgba(67, 214, 160, 0.14)',
    'bad-soft': 'rgba(255, 107, 107, 0.14)',

    'tile-empty': '#131318',
    'shimmer-base': 'rgba(255, 255, 255, 0.035)',
    'shimmer-peak': 'rgba(255, 255, 255, 0.085)',
    scrim: 'rgba(6, 6, 9, 0.72)',

    'shadow-1': '0 1px 2px rgba(0, 0, 0, 0.45)',
    'shadow-2': '0 6px 20px -6px rgba(0, 0, 0, 0.6)',
    'shadow-3': '0 20px 56px -16px rgba(0, 0, 0, 0.72)',
    'shadow-dock': '0 12px 40px -8px rgba(0, 0, 0, 0.7)',

    // Two very wide, very faint colour fields. Enough to keep a large dark
    // canvas from reading as a flat void; not enough to notice as an effect.
    'ambient-1': 'rgba(255, 138, 91, 0.055)',
    'ambient-2': 'rgba(91, 138, 255, 0.05)',
  },

  light: {
    name: 'daylight',
    colorScheme: 'light',

    // Warm off-white. A true #FFF ground is what makes a light theme read as
    // an unstyled document.
    canvas: '#F6F5F2',
    'surface-1': '#FFFFFF',
    'surface-2': '#FFFFFF',
    'surface-3': '#FAF9F7',
    'surface-sunken': '#EFEEEA',

    glass: 'rgba(255, 255, 255, 0.78)',
    'glass-strong': 'rgba(255, 255, 255, 0.92)',

    ink: '#131316',
    'ink-2': '#5A5A64',
    'ink-3': '#8C8C96',
    'ink-inverse': '#FFFFFF',

    hairline: 'rgba(19, 19, 22, 0.08)',
    'hairline-strong': 'rgba(19, 19, 22, 0.15)',
    'edge-light': 'rgba(255, 255, 255, 0.9)',

    accent: '#DE5F33',
    'accent-hover': '#C9522A',
    'accent-soft': 'rgba(222, 95, 51, 0.10)',
    'accent-line': 'rgba(222, 95, 51, 0.30)',
    'accent-ink': '#FFFFFF',

    ok: '#12996B',
    warn: '#B57C0A',
    bad: '#D4453F',
    'ok-soft': 'rgba(18, 153, 107, 0.12)',
    'bad-soft': 'rgba(212, 69, 63, 0.12)',

    'tile-empty': '#E7E5E0',
    'shimmer-base': 'rgba(19, 19, 22, 0.04)',
    'shimmer-peak': 'rgba(19, 19, 22, 0.09)',
    scrim: 'rgba(246, 245, 242, 0.78)',

    'shadow-1': '0 1px 2px rgba(19, 19, 22, 0.06)',
    'shadow-2': '0 6px 20px -6px rgba(19, 19, 22, 0.12)',
    'shadow-3': '0 20px 56px -16px rgba(19, 19, 22, 0.18)',
    'shadow-dock': '0 12px 40px -8px rgba(19, 19, 22, 0.18)',

    'ambient-1': 'rgba(222, 95, 51, 0.07)',
    'ambient-2': 'rgba(51, 95, 222, 0.05)',
  },
};

/** Values that do not change between themes. */
export const constants = {
  /*
   * `system-ui` first, deliberately. It resolves to SF Pro on macOS/iOS and
   * Segoe UI Variable on Windows — two genuinely excellent, properly hinted
   * faces that are already on the machine. Shipping a webfont to replace them
   * would cost a render-blocking request to look slightly different, not
   * better. The named fallbacks cover Linux.
   */
  'font-sans':
    "system-ui, -apple-system, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', Inter, Cantarell, 'Noto Sans', 'Helvetica Neue', sans-serif",
  // Only ever used for measured values, where tabular figures matter.
  'font-mono':
    "ui-monospace, SFMono-Regular, 'SF Mono', 'Cascadia Mono', Menlo, 'Roboto Mono', 'Liberation Mono', monospace",

  'radius-xs': '6px',
  'radius-sm': '10px',
  'radius-md': '14px',
  'radius-lg': '20px',
  'radius-xl': '28px',
  'radius-pill': '999px',

  'space-1': '4px',
  'space-2': '8px',
  'space-3': '12px',
  'space-4': '16px',
  'space-5': '24px',
  'space-6': '32px',
  'space-7': '48px',
  'space-8': '72px',

  // A single easing used everywhere non-spring, so the whole interface decays
  // at the same rate and feels like one object.
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

/** Serializes a theme into the body of a CSS rule. */
export function toCssVariables(tokens) {
  return Object.entries(tokens)
    .filter(([key]) => key !== 'name' && key !== 'colorScheme')
    .map(([key, value]) => `--${key}: ${value};`)
    .join('\n    ');
}

/**
 * Reads a resolved token at runtime. Needed by canvas layers, which paint
 * pixels and therefore cannot use `var()`.
 */
export function readToken(name, element = document.documentElement) {
  return getComputedStyle(element).getPropertyValue(`--${name}`).trim();
}

export const THEME_NAMES = Object.keys(themes);
