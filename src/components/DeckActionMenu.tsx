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
  /* Flex-center the glyph so it sits dead-centre regardless of the device
     font's ellipsis metrics — line-height alone left it drifting and, on
     fonts with a taller glyph, overflowing the button. */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 999px;
  color: ${ACCENT_TEXT};
  /* The ⋯ ink is short and wide; ~0.6× the button keeps it app-scale without
     crowding the rim. */
  font-weight: 700;
  font-size: 33px;
  line-height: 1;
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
  }
`;

// Small glass action menu unfolding above the context button (below it in
// landscape, where the button lives in the top bar).
const Menu = styled.div`
  position: fixed;
  right: 16px;
  /* Clears the 52px button (top at inset + 70px) with an 8px gap. */
  bottom: calc(env(safe-area-inset-bottom, 0px) + 78px);
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
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 14px 18px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
  font-size: 14px;
  line-height: 1;
  letter-spacing: 0.06em;
  text-align: left;
  cursor: pointer;
`;

// Small stroke icons in front of the menu labels — inline SVGs on currentColor
// so they inherit the row's ink and stay crisp on the glass (emoji would clash
// with the chrome and render differently per platform).
const ItemIcon = styled.svg.attrs({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})`
  width: 16px;
  height: 16px;
  flex: none;
  opacity: 0.85;
`;

const ShareIcon = () => (
  <ItemIcon>
    <path d="M12 15V3" />
    <path d="m8 7 4-4 4 4" />
    <path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
  </ItemIcon>
);

const SaveIcon = () => (
  <ItemIcon>
    <path d="M12 3v12" />
    <path d="m8 11 4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </ItemIcon>
);

const InfoIcon = () => (
  <ItemIcon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </ItemIcon>
);

const MotionIcon = () => (
  <ItemIcon>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </ItemIcon>
);

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
  font-weight: 600;
  font-size: 13px;
  line-height: 1;
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
              {canShareFiles() ? <ShareIcon /> : <SaveIcon />}
              {trans(canShareFiles() ? 'Teilen' : 'Bild speichern')}
            </Item>
          )}
          {(current?.source || current?.detail) && (
            <Item
              onClick={() => {
                onClose();
                onShowSource();
              }}
            >
              <InfoIcon />
              {trans(current?.detail ? 'Details anzeigen' : 'Quelle anzeigen')}
            </Item>
          )}
          {onAskMotion && (
            <Item
              onClick={() => {
                onClose();
                onAskMotion();
              }}
            >
              <MotionIcon />
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
