# Desktop-Gallery / Mobile-App Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the card gallery as the production desktop UI (calm aubergine backdrop, skeletons + progress, no loader, no 3D carousel), while the mobile/tablet deck + loader stay byte-for-behaviour identical — split cleanly into two lazy-loaded chunks.

**Architecture:** `App.tsx` is a thin device switch (`useIsMobile()` + `?view=` override) that lazy-loads exactly one experience: `MobileApp` (today's loader + `MobileDeck`) or `DesktopApp` (gallery). The desktop chunk carries no `three`/R3F; the entire WebGL carousel scene is retired. One Vite build, one deploy, one PWA.

**Tech Stack:** React 19, TypeScript, Vite 8, styled-components, vitest, Playwright, oxlint. Canvas-2D card rendering (unchanged).

## Global Constraints

- **Branch:** `feat/desktop-gallery-split` (already created; base `main`).
- **Colors from `src/dashboards/theme.ts` only** — the backdrop's per-category tint uses `TAGS[].accent` (already `SERIES`-derived); never hand-pick hex.
- **Mobile/tablet behaviour must not change** — `MobileApp` wraps today's path verbatim; the only prior change (enlarged `FavPill`/`DeckActionMenu` icons) stays.
- **i18n:** any new/changed German UI string needs the same key in `src/i18n/{en,fr,it}.ts` or `src/i18n/identical.ts`; the coverage guard fails the build otherwise.
- **Animation:** compositor-friendly (`transform`/`opacity`/`background-position`); every motion respects `@media (prefers-reduced-motion: reduce)`.
- **React:** typed props via `type`/`interface`, infer return type, no `React.FC`.
- **`import/no-cycle` is an error;** mind the `dashboards` ↔ `data` boundary.
- **Lint/build gates:** `npm run lint` (oxlint) clean; `npm run build` (`tsc -b && vite build`) clean — this is what CI runs.
- **Keep `base: './'`** in `vite.config.ts` and the PWA files (`public/manifest.webmanifest`, `public/sw.js`) untouched.
- **Breakpoint stays:** `MOBILE_QUERY = '(max-width: 820px), (pointer: coarse)'` (tablets = mobile experience).

---

## File Structure

**New files**
- `src/mobile/MobileApp.tsx` — today's mobile path (boot beat, `loadLiveData`, `LoadingScreen`, `MobileDeck`).
- `src/desktop/DesktopApp.tsx` — gallery shell: backdrop + gallery + skeletons/progress, no loader.
- `src/desktop/gallery/AubergineBackdrop.tsx` — CSS aubergine gradient, slow drift, per-category tint.
- `src/desktop/gallery/GallerySkeletons.tsx` — skeleton grid + top progress bar.
- `src/desktop/gallery/progress.ts` — pure `progressPct()` helper (+ test).
- `src/hooks/viewOverride.ts` — `readViewOverride()` (+ test).

**Moved (from `src/dev/` → `src/desktop/gallery/`)**
- `DevGallery.tsx` → `Gallery.tsx` (dev-only props/toggles removed)
- `GalleryGrid.tsx`, `GalleryThumb.tsx`, `GalleryLightbox.tsx`, `GalleryToolbar.tsx`,
  `GalleryCardMenu.tsx`, `GlassSelect.tsx`, `galleryData.ts`, `galleryChrome.ts`

**Modified**
- `src/hooks/useIsMobile.ts` — honour `readViewOverride()`.
- `src/App.tsx` — device switch + lazy chunks; remove carousel/loader/gallery-toggle.
- `package.json` — `dev:mobile` / `dev:desktop` scripts; drop `three`/R3F deps (after grep).

**Deleted (retire the R3F carousel scene)**
- `src/components/Carousel3D.tsx`, `CarouselItem.tsx`, `HeroCard.tsx`, `HeroScrim.tsx`,
  `Aurora.tsx`, `Afterglow.tsx`, `Dust.tsx`, `CameraRig.tsx`, `ClockContinuity.tsx`, `PerfHud.tsx`,
  `DevGalleryLink.tsx`
- `src/hooks/useCarouselRotation.ts` (+ test), `src/hooks/useDashboardTexture.ts` (+ test)
- `src/dashboards/texture.ts`
- `src/dev/GalleryBackdrop.tsx` (WebGL; replaced by `AubergineBackdrop`)
- the now-empty `src/dev/` directory

---

## Task 1: `?view=` override in device detection

**Files:**
- Create: `src/hooks/viewOverride.ts`
- Create: `src/hooks/viewOverride.test.ts`
- Modify: `src/hooks/useIsMobile.ts`

**Interfaces:**
- Produces: `readViewOverride(): 'mobile' | 'desktop' | null` — reads `?view=` from `window.location.search`.
- `useIsMobile()` return unchanged (`boolean`), but override wins when present.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/viewOverride.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readViewOverride } from './viewOverride';

function setSearch(search: string): void {
  vi.stubGlobal('window', { location: { search } } as unknown as Window);
}

afterEach(() => vi.unstubAllGlobals());

describe('readViewOverride', () => {
  it('returns null with no param', () => {
    setSearch('');
    expect(readViewOverride()).toBeNull();
  });
  it('reads view=mobile', () => {
    setSearch('?view=mobile');
    expect(readViewOverride()).toBe('mobile');
  });
  it('reads view=desktop', () => {
    setSearch('?view=desktop&foo=1');
    expect(readViewOverride()).toBe('desktop');
  });
  it('ignores unknown values', () => {
    setSearch('?view=watch');
    expect(readViewOverride()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/hooks/viewOverride.test.ts`
Expected: FAIL — cannot resolve `./viewOverride`.

- [ ] **Step 3: Implement `readViewOverride`**

```ts
// src/hooks/viewOverride.ts
export type ViewOverride = 'mobile' | 'desktop';

/** Force a specific experience for previewing, regardless of the device:
    `?view=mobile` or `?view=desktop`. Any other value (or none) → null. */
export function readViewOverride(): ViewOverride | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('view');
  return v === 'mobile' || v === 'desktop' ? v : null;
}
```

- [ ] **Step 4: Wire the override into `useIsMobile`**

In `src/hooks/useIsMobile.ts`, import the helper and let it win. Replace the body of `useIsMobile` so the override short-circuits the media query:

```ts
import { useEffect, useState } from 'react';
import { readViewOverride } from './viewOverride';

export const MOBILE_QUERY = '(max-width: 820px), (pointer: coarse)';
const QUERY = MOBILE_QUERY;

function match(): boolean {
  const override = readViewOverride();
  if (override) return override === 'mobile';
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

/** True on touch phones / small screens (or forced via `?view=`), re-evaluated
    on viewport changes. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(match);

  useEffect(() => {
    if (readViewOverride()) return; // forced — ignore viewport changes
    const mq = window.matchMedia(QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/hooks/viewOverride.test.ts && npx tsc -b`
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/viewOverride.ts src/hooks/viewOverride.test.ts src/hooks/useIsMobile.ts
git commit -m "feat(routing): ?view= override for the device switch"
```

---

## Task 2: Extract `MobileApp` (encapsulate today's mobile path)

**Files:**
- Create: `src/mobile/MobileApp.tsx`
- Modify: `src/App.tsx` (render `<MobileApp/>` on the mobile branch)

**Interfaces:**
- Produces: `export default function MobileApp()` — self-contained mobile experience (loader + deck + boot beat + `loadLiveData`).

- [ ] **Step 1: Create `MobileApp` with today's mobile behaviour**

```tsx
// src/mobile/MobileApp.tsx
import { useEffect, useState } from 'react';
import { MobileDeck } from '../components/MobileDeck';
import { LoadingScreen } from '../components/loading/LoadingScreen';
import { loadLiveData } from '../data/sources';
import { LOCALE, onLocaleChange, ensureLocaleReady } from '../i18n';

// Same staged boot beat the app used before the split: give the loader one
// beat while the live-data fetches race ahead, hold it until the dictionary is
// ready so a panel never flashes German for a non-German visitor.
const BOOT_MS = 2400;

export default function MobileApp() {
  const [done, setDone] = useState(false);
  const [locale, setLocaleState] = useState(LOCALE);
  useEffect(() => onLocaleChange(setLocaleState), []);

  const [dictReady, setDictReady] = useState(LOCALE === 'de');
  useEffect(() => {
    let alive = true;
    void (async () => {
      await ensureLocaleReady();
      if (alive) setDictReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const [showLoader, setShowLoader] = useState(true);
  useEffect(() => {
    loadLiveData();
    const id = setTimeout(() => setDone(true), BOOT_MS);
    return () => clearTimeout(id);
  }, []);

  const ready = done && dictReady;

  return (
    <>
      {ready && <MobileDeck key={locale} />}
      {showLoader && <LoadingScreen done={ready} onExited={() => setShowLoader(false)} />}
    </>
  );
}
```

- [ ] **Step 2: Point `App.tsx`'s mobile branch at `MobileApp` (temporary, non-lazy)**

In `src/App.tsx`, import `MobileApp` and render it where the mobile branch used to inline `MobileDeck`. Leave the desktop carousel branch untouched for now (still builds). Minimal change — replace the mobile side of the ternary at line 132 area:

```tsx
import MobileApp from './mobile/MobileApp';
// ...
{ready && (isMobile ? <MobileApp /> : <Carousel3D paused={showGallery} />)}
```

(The `App`-level `ready`/loader still wraps the desktop path; the mobile path now owns its own loader inside `MobileApp`. To avoid a double loader on mobile, gate the `App`-level `LoadingScreen`/boot to desktop only in this step — set `showLoader` init to `!galleryInUrl() && !isMobile` and skip the mobile branch's dependence on `App`'s `ready`. Simplest: on the mobile branch render `<MobileApp/>` unconditionally and let `App`'s `ready`/loader apply only to desktop.)

Concretely, change the render block to:

```tsx
{isMobile ? (
  <MobileApp />
) : (
  <>
    {ready && <Carousel3D paused={showGallery} />}
    {!showGallery && <PerfHud />}
    {!showGallery && <DevGalleryLink onOpen={() => setShowGallery(true)} />}
  </>
)}
{!isMobile && showLoader && <LoadingScreen done={ready} onExited={() => setShowLoader(false)} />}
```

and set `const [showLoader, setShowLoader] = useState(() => !galleryInUrl());` (unchanged) — it is now only rendered on desktop.

- [ ] **Step 3: Build + existing tests as guardrail**

Run: `npm run build && npm run test`
Expected: build clean; all tests pass (`cards.smoke`, `i18n.coverage`, etc.).

- [ ] **Step 4: Headless check — mobile unchanged**

```bash
npm run dev &   # note the port
```
Drive Chrome at 390×844 → confirm the loader plays then the deck appears exactly as before. Screenshot. Kill dev.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/MobileApp.tsx src/App.tsx
git commit -m "refactor(mobile): extract MobileApp wrapping today's loader + deck"
```

---

## Task 3: Promote the gallery to `src/desktop/gallery/` (productionise)

**Files:**
- Move: `src/dev/{DevGallery→Gallery,GalleryGrid,GalleryThumb,GalleryLightbox,GalleryToolbar,GalleryCardMenu,GlassSelect}.tsx` and `{galleryData,galleryChrome}.ts` → `src/desktop/gallery/`
- Modify: moved files' imports (`../` → `../../` for `src/`-root reaches) and `Gallery.tsx` (drop dev-only props)

**Interfaces:**
- Produces: `export default function Gallery(props: GalleryProps)` where
  `type GalleryProps = { onThumbRendered?: (id: string) => void }` — no more
  `active`/`onClose` (there is no carousel to fade to/from).

- [ ] **Step 1: Move the files with git**

```bash
mkdir -p src/desktop/gallery
git mv src/dev/DevGallery.tsx     src/desktop/gallery/Gallery.tsx
git mv src/dev/GalleryGrid.tsx    src/desktop/gallery/GalleryGrid.tsx
git mv src/dev/GalleryThumb.tsx   src/desktop/gallery/GalleryThumb.tsx
git mv src/dev/GalleryLightbox.tsx src/desktop/gallery/GalleryLightbox.tsx
git mv src/dev/GalleryToolbar.tsx src/desktop/gallery/GalleryToolbar.tsx
git mv src/dev/GalleryCardMenu.tsx src/desktop/gallery/GalleryCardMenu.tsx
git mv src/dev/GlassSelect.tsx    src/desktop/gallery/GlassSelect.tsx
git mv src/dev/galleryData.ts     src/desktop/gallery/galleryData.ts
git mv src/dev/galleryChrome.ts   src/desktop/gallery/galleryChrome.ts
```

- [ ] **Step 2: Fix imports (one level deeper)**

The folder went from depth 2 (`src/dev/`) to depth 3 (`src/desktop/gallery/`). Every import that reached the `src/` root gains one `../`. Intra-folder (`./…`) imports are unchanged. Apply across the moved files:

```bash
# Rewrite root-reaching relative imports: ../<x> -> ../../<x>
# (only the known src-root dirs the gallery imports)
sed -i -E "s#(['\"])\.\./(data|i18n|dashboards|components|hooks)/#\1../../\2/#g" \
  src/desktop/gallery/*.tsx src/desktop/gallery/*.ts
```

Then run `npx tsc -b` and fix any import it still flags by hand.

- [ ] **Step 3: Strip dev-only surface from `Gallery.tsx`**

In `src/desktop/gallery/Gallery.tsx`:
- Rename the component `DevGallery` → `Gallery`; keep `export default`.
- Replace `interface DevGalleryProps { active: boolean; onClose: () => void }` with
  `interface GalleryProps { onThumbRendered?: (id: string) => void }`.
- Remove the `active`/`onClose` usage: the `Root` no longer needs the `$active`
  crossfade (it is always the visible view). Drop `$active`, `aria-hidden={!active}`,
  and pass `active` down. Remove the `onClose` prop threaded to `GalleryToolbar`.
- Pass `onThumbRendered` to `GalleryGrid` (added in Task 5).
- `GalleryBackdrop` import/usage is removed here (replaced in Task 6 by the
  `AubergineBackdrop`, rendered by `DesktopApp`, not the gallery).

Show the new signature + return skeleton (rest of the body is unchanged logic):

```tsx
interface GalleryProps {
  onThumbRendered?: (id: string) => void;
}

export default function Gallery({ onThumbRendered }: GalleryProps) {
  // ... all existing state/hooks unchanged (entries, query, category, size,
  //     locale, redrawToken, list, categories, lightbox, menu, toast) ...
  return (
    <Root>
      <Scroll>
        <GalleryToolbar /* same props minus onClose */ />
        <GalleryGrid /* same props */ onRendered={onThumbRendered} />
      </Scroll>
      {/* lightbox / menu / toast unchanged */}
    </Root>
  );
}
```

Update `Root` to drop the `$active` transition (constant visible):

```tsx
const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1;
  color-scheme: dark;
`;
```

- [ ] **Step 4: Update `GalleryToolbar` — remove the back-to-app control**

In `src/desktop/gallery/GalleryToolbar.tsx`, delete the `onClose` prop and the
`← App` / close button that used it. Keep search, category, size, language, count.
Verify any button label removed didn't leave an orphaned i18n key in use.

- [ ] **Step 5: Update `App.tsx`'s dev-gallery import path (keep it building)**

`App.tsx` still references the old dev gallery via `import('./dev/DevGallery')`.
Temporarily update that dynamic import to `import('./desktop/gallery/Gallery')`
and adapt the props it passes (`active`/`onClose` no longer exist) — or, simpler,
comment out the in-`App` gallery mount entirely (it is removed for good in Task 7).
Prefer removing the `App`-level gallery mount now:
- delete the `DevGallery` lazy const, `galleryInUrl`, `GALLERY_PARAM`, the `g`-key
  effect, `showGallery`/`galleryMounted` state, and the `<Suspense><DevGallery/></Suspense>`
  block. Desktop keeps rendering `Carousel3D` (unpaused) + `PerfHud` for now.

- [ ] **Step 6: Build + i18n coverage guardrail**

Run: `npm run build && npm run test`
Expected: build clean; `i18n.coverage` green (gallery copy still covered).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(gallery): promote dev gallery to src/desktop/gallery (productionise)"
```

---

## Task 4: `progressPct` helper (pure, TDD)

**Files:**
- Create: `src/desktop/gallery/progress.ts`
- Create: `src/desktop/gallery/progress.test.ts`

**Interfaces:**
- Produces: `progressPct(rendered: number, total: number): number` — clamped 0–100 integer; `total <= 0` → 100 (nothing to wait for).

- [ ] **Step 1: Write the failing test**

```ts
// src/desktop/gallery/progress.test.ts
import { describe, expect, it } from 'vitest';
import { progressPct } from './progress';

describe('progressPct', () => {
  it('is 100 when there is nothing to render', () => {
    expect(progressPct(0, 0)).toBe(100);
  });
  it('is 0 at the start', () => {
    expect(progressPct(0, 200)).toBe(0);
  });
  it('rounds to an integer percent', () => {
    expect(progressPct(1, 3)).toBe(33);
  });
  it('never exceeds 100', () => {
    expect(progressPct(210, 200)).toBe(100);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run src/desktop/gallery/progress.test.ts`
Expected: FAIL — cannot resolve `./progress`.

- [ ] **Step 3: Implement**

```ts
// src/desktop/gallery/progress.ts
/** Determinate load progress: rendered thumbnails / total, as a 0–100 integer.
    With nothing to render (empty filter) there is nothing to wait for → 100. */
export function progressPct(rendered: number, total: number): number {
  if (total <= 0) return 100;
  return Math.min(100, Math.round((rendered / total) * 100));
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npx vitest run src/desktop/gallery/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/desktop/gallery/progress.ts src/desktop/gallery/progress.test.ts
git commit -m "feat(gallery): progressPct helper for the load bar"
```

---

## Task 5: Skeletons + per-thumb first-paint signal

**Files:**
- Modify: `src/desktop/gallery/GalleryThumb.tsx` (skeleton overlay + `onRendered`)
- Modify: `src/desktop/gallery/GalleryGrid.tsx` (thread `onRendered` through)
- Create: `src/desktop/gallery/GallerySkeletons.tsx` (top progress bar component)

**Interfaces:**
- `GalleryThumb` gains `onRendered?: (id: string) => void`, fired once after its
  first canvas paint; shows a shimmer skeleton until then.
- `GalleryGrid` gains `onRendered?: (id: string) => void`, forwarded to each thumb.
- Produces: `export function ProgressBar({ pct }: { pct: number })` in
  `GallerySkeletons.tsx` — a thin top bar, hidden at 100%.

- [ ] **Step 1: Add the skeleton overlay + first-paint callback to `GalleryThumb`**

In `src/desktop/gallery/GalleryThumb.tsx`, add a `rendered` state that flips true
after the first draw effect completes, call `onRendered(id)` once, and overlay a
shimmer `<Skeleton/>` (absolute, cross-fades out) while `!rendered`. Sketch:

```tsx
const Skeleton = styled.div`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(100deg, #ffffff08 30%, #ffffff18 50%, #ffffff08 70%);
  background-size: 200% 100%;
  animation: thumb-shimmer 1.4s ease-in-out infinite;
  @keyframes thumb-shimmer {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;
// in the component: after the first draw effect runs, setRendered(true) and
// onRendered?.(entry.id); render {!rendered && <Skeleton aria-hidden />} over the canvas
// with an opacity transition.
```

Fire `onRendered` exactly once (guard with a ref) so the global counter is not
double-incremented on redraws (locale/live-data ticks).

- [ ] **Step 2: Forward `onRendered` through `GalleryGrid`**

Add `onRendered?: (id: string) => void` to `GalleryGrid`'s props and pass it to
each `<GalleryThumb onRendered={onRendered} … />`.

- [ ] **Step 3: Add the `ProgressBar`**

```tsx
// src/desktop/gallery/GallerySkeletons.tsx
import styled from 'styled-components';

const Track = styled.div<{ $hidden: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 20;
  background: transparent;
  opacity: ${(p) => (p.$hidden ? 0 : 1)};
  transition: opacity 400ms ease 200ms;
  pointer-events: none;
`;

const Fill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${(p) => p.$pct}%;
  background: linear-gradient(90deg, #7a1f6b, #b5432f);
  transition: width 240ms ease;
`;

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <Track $hidden={pct >= 100} aria-hidden>
      <Fill $pct={pct} />
    </Track>
  );
}
```

- [ ] **Step 4: Build + tests**

Run: `npm run build && npm run test`
Expected: clean/green.

- [ ] **Step 5: Commit**

```bash
git add src/desktop/gallery/GalleryThumb.tsx src/desktop/gallery/GalleryGrid.tsx src/desktop/gallery/GallerySkeletons.tsx
git commit -m "feat(gallery): per-thumb skeletons + first-paint signal + progress bar"
```

---

## Task 6: `AubergineBackdrop` (CSS, per-category mood)

**Files:**
- Create: `src/desktop/gallery/AubergineBackdrop.tsx`
- Delete: `src/dev/GalleryBackdrop.tsx` (WebGL) — if not already gone

**Interfaces:**
- Produces: `export function AubergineBackdrop({ accent }: { accent: string })` — a
  fixed, full-bleed CSS gradient. `accent` is the active category's `TAGS[].accent`
  hex; the component blends a faint tint of it into the aubergine base and
  cross-fades when it changes.

- [ ] **Step 1: Implement the backdrop**

```tsx
// src/desktop/gallery/AubergineBackdrop.tsx
import styled from 'styled-components';

// Ubuntu-aubergine base (deep aubergine → plum → magenta over near-black), with a
// slow drift and a faint per-category accent bloom in the top-right. The accent
// is a mood tint via CSS custom property, not a palette takeover — aubergine
// stays dominant. Pure CSS: no WebGL ships to the desktop chunk.
const Base = styled.div<{ $accent: string }>`
  position: fixed;
  inset: 0;
  z-index: 0;
  --accent: ${(p) => p.$accent};
  background:
    radial-gradient(50% 65% at 84% 16%, color-mix(in oklab, var(--accent) 40%, transparent) 0%, transparent 60%),
    radial-gradient(60% 80% at 18% 12%, #7a1f6b 0%, transparent 55%),
    radial-gradient(55% 70% at 88% 22%, #571b52 0%, transparent 60%),
    radial-gradient(70% 90% at 72% 100%, #3d0f39 0%, transparent 60%),
    linear-gradient(150deg, #2c001e 0%, #1c0518 55%, #120311 100%);
  background-size: 140% 140%;
  animation: aubergine-drift 28s ease-in-out infinite alternate;
  transition: --accent 600ms ease;

  @keyframes aubergine-drift {
    from { background-position: 0% 0%, 0% 0%, 100% 100%, 60% 100%, 0 0; }
    to   { background-position: 12% 8%, 18% 10%, 82% 88%, 48% 86%, 0 0; }
  }
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

export function AubergineBackdrop({ accent }: { accent: string }) {
  return <Base $accent={accent} aria-hidden />;
}
```

- [ ] **Step 2: Delete the WebGL backdrop (if it survived the move)**

```bash
git rm -f src/dev/GalleryBackdrop.tsx 2>/dev/null || true
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean (component compiles; note `color-mix`/`--accent` transition are
progressive-enhancement — static fallback is fine on older engines).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(gallery): CSS aubergine backdrop with per-category mood tint"
```

---

## Task 7: `DesktopApp` shell (backdrop + gallery + progress, no loader)

**Files:**
- Create: `src/desktop/DesktopApp.tsx`

**Interfaces:**
- Produces: `export default function DesktopApp()` — renders `AubergineBackdrop`
  (accent from the active category), the gallery, and the `ProgressBar`; kicks off
  `loadLiveData()`; gates the first thumbnail paint on `ensureLocaleReady()`.

**Consumes:** `Gallery` (Task 3, `onThumbRendered`), `AubergineBackdrop` (Task 6),
`ProgressBar` (Task 5), `progressPct` (Task 4).

Note: the active category's accent lives inside `Gallery` today. Lift it: `Gallery`
already computes `accent`; expose the active category upward via an
`onAccentChange?: (accent: string) => void` prop (add it in this task to
`Gallery`, firing in an effect on `accent` change), so `DesktopApp` can pass it to
the backdrop. Default before any change: `ACCENT` from `galleryChrome`.

- [ ] **Step 1: Add `onAccentChange` to `Gallery`**

In `Gallery.tsx`, add `onAccentChange?: (accent: string) => void` to `GalleryProps`
and, after computing `accent`, `useEffect(() => onAccentChange?.(accent), [accent, onAccentChange])`.

- [ ] **Step 2: Implement `DesktopApp`**

```tsx
// src/desktop/DesktopApp.tsx
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import Gallery from './gallery/Gallery';
import { AubergineBackdrop } from './gallery/AubergineBackdrop';
import { ProgressBar } from './gallery/GallerySkeletons';
import { progressPct } from './gallery/progress';
import { ACCENT } from './gallery/galleryChrome';
import { buildEntries } from './gallery/galleryData';
import { loadLiveData } from '../data/sources';
import { LOCALE, ensureLocaleReady } from '../i18n';

const Wrap = styled.div`
  position: fixed;
  inset: 0;
  overflow: hidden;
`;

export default function DesktopApp() {
  const total = useMemo(() => buildEntries().length, []);
  const [rendered, setRendered] = useState(0);
  const [accent, setAccent] = useState(ACCENT);
  const [dictReady, setDictReady] = useState(LOCALE === 'de');

  useEffect(() => {
    loadLiveData();
    let alive = true;
    void (async () => {
      await ensureLocaleReady();
      if (alive) setDictReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // While the dictionary loads, show an indeterminate-ish 0 and hold the grid;
  // once ready the thumbnails paint translated and drive the determinate bar.
  const pct = dictReady ? progressPct(rendered, total) : 0;

  return (
    <Wrap>
      <AubergineBackdrop accent={accent} />
      <ProgressBar pct={pct} />
      {dictReady && (
        <Gallery
          onAccentChange={setAccent}
          onThumbRendered={() => setRendered((n) => n + 1)}
        />
      )}
    </Wrap>
  );
}
```

- [ ] **Step 3: Build + tests**

Run: `npm run build && npm run test`
Expected: clean/green.

- [ ] **Step 4: Commit**

```bash
git add src/desktop/DesktopApp.tsx src/desktop/gallery/Gallery.tsx
git commit -m "feat(desktop): DesktopApp shell — backdrop, gallery, progress, no loader"
```

---

## Task 8: Rewire `App.tsx` to the lazy device switch

**Files:**
- Modify: `src/App.tsx` (replace with the thin switch)

**Interfaces:**
- Consumes: `useIsMobile` (Task 1), `MobileApp` (Task 2), `DesktopApp` (Task 7).

- [ ] **Step 1: Replace `App.tsx` wholesale**

```tsx
// src/App.tsx
import { lazy, Suspense } from 'react';
import styled from 'styled-components';
import { GlobalStyle } from './GlobalStyle';
import { useIsMobile } from './hooks/useIsMobile';

// Two experiences, two chunks: the desktop gallery never pulls in the mobile
// deck, and the mobile deck never pulls in the gallery. The retired 3D carousel
// (and all of three/R3F) is gone entirely.
const MobileApp = lazy(() => import('./mobile/MobileApp'));
const DesktopApp = lazy(() => import('./desktop/DesktopApp'));

const Stage = styled.main`
  position: fixed;
  inset: 0;
  background: #080b14;
  overflow: hidden;

  & canvas {
    display: block;
    touch-action: none;
  }
`;

export default function App() {
  const isMobile = useIsMobile();
  return (
    <Stage>
      <GlobalStyle />
      <Suspense fallback={null}>{isMobile ? <MobileApp /> : <DesktopApp />}</Suspense>
    </Stage>
  );
}
```

- [ ] **Step 2: Build + tests**

Run: `npm run build && npm run test`
Expected: build FAILS to resolve the now-unused carousel imports IF any remain —
that is expected; they are deleted in Task 9. If the build fails only on
`Carousel3D`/`PerfHud`/`DevGalleryLink` being unused/broken, proceed to Task 9
before re-running. (Better: do Task 9 immediately after this step, then build.)

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): thin device switch, lazy-load MobileApp | DesktopApp"
```

---

## Task 9: Delete the retired R3F carousel scene + drop deps

**Files:**
- Delete: the carousel scene, hooks, texture, and the empty `src/dev/`.
- Modify: `package.json` (remove `three`/R3F deps once unreferenced).

- [ ] **Step 1: Delete the carousel scene and its exclusive helpers**

```bash
git rm src/components/Carousel3D.tsx src/components/CarouselItem.tsx \
       src/components/HeroCard.tsx src/components/HeroScrim.tsx \
       src/components/Aurora.tsx src/components/Afterglow.tsx \
       src/components/Dust.tsx src/components/CameraRig.tsx \
       src/components/ClockContinuity.tsx src/components/PerfHud.tsx \
       src/components/DevGalleryLink.tsx \
       src/hooks/useCarouselRotation.ts src/hooks/useCarouselRotation.test.ts \
       src/hooks/useDashboardTexture.ts src/hooks/useDashboardTexture.test.ts \
       src/dashboards/texture.ts
rmdir src/dev 2>/dev/null || true
```

- [ ] **Step 2: Grep for stragglers**

```bash
grep -rnE "from 'three'|@react-three|useEnvironment|dashboards/texture|Carousel3D|PerfHud|DevGalleryLink" src/
```
Expected: **no matches** in shipped `src/` (test-only helpers already removed). Fix
any remaining import (e.g. a re-export in `dashboards/index.ts`) by deleting the
dead reference.

- [ ] **Step 3: Drop the WebGL dependencies**

Only after Step 2 is clean:

```bash
npm rm three @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing @types/three
```

- [ ] **Step 4: Full build + tests**

Run: `npm run lint && npm run build && npm run test`
Expected: all clean/green. The desktop chunk no longer contains `three`
(spot-check `dist/assets/*` sizes drop substantially).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: retire the 3D carousel scene and drop three/R3F deps"
```

---

## Task 10: Dev preview scripts

**Files:**
- Modify: `package.json` (`scripts`)

- [ ] **Step 1: Add convenience scripts**

Add to `scripts` (the existing `dev` opens via the IDE BROWSER env; these append the override param):

```json
"dev:mobile": "BROWSER=code BROWSER_ARGS=--open-url vite --open '/?view=mobile'",
"dev:desktop": "BROWSER=code BROWSER_ARGS=--open-url vite --open '/?view=desktop'"
```

- [ ] **Step 2: Sanity check**

Run: `npm run dev:desktop` → browser opens at `/?view=desktop` (gallery). Ctrl-C.
Run: `npm run dev:mobile` → opens at `/?view=mobile` (loader + deck). Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(dev): dev:mobile / dev:desktop preview scripts"
```

---

## Task 11: Verification — both surfaces + PWA

**Files:** none (verification only; fixes committed as found).

- [ ] **Step 1: Desktop headless (Playwright, 1440×900)**

Start dev, drive Chrome desktop. Confirm: gallery renders, aubergine backdrop
present and **drifting**, skeletons appear then cross-fade to thumbnails, the top
progress bar advances then hides, **no full-screen loader**, no console errors.
Switch the category filter → backdrop mood shifts (accent tint changes). Screenshot.

- [ ] **Step 2: Mobile headless (390×844)**

Confirm loader plays then `MobileDeck` appears — identical to today, enlarged
star/⋯ icons intact. Screenshot.

- [ ] **Step 3: `?view=` override**

At 1440×900 open `/?view=mobile` → mobile experience; `/?view=desktop` at 390×844
→ desktop gallery. Confirms the override.

- [ ] **Step 4: PWA installability**

Build + preview (`npm run build && npm run preview`). In Chrome DevTools →
Application: manifest parsed (name, icons, `display: standalone`, `start_url`),
service worker registered, and the install criteria are met (installable). Note
the result; if a criterion regressed, fix `index.html`/manifest and re-check.

- [ ] **Step 5: Final gate**

Run: `npm run lint && npm run build && npm run test`
Expected: all clean/green.

- [ ] **Step 6: Commit any verification fixes**

```bash
git add -A
git commit -m "test: verify desktop gallery, mobile deck, and PWA installability"
```

---

## Self-Review (author)

- **Spec coverage:** device switch + lazy chunks (T1,T2,T7,T8) · gallery
  productionised (T3) · aubergine backdrop + per-category mood (T6, wired T7) ·
  skeletons + progress (T4,T5,T7) · mobile unchanged (T2) · carousel/loader/three
  retired (T8,T9) · dev scripts / `?view` (T1,T10) · PWA verified (T11). All spec
  sections map to a task.
- **Placeholder scan:** new-logic tasks (1,4,5,6,7,8,10) carry full code; structural
  tasks (2,3,9) carry exact commands + the specific edits, with `build`/tests as the
  gate (appropriate for moves/deletes).
- **Type consistency:** `readViewOverride(): 'mobile'|'desktop'|null`, `progressPct(rendered,total)`,
  `Gallery({ onThumbRendered, onAccentChange })`, `AubergineBackdrop({ accent })`,
  `ProgressBar({ pct })`, `GalleryThumb … onRendered`, `GalleryGrid … onRendered` —
  names align across tasks.
