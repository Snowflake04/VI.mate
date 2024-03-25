import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import { AnimatePresence, motion } from 'motion/react';

import Avatar from '../../components/Avatar.jsx';
import { VisuallyHidden } from '../../components/Primitives.jsx';
import { CloseIcon, SendIcon } from '../../components/Icons.jsx';

import { media, TAP } from '../../design/media.js';
import { callEngine } from '../../lib/CallEngine.js';
import { useCallStore } from '../../store/callStore.js';
import { useChatStore, GROUP_THREAD } from '../../store/chatStore.js';

/**
 * Group chat and private 1:1 chat in one surface.
 *
 * Both roadmap features land here, and the thread model does the work:
 * `'group'` is the room, and any peer id is a private conversation with that
 * person. Switching threads keeps a per-thread draft, and a DM is visually
 * unmistakable — the composer takes on the accent when you are whispering,
 * because sending a private message to the wrong place is the one mistake a
 * chat feature must not let you make quietly.
 */
export default function ChatPanel() {
  const activeThread = useChatStore((state) => state.activeThread);
  const setActiveThread = useChatStore((state) => state.setActiveThread);
  const messages = useChatStore(
    (state) => state.threads[state.activeThread] ?? EMPTY
  );

  const peers = useCallStore((state) => state.peers);
  const selfId = useCallStore((state) => state.selfId);

  const isPrivate = activeThread !== GROUP_THREAD;
  const partner = isPrivate ? peers[activeThread] : null;

  return (
    <Wrap>
      <AnimatePresence initial={false}>
        {isPrivate && (
          <PrivateBar
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <PrivateInner>
              <Avatar name={partner?.displayName ?? '?'} size={22} />
              <PrivateText>
                Private with <strong>{partner?.displayName ?? 'someone who left'}</strong>
              </PrivateText>
              <BackButton
                onClick={() => setActiveThread(GROUP_THREAD)}
                title='Back to room chat'
              >
                <CloseIcon />
                <VisuallyHidden>Back to room chat</VisuallyHidden>
              </BackButton>
            </PrivateInner>
          </PrivateBar>
        )}
      </AnimatePresence>

      <Transcript messages={messages} selfId={selfId} isPrivate={isPrivate} />

      <Composer
        threadId={activeThread}
        isPrivate={isPrivate}
        disabled={isPrivate && !partner}
        placeholder={
          isPrivate
            ? `Message ${partner?.displayName ?? '—'} privately`
            : 'Message the room'
        }
      />
    </Wrap>
  );
}

const EMPTY = [];

/**
 * The transcript.
 *
 * Auto-scroll only follows when the reader is already at the bottom — yanking
 * someone back down while they are reading older messages is the classic chat
 * bug, which is why this checks scroll position before deciding.
 */
function Transcript({ messages, selfId, isPrivate }) {
  const scrollRef = useRef(null);
  const pinnedToBottom = useRef(true);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    pinnedToBottom.current = distance < 80;
  }, []);

  // Layout effect, so the scroll lands in the same frame the message paints.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !pinnedToBottom.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <Scroll ref={scrollRef} data-role='transcript'>
        <Empty>
          <EmptyTitle>
            {isPrivate ? 'No messages yet' : 'No messages yet'}
          </EmptyTitle>
          <EmptyHint>
            {isPrivate
              ? 'Only the two of you will see this.'
              : 'Messages are relayed through the signalling server and kept only while the room is open.'}
          </EmptyHint>
        </Empty>
      </Scroll>
    );
  }

  return (
    <Scroll ref={scrollRef} onScroll={handleScroll} data-role='transcript'>
      {messages.map((message, index) => (
        <ChatMessage
          key={message.id ?? index}
          message={message}
          mine={message.from === selfId}
          // Consecutive messages from the same person lose their header, so the
          // transcript reads as conversation rather than as a log.
          grouped={
            index > 0 &&
            messages[index - 1].from === message.from &&
            message.at - messages[index - 1].at < 120_000
          }
        />
      ))}
    </Scroll>
  );
}

const ChatMessage = memo(function ChatMessage({ message, mine, grouped }) {
  return (
    <Row $mine={mine} $grouped={grouped}>
      {!mine && (
        <AvatarSlot>
          {!grouped && <Avatar name={message.fromName} size={26} />}
        </AvatarSlot>
      )}

      <Column $mine={mine}>
        {!grouped && (
          <Meta $mine={mine}>
            <Author>{mine ? 'You' : message.fromName}</Author>
            <Time>{formatTime(message.at)}</Time>
          </Meta>
        )}
        <Bubble $mine={mine} $private={message.private}>
          {message.body}
        </Bubble>
      </Column>
    </Row>
  );
});

/**
 * The composer. Its draft lives in the store rather than local state, so
 * switching threads mid-sentence does not lose what you were writing.
 */
function Composer({ threadId, placeholder, disabled, isPrivate }) {
  const draft = useChatStore((state) => state.drafts[threadId] ?? '');
  const setDraft = useChatStore((state) => state.setDraft);
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus follows the thread, so a DM opened from the roster is immediately
    // typeable.
    if (!disabled) inputRef.current?.focus();
  }, [threadId, disabled]);

  const send = useCallback(() => {
    const body = draft.trim();
    if (!body || disabled) return;

    callEngine.sendMessage(body, threadId === GROUP_THREAD ? null : threadId);
    setDraft(threadId, '');
  }, [draft, threadId, disabled, setDraft]);

  const handleKeyDown = useCallback(
    (event) => {
      // Enter sends; Shift+Enter is a newline.
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    },
    [send]
  );

  return (
    <Composition>
      <InputShell $private={isPrivate} $disabled={disabled}>
        <Input
          ref={inputRef}
          value={draft}
          rows={1}
          maxLength={2000}
          disabled={disabled}
          placeholder={disabled ? 'They have left the room' : placeholder}
          onChange={(event) => setDraft(threadId, event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={placeholder}
        />
        <Send onClick={send} disabled={disabled || !draft.trim()} title='Send'>
          <SendIcon />
          <VisuallyHidden>Send message</VisuallyHidden>
        </Send>
      </InputShell>
    </Composition>
  );
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

const PrivateBar = styled(motion.div)`
  overflow: hidden;
  flex-shrink: 0;
  padding: 0 12px;
`;

const PrivateInner = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;

  padding: 8px 8px 8px 10px;
  margin-bottom: 4px;

  background: var(--accent-soft);
  border-radius: var(--radius-sm);
`;

const PrivateText = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  strong {
    font-weight: 550;
    color: var(--ink);
  }
`;

const BackButton = styled.button`
  display: grid;
  place-items: center;
  width: ${TAP};
  height: ${TAP};
  flex-shrink: 0;

  ${media.lg} {
    width: 24px;
    height: 24px;
  }

  color: var(--ink-3);
  border-radius: var(--radius-pill);

  &:hover {
    color: var(--ink);
    background: var(--surface-3);
  }

  svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.9;
    stroke-linecap: round;
  }
`;

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-2) var(--space-3) var(--space-3);
  display: flex;
  flex-direction: column;
`;

const Empty = styled.div`
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  text-align: center;
  padding: var(--space-6) var(--space-4);
`;

const EmptyTitle = styled.p`
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
`;

const EmptyHint = styled.p`
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ink-3);
  max-width: 30ch;
  text-wrap: pretty;
`;

const Row = styled.div`
  display: flex;
  gap: 9px;
  margin-top: ${({ $grouped }) => ($grouped ? '3px' : 'var(--space-4)')};
  flex-direction: ${({ $mine }) => ($mine ? 'row-reverse' : 'row')};
  align-items: flex-start;

  &:first-child {
    margin-top: 0;
  }
`;

const AvatarSlot = styled.div`
  width: 26px;
  flex-shrink: 0;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  align-items: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
  min-width: 0;
  max-width: 84%;
`;

const Meta = styled.div`
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin-bottom: 4px;
  padding: 0 2px;
  flex-direction: ${({ $mine }) => ($mine ? 'row-reverse' : 'row')};
`;

const Author = styled.span`
  font-size: 12.5px;
  font-weight: 550;
  color: var(--ink-2);
`;

const Time = styled.span`
  font-size: 11px;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
`;

const Bubble = styled.div`
  padding: 9px 13px;

  font-size: 14px;
  line-height: 1.5;
  /* "anywhere" rather than "break-all": long URLs wrap, ordinary words are not
     chopped mid-syllable. */
  overflow-wrap: anywhere;
  white-space: pre-wrap;

  color: var(--ink);
  background: var(--surface-3);
  /* Asymmetric corner points at the speaker — the one bit of shape that says
     who is talking without needing a colour. */
  border-radius: var(--radius-md) var(--radius-md) var(--radius-md) 5px;

  ${({ $mine }) =>
    $mine &&
    css`
      color: #fff;
      background: var(--accent);
      border-radius: var(--radius-md) var(--radius-md) 5px var(--radius-md);
    `}

  ${({ $private, $mine }) =>
    $private &&
    !$mine &&
    css`
      background: var(--accent-soft);
    `}
`;

const Composition = styled.div`
  /* The sheet already clears the home indicator; this only needs breathing room. */
  padding: 0 var(--space-3) var(--space-3);
  flex-shrink: 0;
`;

const InputShell = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 6px;

  padding: 6px 6px 6px 14px;

  background: var(--surface-sunken);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px
    ${({ $private }) => ($private ? 'var(--accent-line)' : 'var(--hairline)')};

  transition: box-shadow 200ms var(--ease);
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};

  &:focus-within {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
`;

const Input = styled.textarea`
  flex: 1;
  min-width: 0;
  resize: none;
  max-height: 116px;
  padding: 10px 0;

  /*
   * 16px is not a style choice. iOS Safari zooms the whole page when a text
   * field smaller than 16px receives focus, and it does not zoom back out —
   * leaving the call scaled up and horizontally scrolling. Only the roomier
   * layout, where there is no such behaviour to trip over, drops to 14px.
   */
  font-size: 16px;
  line-height: 1.5;

  ${media.lg} {
    font-size: 14px;
  }
  color: var(--ink);
  background: transparent;

  &::placeholder {
    color: var(--ink-3);
  }
`;

const Send = styled.button`
  display: grid;
  place-items: center;
  width: ${TAP};
  height: ${TAP};
  flex-shrink: 0;

  ${media.lg} {
    width: 34px;
    height: 34px;
  }

  color: var(--accent-ink);
  background: var(--accent);
  border-radius: var(--radius-pill);
  transition: opacity 180ms var(--ease), transform 180ms var(--ease);

  &:hover:not(:disabled) {
    transform: scale(1.05);
  }

  &:disabled {
    opacity: 0.28;
  }

  svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;
