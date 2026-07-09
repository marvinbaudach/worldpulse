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
  /* One 56px button plus a 12px gap to the left of the "⋯" menu (right: 16px):
     16 + 56 + 12 = 84. 56px keeps the tap target comfortably above the 44px
     minimum and reads as an app-scale control on phones. */
  right: 84px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
  z-index: 12;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 999px;
  color: ${(p) => (p.$active ? SERIES[2] : 'rgba(255, 255, 255, 0.7)')};
  font: 600 24px/1 inherit;
  cursor: pointer;
  transition: transform 120ms ease;
  ${glassSurface}

  &:active {
    transform: scale(0.88);
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
