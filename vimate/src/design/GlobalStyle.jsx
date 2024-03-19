import { createGlobalStyle } from 'styled-components';
import { themes, constants, toCssVariables } from './tokens.js';

/**
 * Tokens are emitted as CSS custom properties rather than fed through the
 * styled-components ThemeProvider. Two reasons, both practical:
 *
 *  - Switching a ThemeProvider value re-renders every styled component in the
 *    tree. During a live call that means every video tile. Flipping one
 *    attribute on <html> costs zero React work.
 *  - The View Transition snapshot is taken from the real DOM, so the theme has
 *    to change through CSS to be captured by it.
 */
export const GlobalStyle = createGlobalStyle`
  :root {
    ${toCssVariables(constants)}
    ${toCssVariables(themes.dark)}
  }

  :root[data-theme='light'] {
    ${toCssVariables(themes.light)}
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  * {
    margin: 0;
    padding: 0;
  }

  html, body, #root {
    height: 100%;
  }

  html {
    overflow-x: hidden;
  }

  body {
    background: var(--canvas);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.5;
    letter-spacing: -0.011em;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    overscroll-behavior: none;
  }

  /*
   * Headings inherit their size; the design system sets it explicitly.
   * Without this an <h1> silently doubles to the browser's 2em default on top
   * of whatever was asked for.
   */
  h1, h2, h3, h4, h5, h6 {
    font-size: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
  }

  /*
   * Optical tracking. Large type needs negative letter-spacing to avoid
   * looking loose; small type needs slightly positive to stay legible. Doing
   * this once here is the difference between type that was set and type that
   * was merely sized.
   */
  .display {
    letter-spacing: -0.035em;
    line-height: 1.04;
  }

  code, kbd, samp, pre, .mono {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
  }

  button, input, textarea, select {
    font: inherit;
    letter-spacing: inherit;
    color: inherit;
    background: none;
    border: none;
    outline: none;
  }

  button {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  button:disabled {
    cursor: not-allowed;
  }

  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: var(--radius-xs);
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  video {
    display: block;
    max-width: 100%;
  }

  ::selection {
    background: var(--accent);
    color: var(--accent-ink);
  }

  /* Scrollbars stay out of the way until you are actually over the content. */
  * {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
  }

  *:hover {
    scrollbar-color: var(--hairline-strong) transparent;
  }

  *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  *::-webkit-scrollbar-track {
    background: transparent;
  }

  *::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: var(--radius-pill);
    border: 2px solid transparent;
    background-clip: content-box;
  }

  *:hover::-webkit-scrollbar-thumb {
    background: var(--hairline-strong);
    background-clip: content-box;
  }

  /*
   * Theme transition. The outgoing snapshot holds still while the incoming one
   * is revealed by a circular wipe (animated in design/theme.js), so the change
   * reads as light sweeping across the room rather than a cross-fade.
   */
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
    mix-blend-mode: normal;
  }

  ::view-transition-old(root) {
    z-index: 1;
  }

  ::view-transition-new(root) {
    z-index: 9999;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }

    ::view-transition-group(*),
    ::view-transition-old(*),
    ::view-transition-new(*) {
      animation: none !important;
    }
  }
`;

export default GlobalStyle;
