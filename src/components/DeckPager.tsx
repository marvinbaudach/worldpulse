import styled from 'styled-components';

// The pager reads as a property of the deck, not the header: centered under
// the cards (iOS-pager style) instead of squeezed next to the filter button —
// top-center is out, the wider theme labels (DEUTSCHLAND) would collide.
export const DotsDock = styled.div`
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 26px);
  transform: translateX(-50%);
  z-index: 12;
  pointer-events: none;

  /* Landscape phones: vertical space is scarce and the card reaches deeper
     down — hug the screen edge so the dots keep clear of the card. */
  @media (max-height: 520px) {
    bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
  }
`;

const DotsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Dot = styled.div<{ $active: boolean; $small: boolean }>`
  width: ${(p) => (p.$active ? 18 : 6)}px;
  height: 6px;
  border-radius: 999px;
  background: ${(p) => (p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.28)')};
  transform: scale(${(p) => (p.$small ? 0.6 : 1)});
  transition: width 0.25s ease, background 0.25s ease, transform 0.25s ease;
`;

// iOS-pager style dots: with many cards only a sliding window of dots shows,
// and the window-edge dots shrink to signal "more beyond".
const MAX_DOTS = 9;

export function Dots({ count, active }: { count: number; active: number }) {
  if (count <= 1) return null;
  const visible = Math.min(count, MAX_DOTS);
  const start = Math.max(0, Math.min(active - Math.floor(MAX_DOTS / 2), count - visible));
  return (
    // The dots are purely visual; the row announces the position textually.
    <DotsRow role="status" aria-label={`${active + 1} / ${count}`}>
      {Array.from({ length: visible }, (_, j) => {
        const i = start + j;
        const edge =
          count > MAX_DOTS &&
          ((j === 0 && start > 0) || (j === visible - 1 && start + visible < count));
        return <Dot key={i} aria-hidden $active={i === active} $small={edge} />;
      })}
    </DotsRow>
  );
}
