import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'motion/react';

import Backdrop from '../../components/Backdrop.jsx';
import Brand from '../../components/Brand.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import KineticText from '../../components/KineticText.jsx';

import JoinConsole from './JoinConsole.jsx';
import SystemReadout from './SystemReadout.jsx';

import { callEngine } from '../../lib/CallEngine.js';
import { useCallStore } from '../../store/callStore.js';

/**
 * The lobby.
 *
 * A single centred column rather than the headline-left / form-right split it
 * replaced. That split is the default shape of a marketing page, and this is
 * not one — there is exactly one thing to do here, and centring it says so.
 * Everything is stacked in reading order: what this is, then the way in, then
 * the small print about your connection.
 */
export default function Lobby() {
  const navigate = useNavigate();

  const phase = useCallStore((state) => state.phase);
  const room = useCallStore((state) => state.room);
  const socketStatus = useCallStore((state) => state.socketStatus);

  // Boot the engine once. StrictMode double-invokes effects in development;
  // `start()` is idempotent, which is why no ref guard is needed here.
  useEffect(() => {
    callEngine.start();
  }, []);

  /**
   * Warm the call chunk while the user is still typing, so the code split
   * costs nothing at the moment it would be most visible.
   */
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 400));
    const handle = idle(() => {
      import('../Room/Room.jsx');
    });
    return () => window.cancelIdleCallback?.(handle);
  }, []);

  useEffect(() => {
    if (phase === 'in-room' && room?.code) {
      navigate(`/room/${room.code}`, { replace: true });
    }
  }, [phase, room, navigate]);

  return (
    <Screen>
      <Backdrop variant='lobby' />

      <Header>
        <Brand showStatus status={socketStatus} />
        <ThemeToggle />
      </Header>

      <Main>
        <Column>
          <Intro
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Headline className='display'>
              <KineticText text='Talk directly.' delay={0.08} />
              <Muted>
                <KineticText text='No server in the middle.' delay={0.34} />
              </Muted>
            </Headline>

            <Lede>
              Audio, video, and screen share travel peer-to-peer over WebRTC.
              The signalling server introduces you and then steps out — it never
              sees a frame of your call.
            </Lede>
          </Intro>

          <Console>
            <JoinConsole />
            <SystemReadout />
          </Console>
        </Column>
      </Main>
    </Screen>
  );
}

const Screen = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--canvas);
`;

const Header = styled.header`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) clamp(var(--space-4), 4vw, var(--space-6));
`;

const Main = styled.main`
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  justify-content: center;
  /* Optically centred: a block that is mathematically centred in a tall
     viewport sits slightly low to the eye. */
  align-items: center;
  padding: var(--space-5) var(--space-4) var(--space-8);
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  width: 100%;
  /* Sized by the widest element (the headline), not the narrowest (the card) —
     otherwise the display type is forced to wrap at a form's measure. */
  max-width: 600px;
`;

const Intro = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  text-align: center;
  width: 100%;
`;

const Headline = styled.h1`
  font-size: clamp(34px, 6vw, 52px);
  font-weight: 500;
  text-wrap: balance;
`;

/** The second line drops back so the phrase has a beat in the middle. */
const Muted = styled.span`
  display: block;
  color: var(--ink-3);
`;

const Console = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 452px;
`;

const Lede = styled.p`
  font-size: 15px;
  line-height: 1.65;
  color: var(--ink-2);
  max-width: 42ch;
  margin: 0 auto;
  text-wrap: pretty;
`;
