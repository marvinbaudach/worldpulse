// Dev-only review gallery — the lightbox: a full 768×960 render of one card
// alongside its metadata, with prev/next to walk the current filtered set.

import { downloadCard } from '../exportCard';
import { drawCard, type CardEntry, type Category } from './galleryData';

const FULL_W = 768;
const FULL_H = 960;

export interface Lightbox {
  open(list: CardEntry[], index: number): void;
  /** Redraw the currently shown card (e.g. after live data lands). */
  redraw(): void;
  /** Whether the lightbox is currently open (owns the arrow keys). */
  isOpen(): boolean;
}

function addRow(parent: HTMLElement, key: string, value: string): void {
  const row = document.createElement('div');
  row.className = 'row';
  const k = document.createElement('span');
  k.className = 'k';
  k.textContent = `${key} `;
  row.appendChild(k);
  row.appendChild(document.createTextNode(value));
  parent.appendChild(row);
}

export function createLightbox(categoryOf: (tag: string) => Category | undefined): Lightbox {
  const root = document.getElementById('lb') as HTMLDivElement;
  const canvas = document.getElementById('lbCanvas') as HTMLCanvasElement;
  const info = document.getElementById('lbInfo') as HTMLDivElement;
  const btnClose = document.getElementById('close') as HTMLButtonElement;
  const btnDownload = document.getElementById('download') as HTMLButtonElement;
  const btnPrev = document.getElementById('prev') as HTMLButtonElement;
  const btnNext = document.getElementById('next') as HTMLButtonElement;

  let list: CardEntry[] = [];
  let pos = 0;
  let isOpen = false;

  function render(): void {
    const entry = list[pos];
    if (!entry) return;
    drawCard(canvas, entry.card, FULL_W, FULL_H);

    const cat = categoryOf(entry.primaryTag);
    info.replaceChildren();

    const h2 = document.createElement('h2');
    h2.textContent = entry.card.title;
    info.appendChild(h2);

    const rows = document.createElement('div');
    addRow(rows, 'id', entry.card.id);
    addRow(rows, '#', String(entry.idx));
    addRow(rows, 'Kategorie', cat ? cat.label : '—');
    addRow(rows, 'hinzugefügt', entry.card.added ? entry.card.added.slice(0, 16).replace('T', ' ') : '—');
    addRow(rows, 'tags', entry.card.tags?.length ? entry.card.tags.join(' · ') : '—');
    addRow(rows, 'Position', `${pos + 1} / ${list.length}`);
    info.appendChild(rows);

    if (entry.card.source) {
      const src = document.createElement('div');
      src.className = 'src';
      src.textContent = entry.card.source;
      info.appendChild(src);
    }
  }

  function show(i: number): void {
    if (!list.length) return;
    pos = (i + list.length) % list.length;
    render();
  }

  function close(): void {
    isOpen = false;
    root.classList.remove('open');
  }

  // Reuse the app's poster export (1080×1350, source stamped in) so the QA
  // download is byte-for-byte what the mobile deck's share/save produces.
  async function download(): Promise<void> {
    const entry = list[pos];
    if (!entry || btnDownload.disabled) return;
    btnDownload.disabled = true;
    try {
      await downloadCard(entry.card);
    } catch (err) {
      console.error('Card-Export fehlgeschlagen', err);
    } finally {
      btnDownload.disabled = false;
    }
  }

  btnClose.addEventListener('click', close);
  btnDownload.addEventListener('click', () => void download());
  btnPrev.addEventListener('click', () => show(pos - 1));
  btnNext.addEventListener('click', () => show(pos + 1));
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(pos - 1);
    else if (e.key === 'ArrowRight') show(pos + 1);
  });

  return {
    open(l, index) {
      list = l;
      isOpen = true;
      root.classList.add('open');
      show(index);
    },
    redraw() {
      if (isOpen) render();
    },
    isOpen() {
      return isOpen;
    },
  };
}
