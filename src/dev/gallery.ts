// Dev-only QA/review harness: renders every card into a filterable, sortable
// grid of thumbnails, with a lightbox for full-size inspection and optional
// live-data loading. Served only via gallery.html in `npm run dev`
// (`npm run gallery` opens it directly) — never part of the app bundle, since
// Vite builds only index.html. Cards fall back to the settled/offline look
// until (and unless) the live fetchers land real data.

import { live, onLiveUpdate } from '../data/store';
import { loadLiveData } from '../data/sources';
import { WORLD } from '../data/world';
import {
  buildEntries,
  filterSort,
  drawCard,
  CATEGORIES,
  type CardEntry,
  type FilterState,
} from './galleryData';
import { createLightbox } from './galleryLightbox';

// The real app assigns the bundled country outlines synchronously in
// loadLiveData(); mirror that here so every choropleth/region map has something
// to draw before (and without) any fetch.
live.worldMap = WORLD;

const grid = document.getElementById('grid') as HTMLDivElement;
const searchInput = document.getElementById('q') as HTMLInputElement;
const catSelect = document.getElementById('cat') as HTMLSelectElement;
const sortSelect = document.getElementById('sort') as HTMLSelectElement;
const sizeSelect = document.getElementById('size') as HTMLSelectElement;
const liveToggle = document.getElementById('live') as HTMLInputElement;
const countLabel = document.getElementById('count') as HTMLSpanElement;

const entries = buildEntries();
const lightbox = createLightbox((tag) => CATEGORIES.get(tag));

interface Mounted {
  entry: CardEntry;
  canvas: HTMLCanvasElement;
}
let mounted: Mounted[] = [];
let thumbW = Number(sizeSelect.value);

// Panel aspect ratio (native 768×960); thumbnails scale to the chosen width.
const FULL_RATIO = 960 / 768;
const thumbH = (): number => Math.round(thumbW * FULL_RATIO);

function currentFilter(): FilterState {
  return {
    query: searchInput.value,
    category: catSelect.value,
    sort: sortSelect.value as FilterState['sort'],
  };
}

/** Populate the category dropdown with only the categories that hold cards, in
    chip order, each with its count. */
function buildCategoryOptions(): void {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.primaryTag, (counts.get(e.primaryTag) ?? 0) + 1);

  const all = document.createElement('option');
  all.value = '';
  all.textContent = `alle (${entries.length})`;
  catSelect.appendChild(all);

  for (const [id, cat] of CATEGORIES) {
    const n = counts.get(id);
    if (!n) continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${cat.label.toLowerCase()} (${n})`;
    catSelect.appendChild(opt);
  }
}

function makeFigure(entry: CardEntry, list: CardEntry[], h: number): HTMLElement {
  const figure = document.createElement('figure');

  const canvas = document.createElement('canvas');
  drawCard(canvas, entry.card, thumbW, h);
  figure.appendChild(canvas);

  const cap = document.createElement('figcaption');
  const top = document.createElement('div');
  top.className = 'top';
  const idx = document.createElement('span');
  idx.className = 'idx';
  idx.textContent = `#${entry.idx} `;
  top.appendChild(idx);
  top.appendChild(document.createTextNode(entry.card.id));
  cap.appendChild(top);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const cat = CATEGORIES.get(entry.primaryTag);
  if (cat) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = cat.accent;
    chip.textContent = cat.label.toLowerCase();
    meta.appendChild(chip);
  }
  const date = document.createElement('span');
  date.textContent = entry.card.added ? entry.card.added.slice(0, 10) : '—';
  meta.appendChild(date);
  cap.appendChild(meta);
  figure.appendChild(cap);

  figure.addEventListener('click', () => lightbox.open(list, list.indexOf(entry)));

  mounted.push({ entry, canvas });
  return figure;
}

function render(): void {
  grid.style.setProperty('--tw', `${thumbW}px`);
  const list = filterSort(entries, currentFilter());
  const h = thumbH();
  mounted = [];

  const frag = document.createDocumentFragment();
  for (const entry of list) frag.appendChild(makeFigure(entry, list, h));
  grid.replaceChildren(frag);

  countLabel.textContent = `${list.length} Karten`;
}

// Coalesce live-update bursts into a single redraw of the visible thumbnails.
let redrawQueued = false;
function scheduleRedraw(): void {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    const h = thumbH();
    for (const m of mounted) drawCard(m.canvas, m.entry.card, thumbW, h);
    lightbox.redraw();
  });
}

// Controls.
searchInput.addEventListener('input', render);
catSelect.addEventListener('change', render);
sortSelect.addEventListener('change', render);
sizeSelect.addEventListener('change', () => {
  thumbW = Number(sizeSelect.value);
  render();
});

// Live data: start the fetchers once when enabled, and redraw as datasets land.
let fetchStarted = false;
function maybeStartLive(): void {
  if (liveToggle.checked && !fetchStarted) {
    fetchStarted = true;
    loadLiveData();
  }
}
liveToggle.addEventListener('change', maybeStartLive);
onLiveUpdate(() => {
  if (liveToggle.checked) scheduleRedraw();
});

buildCategoryOptions();
render();
maybeStartLive();

// Importing the card renderers pulls in i18n, whose module side effect sets
// document.title to the app's — override it so the QA tab stays identifiable.
document.title = `Card Gallery · QA (${entries.length})`;

// Signal for screenshot tooling that the first (settled) render is done.
document.documentElement.setAttribute('data-ready', 'true');
