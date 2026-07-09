# Design — Defense basket comparison card

Date: 2026-07-09

## Goal

The ring shows one defense-stock card today: **`defense-stocks`**, a solo
Rheinmetall area chart in absolute € (€35 → €1600). The user wants to broaden it
to "more defense stocks, also USA, maybe an ETF" — Rheinmetall as one member of a
wider sector rally, not the whole story.

## Decisions (confirmed with user)

- **Scale:** indexed / rebased to `Anfang 2022 = ×1`, **log y-axis**. Mixing € and
  $ absolute prices is meaningless, and on a linear axis Rheinmetall's ×20 run
  crushes everything else into a flat line at the bottom. A log axis is the
  standard tool for comparing assets with very different growth and keeps all
  lines readable.
- **Instruments:** three lines — Rheinmetall (individual), a broad EU-defense
  proxy, and a US-defense ETF (covers "auch USA" + "vllt ETF" in one).
- **Card handling:** a **new second card**; the solo Rheinmetall card stays
  untouched.
- **Window:** 2019 → heute, so ~2 quiet pre-war years (flat near ×1) precede the
  post-Zeitenwende divergence.
- **Framing (honesty):** data-wise Rheinmetall is the sector's extreme outlier,
  not a "small number". The truthful chart shows it leading by a wide margin;
  that is the intended story ("die ganze Branche re-ratet — Rheinmetall am
  extremsten").

## Data (illustrative, rounded — like the rest of the bundled series)

Rebased so `Anfang 2022 (≈ Jahresende 2021) = ×1`. Rheinmetall factors come from
the solo card's own year-end anchors (÷83).

| Jahr | 🇩🇪 Rheinmetall | 🇪🇺 EU-Rüstung | 🇺🇸 US-Rüstung (ITA) |
|------|-----------------|----------------|----------------------|
| 2019 | 1.2 | 1.0 | 1.0 |
| 2020 | 1.05 | 1.0 | 1.0 |
| 2021 | 1.0 | 1.0 | 1.0 |
| 2022 | 2.2 | 1.3 | 1.1 |
| 2023 | 3.5 | 1.7 | 1.25 |
| 2024 | 7.4 | 2.4 | 1.5 |
| 2025 | 19.3 | 4.2 | 2.0 |

Grounding: Rheinmetall ×~20 since the invasion (matches the solo card's `×20`
note); European defense sector re-rated hard through 2024–2025 (VanEck Defense
UCITS +55 % in 2024, +131 % since its 2023 launch) → ×~4; iShares U.S. Aerospace
& Defense (ITA, a real ETF with full history) more muted → ×~2.

## Rendering

Reuse the existing multi-series `lineChart` (as the `m2` "Geldmenge · 2000 = 1×"
card already does). No renderer changes.

- Series[0] = Rheinmetall (`red`, matches the solo card, is the front series →
  gets the live endpoint pulse; era markers ride its curve). EU = `blue`,
  US = `yellow` (all from the CVD-validated `SERIES` palette).
- Legend names carry a flag emoji inline: `🇩🇪 Rheinmetall`, `🇪🇺 EU-Rüstung`,
  `🇺🇸 US-Rüstung`.
- Era markers via `eraMarkers(2019, 2025, …)`: `⚔️ Zeitenwende` (2022),
  `🇪🇺 ReArm Europe` (2025).
- x labels `['2019','2021','2023','heute']`.

### New series math (isolated, in `src/data/series.ts`)

`compareSeries` normalizes onto a **linear** `niceScale`, which is what crushes
the ETFs. Add two small siblings, leaving `compareSeries`/`niceScale` untouched:

- `logScale(min, max, fmt, base = 2)` → geometric bounds snapped to powers of
  `base` with a tick per gridline. For min ≈ 1, max ≈ 19.3 → `lo = 1`, `hi = 32`,
  ticks `×1 ×2 ×4 ×8 ×16 ×32`.
- `compareSeriesLog(anchors, fmt, extra, samples)` → mirrors `compareSeries` but
  log-normalizes each series `(ln v − ln lo) / (ln hi − ln lo)`. All anchors are
  ≥ 1, so no non-positive inputs. Rheinmetall's ×19.3 lands at ~0.85 height
  (between the ×16 and ×32 gridlines); the ETFs sit at ~0.19 / ~0.41 — readable.

`DEFENSE_COMPARE` is built with `compareSeriesLog` in `src/data/bundled.ts`,
exposing `{ rows, ticks, rheinLatest: 19.3 }`.

## Registration (per CLAUDE.md "Adding a dashboard card")

- New card object in `POOL` (`src/dashboards/cards.ts`), placed next to the solo
  `defense-stocks` card; id `defense-basket`. Purely bundled → no `dynamic`/`live`.
- `TAGS_BY_ID['defense-basket'] = ['maerkte','krieg','geld']` (same as the solo).
- `ADDED_BY_ID['defense-basket'] = '2026-07-09T…'` and add to `FEATURED`, next to
  `defense-stocks`.
- i18n: add the new German source/label/legend strings to `src/i18n/{en,fr,it}.ts`.
- No `DATA_VINTAGE` bump (already 2026; only new data added).

## Out of scope (YAGNI)

Individual US/EU tickers, a broad-market (S&P/MSCI) reference line, live price
fetching, and any log-axis support inside the shared chart renderer.
