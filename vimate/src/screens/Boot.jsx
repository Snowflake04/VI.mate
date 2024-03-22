import styled, { keyframes } from 'styled-components';
import Brand from '../components/Brand.jsx';
import Backdrop from '../components/Backdrop.jsx';

/**
 * The preloader for the code-split call route.
 *
 * A quiet mark and a breathing bar. The version this replaced was a fake boot
 * sequence — a checklist of stages advancing on a timer, pretending to report
 * progress it did not have. This makes no claim at all, which is the honest
 * thing to do when you genuinely do not know how long a chunk will take.
 */
export function Boot({ label = 'Loading' }) {
  return (
    <Screen>
      <Backdrop variant='app' />
      <Center>
        <Brand size='lg' />
        <Track role='status' aria-label={label}>
          <Sweep />
        </Track>
      </Center>
    </Screen>
  );
}

const Screen = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-5);
  background: var(--canvas);
`;

const Center = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
`;

const sweep = keyframes`
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
`;

const Track = styled.div`
  position: relative;
  width: 132px;
  height: 2px;
  overflow: hidden;
  background: var(--hairline);
  border-radius: var(--radius-pill);
`;

const Sweep = styled.div`
  position: absolute;
  inset: 0;
  width: 50%;
  background: var(--accent);
  border-radius: inherit;
  animation: ${sweep} 1.25s var(--ease) infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    width: 100%;
    opacity: 0.4;
  }
`;

export default Boot;
