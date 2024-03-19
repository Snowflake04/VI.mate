import { Component } from 'react';
import styled from 'styled-components';
import { Button, Title } from './Primitives.jsx';
import Brand from './Brand.jsx';

/**
 * Last line of defence.
 *
 * A render error anywhere in the call would otherwise unmount the tree and
 * leave a white page — the worst possible outcome mid-meeting, because it gives
 * the user nothing to act on and no way back. This keeps the room recoverable
 * and offers a reload.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] unrecoverable render error', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Screen>
        <Card>
          <Brand size='lg' />

          <div>
            <Title>Something broke</Title>
            <Copy>
              The interface stopped responding while rendering. Your call has
              ended, but the room is still open — rejoin with the same code.
            </Copy>
          </div>

          <Trace>{String(error?.message ?? error)}</Trace>

          <Actions>
            <Button onClick={() => window.location.assign('/')}>Lobby</Button>
            <Button $variant='primary' onClick={() => window.location.reload()}>
              Reload
            </Button>
          </Actions>
        </Card>
      </Screen>
    );
  }
}

const Screen = styled.div`
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-5);
  background: var(--canvas);
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  width: min(440px, 100%);
  padding: var(--space-6);

  background: var(--surface-2);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-3), inset 0 1px 0 var(--edge-light);
`;

const Copy = styled.p`
  margin-top: 7px;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--ink-2);
  text-wrap: pretty;
`;

const Trace = styled.pre`
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  color: var(--bad);
  background: var(--surface-sunken);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 140px;
  overflow: auto;
`;

const Actions = styled.div`
  display: flex;
  gap: var(--space-2);

  button {
    flex: 1;
  }
`;

export default ErrorBoundary;
