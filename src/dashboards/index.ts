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
 *
 * `primary` themes render as always-visible chips in the desktop bar; the
 * rest live in its "MEHR" popover so the bar stays a fixed width no matter
 * how many themes the pool grows. Mobile's ThemeSheet ignores the flag and
 * lists everything.
 */
export const TAGS: { id: string; label: string; accent: string; primary?: boolean }[] = [
  { id: 'geld', label: 'GELD', accent: SERIES[2], primary: true }, // gold
  // All 8 categorical slots are taken (see TECH below) — MÄRKTE shares green
  // with the NEU meta chip; the palette is fixed (CVD-validated).
  { id: 'maerkte', label: 'MÄRKTE', accent: SERIES[3], primary: true }, // green
  { id: 'krieg', label: 'KRIEG', accent: SERIES[5], primary: true }, // red
  { id: 'deutschland', label: 'DEUTSCHLAND', accent: SERIES[7], primary: true }, // orange
  { id: 'soziales', label: 'SOZIALES', accent: SERIES[6], primary: true }, // magenta
  { id: 'freiheit', label: 'FREIHEIT', accent: SERIES[4], primary: true }, // violet
  { id: 'gesundheit', label: 'GESUNDHEIT', accent: SERIES[1] }, // aqua
  // Pandemic dossier: everything COVID — measures, vaccinations, excess
  // mortality. Shares aqua with GESUNDHEIT (the palette is fixed).
  { id: 'corona', label: 'CORONA', accent: SERIES[1] }, // aqua
  // All 8 categorical slots are taken, so TECH shares violet with FREIHEIT —
  // the palette is fixed (CVD-validated), never extended by hand.
  { id: 'tech', label: 'TECH', accent: SERIES[4] }, // violet
  { id: 'welt', label: 'WELT', accent: SERIES[0] }, // blue
  // Climate category: the live world-temperature map plus the deep-time
  // paleoclimate panels. Shares aqua with GESUNDHEIT — the palette is fixed
  // (CVD-validated), and aqua reads cold/ice for a climate theme.
  { id: 'klima', label: 'KLIMA', accent: SERIES[1] }, // aqua
  // Review chip: the whole pool ordered newest-first (see ADDED_BY_ID) instead
  // of the usual clustered shuffle, so freshly added cards are easy to check.
  { id: 'neu', label: 'NEU', accent: SERIES[3] }, // green
  // Personal stack: gets its cards from the favorites store at runtime, so it
  // has no static pool entry (see RING_BY_TAG below). Shares gold with GELD —
  // the palette is fixed (CVD-validated), and gold matches the star.
  { id: 'favoriten', label: 'FAVORITEN', accent: SERIES[2] }, // gold
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
  mideast: ['krieg', 'welt'],
  'military-per-soldier': ['krieg', 'geld'],
  'military-gdp': ['krieg', 'geld'],
  'us-debt': ['geld'],
  nukes: ['krieg'],
  'homicide-map': ['soziales', 'welt'],
  'temp-map': ['klima', 'welt'],
  'holocene': ['klima', 'welt'],
  'ice-cores': ['klima', 'welt'],
  'deglaciation': ['klima', 'welt'],
  'sea-level': ['klima', 'welt'],
  'swiss-pop': ['welt', 'soziales'],
  'world-pop': ['welt', 'soziales'],
  'oil-consumption': ['welt', 'geld'],
  'conflict-deaths': ['krieg'],
  'wars-interwar': ['krieg'],
  'wars-coldwar': ['krieg'],
  'ukraine-deaths': ['krieg'],
  refugees: ['krieg', 'soziales'],
  'refugees-interventions': ['krieg', 'soziales', 'welt'],
  'africa-eu-routes': ['welt', 'soziales'],
  'us-interest': ['geld'],
  overdose: ['gesundheit'],
  'debt-gdp': ['geld', 'welt'],
  'eu-debt-map': ['geld'],
  'pop-share': ['welt', 'soziales'],
  'life-exp': ['gesundheit', 'welt'],
  'life-exp-nations': ['gesundheit', 'welt'],
  m2: ['geld', 'welt'],
  'wealth-top1': ['geld', 'soziales'],
  'm2-history': ['geld'],
  'ai-jobs': ['soziales', 'geld', 'tech'],
  'ai-compute': ['tech'],
  'moore': ['tech'],
  'process-node': ['tech'],
  'compute-cost': ['tech', 'geld'],
  'genome-cost': ['tech'],
  'ai-training-cost': ['tech', 'geld'],
  'ai-training-models': ['tech', 'geld'],
  'ai-investment': ['tech', 'geld'],
  'ai-datacenter-power': ['tech', 'welt'],
  'ai-users': ['tech', 'soziales'],
  'youth-unemployment': ['soziales', 'welt'],
  unemployment: ['soziales', 'welt'],
  poverty: ['soziales', 'welt'],
  'poorest-nations': ['soziales', 'welt'],
  'de-insolvenz-jobs': ['deutschland', 'geld'],
  'de-industry': ['deutschland', 'geld'],
  'de-migration': ['deutschland', 'soziales'],
  'de-migration-flows': ['deutschland', 'soziales', 'welt'],
  'pl-migration': ['deutschland', 'soziales', 'welt'],
  'de-emigration-dest': ['deutschland', 'welt'],
  'de-population': ['deutschland', 'soziales'],
  'de-pop-nationality': ['deutschland', 'soziales'],
  'de-crime-foreign': ['deutschland', 'soziales'],
  'de-assault': ['deutschland', 'soziales'],
  'de-knife-attacks': ['deutschland', 'soziales'],
  'de-tvbz-violence': ['deutschland', 'soziales'],
  'de-tvbz-age': ['deutschland', 'soziales'],
  'de-tvbz-rape': ['deutschland', 'soziales'],
  'ch-zurich-afghan-crime': ['soziales', 'welt'],
  'de-tax-quota': ['deutschland', 'geld'],
  'de-income-tax-share': ['deutschland', 'geld', 'soziales'],
  'de-power-prices': ['deutschland', 'geld', 'welt'],
  'berlin-warrants': ['deutschland', 'soziales'],
  'de-state-quota': ['deutschland', 'geld'],
  'de-public-employment': ['deutschland', 'geld', 'soziales'],
  'de-old-age-ratio': ['deutschland', 'soziales', 'geld'],
  'de-aging-nations': ['welt', 'soziales'],
  'internet-shutdowns': ['welt', 'soziales', 'freiheit'],
  'press-freedom-nations': ['welt', 'soziales', 'freiheit'],
  'jailed-journalists': ['welt', 'soziales', 'freiheit'],
  'asset-correlation': ['geld', 'maerkte', 'welt'],
  'oil-price': ['maerkte', 'geld', 'welt'],
  vix: ['maerkte', 'geld'],
  'defense-stocks': ['maerkte', 'krieg', 'geld'],
  'gold-price': ['maerkte', 'geld'],
  'us-10y': ['maerkte', 'geld'],
  'margin-debt': ['maerkte', 'geld'],
  buffett: ['maerkte', 'geld'],
  'shiller-cape': ['maerkte', 'geld'],
  'mag7-share': ['maerkte', 'geld', 'tech'],
  'us-interest-tax': ['maerkte', 'geld'],
  'us-deficit': ['maerkte', 'geld'],
  'us-card-debt': ['maerkte', 'geld', 'soziales'],
  'auto-delinquency': ['maerkte', 'geld', 'soziales'],
  'office-vacancy': ['maerkte', 'geld'],
  'dollar-reserves': ['maerkte', 'geld', 'welt'],
  'zombie-firms': ['maerkte', 'geld'],
  'book-bans': ['soziales', 'welt', 'freiheit'],
  internet: ['welt', 'tech'],
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
  '5g-stations': ['welt', 'tech'],
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
  'covid-stringency': ['corona', 'welt', 'soziales'],
  'covid-lockdowns': ['corona', 'welt', 'soziales'],
  'covid-vax-percapita': ['corona', 'welt'],
  'real-wages': ['geld', 'deutschland', 'soziales'],
  homeownership: ['geld', 'welt', 'soziales'],
  'cb-balance': ['geld', 'welt'],
  'wealth-divergence': ['geld', 'soziales'],
  'food-fertilizer': ['welt', 'geld', 'gesundheit'],
  'pension-level': ['geld', 'deutschland', 'soziales'],
  'rent-burden': ['geld', 'deutschland', 'soziales'],
  'de-underemployment': ['deutschland', 'soziales', 'geld'],
  'de-buergergeld': ['deutschland', 'soziales', 'geld'],
  'de-exports': ['deutschland', 'geld', 'welt'],
  cbdc: ['geld', 'welt', 'freiheit'],
  'freedom-decline': ['welt', 'freiheit'],
  'covid-rights': ['corona', 'welt', 'freiheit'],
  'de-speech-cases': ['deutschland', 'freiheit'],
  'uk-speech-arrests': ['welt', 'freiheit'],
  'young-homeownership': ['geld', 'soziales', 'freiheit'],
  'lez-zones': ['welt', 'freiheit'],
  'shutdowns-per-year': ['welt', 'freiheit'],
  'gene-therapies': ['gesundheit', 'welt', 'freiheit'],
  'smartphone-leash': ['welt', 'soziales', 'freiheit'],
  'autocracy-share': ['welt', 'freiheit'],
  'fiat-lifespan': ['geld', 'welt', 'freiheit'],
  'face-recognition': ['welt', 'freiheit', 'tech'],
  'gold-anonymous': ['geld', 'freiheit', 'deutschland'],
  'gender-language': ['deutschland', 'soziales'],
  'gender-divide': ['soziales', 'welt'],
  'self-id-laws': ['welt', 'freiheit', 'soziales'],
  'rainbow-camps': ['welt', 'soziales'],
  'lgbt-criminal-map': ['welt', 'soziales', 'freiheit'],
  'executions-map': ['welt', 'freiheit', 'soziales'],
  genocides: ['krieg', 'welt'],
  'trans-youth': ['gesundheit', 'soziales'],
  'sdg-progress': ['welt', 'freiheit'],
  'who-funding': ['gesundheit', 'welt', 'geld'],
  'excess-mortality': ['corona', 'welt'],
  'covid-vax-excess': ['corona', 'deutschland'],
  'covid-vax-births': ['corona', 'deutschland', 'soziales'],
  'covid-myocarditis': ['corona'],
  'excess-mortality-map': ['corona', 'welt'],
  'covid-vax-map': ['corona', 'welt'],
  'cb-gold': ['geld', 'maerkte', 'welt'],
  'gold-reserves': ['geld', 'maerkte', 'welt'],
  'farm-decline': ['deutschland', 'soziales', 'geld'],
  'pisa': ['deutschland', 'soziales'],
  'media-trust': ['deutschland', 'freiheit', 'soziales'],
  'free-speech-feeling': ['deutschland', 'freiheit'],
  'ice-ban': ['welt', 'freiheit'],
  'birth-collapse': ['deutschland', 'soziales'],
  'meat-target': ['welt', 'gesundheit', 'freiheit'],
  'big-three': ['geld', 'maerkte', 'welt'],
};
for (const d of POOL) d.tags = TAGS_BY_ID[d.id] ?? [];

/**
 * When each card entered the pool (first commit touching its id in cards.ts;
 * uncommitted cards get the current date). Drives the NEU chip, which shows
 * the pool ordered newest-first so fresh cards are easy to review.
 */
const ADDED_BY_ID: Record<string, string> = {
  'military': '2026-07-07T07:48:18+02:00',
  'mideast': '2026-07-09T12:00:00+02:00',
  'military-per-soldier': '2026-07-07T12:06:22+02:00',
  'military-gdp': '2026-07-07T12:06:22+02:00',
  'us-debt': '2026-07-07T07:48:18+02:00',
  'nukes': '2026-07-07T07:48:18+02:00',
  'homicide-map': '2026-07-07T07:48:18+02:00',
  'swiss-pop': '2026-07-07T07:48:18+02:00',
  'world-pop': '2026-07-07T07:48:18+02:00',
  'oil-consumption': '2026-07-07T07:48:18+02:00',
  'conflict-deaths': '2026-07-07T07:48:18+02:00',
  'wars-interwar': '2026-07-08T23:59:00+02:00',
  'wars-coldwar': '2026-07-08T23:59:00+02:00',
  'ukraine-deaths': '2026-07-08T23:00:00+02:00',
  'refugees': '2026-07-07T07:48:18+02:00',
  'refugees-interventions': '2026-07-07T12:12:01+02:00',
  'africa-eu-routes': '2026-07-08T23:00:00+02:00',
  'us-interest': '2026-07-07T07:48:18+02:00',
  'overdose': '2026-07-07T07:48:18+02:00',
  'debt-gdp': '2026-07-07T07:48:18+02:00',
  'eu-debt-map': '2026-07-07T07:48:18+02:00',
  'pop-share': '2026-07-07T07:48:18+02:00',
  'life-exp': '2026-07-07T07:48:18+02:00',
  'life-exp-nations': '2026-07-07T07:48:18+02:00',
  'm2': '2026-07-07T07:48:18+02:00',
  'wealth-top1': '2026-07-08T12:00:00+02:00',
  'm2-history': '2026-07-07T07:48:18+02:00',
  'ai-jobs': '2026-07-07T07:48:18+02:00',
  'ai-compute': '2026-07-08T23:59:00+02:00',
  'moore': '2026-07-09T14:00:00+02:00',
  'process-node': '2026-07-09T14:01:00+02:00',
  'compute-cost': '2026-07-09T14:02:00+02:00',
  'genome-cost': '2026-07-09T14:03:00+02:00',
  'ai-training-cost': '2026-07-09T09:45:00+02:00',
  'ai-training-models': '2026-07-09T13:30:00+02:00',
  'ai-investment': '2026-07-08T23:59:00+02:00',
  'ai-datacenter-power': '2026-07-08T23:59:00+02:00',
  'ai-users': '2026-07-08T23:59:00+02:00',
  'youth-unemployment': '2026-07-07T07:48:18+02:00',
  'unemployment': '2026-07-07T07:48:18+02:00',
  'poverty': '2026-07-07T07:48:18+02:00',
  'poorest-nations': '2026-07-07T21:01:29+02:00',
  'de-insolvenz-jobs': '2026-07-07T07:48:18+02:00',
  'de-industry': '2026-07-07T07:48:18+02:00',
  'de-migration': '2026-07-07T07:48:18+02:00',
  'de-migration-flows': '2026-07-07T11:21:40+02:00',
  'pl-migration': '2026-07-08T19:26:55+02:00',
  'de-emigration-dest': '2026-07-08T23:00:00+02:00',
  'de-population': '2026-07-07T11:21:40+02:00',
  'de-pop-nationality': '2026-07-08T23:59:00+02:00',
  'de-crime-foreign': '2026-07-07T07:48:18+02:00',
  'de-assault': '2026-07-07T11:32:48+02:00',
  'de-knife-attacks': '2026-07-07T11:06:57+02:00',
  'de-tvbz-violence': '2026-07-08T10:32:24+02:00',
  'de-tvbz-age': '2026-07-08T10:32:24+02:00',
  'de-tvbz-rape': '2026-07-08T10:32:24+02:00',
  'ch-zurich-afghan-crime': '2026-07-08T10:32:24+02:00',
  'de-tax-quota': '2026-07-07T09:01:56+02:00',
  'de-power-prices': '2026-07-07T09:13:02+02:00',
  'berlin-warrants': '2026-07-07T11:11:15+02:00',
  'de-state-quota': '2026-07-07T09:01:56+02:00',
  'de-old-age-ratio': '2026-07-07T09:28:10+02:00',
  'de-aging-nations': '2026-07-07T09:28:10+02:00',
  'internet-shutdowns': '2026-07-07T07:48:18+02:00',
  'press-freedom-nations': '2026-07-07T08:03:48+02:00',
  'jailed-journalists': '2026-07-07T08:30:25+02:00',
  'asset-correlation': '2026-07-07T08:46:44+02:00',
  'book-bans': '2026-07-07T07:48:18+02:00',
  'internet': '2026-07-07T07:48:18+02:00',
  'world-hunger': '2026-07-07T07:48:18+02:00',
  'extreme-poverty': '2026-07-07T07:48:18+02:00',
  'nuke-tests': '2026-07-07T07:48:18+02:00',
  'obesity-nations': '2026-07-07T07:48:18+02:00',
  'fertility': '2026-07-07T07:48:18+02:00',
  'dollar': '2026-07-07T07:48:18+02:00',
  'armies': '2026-07-07T07:48:18+02:00',
  'wealth': '2026-07-07T07:48:18+02:00',
  'tax-burden': '2026-07-07T07:48:18+02:00',
  'power-prices': '2026-07-07T07:48:18+02:00',
  'incarceration': '2026-07-07T07:48:18+02:00',
  'corruption': '2026-07-07T07:48:18+02:00',
  'us-bases': '2026-07-07T07:48:18+02:00',
  'modern-slavery': '2026-07-07T07:48:18+02:00',
  'us-wars': '2026-07-07T07:48:18+02:00',
  'recent-wars': '2026-07-07T07:48:18+02:00',
  'teen-mde': '2026-07-07T07:48:18+02:00',
  'female-lfp': '2026-07-07T07:48:18+02:00',
  'teen-screen': '2026-07-07T07:48:18+02:00',
  'teen-antidepressants': '2026-07-07T07:48:18+02:00',
  'de-energy-mix': '2026-07-07T07:48:18+02:00',
  'obesity-fastfood': '2026-07-07T07:48:18+02:00',
  'surveillance': '2026-07-07T07:48:18+02:00',
  'cameras-world': '2026-07-07T07:48:18+02:00',
  'gov-requests-country': '2026-07-07T07:48:18+02:00',
  'youtube-removals': '2026-07-07T07:48:18+02:00',
  'cashless': '2026-07-07T13:00:01+02:00',
  '5g-stations': '2026-07-07T07:48:18+02:00',
  'inflation': '2026-07-07T07:48:18+02:00',
  'digital-id': '2026-07-07T07:48:18+02:00',
  'digital-id-gap': '2026-07-08T16:29:47+02:00',
  'cash-limits': '2026-07-08T16:29:47+02:00',
  'age-verify': '2026-07-07T19:55:58+02:00',
  'age-verify-nations': '2026-07-08T16:29:47+02:00',
  'air-pnr': '2026-07-08T16:29:47+02:00',
  'kyc-crypto': '2026-07-08T16:29:47+02:00',
  'alcohol-nations': '2026-07-07T07:48:18+02:00',
  'alcohol-deaths': '2026-07-07T07:48:18+02:00',
  'c40-cities': '2026-07-07T07:48:18+02:00',
  'un-resolutions': '2026-07-07T07:48:18+02:00',
  'de-family': '2026-07-07T07:48:18+02:00',
  'single-households': '2026-07-07T07:48:18+02:00',
  'covid-stringency': '2026-07-07T07:48:18+02:00',
  'covid-lockdowns': '2026-07-07T07:48:18+02:00',
  'covid-vax-percapita': '2026-07-07T07:48:18+02:00',
  'real-wages': '2026-07-07T09:01:56+02:00',
  'homeownership': '2026-07-07T09:01:56+02:00',
  'cb-balance': '2026-07-07T09:01:56+02:00',
  'wealth-divergence': '2026-07-07T09:01:56+02:00',
  'food-fertilizer': '2026-07-07T09:01:56+02:00',
  'pension-level': '2026-07-07T09:01:56+02:00',
  'rent-burden': '2026-07-07T09:01:56+02:00',
  'de-underemployment': '2026-07-07T09:13:02+02:00',
  'de-buergergeld': '2026-07-08T23:00:00+02:00',
  'de-exports': '2026-07-07T09:28:10+02:00',
  'cbdc': '2026-07-07T13:00:01+02:00',
  'freedom-decline': '2026-07-07T13:00:01+02:00',
  'covid-rights': '2026-07-07T13:00:01+02:00',
  'de-speech-cases': '2026-07-07T13:00:01+02:00',
  'uk-speech-arrests': '2026-07-07T13:00:01+02:00',
  'young-homeownership': '2026-07-07T13:00:01+02:00',
  'lez-zones': '2026-07-07T13:00:01+02:00',
  'shutdowns-per-year': '2026-07-07T13:00:01+02:00',
  'gene-therapies': '2026-07-07T13:00:01+02:00',
  'smartphone-leash': '2026-07-07T13:00:01+02:00',
  'autocracy-share': '2026-07-07T13:07:09+02:00',
  'fiat-lifespan': '2026-07-07T13:25:00+02:00',
  'face-recognition': '2026-07-08T20:35:00+02:00',
  'gold-anonymous': '2026-07-08T20:35:00+02:00',
  'gender-language': '2026-07-09T00:10:00+02:00',
  'gender-divide': '2026-07-09T00:30:00+02:00',
  'self-id-laws': '2026-07-09T00:10:00+02:00',
  'rainbow-camps': '2026-07-09T00:10:00+02:00',
  'lgbt-criminal-map': '2026-07-09T01:00:00+02:00',
  'executions-map': '2026-07-09T01:20:00+02:00',
  'genocides': '2026-07-09T01:40:00+02:00',
  'trans-youth': '2026-07-09T00:10:00+02:00',
  'oil-price': '2026-07-09T02:00:00+02:00',
  'vix': '2026-07-09T02:00:00+02:00',
  'defense-stocks': '2026-07-09T02:00:00+02:00',
  'gold-price': '2026-07-09T02:00:00+02:00',
  'us-10y': '2026-07-09T02:00:00+02:00',
  'margin-debt': '2026-07-09T02:00:00+02:00',
  'temp-map': '2026-07-08T12:00:00+02:00',
  'holocene': '2026-07-08T12:00:00+02:00',
  'ice-cores': '2026-07-09T14:30:00+02:00',
  'deglaciation': '2026-07-09T14:30:00+02:00',
  'sea-level': '2026-07-09T14:30:00+02:00',
  'de-income-tax-share': '2026-07-08T13:00:00+02:00',
  'sdg-progress': '2026-07-09T03:00:00+02:00',
  'who-funding': '2026-07-09T03:00:00+02:00',
  'excess-mortality': '2026-07-09T03:00:00+02:00',
  'covid-vax-excess': '2026-07-09T14:00:00+02:00',
  'covid-vax-births': '2026-07-09T14:30:00+02:00',
  'covid-myocarditis': '2026-07-09T15:00:00+02:00',
  'excess-mortality-map': '2026-07-09T09:45:00+02:00',
  'covid-vax-map': '2026-07-09T09:45:00+02:00',
  'cb-gold': '2026-07-09T03:00:00+02:00',
  'gold-reserves': '2026-07-08T21:30:00+02:00',
  'farm-decline': '2026-07-09T03:00:00+02:00',
  'pisa': '2026-07-09T03:00:00+02:00',
  'media-trust': '2026-07-09T03:00:00+02:00',
  'free-speech-feeling': '2026-07-09T03:00:00+02:00',
  'ice-ban': '2026-07-09T03:00:00+02:00',
  'birth-collapse': '2026-07-09T03:00:00+02:00',
  'meat-target': '2026-07-09T03:00:00+02:00',
  'big-three': '2026-07-09T03:00:00+02:00',
  'buffett': '2026-07-09T04:00:00+02:00',
  'shiller-cape': '2026-07-09T04:00:00+02:00',
  'mag7-share': '2026-07-09T04:00:00+02:00',
  'us-interest-tax': '2026-07-09T04:00:00+02:00',
  'us-deficit': '2026-07-09T04:00:00+02:00',
  'us-card-debt': '2026-07-09T04:00:00+02:00',
  'auto-delinquency': '2026-07-09T04:00:00+02:00',
  'office-vacancy': '2026-07-09T04:00:00+02:00',
  'dollar-reserves': '2026-07-09T04:00:00+02:00',
  'zombie-firms': '2026-07-09T04:00:00+02:00',
  'de-public-employment': '2026-07-08T14:00:00+02:00',
};
for (const d of POOL) d.added = ADDED_BY_ID[d.id];

/** Full pool ordered newest-first (cards without a date trail at the end). */
export const NEWEST: Dashboard[] = [...POOL].sort((a, b) =>
  (b.added ?? '').localeCompare(a.added ?? ''),
);

/**
 * Hand-picked headliners: these lead the ring so the strongest panels sit up
 * front on load; the rest of the pool follows behind them.
 */
const FEATURED = new Set([
  'us-wars', 'us-bases', 'modern-slavery', 'corruption', 'incarceration', 'obesity-nations', 'nukes',
  'us-debt', 'us-interest', 'm2', 'dollar', 'wealth', 'homicide-map',
  'world-pop', 'oil-consumption', 'temp-map', 'holocene', 'ice-cores', 'deglaciation', 'sea-level', 'de-insolvenz-jobs', 'conflict-deaths', 'refugees', 'refugees-interventions',
  'military', 'military-per-soldier', 'military-gdp', 'de-industry', 'recent-wars', 'de-state-quota', 'de-tax-quota', 'de-income-tax-share', 'de-public-employment', 'de-power-prices', 'de-old-age-ratio', 'de-aging-nations', 'berlin-warrants',
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
  'oil-price', 'vix', 'defense-stocks', 'gold-price', 'us-10y', 'margin-debt',
  'buffett', 'shiller-cape', 'mag7-share', 'us-interest-tax', 'us-deficit',
  'us-card-debt', 'auto-delinquency', 'office-vacancy', 'dollar-reserves', 'zombie-firms',
  'ai-compute', 'ai-investment', 'ai-datacenter-power', 'ai-users',
  'gender-language', 'gender-divide', 'self-id-laws', 'rainbow-camps', 'lgbt-criminal-map', 'executions-map', 'genocides', 'trans-youth',
  'sdg-progress', 'who-funding', 'excess-mortality', 'cb-gold', 'gold-reserves', 'farm-decline', 'pisa', 'free-speech-feeling', 'birth-collapse', 'big-three',
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

/** Card lookup for runtime-assembled decks (the favorites stack). */
export const DASHBOARDS_BY_ID: Record<string, Dashboard> = Object.fromEntries(
  POOL.map((d) => [d.id, d]),
);

/**
 * Hard cap for the desktop ring: at most RING_MAX cards per theme. Featured
 * cards fill the ring first; both halves are shuffled once per load, so the
 * overflow rotates across visits instead of the same cards always being cut.
 * Mobile keeps the full per-theme pool — a swipe deck has no crowding problem.
 */
export const RING_MAX = 20;

export const RING_BY_TAG: Record<string, Dashboard[]> = Object.fromEntries(
  TAGS.filter((t) => t.id !== 'favoriten').map((t) => [
    t.id,
    t.id === 'neu'
      ? NEWEST.slice(0, RING_MAX)
      : clustered(POOL.filter((d) => d.tags?.includes(t.id))).slice(0, RING_MAX),
  ]),
);

/** Floor for the ring radius, so a small filtered set still spaces out well. */
export const MIN_COUNT = 5;
