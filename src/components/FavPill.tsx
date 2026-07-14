import styled from 'styled-components';
import { FavStar } from './FavStar';
import { useFavorites } from '../hooks/useFavorites';
import { toggleFavorite } from '../favorites';
import { hapticTick } from '../haptics';
import { t as trans } from '../i18n';
import type { Dashboard } from '../dashboards';
import { SERIES } from '../dashboards/theme';
import { glassSurface } from './glass';

// Favorite toggle for the front card, docked into the bottom action cluster
// beside the "⋯" menu. It used to ride the card's top-right corner, where a
// long (often two-line) title kept running underneath it on phones. Moving it
// off the card kills that whole class of overlap. The star pop and expanding
// ping still play here — FavStar owns that; the pill just anchors it.
const Pill = styled.button<{ $active: boolean }>`
  position: fixed;
  /* One 52px button plus a 12px gap to the left of the "⋯" menu (right: 16px):
     16 + 52 + 12 = 80. 52px reads as an app-scale control and sits well clear
     of the 44px minimum tap target. */
  right: 80px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
  z-index: 12;
  /* Flex-center the star so it stays centred whatever the device font's glyph
     box does — matching the "⋯" menu button beside it. */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 999px;
  color: ${(p) => (p.$active ? SERIES[2] : 'rgba(255, 255, 255, 0.7)')};
  /* ~0.55× the button reads app-scale without the glyph touching the rim. */
  font-weight: 600;
  font-size: 29px;
  line-height: 1;
  cursor: pointer;
  transition: transform 120ms ease;
  ${glassSurface}

  &:active {
    transform: scale(0.88);
  }

  /* Landscape phones: the deck card fills the width, so the bottom-right action
     cluster moves up into the empty right side of the top bar to clear it. */
  @media (max-height: 520px) {
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    right: calc(env(safe-area-inset-right, 0px) + 78px);
    bottom: auto;
  }
`;

interface FavPillProps {
  /** The front card the toggle applies to; undefined on an empty deck. */
  current: Dashboard | undefined;
}

export function FavPill({ current }: FavPillProps) {
  const favoriteIds = useFavorites();
  if (!current) return null;
  const active = favoriteIds.includes(current.id);
  return (
    <Pill
      $active={active}
      aria-pressed={active}
      aria-label={trans(active ? 'Favorit entfernen' : 'Zu Favoriten')}
      onClick={() => {
        hapticTick();
        toggleFavorite(current.id);
      }}
    >
      <FavStar id={current.id} active={active} />
    </Pill>
  );
}
