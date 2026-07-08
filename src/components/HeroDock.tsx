import styled from 'styled-components';
import { downloadCard } from '../exportCard';
import { toggleFavorite } from '../favorites';
import { useFavorites } from '../hooks/useFavorites';
import { SERIES } from '../dashboards/theme';
import type { Dashboard } from '../dashboards';
import { t as tr } from '../i18n';
import { glassSurface } from './glass';

// Footer for the open hero, pinned to the bottom while the rest of the chrome
// is hidden: a small round glass "i" that unfolds the source note above it on
// hover (like a toolbar tooltip), the favorites star, and the PNG export.
const Dock = styled.div`
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 20px);
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  justify-content: center;
  gap: 8px;
`;

const InfoButton = styled.button`
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.8);
  font: italic 600 15px/1 Georgia, serif;
  cursor: help;
  ${glassSurface}
`;

// Star toggle: adds/removes the open card from the favorites stack. Gold when
// active — the same SERIES slot the FAVORITEN chip carries.
const FavButton = styled.button<{ $active: boolean }>`
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  color: ${(p) => (p.$active ? SERIES[2] : 'rgba(255, 255, 255, 0.8)')};
  font: 600 15px/1 inherit;
  cursor: pointer;
  ${glassSurface}
`;

// PNG export of the open hero: one settled offscreen draw at poster size
// (see exportCard.ts), saved as a download.
const ExportButton = styled.button`
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.8);
  font: 600 15px/1 inherit;
  cursor: pointer;
  ${glassSurface}
`;

// Tooltip above the button; a small padding bridge (bottom, no visual) keeps
// the note reachable so it does not flicker out when the pointer crosses the
// gap from the button up onto it.
const SourceNote = styled.div`
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  width: max-content;
  max-width: min(92vw, 440px);
  padding: 11px 16px;
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.85);
  font: 400 12px/1.5 inherit;
  text-align: center;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    visibility 0.18s;
  ${glassSurface}

  ${Dock}:hover & {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }
`;

export function HeroDock({ dashboard }: { dashboard: Dashboard }) {
  const favoriteIds = useFavorites();
  const fav = favoriteIds.includes(dashboard.id);
  const favLabel = tr(fav ? 'Favorit entfernen' : 'Zu Favoriten');
  const exportLabel = tr('Als PNG speichern');
  return (
    <Dock>
      {dashboard.source && (
        <>
          <SourceNote role="tooltip">
            {tr('Quelle')}: {tr(dashboard.source)}
          </SourceNote>
          <InfoButton aria-label={`${tr('Quelle')}: ${tr(dashboard.source)}`}>i</InfoButton>
        </>
      )}
      <FavButton
        $active={fav}
        aria-pressed={fav}
        aria-label={favLabel}
        title={favLabel}
        onClick={() => toggleFavorite(dashboard.id)}
      >
        <span aria-hidden>{fav ? '★' : '☆'}</span>
      </FavButton>
      <ExportButton
        aria-label={exportLabel}
        title={exportLabel}
        onClick={() => void downloadCard(dashboard)}
      >
        <span aria-hidden>⤓</span>
      </ExportButton>
    </Dock>
  );
}
