import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { ALL_DASHBOARDS, TAGS } from '../dashboards';
import { CARD_SOURCES } from '../dashboards/cardSources';
import { useTagFilter } from '../hooks/useTagFilter';
import { SwipeDeck } from './SwipeDeck';
import { SourcesOverlay } from './SourcesOverlay';
import { glassSurface } from './glass';

const Deck = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 8px;
`;

const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px 26px;
  border: none;
  border-radius: 999px;
  color: #cfe4ff;
  font: 600 16px/1 inherit;
  letter-spacing: 0.14em;
  cursor: pointer;
  ${glassSurface}
`;

const Counter = styled.div`
  color: rgba(255, 255, 255, 0.5);
  font: 600 12px/1 inherit;
  letter-spacing: 0.14em;
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 16px;
  border: none;
  border-radius: 999px;
  color: #cfe4ff;
  font: 600 12px/1 inherit;
  letter-spacing: 0.12em;
  cursor: pointer;
  ${glassSurface}
`;

// Source of the card currently on top of the deck; tapping it opens the full
// list. Pinned bottom-centre, above the swipe hint and the safe area.
const SourceTag = styled.button`
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 62px);
  transform: translateX(-50%);
  z-index: 12;
  max-width: 90vw;
  padding: 8px 15px;
  border: none;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.7);
  font: 600 11px/1.2 inherit;
  letter-spacing: 0.05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  ${glassSurface}
`;

// One-time swipe cue: the pager is a native horizontal scroll, so nothing
// signals it is swipeable until you try. Fades out on the first swipe.
const Hint = styled.div<{ $gone: boolean }>`
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 22px);
  transform: translateX(-50%);
  z-index: 12;
  padding: 9px 16px;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.7);
  font: 600 12px/1 inherit;
  letter-spacing: 0.08em;
  white-space: nowrap;
  pointer-events: none;
  opacity: ${(p) => (p.$gone ? 0 : 1)};
  transition: opacity 0.4s ease;
  ${glassSurface}
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(3, 5, 9, 0.5);
`;

const Sheet = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 31;
  padding: 10px 12px calc(env(safe-area-inset-bottom, 0px) + 14px);
  border-radius: 22px 22px 0 0;
  ${glassSurface}
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  animation: sheet-up 0.28s ease;

  @keyframes sheet-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;

const Handle = styled.div`
  grid-column: 1 / -1;
  justify-self: center;
  width: 40px;
  height: 4px;
  margin: 2px 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
`;

const Option = styled.button<{ $active: boolean }>`
  padding: 14px 12px;
  border: none;
  border-radius: 12px;
  background: ${(p) => (p.$active ? 'rgba(57, 135, 229, 0.28)' : 'rgba(255, 255, 255, 0.05)')};
  color: ${(p) => (p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.75)')};
  font: 600 13px/1 inherit;
  letter-spacing: 0.1em;
  text-align: left;
  cursor: pointer;
`;

/**
 * Mobile view: no 3D ring at all — a filter plus a swipeable deck of cards,
 * each drawn straight to a 2D canvas. Far lighter than the WebGL carousel.
 */
export function MobileDeck() {
  // Always open on the full deck (ALLE); the filter lives in state for the
  // session only, so it never inherits the 3D view's saved filter.
  const [tag, setTag] = useTagFilter(null);

  const dashboards = useMemo(
    () => (tag ? ALL_DASHBOARDS.filter((d) => d.tags?.includes(tag)) : ALL_DASHBOARDS),
    [tag],
  );

  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [swiped, setSwiped] = useState(() => localStorage.getItem('worldpulse-swiped') === '1');

  const onIndex = (i: number) => {
    setActive(i);
    if (i > 0 && !swiped) {
      setSwiped(true);
      localStorage.setItem('worldpulse-swiped', '1');
    }
  };

  const activeSource = CARD_SOURCES[dashboards[active]?.id ?? ''];
  const currentLabel = tag ? (TAGS.find((t) => t.id === tag)?.label ?? 'ALLE') : 'ALLE';
  const pick = (next: string | null) => {
    setTag(next);
    setMenuOpen(false);
  };

  return (
    <Deck>
      <TopBar>
        <FilterButton onClick={() => setMenuOpen(true)}>
          {currentLabel}
          <span aria-hidden>▾</span>
        </FilterButton>
        <Right>
          <Counter>
            {Math.min(active + 1, dashboards.length)} / {dashboards.length}
          </Counter>
          <IconButton onClick={() => setSourcesOpen(true)}>ⓘ QUELLEN</IconButton>
        </Right>
      </TopBar>

      <SwipeDeck key={tag ?? 'all'} dashboards={dashboards} onIndex={onIndex} />

      {activeSource && (
        <SourceTag onClick={() => setSourcesOpen(true)}>Quelle: {activeSource.name}</SourceTag>
      )}

      {!swiped && dashboards.length > 1 && <Hint $gone={false}>← wischen zum Blättern →</Hint>}

      {sourcesOpen && <SourcesOverlay onClose={() => setSourcesOpen(false)} />}

      {menuOpen && (
        <>
          <Backdrop onClick={() => setMenuOpen(false)} />
          <Sheet>
            <Handle />
            <Option $active={tag === null} onClick={() => pick(null)}>
              ALLE
            </Option>
            {TAGS.map((t) => (
              <Option key={t.id} $active={tag === t.id} onClick={() => pick(t.id)}>
                {t.label}
              </Option>
            ))}
          </Sheet>
        </>
      )}
    </Deck>
  );
}
