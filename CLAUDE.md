# Worldpulse — Agent Guide

3D data carousel: canvas-drawn dashboards on WebGL panels that orbit and morph
between formations, fed by keyless public APIs. React 19 · React Three Fiber ·
Three.js · Vite 8 · TypeScript 6 · oxlint. Deploys to GitHub Pages on push to
`main`.

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
- UI copy is authored in **German**; code, comments and commit messages are
  **English**. i18n (`src/i18n/`): `t()` maps the German source string to the
  browser language (de/en/fr/it, fallback en) via dictionaries keyed by the
  exact German text. Translation happens centrally in the renderers
  (`drawEyebrow`, `drawSource`, `drawLegend`, `withFlag`, era markers…) — card
  definitions stay German and untouched. When adding/changing German copy, add
  the same key to `src/i18n/{en,fr,it}.ts`; missing keys fall through to
  German, composed `A · B` labels translate per segment. A coverage guard
  (`i18n.coverage.test.ts`) renders every card with a recorder on `t()` and
  fails the build if a rendered German string is neither a dictionary key (in
  any of en/fr/it) nor listed in `identical.ts` — and separately flags *drift*
  (a string that only differs from an existing key by whitespace/case/dash/
  quote). So a new/reworded German string must be translated, or, if it truly
  reads the same in every locale, added to `identical.ts`. Strings whose English
  is identical but French/Italian differ live in `fr.ts`/`it.ts` only (extra
  keys), not `en.ts`.
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

## Data integrity & uncertainty

Single smoothed aggregates hide information. Where it adds real signal, show the
data's own uncertainty — but never substitute figures the source did not report.

- **Raw vs. adjusted, both labeled.** When a series has a raw and a
  seasonally-adjusted/modeled form (excess mortality, climate anomalies), draw
  both, clearly labeled, so the adjustment is visible rather than hidden — and
  cite the method.
- **Show real uncertainty.** Prefer sources that publish confidence intervals or
  revision history; render them (bands, revision ghosts) instead of a single
  false-precision line. Do not invent bands.
- **Passive-reporting caveats, honestly.** For systems like VAERS/EudraVigilance,
  annotate documented limitations (reporting latency, passive capture) as
  text/footnotes. Do not multiply reported counts by a chosen factor and present
  the result as a corrected value.
- **Demographics from the sources.** Dependency ratios, fertility, migration
  flows: pull straight from UN / World Bank / Eurostat, dated and sourced. Report
  what they show.
- **`bundled.ts` is an offline fallback, not an override.** When an API is down,
  fall back to the last real cached/bundled values for that same series. Never
  overlay bundled figures onto a live source to create a delta.

