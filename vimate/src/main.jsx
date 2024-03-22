import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import { initTheme } from './design/theme.js';

/**
 * The theme is applied before React mounts so the first painted frame is
 * already correct. Doing it in an effect produces a flash of the wrong theme
 * on every reload, which on a dark-first product is a white strobe.
 */
initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
