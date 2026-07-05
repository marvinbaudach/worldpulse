# Worldpulse

Cinematic 3D data carousel — up to 30 animated dashboards (canvas-rendered
charts, treemaps, world maps, a live US debt clock) orbit in space with drag
inertia and depth cues. Every panel shows real public data with a
geopolitical/financial bent: national debt ticking up live (US Treasury),
military spending and homicide rates (World Bank), nuclear warheads on a
world map (FAS), refugees, fertility by continent and population history
(UN), debt-to-GDP and reserve currencies (IMF), a Zurich forecast
(Open-Meteo) and the most-read Wikipedia articles (Wikimedia). Panels not
backed by a live API ship with sourced, yearly-revised data. The UI is
German (Swiss market); the codebase is English.

**Live → [marvinbaudach.github.io/worldpulse](https://marvinbaudach.github.io/worldpulse/)**

Presenting: the bottom bar morphs the set between ring, double rows, helix
and sphere formations (hotkeys 1–4) and adjusts the panel count 5–30
(persisted); optional webcam hand gestures spin the ring and grab panels.

## Tech

- React Three Fiber · Three.js · drei · postprocessing (Bloom, Vignette)
- Vite 8 · React 19 · TypeScript 6 · oxlint
- Dashboards drawn with Canvas 2D into `CanvasTexture`s — panels only redraw
  when their data changes; a CVD-validated dark chart palette
- Live data layer: keyless CORS APIs, derived shapes cached in localStorage,
  every panel falls back to bundled data offline; the loading screen's feed
  list derives from the same manifest as the fetchers, so it cannot drift
- Formation morphs: per-panel slot targets with staggered damped flight;
  ring radius, camera distance and fog scale with the panel count
- Rotation and animation driven entirely in `useFrame` (no per-frame React
  state); adaptive render resolution via `PerformanceMonitor`
- CI: lint + type-checked build, deployed to GitHub Pages on push to `main`

## Develop

```bash
npm install
npm run dev      # dev server
npm run build    # type-checked production build
npm run lint
```
