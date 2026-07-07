// Public dashboard registry: the theme filter chips, the per-card tag map, the
// featured ordering and the assembled ring. Card definitions live in cards.ts,
// their shared factories in cardHelpers.ts.

import type { Dashboard } from './types';
import { POOL } from './cards';

export { type Dashboard, SETTLED_T } from './types';
export { type DashboardTexture, createDashboardTexture } from './texture';

/** Filter chips shown in the bottom bar, in display order. */
export const TAGS: { id: string; label: string }[] = [
  { id: 'geld', label: 'GELD' },
  { id: 'krieg', label: 'KRIEG' },
  { id: 'deutschland', label: 'DEUTSCHLAND' },
  { id: 'soziales', label: 'SOZIALES' },
  { id: 'freiheit', label: 'FREIHEIT' },
  { id: 'gesundheit', label: 'GESUNDHEIT' },
  { id: 'welt', label: 'WELT' },
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
  'us-debt': ['geld'],
  nukes: ['krieg'],
  'homicide-map': ['soziales', 'welt'],
  'swiss-pop': ['welt', 'soziales'],
  'world-pop': ['welt', 'soziales'],
  'oil-consumption': ['welt', 'geld'],
  'conflict-deaths': ['krieg'],
  refugees: ['krieg', 'soziales'],
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
  'de-insolvenz-jobs': ['deutschland', 'geld'],
  'de-industry': ['deutschland', 'geld'],
  'de-migration': ['deutschland', 'soziales'],
  'de-crime-foreign': ['deutschland', 'soziales'],
  'de-knife-attacks': ['deutschland', 'soziales'],
  'de-group-rape': ['deutschland', 'soziales'],
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
  cashless: ['geld', 'welt'],
  '5g-stations': ['welt'],
  inflation: ['geld', 'welt'],
  'digital-id': ['welt', 'soziales', 'freiheit'],
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
};
for (const d of POOL) d.tags = TAGS_BY_ID[d.id] ?? [];

/**
 * Hand-picked headliners: these lead the ring so the strongest panels sit up
 * front on load; the rest of the pool follows behind them.
 */
const FEATURED = new Set([
  'us-wars', 'us-bases', 'modern-slavery', 'corruption', 'incarceration', 'obesity-nations', 'nukes',
  'us-debt', 'us-interest', 'm2', 'dollar', 'wealth', 'homicide-map',
  'world-pop', 'oil-consumption', 'de-insolvenz-jobs', 'conflict-deaths', 'refugees',
  'military', 'de-industry', 'recent-wars', 'de-state-quota', 'de-tax-quota', 'de-power-prices', 'de-old-age-ratio', 'de-aging-nations', 'berlin-warrants',
  'youth-unemployment', 'unemployment', 'poverty',
  'teen-mde', 'female-lfp',
  'teen-screen', 'teen-antidepressants', 'obesity-fastfood', 'surveillance',
  'cameras-world', 'internet-shutdowns', 'press-freedom-nations', 'book-bans', 'jailed-journalists', 'asset-correlation',
  'gov-requests-country', 'youtube-removals', '5g-stations',
  'un-resolutions', 'de-family', 'single-households', 'inflation',
  'digital-id', 'alcohol-nations', 'alcohol-deaths', 'c40-cities',
  'covid-stringency', 'covid-lockdowns', 'covid-vax-percapita',
  'real-wages', 'homeownership', 'cb-balance',
  'wealth-divergence', 'food-fertilizer', 'pension-level', 'rent-burden',
  'de-underemployment',
]);

/**
 * Featured panels come first (shuffled among themselves each page load),
 * the remaining pool shuffled after them. The whole pool is on stage; a
 * theme filter narrows it to the tagged cards.
 */
export const ALL_DASHBOARDS: Dashboard[] = [
  ...shuffled(POOL.filter((d) => FEATURED.has(d.id))),
  ...shuffled(POOL.filter((d) => !FEATURED.has(d.id))),
];

/** Floor for the ring radius, so a small filtered set still spaces out well. */
export const MIN_COUNT = 5;
