import styled from 'styled-components';
import { canShareFiles, shareCard } from '../exportCard';
import { LOCALE, LOCALES, setLocale, t as trans } from '../i18n';
import type { Dashboard } from '../dashboards';
import { ACCENT_TEXT, glassSurface } from './glass';

// One "⋯" context button gathers the card actions (share, source, motion
// opt-in): separate pills crowded the bottom edge and fought the swipe hint
// on small phones.
const MenuButton = styled.button`
  position: fixed;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
  z-index: 12;
  width: 60px;
  height: 60px;
  border: none;
  border-radius: 999px;
  color: ${ACCENT_TEXT};
  font: 700 28px/1 inherit;
  cursor: pointer;
  transition: transform 120ms ease;
  ${glassSurface}

  &:active {
    transform: scale(0.9);
  }

  /* Landscape phones: the card fills the width, so the action cluster docks
     into the empty right side of the top bar instead of the bottom edge. */
  @media (max-height: 520px) {
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    right: calc(env(safe-area-inset-right, 0px) + 16px);
    bottom: auto;
    width: 52px;
    height: 52px;
    font-size: 25px;
  }
`;

// Small glass action menu unfolding above the context button (below it in
// landscape, where the button lives in the top bar).
const Menu = styled.div`
  position: fixed;
  right: 16px;
  /* Clears the 60px button (top at inset + 78px) with an 8px gap. */
  bottom: calc(env(safe-area-inset-bottom, 0px) + 86px);
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

  /* Unfold downward from the top-bar button (top at inset + 62px + 8px gap). */
  @media (max-height: 520px) {
    top: calc(env(safe-area-inset-top, 0px) + 70px);
    right: calc(env(safe-area-inset-right, 0px) + 16px);
    bottom: auto;
  }
`;

const Item = styled.button`
  min-height: 44px;
  padding: 14px 18px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  font: 600 14px/1 inherit;
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
  min-height: 44px;
  padding: 13px 0;
  border: none;
  border-radius: 10px;
  background: ${(p) => (p.$active ? 'rgba(57, 135, 229, 0.28)' : 'rgba(255, 255, 255, 0.05)')};
  color: ${(p) => (p.$active ? ACCENT_TEXT : 'rgba(255, 255, 255, 0.7)')};
  font: 600 13px/1 inherit;
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
