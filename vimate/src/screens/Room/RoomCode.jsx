import { useCallback, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'motion/react';

import { CheckIcon, CopyIcon } from '../../components/Icons.jsx';
import { useUIStore } from '../../store/uiStore.js';

/**
 * The room code, copyable.
 *
 * Copies a full join URL rather than the bare code — the overwhelmingly common
 * next action is pasting it into a message for someone else, and a link works
 * without having to explain what to do with twelve characters.
 */
export default function RoomCode({ code }) {
  const [copied, setCopied] = useState(false);
  const pushToast = useUIStore((state) => state.pushToast);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    const url = `${window.location.origin}/room/${code}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      pushToast({ tone: 'ok', text: 'Invite link copied' });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access is denied in some embedded and insecure contexts.
      // Showing the link beats failing silently.
      pushToast({ tone: 'warn', text: url });
    }
  }, [code, pushToast]);

  if (!code) return null;

  return (
    <Trigger onClick={handleCopy} title='Copy invite link'>
      <Code>{code}</Code>
      <IconWell>
        <AnimatePresence mode='wait' initial={false}>
          <motion.span
            key={copied ? 'done' : 'copy'}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.16 }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </motion.span>
        </AnimatePresence>
      </IconWell>
    </Trigger>
  );
}

const Trigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;

  height: 30px;
  padding: 0 11px;

  @media (pointer: coarse) {
    height: 44px;
    padding: 0 14px;
  }

  color: var(--ink-2);
  background: var(--surface-1);
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 1px var(--hairline);

  transition:
    color 180ms var(--ease),
    background-color 180ms var(--ease),
    box-shadow 180ms var(--ease);

  &:hover {
    color: var(--ink);
    background: var(--surface-3);
    box-shadow: inset 0 0 0 1px var(--hairline-strong);
  }

  svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const Code = styled.span`
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
`;

const IconWell = styled.span`
  display: grid;
  place-items: center;
  width: 13px;
  height: 13px;
  color: var(--ink-3);

  > span {
    display: grid;
    place-items: center;
  }
`;
