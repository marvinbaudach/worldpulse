# Mobile Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile deck more readable (bigger type, less clutter) and more app-like (chart animations, PWA install, page dots, pull-to-refresh, living background, gyro tilt).

**Architecture:** All changes live on the mobile path (`MobileDeck` → `SwipeDeck` → `CardCanvas`) plus small central hooks: the readability boost is one scale-factor change at the mobile canvas entry point, chart animation reuses the existing time-driven `draw(frame)` pipeline, and the effects are DOM/CSS layers around the deck. The desktop WebGL carousel and the card definitions stay untouched.

**Tech Stack:** React 19, styled-components, Canvas 2D, Vite 8, TypeScript 6, oxlint.

**Verification:** This repo has no unit-test framework; the CI gates are `npm run lint` (oxlint) and `npm run build` (tsc + vite). Every task ends with both, plus a visual pass in Chrome DevTools mobile emulation where UI changes. UI copy is German with i18n keys in `src/i18n/{en,fr,it}.ts`; code comments and commits are English.

**Spec:** `docs/superpowers/specs/2026-07-08-mobile-optimization-design.md`

---

### Task 1: Readability — mobile u-boost + compact frame flag

**Files:**
- Modify: `src/dashboards/draw.ts` (the `Frame` interface, ~line 71)
- Modify: `src/dashboards/charts/shared.ts` (`drawSource`, ~line 69)
- Modify: `src/components/CardCanvas.tsx` (reference width, ~line 7 and the `draw` call ~line 37)

- [ ] **Step 1: Add `compact` to the `Frame` interface**

In `src/dashboards/draw.ts`, extend the existing interface:

```ts
export interface Frame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Seconds since the current hover/hero started — drives the animations. */
  t: number;
  /** 1 unit = 1 design pixel of the 512-wide reference layout. */
  u: number;
  /** Mobile deck: skip tertiary chrome (the source footer) — on the phone
      the source already lives behind the info button. */
  compact?: boolean;
}
```

- [ ] **Step 2: Skip the source footer in compact mode**

In `src/dashboards/charts/shared.ts`:

```ts
/** Muted source/attribution line pinned to the panel's bottom-left. */
export function drawSource(f: Frame, source: string): void {
  if (f.compact) return; // mobile shows the source behind the info button
  const { ctx, u, h } = f;
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${13 * u}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(tr(source), 36 * u, h - 22 * u);
}
```

- [ ] **Step 3: Boost `u` at the mobile entry point**

In `src/components/CardCanvas.tsx`, replace the `REF_W` constant and its comment,
and pass `compact` in the draw call:

```ts
// The draw functions are written against a 512-wide reference layout (u =
// w / 512). Mobile cards render ~370 CSS px wide, which shrinks that design
// below comfortable reading size — so the deck uses a smaller reference
// width, boosting u (and with it every font, stroke and legend) ~22% across
// all cards at once. Tune this constant by eye in device emulation.
const MOBILE_REF_W = 420;
```

```ts
      dashboard.draw({ ctx, w, h, t, u: w / MOBILE_REF_W, compact: true });
```

(There is exactly one `dashboard.draw` call in this file; `REF_W` has no other
users in this file — verify with `grep -n "REF_W" src/components/CardCanvas.tsx`.)

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: both pass with no errors.

- [ ] **Step 5: Visual pass**

Run `npm run dev`, open Chrome DevTools device emulation (e.g. Pixel 7).
Swipe through the densest cards of several themes (multi-series lines with
legends, ranked map lists). Check: labels readable, nothing colliding or
clipped, no source footer on the cards. If dense cards collide, raise
`MOBILE_REF_W` toward 460 and re-check.

- [ ] **Step 6: Commit**

```bash
git add src/dashboards/draw.ts src/dashboards/charts/shared.ts src/components/CardCanvas.tsx
git commit -m "Boost mobile card type via smaller reference width, hide source footer"
```

---

### Task 2: Chart animation — intro replay per card + live ticking

**Files:**
- Create: `src/hooks/useReducedMotion.ts`
- Modify: `src/components/SwipeDeck.tsx` (drop the one-shot `intro` ref)
- Modify: `src/components/CardCanvas.tsx` (live/dynamic redraw subscription)

- [ ] **Step 1: Create the reduced-motion hook**

Create `src/hooks/useReducedMotion.ts` (same shape as `useIsMobile`):

```ts
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the OS asks for reduced motion; tracks live changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Replay the intro on every landing**

In `src/components/SwipeDeck.tsx`:

1. Import the hook: `import { useReducedMotion } from '../hooks/useReducedMotion';`
2. Inside the component add `const reducedMotion = useReducedMotion();`
3. Delete the `intro` ref and its comment (lines ~63–66: `// Only the first
   card plays…` through `const intro = useRef(true);`) and delete the
   `intro.current = false; // no chart replay…` line inside `throwCard`.
4. Change the front card's prop from `animate={intro.current}` to
   `animate={!reducedMotion}`.

Why this works: the front card's `<Card key={cur.id}>` keeps its identity when
a neighbour becomes current (same React key), so `CardCanvas` sees `animate`
flip `false → true` exactly when the card lands, its effect re-runs, and the
fly-in replays. `setIndex` fires after the throw completes (`THROW_MS`), so the
replay starts together with the landing — the settled→restart repaint reads as
part of the transition, per the spec.

- [ ] **Step 3: Keep live/dynamic cards updating**

In `src/components/CardCanvas.tsx`, subscribe to the store's pub/sub. Import:

```ts
import { onLiveUpdate } from '../data/store';
```

Replace the effect body (keep the existing `dpr`/`draw` setup) so the end of
the effect looks like this — note the `settled` flag so a tick never fights
the running intro:

```ts
    let raf = 0;
    let settled = !animate;
    if (animate) {
      let start = 0;
      const tick = (now: number) => {
        if (!start) start = now;
        const t = (now - start) / 1000;
        if (t < INTRO_S) {
          draw(t);
          raf = requestAnimationFrame(tick);
        } else {
          settled = true;
          draw(SETTLED_T); // lock the fully-settled frame
        }
      };
      raf = requestAnimationFrame(tick);
    } else {
      draw(SETTLED_T);
    }

    // Live cards keep counting (the once-a-second tick) and dynamic cards
    // repaint when a dataset lands — the same triggers the WebGL ring uses.
    // Guarded on `settled` so an update never interrupts the intro replay.
    const offLive =
      dashboard.live || dashboard.dynamic
        ? onLiveUpdate((kind) => {
            if (!settled) return;
            if (kind === 'tick' ? dashboard.live : dashboard.dynamic) draw(SETTLED_T);
          })
        : undefined;

    const onResize = () => draw(SETTLED_T);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      offLive?.();
    };
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 5: Visual pass**

In mobile emulation: every swipe replays the landing card's chart fly-in; the
debt-clock card (theme GELD) keeps counting once per second after it settles.
With DevTools "Emulate CSS prefers-reduced-motion: reduce" the cards render
settled with no replay.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useReducedMotion.ts src/components/SwipeDeck.tsx src/components/CardCanvas.tsx
git commit -m "Replay chart intro on every card landing, keep live cards ticking"
```

---

### Task 3: PWA — manifest, icons, service worker

**Files:**
- Create: `public/manifest.webmanifest`, `public/sw.js`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`
- Modify: `index.html`, `src/main.tsx`

- [ ] **Step 1: Generate the icons from the existing favicon**

```bash
cd /home/marvin/Projects/carousel-3d
rsvg-convert -w 192 -h 192 public/favicon.svg -o public/icon-192.png
rsvg-convert -w 512 -h 512 public/favicon.svg -o public/icon-512.png
# Maskable: shrink the artwork into the ~80% safe zone on the app background.
magick public/icon-512.png -resize 80% -background '#05070c' -gravity center -extent 512x512 public/icon-maskable-512.png
```

Expected: three PNGs in `public/` (`file public/icon-*.png` reports the sizes).

- [ ] **Step 2: Write the manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "Worldpulse",
  "short_name": "Worldpulse",
  "description": "Live-Dashboards aus offenen Daten",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#05070c",
  "theme_color": "#05070c",
  "icons": [
    { "src": "./icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "./icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "./icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Write the minimal service worker**

Create `public/sw.js`:

```js
// Minimal pass-through service worker: Chrome wants a fetch handler before it
// offers the install prompt. No caching — offline support is out of scope
// (see the mobile optimization spec).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
```

- [ ] **Step 4: Wire up `index.html`**

In `index.html`, change the viewport meta and add the PWA tags inside `<head>`:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#05070c" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" href="./icon-192.png" />
```

(The `theme-color` meta already exists — keep it; the viewport line replaces
the existing one.)

- [ ] **Step 5: Register the service worker in production**

In `src/main.tsx`, append after the render call:

```ts
// PWA: register the minimal service worker (install-prompt requirement).
// Relative URL so the GitHub Pages subpath (vite `base: './'`) resolves;
// skipped in dev where a worker would only get in the way.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
```

- [ ] **Step 6: Lint + build + verify**

Run: `npm run lint && npm run build && ls dist/manifest.webmanifest dist/sw.js dist/icon-192.png`
Expected: lint/build pass; the three files are in `dist/`.
Then `npm run preview`, open the preview URL in Chrome, DevTools → Application
→ Manifest: no warnings, installability check passes (SW registers only in
the production preview, not `npm run dev`).

- [ ] **Step 7: Commit**

```bash
git add public/manifest.webmanifest public/sw.js public/icon-192.png public/icon-512.png public/icon-maskable-512.png index.html src/main.tsx
git commit -m "Add PWA manifest, icons and minimal service worker"
```

---

### Task 4: Micro-interactions — page dots + sheet polish

**Files:**
- Modify: `src/components/MobileDeck.tsx` (replace `Counter`, polish `Backdrop`)

- [ ] **Step 1: Replace the counter with page dots**

In `src/components/MobileDeck.tsx`, delete the `Counter` styled component and
its usage, and add:

```tsx
const DotsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Dot = styled.div<{ $active: boolean; $small: boolean }>`
  width: ${(p) => (p.$active ? 18 : 6)}px;
  height: 6px;
  border-radius: 999px;
  background: ${(p) => (p.$active ? '#cfe4ff' : 'rgba(255, 255, 255, 0.28)')};
  transform: scale(${(p) => (p.$small ? 0.6 : 1)});
  transition: width 0.25s ease, background 0.25s ease, transform 0.25s ease;
`;

// iOS-pager style dots: with many cards only a sliding window of dots shows,
// and the window-edge dots shrink to signal "more beyond".
const MAX_DOTS = 9;

function Dots({ count, active }: { count: number; active: number }) {
  if (count <= 1) return null;
  const visible = Math.min(count, MAX_DOTS);
  const start = Math.max(0, Math.min(active - Math.floor(MAX_DOTS / 2), count - visible));
  return (
    <DotsRow>
      {Array.from({ length: visible }, (_, j) => {
        const i = start + j;
        const edge =
          count > MAX_DOTS &&
          ((j === 0 && start > 0) || (j === visible - 1 && start + visible < count));
        return <Dot key={i} $active={i === active} $small={edge} />;
      })}
    </DotsRow>
  );
}
```

In the JSX, replace

```tsx
        <Counter>
          {Math.min(active + 1, dashboards.length)} / {dashboards.length}
        </Counter>
```

with

```tsx
        <Dots count={dashboards.length} active={Math.min(active, dashboards.length - 1)} />
```

- [ ] **Step 2: Blur + fade the sheet backdrop**

Replace the `Backdrop` styled component:

```tsx
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
```

- [ ] **Step 3: Lint + build + visual pass**

Run: `npm run lint && npm run build`
Expected: pass. In emulation: dots track swipes with the animated active pill;
with a theme holding >9 cards the window slides and edge dots shrink; opening
the theme sheet fades in a blurred backdrop.

- [ ] **Step 4: Commit**

```bash
git add src/components/MobileDeck.tsx
git commit -m "Replace mobile counter with pager dots, blur sheet backdrop"
```

---

### Task 5: Pull-to-refresh for live data

**Files:**
- Modify: `src/data/cache.ts` (export a cache clear)
- Modify: `src/data/sources.ts` (add `refreshLiveData`)
- Modify: `src/components/SwipeDeck.tsx` (vertical pull gesture, `onRefresh` prop)
- Modify: `src/components/MobileDeck.tsx` (refresh state + pill, i18n copy)
- Modify: `src/i18n/en.ts`, `src/i18n/fr.ts`, `src/i18n/it.ts` (new key)

- [ ] **Step 1: Export a cache clear from `cache.ts`**

Append to `src/data/cache.ts`:

```ts
/** Drop every cached derived dataset — a user-initiated refresh must hit the
    network, not the TTL cache. */
export function clearDataCache(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
  }
}
```

- [ ] **Step 2: Add `refreshLiveData` to `sources.ts`**

In `src/data/sources.ts`, add `clearDataCache` to the existing import from
`./cache`, and append after `loadLiveData`:

```ts
let refreshing = false;

/** User-initiated refresh (pull-to-refresh): drop the cache, re-run every
    feed. Resolves when all feeds settled; failures keep their demo data as
    usual. */
export async function refreshLiveData(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  clearDataCache();
  await Promise.allSettled(
    LIVE_FEEDS.map((feed) =>
      feed.load().then(
        () => emitLiveUpdate('data'),
        (err) => console.warn(`[live-data] refresh ${feed.source} ${feed.item} failed`, err),
      ),
    ),
  );
  refreshing = false;
}
```

- [ ] **Step 3: Detect the pull gesture in `SwipeDeck`**

In `src/components/SwipeDeck.tsx`:

1. Extend the props:

```ts
interface SwipeDeckProps {
  dashboards: Dashboard[];
  onIndex: (i: number) => void;
  /** Fired when the user pulls the deck down far enough (pull-to-refresh). */
  onRefresh?: () => void;
}
```

2. Track the vertical axis in the drag state — extend the ref initializer and
   `onDown` with `startY: e.clientY, dy: 0` (add `startY: 0, dy: 0` to the
   initial `useRef({...})` literal too).

3. In `onMove`, after `d.dx = e.clientX - d.startX;` add:

```ts
    d.dy = e.clientY - d.startY;
    // Mostly-vertical downward drag = pull-to-refresh: the card follows the
    // finger down with resistance instead of arming the horizontal throw.
    if (d.dy > 0 && d.dy > Math.abs(d.dx) * 1.5) {
      setCur(`${CENTER} translateY(${Math.min(70, d.dy * 0.3)}px)`, 'none');
      return;
    }
```

4. In `onUp`, before the existing distance/flick logic add:

```ts
    // Committed pull: trigger the refresh and spring the card back.
    if (d.dy > 110 && d.dy > Math.abs(d.dx) * 1.5) {
      navigator.vibrate?.(8);
      onRefresh?.();
      setCur(CENTER, SPRING);
      return;
    }
```

5. Add `onRefresh` to the destructured props:
   `export function SwipeDeck({ dashboards, onIndex, onRefresh }: SwipeDeckProps) {`

- [ ] **Step 4: Wire the refresh into `MobileDeck`**

In `src/components/MobileDeck.tsx`:

1. Imports: `import { refreshLiveData } from '../data/sources';`
2. Add the pill (styled like the existing glass pills):

```tsx
const RefreshPill = styled.div`
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 68px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 12;
  padding: 9px 16px;
  border-radius: 999px;
  color: #cfe4ff;
  font: 600 12px/1 inherit;
  letter-spacing: 0.1em;
  white-space: nowrap;
  pointer-events: none;
  ${glassSurface}
`;
```

3. State + handler inside the component:

```tsx
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshLiveData();
    setRefreshing(false);
  };
```

4. Pass it to the deck and render the pill:

```tsx
      <SwipeDeck key={tag} dashboards={dashboards} onIndex={onIndex} onRefresh={refresh} />

      {refreshing && <RefreshPill>{trans('Daten werden aktualisiert …')}</RefreshPill>}
```

- [ ] **Step 5: Add the i18n key**

German source string: `'Daten werden aktualisiert …'`. Add to the dictionaries
(alphabetical position, same style as neighbours):

- `src/i18n/en.ts`: `'Daten werden aktualisiert …': 'Refreshing data …',`
- `src/i18n/fr.ts`: `'Daten werden aktualisiert …': 'Actualisation des données …',`
- `src/i18n/it.ts`: `'Daten werden aktualisiert …': 'Aggiornamento dei dati …',`

- [ ] **Step 6: Lint + build + visual pass**

Run: `npm run lint && npm run build`
Expected: pass. In emulation: dragging a card straight down pulls it with
resistance; past the threshold it springs back, the pill appears, and dynamic
cards repaint when their dataset lands (the `onLiveUpdate('data')` path from
Task 2). Horizontal swipes are unaffected; a diagonal drag still throws.

- [ ] **Step 7: Commit**

```bash
git add src/data/cache.ts src/data/sources.ts src/components/SwipeDeck.tsx src/components/MobileDeck.tsx src/i18n/en.ts src/i18n/fr.ts src/i18n/it.ts
git commit -m "Add pull-to-refresh that busts the data cache and re-runs feeds"
```

---

### Task 6: Living background — theme-tinted gradient blobs

**Files:**
- Create: `src/components/MobileBackground.tsx`
- Modify: `src/components/MobileDeck.tsx` (mount it, pass the accent)

- [ ] **Step 1: Create the background component**

Create `src/components/MobileBackground.tsx`:

```tsx
import { forwardRef } from 'react';
import styled, { keyframes } from 'styled-components';

// CSS counterpart of the desktop aurora: the mobile path has no WebGL, so the
// "room changes mood" read comes from two big radial-gradient blobs drifting
// via transform (compositor-only, no per-frame JS). The tint follows the
// active theme's accent; the color crossfade rides the gradient transition.
const driftA = keyframes`
  0% { transform: translate(-14%, -10%) scale(1); }
  50% { transform: translate(8%, 4%) scale(1.18); }
  100% { transform: translate(-14%, -10%) scale(1); }
`;

const driftB = keyframes`
  0% { transform: translate(10%, 12%) scale(1.1); }
  50% { transform: translate(-6%, -4%) scale(0.95); }
  100% { transform: translate(10%, 12%) scale(1.1); }
`;

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: -1; /* under the deck's static children, above the stage bg */
  overflow: hidden;
  pointer-events: none;
`;

const Blob = styled.div<{ $c: string }>`
  position: absolute;
  width: 90vmax;
  height: 90vmax;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, ${(p) => p.$c}, transparent 62%);
  opacity: 0.14;
  will-change: transform;
  transition: background 1.2s ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`;

const BlobA = styled(Blob)`
  top: -30vmax;
  left: -25vmax;
  animation: ${driftA} 28s ease-in-out infinite;
`;

const BlobB = styled(Blob)`
  right: -30vmax;
  bottom: -35vmax;
  opacity: 0.1;
  animation: ${driftB} 36s ease-in-out infinite;
`;

interface MobileBackgroundProps {
  /** Active theme accent (TAGS[].accent). */
  accent: string;
}

/** Slow, theme-tinted glow behind the mobile deck. The ref wraps the whole
    layer so the gyro parallax can shift it against the cards. */
export const MobileBackground = forwardRef<HTMLDivElement, MobileBackgroundProps>(
  function MobileBackground({ accent }, ref) {
    return (
      <Layer ref={ref}>
        <BlobA $c={accent} />
        <BlobB $c={accent} />
      </Layer>
    );
  },
);
```

- [ ] **Step 2: Mount it in `MobileDeck`**

In `src/components/MobileDeck.tsx`:

1. Import: `import { MobileBackground } from './MobileBackground';`
2. Resolve the accent next to the existing `currentLabel` line:

```tsx
  const activeTag = TAGS.find((t) => t.id === tag) ?? TAGS[0];
  const currentLabel = trans(activeTag.label);
```

(replace the current `currentLabel` assignment — `activeTag` reuses its lookup)

3. First child inside `<Deck>`:

```tsx
      <MobileBackground accent={activeTag.accent} />
```

- [ ] **Step 3: Lint + build + visual pass**

Run: `npm run lint && npm run build`
Expected: pass. In emulation: a soft, slowly drifting glow behind the cards
that changes hue when switching themes (e.g. GELD gold → KRIEG red, fading
over ~1.2s); with reduced motion emulated the glow is static but still tinted.
Check the DevTools Performance panel briefly: no layout/paint storms — the
blob animation must stay compositor-only.

- [ ] **Step 4: Commit**

```bash
git add src/components/MobileBackground.tsx src/components/MobileDeck.tsx
git commit -m "Add theme-tinted animated gradient background to the mobile deck"
```

---

### Task 7: Gyro parallax / tilt with iOS opt-in

**Files:**
- Create: `src/hooks/useDeviceTilt.ts`
- Modify: `src/components/MobileDeck.tsx` (tilt layer, permission chip)
- Modify: `src/i18n/en.ts`, `src/i18n/fr.ts`, `src/i18n/it.ts` (new key)

- [ ] **Step 1: Create the tilt hook**

Create `src/hooks/useDeviceTilt.ts`:

```ts
import { useEffect, type RefObject } from 'react';

// Damped device-orientation tilt: gamma/beta are normalized to [-1, 1],
// low-pass filtered in a rAF loop, and written as imperative transforms
// (per the project rule: animation never goes through per-frame React
// state). The deck leans with the device; the background shifts the other
// way for parallax.
const MAX_DEG = 3.5;
const BG_SHIFT_PX = 18;
/** beta when a phone rests naturally in the hand — the tilt's zero point. */
const BETA_REST = 45;

export function useDeviceTilt(
  enabled: boolean,
  card: RefObject<HTMLDivElement | null>,
  bg: RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    if (!enabled) return;
    let tx = 0;
    let ty = 0;
    let gx = 0;
    let gy = 0;
    let raf = 0;

    const onOrient = (e: DeviceOrientationEvent) => {
      tx = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 30));
      ty = Math.max(-1, Math.min(1, ((e.beta ?? BETA_REST) - BETA_REST) / 30));
    };

    const tick = () => {
      gx += (tx - gx) * 0.08;
      gy += (ty - gy) * 0.08;
      if (card.current) {
        card.current.style.transform = `rotateY(${(gx * MAX_DEG).toFixed(2)}deg) rotateX(${(-gy * MAX_DEG).toFixed(2)}deg)`;
      }
      if (bg.current) {
        bg.current.style.transform = `translate(${(-gx * BG_SHIFT_PX).toFixed(1)}px, ${(-gy * BG_SHIFT_PX).toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('deviceorientation', onOrient);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      cancelAnimationFrame(raf);
      // Reset so disabling doesn't freeze the layers mid-tilt.
      if (card.current) card.current.style.transform = '';
      if (bg.current) bg.current.style.transform = '';
    };
  }, [enabled, card, bg]);
}
```

- [ ] **Step 2: Permission state + tilt layer in `MobileDeck`**

In `src/components/MobileDeck.tsx`:

1. Imports:

```tsx
import { useMemo, useRef, useState } from 'react';
import { useDeviceTilt } from '../hooks/useDeviceTilt';
import { useReducedMotion } from '../hooks/useReducedMotion';
```

2. Above the component, the permission plumbing:

```tsx
// iOS gates deviceorientation behind a user-gesture permission prompt;
// everywhere else the event just fires. The user's choice persists so the
// opt-in chip shows only until answered.
type DOEWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const MOTION_KEY = 'worldpulse-motion';

function motionPermissionNeeded(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as DOEWithPermission).requestPermission === 'function'
  );
}
```

3. The chip (mirrors `InfoButton`, bottom-right):

```tsx
const MotionChip = styled.button`
  position: fixed;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
  z-index: 12;
  padding: 12px 16px;
  border: none;
  border-radius: 999px;
  color: #cfe4ff;
  font: 600 12px/1 inherit;
  letter-spacing: 0.08em;
  cursor: pointer;
  ${glassSurface}
`;
```

4. The tilt wrapper around the deck area (the parent supplies perspective so
   the layer's rotation reads as 3D):

```tsx
const TiltFrame = styled.div`
  flex: 1;
  display: flex;
  perspective: 1200px;
`;

const TiltLayer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  will-change: transform;
`;
```

5. Inside the component:

```tsx
  const reducedMotion = useReducedMotion();
  const tiltRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  // 'granted' | 'ask' | 'denied' — non-iOS grants implicitly.
  const [motion, setMotion] = useState(() => {
    if (!motionPermissionNeeded()) return 'granted';
    return localStorage.getItem(MOTION_KEY) ?? 'ask';
  });

  const askMotion = async () => {
    try {
      const res = await (DeviceOrientationEvent as DOEWithPermission).requestPermission?.();
      const next = res === 'granted' ? 'granted' : 'denied';
      localStorage.setItem(MOTION_KEY, next);
      setMotion(next);
    } catch {
      localStorage.setItem(MOTION_KEY, 'denied');
      setMotion('denied');
    }
  };

  useDeviceTilt(motion === 'granted' && !reducedMotion, tiltRef, bgRef);
```

Note: iOS does not persist the grant across page loads — a stored `'granted'`
still needs `requestPermission()` per session, but that call resolves without
a visible prompt once granted, so re-asking via the chip is only needed after
`'ask'`. To handle the stored-grant case, add right below `askMotion`:

```tsx
  // A previously granted iOS permission still needs a per-session
  // requestPermission() call, but it resolves silently — piggyback on the
  // first tap anywhere in the deck.
  useEffect(() => {
    if (!motionPermissionNeeded() || motion !== 'granted') return;
    const arm = () => void askMotion();
    window.addEventListener('pointerdown', arm, { once: true });
    return () => window.removeEventListener('pointerdown', arm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

(`useEffect` joins the react import.)

6. In the JSX, wrap the deck and add the chip; pass `bgRef` to the background:

```tsx
      <MobileBackground ref={bgRef} accent={activeTag.accent} />
      ...
      <TiltFrame>
        <TiltLayer ref={tiltRef}>
          <SwipeDeck key={tag} dashboards={dashboards} onIndex={onIndex} onRefresh={refresh} />
        </TiltLayer>
      </TiltFrame>
```

7. The chip renders only while undecided on iOS (keep it clear of the info
   button, which sits bottom-left):

```tsx
      {motion === 'ask' && (
        <MotionChip onClick={askMotion}>{trans('Bewegungseffekte aktivieren')}</MotionChip>
      )}
```

- [ ] **Step 3: Add the i18n key**

German source string: `'Bewegungseffekte aktivieren'`:

- `src/i18n/en.ts`: `'Bewegungseffekte aktivieren': 'Enable motion effects',`
- `src/i18n/fr.ts`: `'Bewegungseffekte aktivieren': 'Activer les effets de mouvement',`
- `src/i18n/it.ts`: `'Bewegungseffekte aktivieren': 'Attiva gli effetti di movimento',`

- [ ] **Step 4: Lint + build + visual pass**

Run: `npm run lint && npm run build`
Expected: pass. In Chrome DevTools → Sensors panel, set a custom orientation
and vary beta/gamma: the deck leans subtly (≤ ~3.5°), the background glow
shifts the opposite way. With reduced motion emulated, no tilt. On the
desktop-browser mobile emulation no chip appears (no `requestPermission`);
the chip path is iOS-only and verified on-device or accepted as reviewed code.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDeviceTilt.ts src/components/MobileDeck.tsx src/components/MobileBackground.tsx src/i18n/en.ts src/i18n/fr.ts src/i18n/it.ts
git commit -m "Add damped gyro tilt with parallax background and iOS opt-in chip"
```

---

### Task 8: Final verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Full gates**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 2: End-to-end mobile pass**

`npm run preview`, Chrome mobile emulation, walk the whole surface:

- Cards readable across the densest themes; no clipped labels; no source
  footer on cards; source still reachable via the "i" button.
- Every swipe replays the chart intro; debt clock ticks; theme switch swaps
  deck + background mood; dots track position; sheet opens with blur.
- Pull down → refresh pill, data lands, dynamic cards repaint.
- Sensors panel → tilt works; reduced-motion emulation kills replay, blob
  drift and tilt but keeps the app usable.
- Application panel → manifest valid, SW registered (preview build).
- Desktop viewport (wide window): the WebGL carousel is untouched and boots
  normally.

- [ ] **Step 3: Commit any tuning fallout**

If the visual pass forced constant tweaks (`MOBILE_REF_W`, blob opacity,
tilt degrees), commit them:

```bash
git add -A && git commit -m "Tune mobile readability and effect constants after visual pass"
```
