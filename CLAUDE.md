# Worldpulse — Agent Guide

3D data carousel: canvas-drawn dashboards on WebGL panels that orbit and morph
between formations, fed by keyless public APIs. React 19 · React Three Fiber ·
Three.js · Vite 8 · TypeScript 6 · oxlint. Deploys to GitHub Pages on push to
`main`. Package name is `worldpulse`; the repo folder is `carousel-3d`.

## Commands

```bash
npm run dev      # vite dev server
npm run build    # tsc -b && vite build (type-checked — CI runs this)
npm run lint     # oxlint (CI runs this before build)
```

CI (`.github/workflows/deploy.yml`) = lint → build → deploy. Both must pass.
`vite.config.ts` uses `base: './'` so the build works under the Pages subpath.

## Architecture (data → texture → 3D)

The pipeline is one-directional. Understand it before touching anything:

1. **`src/data/sources.ts`** — one async fetcher per public API (Open-Meteo,
   Wikimedia, World Bank, US Treasury). Each derives a draw-ready shape, caches
   it (`data/cache.ts`, localStorage), writes it into the mutable `live` store,
   and **swallows its own errors**. `LIVE_FEEDS` is the single source of truth:
   it drives both the fetches AND the loading screen's feed list.
2. **`src/data/store.ts`** — `live` (mutable `LiveData`) + tiny pub/sub
   (`onLiveUpdate`/`emitLiveUpdate`). Fields stay `undefined` on failure.
3. **`src/dashboards/`** — card definitions. Each card's `draw(frame)` reads
   from `live` **every frame** and falls back to bundled/seeded data when the
   field is undefined, so the ring never looks broken offline.
4. **`src/dashboards/charts/` + `draw.ts`** — pure Canvas-2D renderers. They
   work in "units" (`u = width / 512`) so the same code draws 512px ring panels
   and the 1024px hero crisply.
5. **`src/components/`** — R3F. Canvas draws paint into `CanvasTexture`s
   (`useDashboardTexture`); panels only redraw on data change / live tick /
   hover intro. Desktop → `Carousel3D`; phones → `MobileDeck` (2D canvas, no
   WebGL). `App.tsx` picks via `useIsMobile`.

## Adding a dashboard card

1. Add the definition to `POOL` in `src/dashboards/cards.ts`. Build the chart
   config **inside `draw`** (never above it) so it picks up live data per-frame.
   Always provide a fallback for every `live.*` read.
2. Register theme tags in `TAGS_BY_ID` in `src/dashboards/index.ts` (and add to
   `FEATURED` if it should lead the ring).
3. If the data is live-fetched, set `dynamic: true` (triggers redraw when a
   dataset lands). If it keeps moving while idle (e.g. debt clock), set
   `live: true`. Purely bundled cards leave both off to skip the boot redraw storm.
4. New live source? Add a fetcher + a `LIVE_FEEDS` entry in `data/sources.ts`
   and a typed field in `LiveData` (`data/store.ts`).

Reusable single-series trend panels: use `trendCard()` from `cardHelpers.ts`.
Year-axis era markers: use `eraMarkers()`.

## Conventions

- **Colors come from `dashboards/theme.ts` only.** `SERIES` is a fixed,
  identity-assigned categorical palette (never cycled); `SEQ` is the sequential
  ramp for magnitude; `GOOD`/`CRITICAL` are reserved (never series colors). The
  palette is CVD-validated against the `#12151c` surface — don't hand-pick hex.
- **Animation runs in `useFrame`, never per-frame React state.** Adaptive
  resolution via drei `PerformanceMonitor`.
- Formations live in `src/layouts.ts` (`ring`/`helix`/`sphere`), all
  Y-axis rotation-symmetric. Ring radius/camera/fog scale with panel count.
- Deterministic PRNG (`rng`/`makeSeries` in `draw.ts`) so demo data is stable
  across visits.
- UI copy is **German**; code, comments and commit messages are **English**.
- React: type props, infer return type, no `React.FC`.
- `import/no-cycle` is an error — mind the `dashboards` ↔ `data` boundary.

## Gotchas

- `loadLiveData()` guards against StrictMode double-mount (`started` flag).
- Some APIs need pre-encoded query brackets (Treasury) or lag a few days
  (Wikimedia per-country) — see the inline notes in `sources.ts`.
- Country outlines (`data/world.ts` → `WORLD`) ship in the bundle, no fetch.
- `data/vintage.ts` holds `DATA_VINTAGE`, the year the bundled datasets were
  last refreshed. A Vite plugin warns on dev/build once it's stale; bump it
  only after actually updating the static cards (checklist in that file).
- Big files: `dashboards/cards.ts` (~1.5k lines, the pool) and
  `data/bundled.ts` (~1.1k lines, historical fallback series).
