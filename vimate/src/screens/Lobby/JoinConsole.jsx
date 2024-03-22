import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'motion/react';

import {
  Button,
  Field,
  Label,
  Surface,
  Title,
} from '../../components/Primitives.jsx';
import { LockIcon } from '../../components/Icons.jsx';
import { callEngine } from '../../lib/CallEngine.js';
import { useCallStore } from '../../store/callStore.js';

const NAME_KEY = 'vimate.displayName';
const ROOM_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/**
 * Create or join, as one card with a segmented control.
 *
 * Validation is inline and non-destructive. The implementation this replaced
 * reported errors by *deleting what you had typed* and putting the complaint in
 * the placeholder — so a mistyped room code cost you the code, and the message
 * vanished the moment you started fixing it.
 */
export default function JoinConsole() {
  const [mode, setMode] = useState('join');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const phase = useCallStore((state) => state.phase);
  const error = useCallStore((state) => state.error);
  const pendingRoomName = useCallStore((state) => state.pendingRoomName);
  const socketStatus = useCallStore((state) => state.socketStatus);

  // Remembered because typing your own name for every call is friction with no
  // upside. It never leaves the browser.
  const [displayName, setDisplayName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [requireAuth, setRequireAuth] = useState(false);
  const secondFieldRef = useRef(null);

  useEffect(() => {
    try {
      if (displayName) localStorage.setItem(NAME_KEY, displayName);
    } catch {
      // Storage unavailable; not worth surfacing.
    }
  }, [displayName]);

  /** Formats as ABCD-1234-EFGH while typing, without fighting the caret. */
  const handleCodeChange = useCallback((event) => {
    const raw = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const groups = raw.slice(0, 12).match(/.{1,4}/g) ?? [];
    setRoomCode(groups.join('-'));
    setErrors((previous) => ({ ...previous, roomCode: null }));
  }, []);

  const validate = () => {
    const next = {};

    if (!displayName.trim()) next.displayName = 'Enter a name others will see.';
    else if (displayName.trim().length > 32)
      next.displayName = 'Keep it under 32 characters.';

    if (mode === 'join') {
      if (!roomCode.trim()) next.roomCode = 'Enter the code you were given.';
      else if (!ROOM_CODE_PATTERN.test(roomCode.trim()))
        next.roomCode = 'Codes look like ABCD-1234-EFGH.';
    } else if (!roomName.trim()) {
      next.roomName = 'Give the room a name.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy || !validate()) return;

    setBusy(true);
    try {
      if (mode === 'join') {
        await callEngine.joinRoom({
          displayName: displayName.trim(),
          roomCode: roomCode.trim(),
        });
      } else {
        await callEngine.createRoom({
          displayName: displayName.trim(),
          roomName: roomName.trim(),
          requireAuth,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const offline = socketStatus === 'offline';
  const connecting = socketStatus === 'connecting' || socketStatus === 'idle';

  if (phase === 'pending' || phase === 'denied') {
    return <WaitingRoom roomName={pendingRoomName} />;
  }

  return (
    <Card $level={2}>
      <Segmented role='tablist'>
        {[
          ['join', 'Join a room'],
          ['create', 'New room'],
        ].map(([value, labelText]) => (
          <Segment
            key={value}
            type='button'
            role='tab'
            aria-selected={mode === value}
            $active={mode === value}
            onClick={() => {
              setMode(value);
              setErrors({});
              requestAnimationFrame(() => secondFieldRef.current?.focus());
            }}
          >
            {mode === value && (
              <SegmentBg
                layoutId='segmented-bg'
                transition={{ type: 'spring', stiffness: 480, damping: 40 }}
              />
            )}
            <SegmentLabel>{labelText}</SegmentLabel>
          </Segment>
        ))}
      </Segmented>

      <Form onSubmit={handleSubmit} noValidate>
        <Row>
          <Label as='label' htmlFor='display-name'>
            Your name
          </Label>
          <Field
            id='display-name'
            value={displayName}
            maxLength={32}
            autoComplete='nickname'
            placeholder='Ada Lovelace'
            aria-invalid={Boolean(errors.displayName)}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setErrors((previous) => ({ ...previous, displayName: null }));
            }}
          />
          <FieldError message={errors.displayName} />
        </Row>

        <AnimatePresence mode='wait' initial={false}>
          {mode === 'join' ? (
            <Fields key='join' {...FIELD_MOTION}>
              <Row>
                <Label as='label' htmlFor='room-code'>
                  Room code
                </Label>
                <CodeField
                  id='room-code'
                  ref={secondFieldRef}
                  value={roomCode}
                  onChange={handleCodeChange}
                  placeholder='ABCD-1234-EFGH'
                  inputMode='text'
                  autoCapitalize='characters'
                  spellCheck={false}
                  aria-invalid={Boolean(errors.roomCode)}
                />
                <FieldError message={errors.roomCode} />
              </Row>
            </Fields>
          ) : (
            <Fields key='create' {...FIELD_MOTION}>
              <Row>
                <Label as='label' htmlFor='room-name'>
                  Room name
                </Label>
                <Field
                  id='room-name'
                  ref={secondFieldRef}
                  value={roomName}
                  maxLength={48}
                  placeholder='Weekly sync'
                  aria-invalid={Boolean(errors.roomName)}
                  onChange={(event) => {
                    setRoomName(event.target.value);
                    setErrors((previous) => ({ ...previous, roomName: null }));
                  }}
                />
                <FieldError message={errors.roomName} />
              </Row>

              <Toggle htmlFor='require-auth'>
                <ToggleText>
                  <ToggleTitle>
                    <LockIcon />
                    Approve each person
                  </ToggleTitle>
                  <ToggleHint>
                    Everyone with the code waits until you let them in.
                  </ToggleHint>
                </ToggleText>

                <input
                  id='require-auth'
                  type='checkbox'
                  checked={requireAuth}
                  onChange={(event) => setRequireAuth(event.target.checked)}
                />
                <Track $on={requireAuth} aria-hidden='true'>
                  <Thumb
                    layout
                    transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                  />
                </Track>
              </Toggle>
            </Fields>
          )}
        </AnimatePresence>

        {(error || offline) && (
          <Notice role='alert'>
            {offline
              ? 'Cannot reach the signalling server. Check that it is running and that VITE_SIGNALING_URL points at it.'
              : error?.message}
          </Notice>
        )}

        <Submit
          type='submit'
          $variant='primary'
          disabled={busy || connecting || offline}
        >
          {busy
            ? 'One moment…'
            : connecting
              ? 'Connecting…'
              : mode === 'join'
                ? 'Enter room'
                : 'Create room'}
        </Submit>
      </Form>
    </Card>
  );
}

/** The waiting state for an auth-gated room. */
function WaitingRoom({ roomName }) {
  const error = useCallStore((state) => state.error);
  const denied = useCallStore((state) => state.phase) === 'denied';

  return (
    <Card
      $level={2}
      as={motion.div}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Waiting>
        {!denied && (
          <Pulse aria-hidden='true'>
            <span />
            <span />
            <span />
          </Pulse>
        )}

        <Title>{denied ? 'Not this time' : 'Waiting to be let in'}</Title>

        <WaitingBody>
          {denied
            ? (error?.message ?? 'The room owner declined your request.')
            : `The owner of “${roomName ?? 'the room'}” has been asked to admit you. This page will move on by itself.`}
        </WaitingBody>

        {denied && (
          <Button onClick={() => window.location.reload()}>Try again</Button>
        )}
      </Waiting>
    </Card>
  );
}

function FieldError({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <ErrorLine
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
        >
          {message}
        </ErrorLine>
      )}
    </AnimatePresence>
  );
}

const FIELD_MOTION = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
};

const Card = styled(Surface)`
  padding: var(--space-5);
  border-radius: var(--radius-lg);

  @media (max-width: 480px) {
    padding: var(--space-4);
  }
`;

/** A segmented control with a spring-shared pill, not underlined tabs. */
const Segmented = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 3px;
  margin-bottom: var(--space-5);
  background: var(--surface-sunken);
  border-radius: var(--radius-pill);
`;

const Segment = styled.button`
  position: relative;
  height: 34px;
  border-radius: var(--radius-pill);
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: ${({ $active }) => ($active ? 'var(--ink)' : 'var(--ink-3)')};
  transition: color 180ms var(--ease);

  &:hover {
    color: var(--ink);
  }
`;

const SegmentBg = styled(motion.span)`
  position: absolute;
  inset: 0;
  background: var(--surface-1);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-1), inset 0 1px 0 var(--edge-light);
`;

const SegmentLabel = styled.span`
  position: relative;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`;

const Fields = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`;

const Row = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

/** The code is data, so it gets the monospace face and open tracking. */
const CodeField = styled(Field)`
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &::placeholder {
    text-transform: none;
    letter-spacing: 0.04em;
  }
`;

const ErrorLine = styled(motion.div)`
  overflow: hidden;
  font-size: 12.5px;
  color: var(--bad);
`;

const Toggle = styled.label`
  display: flex;
  align-items: center;
  gap: var(--space-4);
  cursor: pointer;

  padding: 13px 15px;
  background: var(--surface-sunken);
  border-radius: var(--radius-sm);

  input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }

  /* Focus lands on the hidden checkbox, so the ring is drawn on the track. */
  input:focus-visible ~ span {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

const ToggleText = styled.span`
  flex: 1;
  min-width: 0;
`;

const ToggleTitle = styled.span`
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);

  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    color: var(--ink-3);
  }
`;

const ToggleHint = styled.span`
  display: block;
  margin-top: 3px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--ink-3);
`;

const Track = styled.span`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: ${({ $on }) => ($on ? 'flex-end' : 'flex-start')};
  flex-shrink: 0;

  width: 42px;
  height: 25px;
  padding: 3px;

  background: ${({ $on }) => ($on ? 'var(--accent)' : 'var(--surface-3)')};
  border-radius: var(--radius-pill);
  box-shadow: ${({ $on }) =>
    $on ? 'none' : 'inset 0 0 0 1px var(--hairline-strong)'};
  transition: background-color 240ms var(--ease);
`;

const Thumb = styled(motion.span)`
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.28);
`;

const Notice = styled.div`
  padding: 11px 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink);
  background: var(--bad-soft);
  border-radius: var(--radius-sm);
`;

const Submit = styled(Button)`
  width: 100%;
  height: 46px;
  font-size: 15px;
`;

const Waiting = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
  padding: var(--space-4) var(--space-2);
`;

/** Three dots breathing in sequence — a wait, not a progress bar. */
const Pulse = styled.span`
  display: flex;
  gap: 6px;
  margin-bottom: var(--space-2);

  span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 1.4s ease-in-out infinite;
  }

  span:nth-child(2) {
    animation-delay: 0.18s;
  }
  span:nth-child(3) {
    animation-delay: 0.36s;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.25;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    span {
      animation: none;
      opacity: 0.6;
    }
  }
`;

const WaitingBody = styled.p`
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-2);
  max-width: 34ch;
  text-wrap: pretty;
`;
