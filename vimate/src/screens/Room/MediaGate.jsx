import { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'motion/react';

import { Button, Title } from '../../components/Primitives.jsx';
import { AlertIcon, CameraOffIcon } from '../../components/Icons.jsx';
import { useCallStore } from '../../store/callStore.js';

/**
 * The designed failure state for denied or unavailable media.
 *
 * The original code's entire response here was
 * `alert('Please enable audio and video')`, after which `localStream` stayed
 * undefined and the next `addLocalTracks()` threw — leaving a blank screen with
 * no explanation and no way forward.
 *
 * This names the specific fault, gives the actual recovery steps, and —
 * importantly — lets you continue anyway. Being in a call without a camera is a
 * completely legitimate state: you can still see everyone, hear everyone, and
 * use chat. Blocking entry over a missing webcam would be the app making a
 * decision that is not the app's to make.
 */
export default function MediaGate({ onDismiss, onRetry }) {
  const mediaError = useCallStore((state) => state.mediaError);
  const mediaStatus = useCallStore((state) => state.mediaStatus);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  const insecure = mediaStatus === 'insecure';

  return (
    <Scrim
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='media-gate-title'
    >
      <Card
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <Glyph>{insecure ? <AlertIcon /> : <CameraOffIcon />}</Glyph>

        <div>
          <Title id='media-gate-title'>
            {mediaError?.title ?? 'Camera unavailable'}
          </Title>
          <Detail>{mediaError?.detail}</Detail>
        </div>

        {!insecure && (
          <Steps>
            <li>Click the camera or padlock icon in the address bar.</li>
            <li>Set camera and microphone to “Allow”.</li>
            <li>Press Retry — no need to reload.</li>
          </Steps>
        )}

        <Actions>
          <Button onClick={onDismiss}>Continue without camera</Button>
          {mediaError?.recoverable !== false && (
            <Button $variant='primary' onClick={handleRetry} disabled={retrying}>
              {retrying ? 'Asking…' : 'Retry'}
            </Button>
          )}
        </Actions>

        <Reassure>
          You will still see and hear everyone, and chat works normally. Others
          see your avatar in place of video.
        </Reassure>
      </Card>
    </Scrim>
  );
}

const Scrim = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 500;

  display: grid;
  place-items: center;
  padding: var(--space-4);

  background: var(--scrim);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
`;

const Card = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  width: min(440px, 100%);
  max-height: calc(100dvh - var(--space-7));
  overflow-y: auto;
  padding: var(--space-6);

  background: var(--surface-2);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-3), inset 0 1px 0 var(--edge-light);
`;

const Glyph = styled.div`
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;

  background: var(--surface-sunken);
  border-radius: var(--radius-md);

  svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: var(--warn);
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const Detail = styled.p`
  margin-top: 7px;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--ink-2);
  text-wrap: pretty;
`;

const Steps = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: var(--space-4) var(--space-4) var(--space-4) 34px;

  background: var(--surface-sunken);
  border-radius: var(--radius-md);

  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ink-2);

  li::marker {
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;

  button {
    flex: 1;
    min-width: 150px;
  }
`;

const Reassure = styled.p`
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ink-3);
  text-wrap: pretty;
`;
