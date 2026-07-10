# Testing

Vitest + jsdom. The suite targets the **pure logic** that drives features —
geometry, data math, i18n, persistence — plus a smoke test that renders every
dashboard card offline. The WebGL/R3F layer and canvas pixels are intentionally
not unit-tested (that's visual-regression territory).

```bash
pnpm test        # vitest run — headless, ~3s; CI runs this between lint and build
pnpm test:watch
```

## Layout

Test files sit next to their source (`foo.ts` → `foo.test.ts`). Config lives in
`vitest.config.ts` (standalone from `vite.config.ts` so the git/vintage plugins
don't run under test). Test files are excluded from `tsconfig.app.json`, so
`tsc -b` (the production build) never type-checks them.

`src/test/setup.ts` polyfills a working `localStorage` (Node 26 gates its own
behind a flag; jsdom 29 doesn't expose one here) and clears it between tests.
`src/test/fakeCanvas.ts` is a dependency-free `CanvasRenderingContext2D` stub
used by the card smoke test — no `node-canvas` native build in CI.

## What's covered

| Area | File | Guards |
|------|------|--------|
| Formations | `src/layouts.test.ts` | slot count, ring rotation-symmetry, `n=1` helix edge case, sphere radius, no NaN |
| Series math | `src/data/series.test.ts` | `niceScale`/`logScale` rounding, `norm`, `resample`, `yearly`/`interpAt`, `trend` |
| Draw helpers | `src/dashboards/draw.test.ts` | PRNG determinism + bounds, `easeOut`/`stagger` clamp, `fmtCompact` thresholds |
| i18n | `src/i18n/i18n.test.ts` | `t()` fallback + composed `A · B` segments, locale number/percent formatters, dictionary sanity |
| Favorites | `src/favorites.test.ts` | toggle order, prune unknown ids, persistence, pub/sub, `favoriteDashboards` |
| Data cache | `src/data/cache.test.ts` | TTL hit/miss, corrupt-entry fallthrough, prefix-scoped clear, `fetchJson` errors |
| Theme | `src/dashboards/theme.test.ts` | palette invariants — status colors never double as series colors |
| **Card integrity** | `src/dashboards/cards.smoke.test.ts` | every card's `draw()` runs offline (no live data) at intro + settled without throwing |
| Filter hooks | `src/hooks/useTagFilter.test.ts`, `useThemeFilter.test.ts` | URL/storage precedence, FAVORITEN chip lifecycle |

The card smoke test is the primary safety net: it catches the most common real
regression — a card reading `live.x.y` without a fallback and crashing the ring
when a feed is down or slow.

## Conventions

- No global test APIs — import `{ describe, it, expect, vi }` from `vitest`.
- Module singletons (favorites list, i18n `LOCALE`) are isolated with
  `vi.resetModules()` + dynamic `import()`, or reset via the module's own API.
- Time-dependent code (cache TTL) uses `vi.useFakeTimers()` + `setSystemTime`.
- Assertions derive expected values from source where possible (e.g. i18n reads
  the real dictionary) so wording changes don't break tests.
