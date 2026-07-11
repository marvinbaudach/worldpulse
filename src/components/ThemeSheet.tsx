import styled from 'styled-components';
import { t as trans } from '../i18n';
import type { TAGS } from '../dashboards';
import { ACCENT_TEXT, glassSurface } from './glass';

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(3, 5, 9, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: backdrop-in 0.28s ease;

  @keyframes backdrop-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
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
  min-height: 52px;
  padding: 16px 14px;
  border: none;
  border-radius: 12px;
  background: ${(p) => (p.$active ? 'rgba(57, 135, 229, 0.28)' : 'rgba(255, 255, 255, 0.05)')};
  color: ${(p) => (p.$active ? ACCENT_TEXT : 'rgba(255, 255, 255, 0.75)')};
  font: 600 14px/1 inherit;
  letter-spacing: 0.1em;
  text-align: left;
  cursor: pointer;
  transition: transform 120ms ease;

  &:active {
    transform: scale(0.97);
  }
`;

interface ThemeSheetProps {
  /** Chips to offer (useThemeFilter's visibleTags). */
  tags: typeof TAGS;
  active: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** Bottom sheet listing the theme chips — the mobile theme picker. */
export function ThemeSheet({ tags, active, onPick, onClose }: ThemeSheetProps) {
  return (
    <>
      <Backdrop onClick={onClose} />
      <Sheet>
        <Handle />
        {tags.map((t) => (
          <Option key={t.id} $active={active === t.id} onClick={() => onPick(t.id)}>
            {trans(t.label)}
          </Option>
        ))}
      </Sheet>
    </>
  );
}
