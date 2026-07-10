import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { t as tr } from '../i18n';
import type { TAGS } from '../dashboards';
import { glassSurface } from './glass';
import { useDismissOnOutsideTap } from '../hooks/useDismissOnOutsideTap';

interface LayoutControlsProps {
  /** Active theme filter — one chip is always selected. */
  tag: string;
  /** Chips to render (useThemeFilter's visibleTags — FAVORITEN only exists
      once something is starred). */
  tags: typeof TAGS;
  onTagChange: (tag: string) => void;
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

// Anchor for the popover: the menu positions itself above the MEHR chip.
const MoreAnchor = styled.div`
  position: relative;
  flex: 0 0 auto;
`;

// Off-screen clone of the bar that always renders every chip plus MEHR, so
// the fit computation knows each chip's real (translated) width without ever
// showing a wrapped or clipped row.
const Measure = styled.div`
  position: fixed;
  visibility: hidden;
  pointer-events: none;
  display: flex;
  gap: 4px;
`;

// Bar paddings/gaps (kept in sync with Bar) and the breathing room to the
// viewport edges the row must not grow past.
const CHIP_GAP = 4;
const BAR_PAD = 8;
const EDGE_MARGIN = 24;

/** How many leading primary chips fit next to the always-visible active chip
    and the MEHR trigger at the given viewport width. */
function fitCount(
  primaryWidths: number[],
  moreWidth: number,
  activeIndex: number,
  activeWidth: number,
  menuAlways: boolean,
  viewport: number,
): number {
  const avail = viewport - EDGE_MARGIN - BAR_PAD;
  for (let k = primaryWidths.length; k > 0; k--) {
    const hasMenu = menuAlways || k < primaryWidths.length;
    // The active chip stays in the row even when its slot got demoted (or it
    // lives in the popover set) — reserve its width in that case.
    const activeExtra = activeIndex >= 0 && activeIndex < k ? 0 : activeWidth;
    const items = k + (activeExtra ? 1 : 0) + (hasMenu ? 1 : 0);
    const total =
      primaryWidths.slice(0, k).reduce((a, w) => a + w, 0) +
      activeExtra +
      (hasMenu ? moreWidth : 0) +
      Math.max(0, items - 1) * CHIP_GAP;
    if (total <= avail) return k;
  }
  return 0;
}

const Menu = styled.div`
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  min-width: 168px;
  padding: 6px;
  border-radius: 14px;
  ${glassSurface}
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: menu-up 0.18s ease;

  @keyframes menu-up {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const MenuItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 11px;
  border: none;
  border-radius: 9px;
  background: ${(p) => (p.$active ? 'rgba(57, 135, 229, 0.28)' : 'transparent')};
  color: ${(p) => (p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.65)')};
  font: 600 11px/1 inherit;
  font-family: inherit;
  letter-spacing: 0.14em;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.92);
  }
`;

// The theme's accent from the categorical palette — the same hue the scene
// tints toward, so the menu previews the scene change.
const AccentDot = styled.span<{ $color: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: ${(p) => p.$color};
`;

/**
 * Theme-filter chips: the `primary` themes render as always-visible chips,
 * everything else lives in the MEHR popover so the bar keeps a fixed width
 * as the theme list grows. When the window gets too narrow for the primary
 * row, trailing chips are demoted into the popover as well, so the bar never
 * wraps or clips. An active overflow theme is pulled into the row as an
 * extra chip, so the current filter is always visible at a glance.
 */
export function LayoutControls({ tag, tags, onTagChange, hidden }: LayoutControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  useDismissOnOutsideTap(menuOpen, 'data-theme-menu', () => setMenuOpen(false));

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const primary = tags.filter((t) => t.primary);
  const secondary = tags.filter((t) => !t.primary);

  // Responsive overflow: measure every chip (plus the MEHR trigger) in the
  // hidden clone, then keep only as many leading primary chips in the row as
  // the current window width fits — the rest join the popover.
  const ordered = [...primary, ...secondary];
  const measureRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const [moreWidth, setMoreWidth] = useState(0);
  const [viewport, setViewport] = useState(() => window.innerWidth);
  useLayoutEffect(() => {
    const measure = () => {
      const el = measureRef.current;
      if (!el) return;
      const chips = Array.from(el.children) as HTMLElement[];
      setWidths(chips.slice(0, -1).map((c) => c.offsetWidth));
      setMoreWidth(chips[chips.length - 1].offsetWidth);
    };
    measure();
    // The chips' font loads async; re-measure once it's in so the widths
    // reflect the real glyphs, not the fallback font.
    document.fonts?.ready.then(measure);
  }, [tags]);
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeIndex = ordered.findIndex((t) => t.id === tag);
  const visible =
    widths.length === ordered.length
      ? fitCount(
          widths.slice(0, primary.length),
          moreWidth,
          activeIndex < primary.length ? activeIndex : -1,
          activeIndex >= 0 ? widths[activeIndex] : 0,
          secondary.length > 0,
          viewport,
        )
      : primary.length;
  const overflow = [...primary.slice(visible), ...secondary];
  const activeOverflow = overflow.find((t) => t.id === tag);
  const row = activeOverflow
    ? [...primary.slice(0, visible), activeOverflow]
    : primary.slice(0, visible);

  const pick = (id: string) => {
    onTagChange(id);
    setMenuOpen(false);
  };

  return (
    <Wrap $hidden={hidden}>
      <Measure aria-hidden ref={measureRef}>
        {ordered.map((t) => (
          <Chip key={t.id} $active={false} tabIndex={-1}>
            {tr(t.label)}
          </Chip>
        ))}
        <Chip $active={false} tabIndex={-1}>
          {tr('MEHR')} ▾
        </Chip>
      </Measure>
      <Bar>
        {row.map((t) => (
          <Chip
            key={t.id}
            $active={tag === t.id}
            aria-pressed={tag === t.id}
            onClick={() => pick(t.id)}
          >
            {tr(t.label)}
          </Chip>
        ))}
        {overflow.length > 0 && (
          <MoreAnchor data-theme-menu>
            <Chip
              $active={false}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={tr('Weitere Themen')}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {tr('MEHR')} ▾
            </Chip>
            {menuOpen && (
              <Menu role="menu" aria-label={tr('Weitere Themen')}>
                {overflow.map((t) => (
                  <MenuItem
                    key={t.id}
                    role="menuitem"
                    $active={tag === t.id}
                    onClick={() => pick(t.id)}
                  >
                    <AccentDot $color={t.accent} />
                    {tr(t.label)}
                  </MenuItem>
                ))}
              </Menu>
            )}
          </MoreAnchor>
        )}
      </Bar>
    </Wrap>
  );
}
