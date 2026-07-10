// Dev-only: right-click a card tile to copy its id, its id + title, or the card
// image itself — so a specific card can be handed to review/edit tooling by name
// or pasted straight in as a picture. Not part of the app bundle (served only
// via gallery.html; see gallery.ts).

import type { Dashboard } from '../dashboards/types';
import { cardToPngBlob } from '../exportCard';

interface MenuItem {
  label: string;
  /** Perform the copy; resolves to the toast message to show. */
  run: (card: Dashboard) => Promise<string>;
}

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
    // Reuse the app's poster export — same render as the lightbox PNG download
    // and the mobile share, so the source is stamped into the image itself.
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

let menuEl: HTMLDivElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function closeMenu(): void {
  menuEl?.remove();
  menuEl = null;
}

function showToast(message: string): void {
  let el = document.getElementById('toast') as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el?.classList.remove('show'), 1400);
}

/** Position the menu at the cursor, clamped so it stays inside the viewport. */
function placeMenu(el: HTMLDivElement, x: number, y: number): void {
  const { innerWidth, innerHeight } = window;
  const { offsetWidth: w, offsetHeight: h } = el;
  el.style.left = `${Math.min(x, innerWidth - w - 8)}px`;
  el.style.top = `${Math.min(y, innerHeight - h - 8)}px`;
}

function openMenu(card: Dashboard, x: number, y: number): void {
  closeMenu();
  const menu = document.createElement('div');
  menu.id = 'ctxmenu';
  menu.setAttribute('role', 'menu');

  for (const item of ITEMS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    button.addEventListener('click', async () => {
      // Close first so the menu can't linger if the async copy is slow.
      closeMenu();
      showToast(await item.run(card));
    });
    menu.appendChild(button);
  }

  document.body.appendChild(menu);
  placeMenu(menu, x, y);
  menuEl = menu;
}

// A single menu instance closes on any outside interaction. `capture` on scroll
// so it also fires for scrolls inside nested containers.
window.addEventListener('pointerdown', (e) => {
  if (menuEl && !menuEl.contains(e.target as Node)) closeMenu();
});
window.addEventListener('scroll', closeMenu, true);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu();
});

/** Attach the copy-id / copy-image context menu to a card tile. */
export function attachCardMenu(figure: HTMLElement, card: Dashboard): void {
  figure.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openMenu(card, e.clientX, e.clientY);
  });
}
