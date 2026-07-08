// Vintage marker for the bundled (non-live) datasets. Bump this to the
// current year AFTER refreshing the static cards — the Vite plugin in
// vite.config.ts prints a loud reminder on every dev start and build once
// the calendar year moves past it.
//
// What a yearly refresh touches (all in src/):
//   - data/bundled.ts        — historical series & fallback panels
//   - dashboards/cards.ts    — static POOL cards and their year labels
//                              (PKS/BKA crime stats, OECD/Eurostat rates,
//                              FAS nuclear estimate, IMF debt, UNHCR, …)
//   - dashboards/geo.ts      — CPI scores, EU debt, WHO treaty status
//
// The seven LIVE_FEEDS in data/sources.ts update themselves and need no bump.
export const DATA_VINTAGE = 2026;
