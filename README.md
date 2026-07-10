# Worldpulse

3D data carousel of animated, live-data dashboards (US debt, military spending,
nuclear warheads, refugees, population, Zurich forecast, Wikipedia trends).
Panels orbit in space with drag inertia and morph between ring, rows, helix
and sphere formations.

**Live → [marvinbaudach.github.io/worldpulse](https://marvinbaudach.github.io/worldpulse/)**

## Features

- **Live data, no keys** — dozens of dashboards from keyless public APIs, cached in localStorage, each with a bundled offline fallback
- **3D carousel** — panels orbit with drag inertia and morph between ring, rows, helix and sphere formations
- **Canvas-drawn charts** — every panel is painted in Canvas 2D into a WebGL texture and only redraws on data change
- **Theme filters** — browse by topic; the scene re-tints to the active theme
- **Four languages** — German, English, French, Italian, picked from the browser
- **Desktop & mobile** — WebGL ring on desktop, a 2D swipe deck on phones
- **Bloom + adaptive resolution** — postprocessing glow with render resolution that scales to the device

## Tech

- **Stack:** React Three Fiber · Three.js · drei · postprocessing (Bloom, Vignette) · Vite 8 · React 19 · TypeScript 6 · oxlint
- **Dashboards:** Canvas 2D into `CanvasTexture`s; panels only redraw on data change; CVD-validated dark palette
- **i18n:** German · English · French · Italian, picked from the browser language; dictionaries keyed by the German source strings, translated centrally in the chart renderers
- **Data:** keyless CORS APIs, derived shapes cached in localStorage, every panel falls back to bundled data offline; the loading screen's feed list derives from the same manifest as the fetchers, so it cannot drift
- **Formations:** per-panel slot targets with staggered damped flight; ring radius, camera distance and fog scale with panel count
- **Animation:** driven entirely in `useFrame` (no per-frame React state); adaptive render resolution via `PerformanceMonitor`
- **CI:** lint + type-checked build, deployed to GitHub Pages on push to `main`

## Develop

```bash
pnpm install
pnpm dev         # dev server
pnpm build       # type-checked production build
pnpm lint
```
