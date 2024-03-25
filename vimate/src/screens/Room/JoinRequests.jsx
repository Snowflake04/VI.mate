import styled from 'styled-components';
import { AnimatePresence, motion } from 'motion/react';

import Avatar from '../../components/Avatar.jsx';
import { Button } from '../../components/Primitives.jsx';
import { callEngine } from '../../lib/CallEngine.js';
import { useCallStore } from '../../store/callStore.js';

/**
 * The approval queue for rooms with "approve each person" turned on.
 *
 * Only the host ever receives `join:request` — and the server re-checks
 * ownership on every approve and deny rather than trusting a flag the client
 * was handed earlier, which is the hole the original implementation left open.
 *
 * Requests stack rather than replacing one another. The version this replaced
 * serialised them through an async queue and showed one name at a time, so a
 * burst of arrivals meant clicking through them blind.
 */
export default function JoinRequests() {
  const requests = useCallStore((state) => state.joinRequests);
  const isAdmin = useCallStore((state) => state.room?.isAdmin);

  if (!isAdmin) return null;

  return (
    <Region aria-live='polite'>
      <AnimatePresence initial={false}>
        {requests.map((request) => (
          <Card
            key={request.id}
            layout
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <Who>
              <Avatar name={request.displayName} size={38} />
              <Text>
                <Name>{request.displayName}</Name>
                <Sub>wants to join</Sub>
              </Text>
            </Who>

            <Actions>
              <Button $variant='ghost' onClick={() => callEngine.deny(request.id)}>
                Decline
              </Button>
              <Button
                $variant='primary'
                onClick={() => callEngine.approve(request.id)}
              >
                Admit
              </Button>
            </Actions>
          </Card>
        ))}
      </AnimatePresence>
    </Region>
  );
}

const Region = styled.div`
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 300;

  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(320px, calc(100vw - var(--space-6)));
  pointer-events: none;

  @media (max-width: 720px) {
    top: auto;
    bottom: calc(var(--control-bar-h, 56px) + var(--space-6));
    left: var(--space-3);
    right: var(--space-3);
    width: auto;
  }
`;

const Card = styled(motion.div)`
  pointer-events: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  background: var(--surface-2);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-3), inset 0 1px 0 var(--edge-light);
`;

const Who = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
`;

const Text = styled.div`
  min-width: 0;
`;

const Name = styled.div`
  font-size: 15px;
  font-weight: 550;
  letter-spacing: -0.014em;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Sub = styled.div`
  font-size: 13px;
  color: var(--ink-3);
`;

const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
`;
