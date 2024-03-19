import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styled, { css } from 'styled-components';
import { useUIStore } from '../store/uiStore.js';

/**
 * Transient status — someone joined, the signal dropped, a message bounced.
 *
 * A floating glass pill rather than a bordered annunciator bar: it sits over
 * the call without claiming a slot in the layout, and it leaves as softly as it
 * arrives. Announced politely so a screen-reader user learns somebody joined
 * without being interrupted.
 */
export function Toast() {
  const toast = useUIStore((state) => state.toast);
  const pushToast = useUIStore((state) => state.pushToast);

  useEffect(() => {
    if (!toast) return undefined;
    // Something you can act on gets longer to be acted on.
    const timer = setTimeout(() => pushToast(null), toast.onAction ? 6000 : 3600);
    return () => clearTimeout(timer);
  }, [toast, pushToast]);

  return (
    <Region role='status' aria-live='polite'>
      <AnimatePresence>
        {toast && (
          <Pill
            key={toast.at}
            as={toast.onAction ? 'button' : 'div'}
            $actionable={Boolean(toast.onAction)}
            onClick={
              toast.onAction
                ? () => {
                    toast.onAction();
                    pushToast(null);
                  }
                : undefined
            }
            initial={{ y: -14, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          >
            <Dot $tone={toast.tone ?? 'ink-3'} />
            <Text>
              {toast.title && <Title>{toast.title}</Title>}
              {toast.text}
            </Text>
          </Pill>
        )}
      </AnimatePresence>
    </Region>
  );
}

const Region = styled.div`
  position: fixed;
  /* Clear of the floating header, which occupies the top strip on a phone. */
  top: calc(env(safe-area-inset-top, 0px) + 66px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 400;
  pointer-events: none;
  display: flex;
  justify-content: center;
  width: max-content;
  max-width: min(92vw, 460px);
`;

const Pill = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 9px;

  font-size: 13.5px;
  font-weight: 450;
  letter-spacing: -0.01em;

  padding: 9px 16px 9px 13px;
  color: var(--ink);
  background: var(--glass-strong);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-3), inset 0 1px 0 var(--edge-light);

  text-align: left;
  max-width: 100%;

  ${({ $actionable }) =>
    $actionable &&
    css`
      /* The Region is pointer-events: none so it never blocks the call; an
         actionable toast has to opt back in. */
      pointer-events: auto;
      cursor: pointer;
      padding-right: 18px;

      &:hover {
        filter: brightness(1.04);
      }

      &:active {
        transform: scale(0.98);
      }
    `}
`;

const Text = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Title = styled.strong`
  font-weight: 600;
  margin-right: 6px;
`;

const Dot = styled.span`
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--${({ $tone }) => $tone});
`;

export default Toast;
