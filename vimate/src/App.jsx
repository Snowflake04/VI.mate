import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import GlobalStyle from './design/GlobalStyle.jsx';
import Lobby from './screens/Lobby/Lobby.jsx';
import Toast from './components/Toast.jsx';
import Boot from './screens/Boot.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

/**
 * The call runtime — peer connections, telemetry, the audio graph, the whole
 * motion layer — is code-split away from the lobby.
 *
 * Most visits are someone typing a room code, so the first paint should not
 * have to parse the WebRTC stack to get there. The chunk is prefetched the
 * moment the lobby is interactive (see Lobby.jsx), so by the time anyone
 * actually presses "join" it is already in cache and the split costs nothing.
 */
const Room = lazy(() => import('./screens/Room/Room.jsx'));

export default function App() {
  return (
    <>
      <GlobalStyle />
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<Boot label='Loading call runtime' />}>
            <Routes>
              <Route path='/' element={<Lobby />} />
              <Route path='/room/:roomCode' element={<Room />} />
              {/* Anything else is a typo, not a 404 worth designing a page for. */}
              <Route path='*' element={<Navigate to='/' replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
      <Toast />
    </>
  );
}
