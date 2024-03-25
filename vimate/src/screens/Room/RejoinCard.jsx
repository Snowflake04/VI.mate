import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'motion/react';

import Backdrop from '../../components/Backdrop.jsx';
import Brand from '../../components/Brand.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import { Button, Field, Label, Title } from '../../components/Primitives.jsx';

import { callEngine } from '../../lib/CallEngine.js';
import { useCallStore } from '../../store/callStore.js';

const NAME_KEY = 'vimate.displayName';

/**
 * What you see when you open /room/CODE without a live session — a shared
 * invite link, a refresh, or a restored browser tab.
 *
 * The old app redirected straight to the lobby here, throwing away the room
 * code the user had just been given and making shared links effectively
 * useless. Keeping the code and asking only for a name turns a dead end into
 * the shortest path back into the call.
 */
export default function RejoinCard({ roomCode }) {
  const navigate = useNavigate();

  const phase = useCallStore((state) => state.phase);
  const error = useCallStore((state) => state.error);
  const socketStatus = useCallStore((state) => state.socketStatus);
  const pendingRoomName = useCallStore((state) => state.pendingRoomName);

  const [displayName, setDisplayName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    callEngine.start();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (!displayName.trim() || busy) return;

    try {
      localStorage.setItem(NAME_KEY, displayName.trim());
    } catch {
      // Non-fatal.
    }

    setBusy(true);
    try {
      await callEngine.joinRoom({ displayName: displayName.trim(), roomCode });
    } finally {
      setBusy(false);
    }
  };

  const connecting = socketStatus === 'connecting' || socketStatus === 'idle';
  const waiting = phase === 'pending';
  const denied = phase === 'denied';

  return (
    <Screen>
      <Backdrop variant='lobby' />

      <Header>
        <Brand showStatus status={socketStatus} />
        <ThemeToggle />
      </Header>

      <Center>
        <Card
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        >
          <CodeBadge>{roomCode}</CodeBadge>

          {waiting ? (
            <>
              <Title>Waiting to be let in</Title>
              <Copy>
                The host of “{pendingRoomName ?? 'this room'}” has been asked to
                admit you. Stay on this page.
              </Copy>
            </>
          ) : denied ? (
            <>
              <Title>Not this time</Title>
              <Copy>{error?.message ?? 'Your request was declined.'}</Copy>
              <Button onClick={() => navigate('/', { replace: true })}>
                Back to lobby
              </Button>
            </>
          ) : (
            <Form onSubmit={handleSubmit} noValidate>
              <div>
                <Title>Rejoin this room</Title>
                <Copy>
                  Your session ended — a reload, or a link someone sent you.
                  Enter a name to walk back in.
                </Copy>
              </div>

              <FieldRow>
                <Label as='label' htmlFor='rejoin-name'>
                  Your name
                </Label>
                <Field
                  id='rejoin-name'
                  autoFocus
                  value={displayName}
                  maxLength={32}
                  placeholder='Ada Lovelace'
                  aria-invalid={touched && !displayName.trim()}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
                {touched && !displayName.trim() && (
                  <ErrorLine>Enter a name others will see.</ErrorLine>
                )}
              </FieldRow>

              {error && !denied && <ErrorLine role='alert'>{error.message}</ErrorLine>}

              <Actions>
                <Button
                  type='button'
                  $variant='ghost'
                  onClick={() => navigate('/', { replace: true })}
                >
                  Lobby
                </Button>
                <Button type='submit' $variant='primary' disabled={busy || connecting}>
                  {busy ? 'Joining…' : connecting ? 'Connecting…' : 'Enter room'}
                </Button>
              </Actions>
            </Form>
          )}
        </Card>
      </Center>
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
  padding: var(--space-4) clamp(var(--space-4), 4vw, var(--space-6));
`;

const Center = styled.main`
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  place-items: center;
  padding: var(--space-5) var(--space-4) var(--space-7);
`;

const Card = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: flex-start;

  width: min(420px, 100%);
  padding: var(--space-6);

  background: var(--surface-2);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-3), inset 0 1px 0 var(--edge-light);
`;

const CodeBadge = styled.span`
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.05em;
  color: var(--accent);

  padding: 6px 12px;
  background: var(--accent-soft);
  border-radius: var(--radius-pill);
`;

const Copy = styled.p`
  margin-top: 7px;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--ink-2);
  text-wrap: pretty;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
`;

const FieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

const ErrorLine = styled.div`
  font-size: 12.5px;
  color: var(--bad);
`;

const Actions = styled.div`
  display: flex;
  gap: var(--space-2);

  button {
    flex: 1;
  }
`;
