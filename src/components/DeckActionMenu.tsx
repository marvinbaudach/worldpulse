import styled from 'styled-components';
import { canShareFiles, shareCard } from '../exportCard';
import { LOCALE, LOCALES, setLocale, t as trans } from '../i18n';
import type { Dashboard } from '../dashboards';
import { glassSurface } from './glass';

// One "⋯" context button gathers the card actions (share, source, motion
// opt-in): separate pills crowded the bottom edge and fought the swipe hint
// on small phones.
const MenuButton = styled.button`
  position: fixed;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
  z-index: 12;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 999px;
  color: #cfe4ff;
  font: 700 26px/1 inherit;
  cursor: pointer;
  ${glassSurface}
`;

// Small glass action menu unfolding above the context button.
const Menu = styled.div`
  position: fixed;
  right: 16px;
  /* Clears the 56px button (top at inset + 74px) with an 8px gap. */
  bottom: calc(env(safe-area-inset-bottom, 0px) + 82px);
  z-index: 13;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 16px;
  animation: menu-up 0.18s ease;
  ${glassSurface}

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
`;

const Item = styled.button`
  padding: 13px 16px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  font: 600 13px/1 inherit;
  letter-spacing: 0.06em;
  text-align: left;
  cursor: pointer;
`;

// Language switcher row at the bottom of the action menu — the mobile
// counterpart of the desktop settings panel's SPRACHE fold.
const LangRow = styled.div`
  display: flex;
  gap: 6px;
`;

const LangButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 11px 0;
  border: none;
  border-radius: 10px;
  background: ${(p) => (p.$active ? 'rgba(57, 135, 229, 0.28)' : 'rgba(255, 255, 255, 0.05)')};
  color: ${(p) => (p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.7)')};
  font: 600 12px/1 inherit;
  letter-spacing: 0.08em;
  cursor: pointer;
`;

interface DeckActionMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** The card the actions apply to (share); undefined on an empty deck. */
  current: Dashboard | undefined;
  /** Opens the source note for the current card (entry hidden without one). */
  onShowSource: () => void;
  /** Non-null shows the iOS motion opt-in entry; the click that picks it is
      the user gesture DeviceOrientationEvent.requestPermission() needs. */
  onAskMotion: (() => void) | null;
}

/**
 * The mobile deck's "⋯" context menu: share/save, source note, motion opt-in
 * and the language switcher. Mark-up carries `data-actions-ui` so the outside-
 * tap dismissal (useDismissOnOutsideTap in MobileDeck) can spare taps on it.
 */
export function DeckActionMenu({
  open,
  onToggle,
  onClose,
  current,
  onShowSource,
  onAskMotion,
}: DeckActionMenuProps) {
  return (
    <>
      <MenuButton
        data-actions-ui
        aria-label={trans('Aktionen')}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span aria-hidden>⋯</span>
      </MenuButton>
      {open && (
        <Menu data-actions-ui>
          {current && (
            <Item
              onClick={() => {
                onClose();
                void shareCard(current);
              }}
            >
              {trans(canShareFiles() ? 'Teilen' : 'Bild speichern')}
            </Item>
          )}
          {current?.source && (
            <Item
              onClick={() => {
                onClose();
                onShowSource();
              }}
            >
              {trans('Quelle anzeigen')}
            </Item>
          )}
          {onAskMotion && (
            <Item
              onClick={() => {
                onClose();
                onAskMotion();
              }}
            >
              {trans('Bewegungseffekte aktivieren')}
            </Item>
          )}
          {/* Locale switch remounts the deck via App's key={locale}, which
              also closes this menu. */}
          <LangRow role="group" aria-label={trans('SPRACHE')}>
            {LOCALES.map((l) => (
              <LangButton
                key={l}
                $active={LOCALE === l}
                aria-pressed={LOCALE === l}
                onClick={() => setLocale(l)}
              >
                {l.toUpperCase()}
              </LangButton>
            ))}
          </LangRow>
        </Menu>
      )}
    </>
  );
}
