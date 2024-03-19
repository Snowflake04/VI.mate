import styled from 'styled-components';

/**
 * The wordmark: an aperture mark plus the name.
 *
 * The mark is an aperture iris — six blades around an opening. It is the right
 * metaphor for a camera product, it reads at 16px, and it is drawn in SVG paths
 * rather than being a stack of bars pretending to be a signal meter.
 *
 * Connection state is a small dot rather than a bordered pill of shouty
 * uppercase text. Status is peripheral information; it should be legible when
 * you look for it and invisible when you are not.
 */
export function Brand({ size = 'md', showStatus = false, status = 'idle' }) {
  const px = size === 'lg' ? 26 : 20;

  return (
    <Wrap $size={size}>
      <Mark width={px} height={px} viewBox='0 0 24 24' aria-hidden='true'>
        <circle
          cx='12'
          cy='12'
          r='10'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.6'
          opacity='0.28'
        />
        {/* Three blades, rotated into six by the transform group below. */}
        <g fill='currentColor'>
          <path d='M12 4.2 A7.8 7.8 0 0 1 18.75 8.1 L12 12 Z' opacity='0.95' />
          <path
            d='M12 4.2 A7.8 7.8 0 0 1 18.75 8.1 L12 12 Z'
            opacity='0.6'
            transform='rotate(120 12 12)'
          />
          <path
            d='M12 4.2 A7.8 7.8 0 0 1 18.75 8.1 L12 12 Z'
            opacity='0.35'
            transform='rotate(240 12 12)'
          />
        </g>
      </Mark>

      <Word $size={size}>
        VI<Dot>.</Dot>mate
      </Word>

      {showStatus && (
        <Status title={STATUS_LABEL[status] ?? status}>
          <StatusDot $status={status} />
        </Status>
      )}
    </Wrap>
  );
}

const STATUS_LABEL = {
  idle: 'Standby',
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
};

const TONE = {
  idle: 'ink-3',
  connecting: 'warn',
  connected: 'ok',
  reconnecting: 'warn',
  offline: 'bad',
};

const Wrap = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ $size }) => ($size === 'lg' ? '11px' : '9px')};
  min-width: 0;
`;

const Mark = styled.svg`
  color: var(--accent);
  flex-shrink: 0;
`;

const Word = styled.span`
  font-size: ${({ $size }) => ($size === 'lg' ? '19px' : '16px')};
  font-weight: 550;
  letter-spacing: -0.026em;
  color: var(--ink);
`;

const Dot = styled.span`
  color: var(--accent);
`;

const Status = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 2px;
`;

const StatusDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--${({ $status }) => TONE[$status] ?? 'ink-3'});
  /* A soft halo so a 6px dot still registers peripherally. */
  box-shadow: 0 0 0 3px
    color-mix(
      in srgb,
      var(--${({ $status }) => TONE[$status] ?? 'ink-3'}) 18%,
      transparent
    );
`;

export default Brand;
