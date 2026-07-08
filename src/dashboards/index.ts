// Public dashboard registry: the theme filter chips, the per-card tag map, the
// featured ordering and the assembled ring. Card definitions live in cards.ts,
// their shared factories in cardHelpers.ts.

import type { Dashboard } from './types';
import { POOL } from './cards';
import { SERIES } from './theme';

export { type Dashboard, SETTLED_T } from './types';
export { type DashboardTexture, createDashboardTexture } from './texture';

/**
 * Filter chips shown in the bottom bar, in display order. Each theme carries
 * an accent from the categorical palette (never hand-picked hex — see
 * theme.ts): the 3D scene tints its ambience toward it, so switching themes
 * reads as a scene change, not just a card swap.
 */
export const TAGS: { id: string; label: string; accent: string }[] = [
  { id: 'geld', label: 'GELD', accent: SERIES[2] }, // gold
  { id: 'krieg', label: 'KRIEG', accent: SERIES[5] }, // red
  { id: 'deutschland', label: 'DEUTSCHLAND', accent: SERIES[7] }, // orange
  { id: 'soziales', label: 'SOZIALES', accent: SERIES[6] }, // magenta
  { id: 'freiheit', label: 'FREIHEIT', accent: SERIES[4] }, // violet
  { id: 'gesundheit', label: 'GESUNDHEIT', accent: SERIES[1] }, // aqua
  { id: 'welt', label: 'WELT', accent: SERIES[0] }, // blue
];

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Theme tags per card; cards may carry several (the industry chart is both
// a Germany and a money story). Applied to the POOL right below.
const TAGS_BY_ID: Record<string, string[]> = {
  military: ['krieg'],
  'military-per-soldier': ['krieg', 'geld'],
  'military-gdp': ['krieg', 'geld'],
  'us-debt': ['geld'],
  nukes: ['krieg'],
  'homicide-map': ['soziales', 'welt'],
  'swiss-pop': ['welt', 'soziales'],
  'world-pop': ['welt', 'soziales'],
  'oil-consumption': ['welt', 'geld'],
  'conflict-deaths': ['krieg'],
  refugees: ['krieg', 'soziales'],
  'refugees-interventions': ['krieg', 'soziales', 'welt'],
  'us-interest': ['geld'],
  overdose: ['gesundheit'],
  'debt-gdp': ['geld', 'welt'],
  'eu-debt-map': ['geld'],
  'pop-share': ['welt', 'soziales'],
  'life-exp': ['gesundheit', 'welt'],
  'life-exp-nations': ['gesundheit', 'welt'],
  m2: ['geld', 'welt'],
  'm2-history': ['geld'],
  'ai-jobs': ['soziales', 'geld'],
  'youth-unemployment': ['soziales', 'welt'],
  unemployment: ['soziales', 'welt'],
  poverty: ['soziales', 'welt'],
  'poorest-nations': ['soziales', 'welt'],
  'de-insolvenz-jobs': ['deutschland', 'geld'],
  'de-industry': ['deutschland', 'geld'],
  'de-migration': ['deutschland', 'soziales'],
  'de-migration-flows': ['deutschland', 'soziales', 'welt'],
  'pl-migration': ['deutschland', 'soziales', 'welt'],
  'de-population': ['deutschland', 'soziales'],
  'de-crime-foreign': ['deutschland', 'soziales'],
  'de-assault': ['deutschland', 'soziales'],
  'de-knife-attacks': ['deutschland', 'soziales'],
  'de-tvbz-violence': ['deutschland', 'soziales'],
  'de-tvbz-age': ['deutschland', 'soziales'],
  'de-tvbz-rape': ['deutschland', 'soziales'],
  'ch-zurich-afghan-crime': ['soziales', 'welt'],
  'de-tax-quota': ['deutschland', 'geld'],
  'de-power-prices': ['deutschland', 'geld', 'welt'],
  'berlin-warrants': ['deutschland', 'soziales'],
  'de-state-quota': ['deutschland', 'geld'],
  'de-old-age-ratio': ['deutschland', 'soziales', 'geld'],
  'de-aging-nations': ['welt', 'soziales'],
  'internet-shutdowns': ['welt', 'soziales', 'freiheit'],
  'press-freedom-nations': ['welt', 'soziales', 'freiheit'],
  'jailed-journalists': ['welt', 'soziales', 'freiheit'],
  'asset-correlation': ['geld', 'welt'],
  'book-bans': ['soziales', 'welt', 'freiheit'],
  internet: ['welt'],
  'world-hunger': ['welt', 'gesundheit'],
  'extreme-poverty': ['welt', 'soziales'],
  'nuke-tests': ['krieg'],
  'obesity-nations': ['gesundheit', 'welt'],
  fertility: ['welt', 'soziales'],
  dollar: ['geld'],
  armies: ['krieg'],
  wealth: ['geld', 'soziales'],
  'tax-burden': ['geld', 'welt'],
  'power-prices': ['geld', 'welt'],
  incarceration: ['soziales', 'welt', 'freiheit'],
  corruption: ['soziales', 'welt'],
  'us-bases': ['krieg', 'welt'],
  'modern-slavery': ['welt', 'soziales', 'freiheit'],
  'us-wars': ['krieg'],
  'recent-wars': ['krieg'],
  'teen-mde': ['gesundheit', 'soziales'],
  'female-lfp': ['deutschland', 'soziales'],
  'teen-screen': ['gesundheit', 'soziales'],
  'teen-antidepressants': ['gesundheit', 'soziales'],
  'de-energy-mix': ['deutschland', 'welt'],
  'obesity-fastfood': ['gesundheit'],
  surveillance: ['welt', 'soziales', 'freiheit'],
  'cameras-world': ['welt', 'soziales', 'freiheit'],
  'gov-requests-country': ['welt', 'soziales', 'freiheit'],
  'youtube-removals': ['welt', 'soziales', 'freiheit'],
  cashless: ['geld', 'welt', 'freiheit'],
  '5g-stations': ['welt'],
  inflation: ['geld', 'welt'],
  'digital-id': ['welt', 'soziales', 'freiheit'],
  'digital-id-gap': ['welt', 'soziales', 'freiheit'],
  'cash-limits': ['geld', 'freiheit', 'welt'],
  'age-verify': ['welt', 'soziales', 'freiheit'],
  'age-verify-nations': ['welt', 'soziales', 'freiheit'],
  'air-pnr': ['welt', 'freiheit', 'soziales'],
  'kyc-crypto': ['geld', 'welt', 'freiheit'],
  'alcohol-nations': ['gesundheit', 'welt'],
  'alcohol-deaths': ['gesundheit'],
  'c40-cities': ['welt'],
  'un-resolutions': ['welt', 'krieg'],
  'de-family': ['deutschland', 'soziales'],
  'single-households': ['deutschland', 'soziales'],
  'covid-stringency': ['gesundheit', 'welt', 'soziales'],
  'covid-lockdowns': ['gesundheit', 'welt', 'soziales'],
  'covid-vax-percapita': ['gesundheit', 'welt'],
  'real-wages': ['geld', 'deutschland', 'soziales'],
  homeownership: ['geld', 'welt', 'soziales'],
  'cb-balance': ['geld', 'welt'],
  'wealth-divergence': ['geld', 'soziales'],
  'food-fertilizer': ['welt', 'geld', 'gesundheit'],
  'pension-level': ['geld', 'deutschland', 'soziales'],
  'rent-burden': ['geld', 'deutschland', 'soziales'],
  'de-underemployment': ['deutschland', 'soziales', 'geld'],
  'de-exports': ['deutschland', 'geld', 'welt'],
  cbdc: ['geld', 'welt', 'freiheit'],
  'freedom-decline': ['welt', 'freiheit'],
  'covid-rights': ['welt', 'freiheit', 'gesundheit'],
  'de-speech-cases': ['deutschland', 'freiheit'],
  'uk-speech-arrests': ['welt', 'freiheit'],
  'young-homeownership': ['geld', 'soziales', 'freiheit'],
  'lez-zones': ['welt', 'freiheit'],
  'shutdowns-per-year': ['welt', 'freiheit'],
  'gene-therapies': ['gesundheit', 'welt', 'freiheit'],
  'smartphone-leash': ['welt', 'soziales', 'freiheit'],
  'autocracy-share': ['welt', 'freiheit'],
  'fiat-lifespan': ['geld', 'welt', 'freiheit'],
};
for (const d of POOL) d.tags = TAGS_BY_ID[d.id] ?? [];

/**
 * Hand-picked headliners: these lead the ring so the strongest panels sit up
 * front on load; the rest of the pool follows behind them.
 */
const FEATURED = new Set([
  'us-wars', 'us-bases', 'modern-slavery', 'corruption', 'incarceration', 'obesity-nations', 'nukes',
  'us-debt', 'us-interest', 'm2', 'dollar', 'wealth', 'homicide-map',
  'world-pop', 'oil-consumption', 'de-insolvenz-jobs', 'conflict-deaths', 'refugees', 'refugees-interventions',
  'military', 'military-per-soldier', 'military-gdp', 'de-industry', 'recent-wars', 'de-state-quota', 'de-tax-quota', 'de-power-prices', 'de-old-age-ratio', 'de-aging-nations', 'berlin-warrants',
  'youth-unemployment', 'unemployment', 'poverty',
  'teen-mde', 'female-lfp',
  'teen-screen', 'teen-antidepressants', 'obesity-fastfood', 'surveillance',
  'cameras-world', 'internet-shutdowns', 'press-freedom-nations', 'book-bans', 'jailed-journalists', 'asset-correlation',
  'gov-requests-country', 'youtube-removals', '5g-stations',
  'un-resolutions', 'de-family', 'single-households', 'inflation',
  'digital-id', 'digital-id-gap', 'cash-limits', 'alcohol-nations', 'alcohol-deaths', 'c40-cities',
  'covid-stringency', 'covid-lockdowns', 'covid-vax-percapita',
  'real-wages', 'homeownership', 'cb-balance',
  'wealth-divergence', 'food-fertilizer', 'pension-level', 'rent-burden',
  'de-underemployment', 'de-migration-flows', 'pl-migration', 'de-population', 'de-assault',
  'cbdc', 'cashless', 'kyc-crypto', 'air-pnr', 'age-verify-nations',
  'freedom-decline', 'covid-rights', 'de-speech-cases',
  'uk-speech-arrests', 'young-homeownership', 'smartphone-leash', 'autocracy-share',
  'fiat-lifespan',
]);

/**
 * The ring is clustered by theme: cards are grouped by their primary tag (the
 * first in TAGS_BY_ID) in the TAGS chip order, so related panels sit together
 * as an arc rather than scattered. Within each cluster the featured panels lead
 * and both halves are shuffled, so the strong cards front each theme while the
 * order still varies per load. Untagged cards trail at the end.
 */
function clustered(cards: Dashboard[]): Dashboard[] {
  return [
    ...shuffled(cards.filter((d) => FEATURED.has(d.id))),
    ...shuffled(cards.filter((d) => !FEATURED.has(d.id))),
  ];
}

export const ALL_DASHBOARDS: Dashboard[] = [
  ...TAGS.flatMap((t) => clustered(POOL.filter((d) => d.tags?.[0] === t.id))),
  ...clustered(POOL.filter((d) => !d.tags?.length)),
];

/**
 * Hard cap for the desktop ring: at most RING_MAX cards per theme. Featured
 * cards fill the ring first; both halves are shuffled once per load, so the
 * overflow rotates across visits instead of the same cards always being cut.
 * Mobile keeps the full per-theme pool — a swipe deck has no crowding problem.
 */
export const RING_MAX = 20;

export const RING_BY_TAG: Record<string, Dashboard[]> = Object.fromEntries(
  TAGS.map((t) => [
    t.id,
    clustered(POOL.filter((d) => d.tags?.includes(t.id))).slice(0, RING_MAX),
  ]),
);

/** Floor for the ring radius, so a small filtered set still spaces out well. */
export const MIN_COUNT = 5;
