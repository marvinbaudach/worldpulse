// Dev-only review gallery — shared helpers: the card list, its category
// metadata, filter/sort, and a canvas draw with an on-error fallback box.
// Not part of the app bundle (served only via gallery.html; see gallery.ts).

import { POOL } from '../dashboards/cards';
// Importing the registry runs its side effects, which assign `tags` and `added`
// onto the very POOL objects read below (ES modules share one instance), so the
// gallery sees the same metadata the app does.
import { TAGS } from '../dashboards';
import type { Dashboard } from '../dashboards/types';
import { SETTLED_T } from '../dashboards/types';

export interface CardEntry {
  card: Dashboard;
  /** Stable index into POOL — matches the definition order in cards.ts. */
  idx: number;
  /** First theme tag, or UNTAGGED when the card carries none. */
  primaryTag: string;
}

export interface Category {
  label: string;
  accent: string;
}

/** Synthetic category id for cards without any theme tag. */
export const UNTAGGED = 'ohne';

/** tagId → chip label + accent, plus the synthetic entry for untagged cards. */
export const CATEGORIES: Map<string, Category> = new Map<string, Category>([
  ...TAGS.map((t) => [t.id, { label: t.label, accent: t.accent }] as const),
  [UNTAGGED, { label: 'OHNE', accent: '#6b7280' }],
]);

/** Rank of each tag in the chip order, for the "category" sort. */
const TAG_ORDER = new Map(TAGS.map((t, i) => [t.id, i]));

export function buildEntries(): CardEntry[] {
  return POOL.map((card, idx) => ({
    card,
    idx,
    primaryTag: card.tags?.[0] ?? UNTAGGED,
  }));
}

export type SortKey = 'newest' | 'category' | 'id';

export interface FilterState {
  query: string;
  /** '' = all categories, else a tag id or UNTAGGED. */
  category: string;
  sort: SortKey;
}

export function filterSort(entries: CardEntry[], s: FilterState): CardEntry[] {
  const q = s.query.trim().toLowerCase();
  const filtered = entries.filter((e) => {
    if (s.category && e.primaryTag !== s.category) return false;
    if (!q) return true;
    return e.card.id.toLowerCase().includes(q) || e.card.title.toLowerCase().includes(q);
  });

  const sorted = [...filtered];
  if (s.sort === 'newest') {
    sorted.sort((a, b) => (b.card.added ?? '').localeCompare(a.card.added ?? ''));
  } else if (s.sort === 'category') {
    const rank = (e: CardEntry) => TAG_ORDER.get(e.primaryTag) ?? TAGS.length;
    sorted.sort((a, b) => rank(a) - rank(b) || a.idx - b.idx);
  } else {
    sorted.sort((a, b) => a.card.id.localeCompare(b.card.id));
  }
  return sorted;
}

/** Draw a card into a canvas at w×h; paints an error box if draw() throws so a
    broken card is visible in the grid instead of silently blank. */
export function drawCard(canvas: HTMLCanvasElement, card: Dashboard, w: number, h: number): void {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try {
    card.draw({ ctx, w, h, t: SETTLED_T, u: w / 512 });
  } catch (err) {
    ctx.fillStyle = '#3a0d0d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '16px monospace';
    ctx.fillText(`draw() threw: ${String(err)}`.slice(0, 54), 16, 32);
  }
}
