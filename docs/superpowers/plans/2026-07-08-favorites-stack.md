# Favorites Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can star dashboard cards and view them as their own FAVORITEN deck on mobile and desktop, persisted in localStorage.

**Architecture:** A tiny pub/sub localStorage store (`src/favorites.ts`) + `useFavorites()` hook feed a dynamic pseudo-tag `favoriten` layered into the existing TAGS/filter system. Mobile shows the full favorites list; the desktop ring computes its card set dynamically (capped at `RING_MAX`) instead of the static `RING_BY_TAG`.

**Tech Stack:** React 19, styled-components, `useSyncExternalStore`, existing i18n (`t()`), oxlint + `tsc -b` (no test framework in repo — CI is lint + build).

**Verification note:** The repo has no unit-test framework and CI runs `npm run lint` + `npm run build` only. Each task gates on those two commands plus targeted browser QA at the end (headless Chrome only, per user preference).

**Commit constraint:** The working tree contains unrelated uncommitted WIP from a parallel session in `MobileDeck.tsx`, `SwipeDeck.tsx`, `dashboards/index.ts`, and the `i18n/*.ts` files. Stage **file-by-file, never `git add -A`**. New files (`favorites.ts`, `useFavorites.ts`, docs) are committed normally. For shared files, committing would sweep in the foreign WIP — leave them uncommitted at the end and report this to the user instead of committing mixed content.

---

### Task 1: Favorites store + hook

**Files:**
- Create: `src/favorites.ts`
- Create: `src/hooks/useFavorites.ts`

- [ ] **Step 1: Write the store**

`src/favorites.ts`:

```ts
// Persistent favorites: card ids in the order they were starred. Backed by
// localStorage with a silent in-memory fallback (private-mode Safari), and a
// tiny pub/sub in the same shape as data/store.ts. Ids of cards that have
// since left the pool are dropped on load.
import { ALL_DASHBOARDS } from './dashboards';

const KEY = 'worldpulse-favorites';
const KNOWN = new Set(ALL_DASHBOARDS.map((d) => d.id));

function load(): readonly string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && KNOWN.has(id));
  } catch {
    return [];
  }
}

let favorites: readonly string[] = load();
const listeners = new Set<() => void>();

/** Stable reference between changes — safe for useSyncExternalStore. */
export function getFavorites(): readonly string[] {
  return favorites;
}

export function isFavorite(id: string): boolean {
  return favorites.includes(id);
}

export function toggleFavorite(id: string): void {
  favorites = favorites.includes(id)
    ? favorites.filter((f) => f !== id)
    : [...favorites, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(favorites));
  } catch {
    // Storage unavailable (private mode / quota): keep working in memory.
  }
  for (const fn of listeners) fn();
}

export function onFavoritesChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

- [ ] **Step 2: Write the hook**

`src/hooks/useFavorites.ts`:

```ts
import { useSyncExternalStore } from 'react';
import { getFavorites, onFavoritesChange } from '../favorites';

/** Reactive favorites id list (insertion order). */
export function useFavorites(): readonly string[] {
  return useSyncExternalStore(onFavoritesChange, getFavorites);
}
```

- [ ] **Step 3: Verify** — `npm run lint` passes; `npx tsc -b --noEmit` type-checks (full `npm run build` also acceptable).

- [ ] **Step 4: Commit (new files only)**

```bash
git add src/favorites.ts src/hooks/useFavorites.ts
git commit -m "feat: add persistent favorites store and hook" -- src/favorites.ts src/hooks/useFavorites.ts
```

---

### Task 2: Register the FAVORITEN tag + id lookup

**Files:**
- Modify: `src/dashboards/index.ts` (TAGS array ~line 18-32, RING_BY_TAG ~line 367)

- [ ] **Step 1: Add the tag** — append to `TAGS` (LAST, after `neu`, so `TAGS[0]` stays the `geld` default):

```ts
  // Personal stack: gets its cards from the favorites store at runtime, so it
  // has no static pool entry (see RING_BY_TAG below). Shares gold with GELD —
  // the palette is fixed (CVD-validated), and gold matches the star.
  { id: 'favoriten', label: 'FAVORITEN', accent: SERIES[2] }, // gold
```

This automatically makes `useTagFilter` accept `?filter=favoriten` (its `VALID` set derives from `TAGS`).

- [ ] **Step 2: Export an id lookup** — after the `ALL_DASHBOARDS` definition:

```ts
/** Card lookup for runtime-assembled decks (the favorites stack). */
export const DASHBOARDS_BY_ID: Record<string, Dashboard> = Object.fromEntries(
  POOL.map((d) => [d.id, d]),
);
```

- [ ] **Step 3: Exclude favorites from the static ring map** — change the `RING_BY_TAG` builder to skip it (its cards come from the store at runtime):

```ts
export const RING_BY_TAG: Record<string, Dashboard[]> = Object.fromEntries(
  TAGS.filter((t) => t.id !== 'favoriten').map((t) => [
    t.id,
    t.id === 'neu'
      ? NEWEST.slice(0, RING_MAX)
      : clustered(POOL.filter((d) => d.tags?.includes(t.id))).slice(0, RING_MAX),
  ]),
);
```

- [ ] **Step 4: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Do NOT commit (shared file with foreign WIP — see commit constraint).

---

### Task 3: Mobile — star button on the card + chip + deck

**Files:**
- Modify: `src/components/SwipeDeck.tsx` (star overlay on the current card)
- Modify: `src/components/MobileDeck.tsx` (deck assembly, chip visibility, empty fallback)

- [ ] **Step 1: Star overlay in SwipeDeck** — add imports:

```ts
import { toggleFavorite } from '../favorites';
import { useFavorites } from '../hooks/useFavorites';
import { t as trans } from '../i18n';
import { SERIES } from '../dashboards/theme';
import { glassSurface } from './glass';
```

Add the styled button (near the other styled defs):

```ts
// Star toggle riding the active card's top-right corner. Lives in the DOM, not
// the canvas texture, so toggling never forces a card redraw. pointerdown is
// stopped so a tap here can never arm the swipe drag underneath.
const FavButton = styled.button<{ $active: boolean }>`
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 5;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 999px;
  color: ${(p) => (p.$active ? SERIES[2] : 'rgba(255, 255, 255, 0.7)')};
  font: 600 18px/1 inherit;
  cursor: pointer;
  ${glassSurface}
`;
```

In the component body (after `const cur = dashboards[index];` block resolves, before `return`):

```ts
const favoriteIds = useFavorites();
const curFav = cur ? favoriteIds.includes(cur.id) : false;
```

NOTE: hooks must run unconditionally — place `useFavorites()` with the other hooks at the top of the component, before the `if (!cur) return <Stack />;` early return.

Inside the current `<Card key={cur.id} …>` element, after `<CardCanvas …/>`:

```tsx
<FavButton
  $active={curFav}
  aria-pressed={curFav}
  aria-label={trans(curFav ? 'Favorit entfernen' : 'Zu Favoriten')}
  onPointerDown={(e) => e.stopPropagation()}
  onClick={() => {
    hapticTick();
    toggleFavorite(cur.id);
  }}
>
  <span aria-hidden>{curFav ? '★' : '☆'}</span>
</FavButton>
```

- [ ] **Step 2: Deck assembly in MobileDeck** — add imports `DASHBOARDS_BY_ID` (from `../dashboards`), `getFavorites` (from `../favorites`), `useFavorites` (from `../hooks/useFavorites`). Replace the `dashboards` memo:

```ts
// FAVORITEN is a snapshot taken when the chip is picked: un-starring while
// browsing must not yank cards out from under the swipe. NEU shows the whole
// pool newest-first; every other chip filters the clustered deck as usual.
const dashboards = useMemo(() => {
  if (tag === 'favoriten') {
    return getFavorites()
      .map((id) => DASHBOARDS_BY_ID[id])
      .filter((d): d is Dashboard => d !== undefined);
  }
  return tag === 'neu' ? NEWEST : ALL_DASHBOARDS.filter((d) => d.tags?.includes(tag));
}, [tag]);
```

(`Dashboard` type import: `import type { Dashboard } from '../dashboards';`)

- [ ] **Step 3: Chip visibility + empty fallback** in MobileDeck:

```ts
const favoriteIds = useFavorites();
// The FAVORITEN chip only exists once something is starred; if the active
// filter empties out (last favorite removed), fall back to the default theme.
const visibleTags = TAGS.filter((t) => t.id !== 'favoriten' || favoriteIds.length > 0);
useEffect(() => {
  if (tag === 'favoriten' && favoriteIds.length === 0) setTag(TAGS[0].id);
}, [tag, favoriteIds, setTag]);
```

In the filter `<Sheet>`, render `visibleTags.map(...)` instead of `TAGS.map(...)`. Also guard the active-tag lookup fallback (already `?? TAGS[0]`, unchanged).

- [ ] **Step 4: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Do NOT commit (shared files).

---

### Task 4: Desktop — hero star + chip + dynamic ring

**Files:**
- Modify: `src/components/Carousel3D.tsx`
- Modify: `src/components/LayoutControls.tsx`

- [ ] **Step 1: Chip visibility in LayoutControls** — import `useFavorites`; inside the component:

```ts
const favoriteIds = useFavorites();
const visibleTags = TAGS.filter((t) => t.id !== 'favoriten' || favoriteIds.length > 0);
```

Render `visibleTags.map(...)` where `TAGS.map(...)` is now (~line 80).

- [ ] **Step 2: Dynamic favorites ring in Carousel3D** — add imports: `DASHBOARDS_BY_ID` (extend the existing `../dashboards` import), `getFavorites, toggleFavorite` from `../favorites`, `useFavorites` from `../hooks/useFavorites`, `t as tr` from `../i18n`, `SERIES` from `../dashboards/theme`, and `type Dashboard` if not already imported. Replace the `dashboards` memo (~line 371):

```ts
// Favorites are assembled at stage time from the store (snapshot per theme
// switch — starring/unstarring mid-scene must not restructure the live ring);
// every other theme uses the capped, per-load rotated static selection.
const dashboards = useMemo(
  () =>
    stageTag === 'favoriten'
      ? getFavorites()
          .slice(0, RING_MAX)
          .map((id) => DASHBOARDS_BY_ID[id])
          .filter((d): d is Dashboard => d !== undefined)
      : (RING_BY_TAG[stageTag] ?? []),
  [stageTag],
);
```

- [ ] **Step 3: Empty fallback** — near the tag state:

```ts
const favoriteIds = useFavorites();
// The FAVORITEN chip vanishes when the last star is removed; if that theme is
// active at that moment, glide back to the default one.
useEffect(() => {
  if (tag === 'favoriten' && favoriteIds.length === 0) setTag(DEFAULT_TAG);
}, [tag, favoriteIds, setTag]);
```

- [ ] **Step 4: Hero star button** — styled def next to `HeroExportButton`:

```ts
// Star toggle in the hero footer: adds/removes the open card from the
// favorites stack. Gold when active — the same SERIES slot the FAVORITEN
// chip carries.
const HeroFavButton = styled.button<{ $active: boolean }>`
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  color: ${(p) => (p.$active ? SERIES[2] : 'rgba(255, 255, 255, 0.8)')};
  font: 600 15px/1 inherit;
  cursor: pointer;
  ${glassSurface}
`;
```

In the `<HeroSourceDock>` block, before `<HeroExportButton …>`:

```tsx
<HeroFavButton
  $active={favoriteIds.includes(selectedDashboard.id)}
  aria-pressed={favoriteIds.includes(selectedDashboard.id)}
  aria-label={tr(favoriteIds.includes(selectedDashboard.id) ? 'Favorit entfernen' : 'Zu Favoriten')}
  title={tr(favoriteIds.includes(selectedDashboard.id) ? 'Favorit entfernen' : 'Zu Favoriten')}
  onClick={() => toggleFavorite(selectedDashboard.id)}
>
  <span aria-hidden>{favoriteIds.includes(selectedDashboard.id) ? '★' : '☆'}</span>
</HeroFavButton>
```

(Extract `const heroFav = favoriteIds.includes(selectedDashboard.id);` inline above the JSX is not possible — the dock renders inside a conditional; compute it in the JSX via a local within the block or accept the repeated call. Preferred: wrap the dock content in an IIFE-free way by computing `const heroFav = selectedDashboard ? favoriteIds.includes(selectedDashboard.id) : false;` next to `selectedDashboard` (~line 545) and using `heroFav` in the JSX.)

- [ ] **Step 5: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Do NOT commit (shared files).

---

### Task 5: i18n dictionaries

**Files:**
- Modify: `src/i18n/en.ts`, `src/i18n/fr.ts`, `src/i18n/it.ts` (alphabetical position within each dict)

- [ ] **Step 1: Add keys**

en.ts:
```ts
  'FAVORITEN': 'FAVORITES',
  'Favorit entfernen': 'Remove favorite',
  'Zu Favoriten': 'Add to favorites',
```

fr.ts:
```ts
  'FAVORITEN': 'FAVORIS',
  'Favorit entfernen': 'Retirer des favoris',
  'Zu Favoriten': 'Ajouter aux favoris',
```

it.ts:
```ts
  'FAVORITEN': 'PREFERITI',
  'Favorit entfernen': 'Rimuovi dai preferiti',
  'Zu Favoriten': 'Aggiungi ai preferiti',
```

- [ ] **Step 2: Verify** — `npm run lint`. Do NOT commit (shared files).

---

### Task 6: Full verification + handoff

- [ ] **Step 1:** `npm run lint` — expect clean exit.
- [ ] **Step 2:** `npm run build` — expect type-checked build success.
- [ ] **Step 3: Browser QA (headless Chrome), mobile viewport (390×844)** against the running dev server (http://localhost:5173/):
  1. Load → star the front card (☆ → ★, gold).
  2. Open the filter sheet → FAVORITEN chip present → pick it → deck shows exactly the starred card(s).
  3. Star a second card in another theme → FAVORITEN shows both, in starred order.
  4. In FAVORITEN, unstar down to zero → view falls back to the default theme, chip gone, no crash.
  5. Reload → favorites persisted.
- [ ] **Step 4: Browser QA, desktop viewport (1440×900):** open a hero card → ☆ in the footer dock → click → ★ gold; FAVORITEN chip appears in the theme bar; switch to it → ring shows the favorites; reload persists.
- [ ] **Step 5:** Commit the plan document only, then report: which files remain uncommitted (shared with foreign WIP) and that the user may want separate commits.

```bash
git add docs/superpowers/plans/2026-07-08-favorites-stack.md
git commit -m "docs: add favorites stack implementation plan" -- docs/superpowers/plans/2026-07-08-favorites-stack.md
```
