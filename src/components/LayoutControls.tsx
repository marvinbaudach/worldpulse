import styled from 'styled-components';
import { TAGS } from '../dashboards';
import { glassSurface } from './glass';

interface LayoutControlsProps {
  /** Active theme filter (null = the full pool). */
  tag: string | null;
  onTagChange: (tag: string | null) => void;
  /** True while a hero is open — the bar slips away so nothing competes
      with the fullscreen card. */
  hidden: boolean;
}

// Bottom center: HandControls owns the top-left, PerfHud the top-right, the
// HotkeyPanel the bottom-right.
const Wrap = styled.div<{ $hidden: boolean }>`
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translate(-50%, ${(p) => (p.$hidden ? '14px' : '0')});
  opacity: ${(p) => (p.$hidden ? 0 : 1)};
  pointer-events: ${(p) => (p.$hidden ? 'none' : 'auto')};
  z-index: 10;
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
`;

const Bar = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  ${glassSurface}

  /* Phones can't fit every chip on one line, and a wrapped multi-row block
     eats the screen. Keep the single pill row but let it scroll sideways —
     one swipe reaches the rest. Scrollbar hidden; the rounded pill clips it. */
  @media (max-width: 640px) {
    max-width: calc(100vw - 20px);
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

const Chip = styled.button<{ $active: boolean }>`
  padding: 7px 13px;
  border: none;
  border-radius: 999px;
  flex: 0 0 auto;
  white-space: nowrap;
  background: ${(p) => (p.$active ? 'rgba(57, 135, 229, 0.28)' : 'transparent')};
  color: ${(p) => (p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.55)')};
  font: 600 11px/1 inherit;
  font-family: inherit;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;

  &:hover {
    color: rgba(255, 255, 255, 0.9);
  }
`;

/**
 * Theme-filter chips: each narrows the stage to the tagged cards. The
 * formation switcher moved into the HotkeyPanel (bottom-right).
 */
export function LayoutControls({ tag, onTagChange, hidden }: LayoutControlsProps) {
  return (
    <Wrap $hidden={hidden}>
      <Bar>
        <Chip $active={tag === null} onClick={() => onTagChange(null)}>
          ALLE
        </Chip>
        {TAGS.map((t) => (
          <Chip
            key={t.id}
            $active={tag === t.id}
            onClick={() => onTagChange(tag === t.id ? null : t.id)}
          >
            {t.label}
          </Chip>
        ))}
      </Bar>
    </Wrap>
  );
}
