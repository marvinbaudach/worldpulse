# Design: Menschenhandel- & Drogenhandel-Weltkarten

Two new bundled choropleth cards for the WorldPulse ring, covering modern
slavery (human trafficking) and drug-related deaths worldwide.

## Goal

Add two serious, sourced world-map cards that reuse the existing
`choroplethMap` renderer — one shading countries by modern-slavery prevalence,
one by drug-related mortality. Both are static/bundled (no keyless live feed
exists for either), matching `executions-map` and `lgbt-criminal-map`.

## Non-goals

- No live data fetcher, no new `LIVE_FEEDS` entry, no `LiveData` field.
- No new chart renderer — `choroplethMap` already does everything needed.
- The drug card does **not** claim to map trafficking *volume/revenue*; it maps
  *deaths*, and the label/source say so.

## Card 1 — „Menschenhandel · moderne Sklaverei weltweit"

- **Renderer:** `choroplethMap`, full world (default bounds -180..180 / -60..85).
- **Shading metric:** estimated people in modern slavery **per 1,000
  population** — Walk Free, *Global Slavery Index 2023*. Colors every country →
  true worldwide picture (the North-Korea / Gulf / Sahel belt is the story).
- **Ranked list (top-5):** absolute victim counts, so the card shows both rate
  (map) and scale (list): India, China, North Korea, Pakistan, Russia.
- **Ramp:** `magenta` (theme SERIES) — distinct from the red execution/temp maps.
- **`value` headline:** global total ≈ 50 million in modern slavery.
- **Source line (German):** "Walk Free · Global Slavery Index 2023 · geschätzte
  Betroffene je 1.000 Einwohner; Nordkorea extrapoliert, Schätzungen."
- **Tags:** `['welt', 'soziales', 'freiheit']`.

## Card 2 — „Drogenhandel · Drogentote"

- **Renderer:** `choroplethMap` with a **regional `bounds`** window on the
  Americas + Europe (roughly `lonMin -130, lonMax 45, latMin 5, latMax 72`) —
  drug-death data is sparse in much of Africa/Asia, and the Americas/Europe is
  where the trade's mortality concentrates. Countries outside the window fall
  off (the renderer clips to the map area).
- **Shading metric:** drug-related deaths **per 100,000 population** — UNODC
  *World Drug Report* / IHME *Global Burden of Disease*. USA stands out sharply
  (opioid/fentanyl crisis).
- **Ranked list (top-5):** highest deaths-per-100k countries.
- **Ramp:** theme `red`/`orange` — semantic for mortality.
- **Source line (German):** "UNODC World Drug Report 2023 / IHME GBD ·
  drogenbedingte Todesfälle je 100.000 Einwohner."
- **Tags:** `['welt', 'gesundheit', 'overdose', 'soziales']` (the `overdose`
  tag already exists).

## Data (verified against original sources before build)

Both datasets are `Record<ISO3, number>` in `src/dashboards/geo.ts`, each
preceded by a sourced English comment block (like `EXECUTIONS_2024` /
`LGBT_CRIMINAL`). Per the user decision, the per-country values are checked
against the actual Walk Free GSI 2023 country table and the IHME/UNODC
drug-death tables (WebSearch/WebFetch) rather than filled from memory. Rounded,
clearly-estimated figures; sources cited on the card.

- `MODERN_SLAVERY_1K: Record<ISO3, number>` — prevalence per 1,000, ~40–60
  countries covering every region so no continent reads as empty.
- `DRUG_DEATHS_100K: Record<ISO3, number>` — deaths per 100k, focused on the
  Americas + Europe window plus a few high-value outliers.

## Cross-cutting

- **cards.ts:** two card defs in `POOL`, placed next to `executions-map`. Build
  the `choroplethMap` config **inside `draw`** (convention). Both cards leave
  `dynamic`/`live` off (purely bundled).
- **index.ts:** add `TAGS_BY_ID` entries, `LAST_UPDATED`-style timestamps, and
  include both ids in the relevant order/`FEATURED` list.
- **i18n:** every new German string (labels, list row names, captions) gets a
  matching key in `src/i18n/{en,fr,it}.ts`; missing keys fall through to German.
- **vintage.ts:** `DATA_VINTAGE` is already `2026`; the 2023-dated datasets are
  within vintage, so no bump — but the `geo.ts` refresh note covers them.

## Testing / verification

- `npm run lint` (oxlint) and `npm run build` (tsc -b) must both pass — CI runs
  both.
- Manual: run `npm run dev`, confirm both cards render on desktop
  (`Carousel3D`) and mobile (`MobileDeck`), the map shades, the ranked list
  fits, and the source line shows. Screenshot key breakpoints if needed.
- Confirm i18n: switch `en`/`fr`/`it` and verify no raw German leaks in
  translated segments.

## Risks

- **Data sensitivity:** figures are estimates on contested topics; the card
  copy names the metric precisely and cites the source, and avoids overclaiming
  ("Drogentote", not "Drogenhandel-Umsatz").
- **Regional-window fit:** the choropleth's list-height reservation assumes a
  near-square regional map; verify the top-5 rows still fit under the
  Americas/Europe window (the renderer already caps map height for this).
