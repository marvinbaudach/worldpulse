// Dev-only review gallery — right-click a card to copy its id, id + title, or
// the card image itself (reusing the app's poster export, so the source is
// stamped into the picture). Plus the little confirmation toast. Controlled by
// DevGallery, which owns the open menu and the toast message.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { Dashboard } from '../dashboards/types';
import { cardToPngBlob } from '../exportCard';
import { INK, glassPanel } from './galleryChrome';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function copyImage(card: Dashboard): Promise<boolean> {
  try {
    // Hand the blob promise straight to ClipboardItem so the write stays inside
    // the originating click gesture across the async render.
    const blob = cardToPngBlob(card).then((b) => {
      if (!b) throw new Error('canvas export denied');
      return b;
    });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

interface MenuItem {
  label: string;
  run: (card: Dashboard) => Promise<string>;
}

const ITEMS: readonly MenuItem[] = [
  {
    label: 'ID kopieren',
    run: async (c) => ((await copyText(c.id)) ? 'ID kopiert' : 'Kopieren fehlgeschlagen'),
  },
  {
    label: 'ID + Titel kopieren',
    run: async (c) =>
      (await copyText(`\`${c.id}\` — ${c.title}`))
        ? 'ID + Titel kopiert'
        : 'Kopieren fehlgeschlagen',
  },
  {
    label: 'Bild kopieren',
    run: async (c) => ((await copyImage(c)) ? 'Bild kopiert' : 'Bild kopieren fehlgeschlagen'),
  },
];

const Menu = styled.div`
  position: fixed;
  z-index: 30;
  min-width: 168px;
  padding: 5px;
  ${glassPanel}

  button {
    display: block;
    width: 100%;
    padding: 7px 10px;
    text-align: left;
    background: none;
    border: none;
    border-radius: 5px;
    color: ${INK};
    font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    cursor: pointer;
  }
  button:hover,
  button:focus-visible {
    background: rgba(255, 255, 255, 0.09);
    outline: none;
  }
`;

export interface CardMenuState {
  card: Dashboard;
  x: number;
  y: number;
}

interface GalleryCardMenuProps {
  menu: CardMenuState;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function GalleryCardMenu({ menu, onClose, onToast }: GalleryCardMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });

  // Clamp inside the viewport once the menu has a measured size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { innerWidth, innerHeight } = window;
    setPos({
      x: Math.min(menu.x, innerWidth - el.offsetWidth - 8),
      y: Math.min(menu.y, innerHeight - el.offsetHeight - 8),
    });
  }, [menu]);

  // Any outside interaction closes it (capture on scroll so nested scrolls fire).
  useEffect(() => {
    const onPointer = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  return (
    <Menu ref={ref} role="menu" style={{ left: pos.x, top: pos.y }}>
      {ITEMS.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={async () => {
            onClose();
            onToast(await item.run(menu.card));
          }}
        >
          {item.label}
        </button>
      ))}
    </Menu>
  );
}

const ToastBox = styled.div`
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 40;
  transform: translateX(-50%);
  padding: 9px 16px;
  ${glassPanel}
  color: ${INK};
  font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  animation: toastIn 150ms ease;

  @keyframes toastIn {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export function GalleryToast({ message }: { message: string }) {
  return <ToastBox role="status">{message}</ToastBox>;
}
