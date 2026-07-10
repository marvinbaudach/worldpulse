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

// One theme tag per card — its single home category. Applied to the POOL
// right below; clustering and the theme chips both key off tags[0].
const TAGS_BY_ID: Record<string, string[]> = {
  'de-budget-split': ['deutschland'],
  'de-megaprojects': ['deutschland'],
  military: ['krieg'],
  mideast: ['krieg'],
  'military-per-soldier': ['krieg'],
  'military-gdp': ['krieg'],
  'us-debt': ['geld'],
  nukes: ['krieg'],
  'homicide-map': ['soziales'],
  'suicide-map': ['soziales'],
  'sdg-index-map': ['welt', 'soziales'],
  'sdg-laggards-map': ['welt', 'soziales'],
  'temp-map': ['welt'],
  'swiss-pop': ['welt'],
  'world-pop': ['welt'],
  'oil-consumption': ['welt'],
  'conflict-deaths': ['krieg'],
  'wars-interwar': ['krieg'],
  'wars-coldwar': ['krieg'],
  'ukraine-deaths': ['krieg'],
  refugees: ['krieg'],
  'refugees-interventions': ['krieg'],
  'africa-eu-routes': ['welt'],
  'us-interest': ['geld'],
  overdose: ['gesundheit'],
  'debt-gdp': ['geld'],
  'eu-debt-map': ['geld'],
  'pop-share': ['welt'],
  'life-exp': ['gesundheit'],
  'life-exp-nations': ['gesundheit'],
  m2: ['geld'],
  'wealth-top1': ['geld'],
  'm2-history': ['geld'],
  'ai-jobs': ['soziales'],
  'ai-compute': ['tech'],
  moore: ['tech'],
  'process-node': ['tech'],
  'compute-cost': ['tech'],
  'genome-cost': ['tech'],
  'ai-training-cost': ['tech'],
  'ai-training-models': ['tech'],
  'ai-investment': ['tech'],
  'ai-datacenter-power': ['tech'],
  'datacenter-map': ['tech'],
  'ai-users': ['tech'],
  'youth-unemployment': ['soziales'],
  unemployment: ['soziales'],
  poverty: ['soziales'],
  'poorest-nations': ['soziales'],
  'poverty-map': ['soziales'],
  'de-insolvenz-jobs': ['deutschland'],
  'de-industry': ['deutschland'],
  'de-auto-jobs': ['deutschland'],
  'hormuz-oil': ['krieg'],
  'hormuz-tankers': ['krieg'],
  'de-migration': ['deutschland'],
  'de-migration-flows': ['deutschland'],
  'pl-migration': ['deutschland'],
  'de-emigration-dest': ['deutschland'],
  'de-population': ['deutschland'],
  'de-pop-nationality': ['deutschland'],
  'de-foreign-population': ['deutschland'],
  'de-crime-foreign': ['deutschland'],
  'de-assault': ['deutschland'],
  'de-knife-attacks': ['deutschland'],
  'de-tvbz-violence': ['deutschland'],
  'de-tvbz-violence-adult': ['deutschland'],
  'de-tvbz-age': ['deutschland'],
  'de-tvbz-rape': ['deutschland'],
  'de-tvbz-rape-adult': ['deutschland'],
  'ch-zurich-afghan-crime': ['soziales'],
  'de-tax-quota': ['deutschland'],
  'de-tax-revenue': ['deutschland'],
  'de-income-tax-share': ['deutschland'],
  'de-power-prices': ['deutschland'],
  'berlin-warrants': ['deutschland'],
  'de-state-quota': ['deutschland'],
  'de-public-employment': ['deutschland'],
  'de-old-age-ratio': ['deutschland'],
  'de-aging-nations': ['welt'],
  'internet-shutdowns': ['freiheit'],
  'press-freedom-nations': ['freiheit'],
  'jailed-journalists': ['freiheit'],
  'asset-correlation': ['geld'],
  'oil-price': ['geld'],
  vix: ['geld'],
  'defense-stocks': ['krieg'],
  'defense-basket': ['krieg'],
  'gold-price': ['geld'],
  'us-10y': ['geld'],
  'margin-debt': ['geld'],
  buffett: ['geld'],
  'shiller-cape': ['geld'],
  'mag7-share': ['geld'],
  'us-interest-tax': ['geld'],
  'us-deficit': ['geld'],
  'us-card-debt': ['geld'],
  'auto-delinquency': ['geld'],
  'office-vacancy': ['geld'],
  'dollar-reserves': ['geld'],
  'zombie-firms': ['geld'],
  internet: ['tech'],
  'world-hunger': ['welt'],
  'extreme-poverty': ['soziales'],
  'nuke-tests': ['krieg'],
  'obesity-nations': ['gesundheit'],
  fertility: ['welt'],
  dollar: ['geld'],
  armies: ['krieg'],
  wealth: ['geld'],
  'tax-burden': ['geld'],
  'power-prices': ['geld'],
  'pension-nations': ['geld'],
  incarceration: ['freiheit'],
  corruption: ['soziales'],
  'us-bases': ['krieg'],
  'modern-slavery': ['freiheit'],
  'us-wars': ['krieg'],
  'recent-wars': ['krieg'],
  'teen-mde': ['gesundheit'],
  'female-lfp': ['deutschland'],
  'teen-screen': ['gesundheit'],
  'teen-antidepressants': ['gesundheit'],
  'de-energy-mix': ['deutschland'],
  'obesity-fastfood': ['gesundheit'],
  surveillance: ['freiheit'],
  'cameras-world': ['freiheit'],
  'gov-requests-country': ['freiheit'],
  'youtube-removals': ['freiheit'],
  cashless: ['freiheit'],
  '5g-stations': ['tech'],
  inflation: ['geld'],
  'digital-id': ['freiheit'],
  'digital-id-gap': ['freiheit'],
  'cash-limits': ['freiheit'],
  'age-verify': ['freiheit'],
  'age-verify-nations': ['freiheit'],
  'air-pnr': ['freiheit'],
  'kyc-crypto': ['freiheit'],
  'alcohol-nations': ['gesundheit'],
  'alcohol-deaths': ['gesundheit'],
  'c40-cities': ['welt'],
  'un-resolutions': ['welt'],
  'de-family': ['deutschland'],
  'single-households': ['deutschland'],
  'covid-stringency': ['corona'],
  'covid-lockdowns': ['corona'],
  'covid-vax-percapita': ['corona'],
  'real-wages': ['deutschland'],
  homeownership: ['geld'],
  'cb-balance': ['geld'],
  'wealth-divergence': ['geld'],
  'food-fertilizer': ['welt'],
  'gas-fertilizer': ['welt'],
  'fert-food-shock': ['welt'],
  'food-crisis': ['welt'],
  'pension-level': ['deutschland'],
  'rent-burden': ['deutschland'],
  'de-underemployment': ['deutschland'],
  'de-buergergeld': ['deutschland'],
  'de-exports': ['deutschland'],
  cbdc: ['freiheit'],
  'freedom-decline': ['freiheit'],
  'covid-rights': ['corona'],
  'de-speech-cases': ['deutschland'],
  'uk-speech-arrests': ['freiheit'],
  'young-homeownership': ['geld'],
  'home-price-income': ['geld'],
  'investor-homes': ['geld'],
  'young-wealth': ['geld'],
  'lez-zones': ['freiheit'],
  'shutdowns-per-year': ['freiheit'],
  'gene-therapies': ['gesundheit'],
  'smartphone-leash': ['freiheit'],
  'autocracy-share': ['freiheit'],
  'fiat-lifespan': ['freiheit'],
  'face-recognition': ['freiheit'],
  'gold-anonymous': ['freiheit'],
  'gender-language': ['deutschland'],
  'gender-divide': ['soziales'],
  'self-id-laws': ['freiheit'],
  'rainbow-camps': ['soziales'],
  'lgbt-criminal-map': ['freiheit'],
  'executions-map': ['freiheit'],
  'slavery-map': ['freiheit'],
  'drug-deaths-map': ['gesundheit'],
  genocides: ['krieg'],
  'trans-youth': ['gesundheit'],
  'sdg-progress': ['welt'],
  'who-funding': ['gesundheit'],
  'excess-mortality': ['corona'],
  'covid-vax-excess': ['corona'],
  'covid-vax-births': ['corona'],
  'de-deaths-raw': ['corona'],
  'covid-myocarditis': ['corona'],
  'excess-mortality-map': ['corona'],
  'covid-vax-map': ['corona'],
  'cb-gold': ['geld'],
  'gold-reserves': ['geld'],
  'farm-decline': ['deutschland'],
  pisa: ['deutschland'],
  'media-trust': ['deutschland'],
  'free-speech-feeling': ['deutschland'],
  'ice-ban': ['freiheit'],
  'birth-collapse': ['deutschland'],
  'meat-target': ['freiheit'],
  'big-three': ['geld'],
  'de-bank-branches': ['freiheit'],
  'us-middle-wealth': ['geld'],
  'us-consumer-debt': ['geld'],
  // EU freedom-restriction dossier (legislative timelines) — see euFreedom.ts.
  chatkontrolle: ['freiheit'],
  'asset-register': ['freiheit'],
  // Corona-critical dossier (Event 201, measures timeline, excess mortality,
  // PEI reports) — see covidCritical.ts.
  'event-201': ['corona'],
  'de-corona-massnahmen': ['corona', 'freiheit'],
  'excess-age-adjusted': ['corona'],
};
for (const d of POOL) d.tags = TAGS_BY_ID[d.id] ?? [];

/**
 * When each card entered the pool (first commit touching its id in cards.ts;
 * uncommitted cards get the current date). Powers the "newest" sort in the dev
 * review gallery (src/dev/gallery.ts) so freshly added cards are easy to find.
 */
const ADDED_BY_ID: Record<string, string> = {
  // SDG-Index laggards choropleth (SDR 2026) — newest, leads the NEU chip.
  'sdg-laggards-map': '2026-07-10T13:05:00+02:00',
  // SDG-Index world choropleth per country (SDR 2026).
  'sdg-index-map': '2026-07-10T13:00:00+02:00',
  // Live Hormuz tanker traffic (IMF PortWatch).
  'hormuz-tankers': '2026-07-10T12:30:00+02:00',
  // Corona-critical dossier.
  'excess-age-adjusted': '2026-07-10T11:02:00+02:00',
  'de-corona-massnahmen': '2026-07-10T11:01:00+02:00',
  'event-201': '2026-07-10T11:00:00+02:00',
  // Suicide-rate world map.
  'suicide-map': '2026-07-10T10:05:00+02:00',
  // EU freedom-restriction dossier.
  chatkontrolle: '2026-07-10T10:04:00+02:00',
  'asset-register': '2026-07-10T10:03:00+02:00',
  'datacenter-map': '2026-07-09T22:30:00+02:00',
  'de-budget-split': '2026-07-09T20:00:00+02:00',
  'de-megaprojects': '2026-07-09T21:31:00+02:00',
  'military': '2026-07-07T07:48:18+02:00',
  'mideast': '2026-07-09T12:00:00+02:00',
  'hormuz-oil': '2026-07-09T14:05:00+02:00',
  'de-auto-jobs': '2026-07-09T14:00:00+02:00',
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
  'poverty-map': '2026-07-10T20:30:00+02:00',
  'de-insolvenz-jobs': '2026-07-07T07:48:18+02:00',
  'de-industry': '2026-07-07T07:48:18+02:00',
  'de-migration': '2026-07-07T07:48:18+02:00',
  'de-migration-flows': '2026-07-07T11:21:40+02:00',
  'pl-migration': '2026-07-08T19:26:55+02:00',
  'de-emigration-dest': '2026-07-08T23:00:00+02:00',
  'de-population': '2026-07-07T11:21:40+02:00',
  'de-pop-nationality': '2026-07-08T23:59:00+02:00',
  'de-foreign-population': '2026-07-10T14:00:00+02:00',
  'de-crime-foreign': '2026-07-07T07:48:18+02:00',
  'de-assault': '2026-07-07T11:32:48+02:00',
  'de-knife-attacks': '2026-07-07T11:06:57+02:00',
  'de-tvbz-violence': '2026-07-08T10:32:24+02:00',
  'de-tvbz-violence-adult': '2026-07-10T12:00:00+02:00',
  'de-tvbz-age': '2026-07-08T10:32:24+02:00',
  'de-tvbz-rape': '2026-07-08T10:32:24+02:00',
  'de-tvbz-rape-adult': '2026-07-10T12:01:00+02:00',
  'ch-zurich-afghan-crime': '2026-07-08T10:32:24+02:00',
  'de-tax-quota': '2026-07-07T09:01:56+02:00',
  'de-tax-revenue': '2026-07-09T16:00:00+02:00',
  'de-power-prices': '2026-07-07T09:13:02+02:00',
  'berlin-warrants': '2026-07-07T11:11:15+02:00',
  'de-state-quota': '2026-07-07T09:01:56+02:00',
  'de-old-age-ratio': '2026-07-07T09:28:10+02:00',
  'de-aging-nations': '2026-07-07T09:28:10+02:00',
  'internet-shutdowns': '2026-07-07T07:48:18+02:00',
  'press-freedom-nations': '2026-07-07T08:03:48+02:00',
  'jailed-journalists': '2026-07-07T08:30:25+02:00',
  'asset-correlation': '2026-07-07T08:46:44+02:00',
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
  'pension-nations': '2026-07-09T00:00:00+02:00',
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
  'gas-fertilizer': '2026-07-09T18:30:00+02:00',
  'fert-food-shock': '2026-07-09T18:31:00+02:00',
  'food-crisis': '2026-07-09T18:32:00+02:00',
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
  'home-price-income': '2026-07-09T16:30:00+02:00',
  'investor-homes': '2026-07-09T16:31:00+02:00',
  'young-wealth': '2026-07-09T16:32:00+02:00',
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
  'slavery-map': '2026-07-09T17:00:00+02:00',
  'drug-deaths-map': '2026-07-09T17:05:00+02:00',
  'genocides': '2026-07-09T01:40:00+02:00',
  'trans-youth': '2026-07-09T00:10:00+02:00',
  'oil-price': '2026-07-09T02:00:00+02:00',
  'vix': '2026-07-09T02:00:00+02:00',
  'defense-stocks': '2026-07-09T02:00:00+02:00',
  'defense-basket': '2026-07-09T16:00:00+02:00',
  'gold-price': '2026-07-09T02:00:00+02:00',
  'us-10y': '2026-07-09T02:00:00+02:00',
  'margin-debt': '2026-07-09T02:00:00+02:00',
  'temp-map': '2026-07-08T12:00:00+02:00',
  'de-income-tax-share': '2026-07-08T13:00:00+02:00',
  'sdg-progress': '2026-07-09T03:00:00+02:00',
  'who-funding': '2026-07-09T03:00:00+02:00',
  'excess-mortality': '2026-07-09T03:00:00+02:00',
  'covid-vax-excess': '2026-07-09T14:00:00+02:00',
  'covid-vax-births': '2026-07-09T14:30:00+02:00',
  'de-deaths-raw': '2026-07-09T17:00:00+02:00',
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
  'de-bank-branches': '2026-07-09T18:00:00+02:00',
  'us-middle-wealth': '2026-07-09T18:01:00+02:00',
  'us-consumer-debt': '2026-07-09T18:02:00+02:00',
};
for (const d of POOL) d.added = ADDED_BY_ID[d.id];

/** Full pool ordered newest-first (cards without a date trail at the end).
    Consumed by the dev review gallery's "newest" sort. */
export const NEWEST: Dashboard[] = [...POOL].sort((a, b) =>
  (b.added ?? '').localeCompare(a.added ?? ''),
);

/**
 * Hand-picked headliners: these lead the ring so the strongest panels sit up
 * front on load; the rest of the pool follows behind them.
 */
const FEATURED = new Set([
  'us-wars', 'us-bases', 'modern-slavery', 'corruption', 'incarceration', 'obesity-nations', 'nukes',
  'us-debt', 'us-interest', 'm2', 'dollar', 'wealth', 'homicide-map', 'suicide-map',
  'world-pop', 'oil-consumption', 'temp-map',
  'de-insolvenz-jobs', 'conflict-deaths', 'refugees', 'refugees-interventions',
  'military', 'military-per-soldier', 'military-gdp', 'de-industry', 'recent-wars', 'de-state-quota', 'de-tax-quota', 'de-tax-revenue', 'de-income-tax-share', 'de-public-employment', 'de-power-prices', 'de-old-age-ratio', 'de-aging-nations', 'berlin-warrants',
  'youth-unemployment', 'unemployment', 'poverty',
  'teen-mde', 'female-lfp',
  'teen-screen', 'teen-antidepressants', 'obesity-fastfood', 'surveillance',
  'cameras-world', 'internet-shutdowns', 'press-freedom-nations', 'jailed-journalists', 'asset-correlation',
  'gov-requests-country', 'youtube-removals', '5g-stations',
  'un-resolutions', 'de-family', 'single-households', 'inflation',
  'digital-id', 'digital-id-gap', 'cash-limits', 'alcohol-nations', 'alcohol-deaths', 'c40-cities',
  'covid-stringency', 'covid-lockdowns', 'covid-vax-percapita',
  'real-wages', 'homeownership', 'cb-balance',
  'wealth-divergence', 'food-fertilizer', 'gas-fertilizer', 'fert-food-shock', 'food-crisis', 'pension-level', 'rent-burden',
  'home-price-income', 'investor-homes', 'young-wealth',
  'de-underemployment', 'de-migration-flows', 'pl-migration', 'de-population', 'de-assault',
  'cbdc', 'cashless', 'kyc-crypto', 'air-pnr', 'age-verify-nations',
  'freedom-decline', 'covid-rights', 'de-speech-cases',
  'uk-speech-arrests', 'young-homeownership', 'smartphone-leash', 'autocracy-share',
  'fiat-lifespan',
  'oil-price', 'vix', 'defense-stocks', 'defense-basket', 'gold-price', 'us-10y', 'margin-debt',
  'buffett', 'shiller-cape', 'mag7-share', 'us-interest-tax', 'us-deficit',
  'us-card-debt', 'auto-delinquency', 'office-vacancy', 'dollar-reserves', 'zombie-firms',
  'ai-compute', 'ai-investment', 'ai-datacenter-power', 'ai-users',
  'gender-language', 'gender-divide', 'self-id-laws', 'rainbow-camps', 'lgbt-criminal-map', 'executions-map', 'slavery-map', 'drug-deaths-map', 'genocides', 'trans-youth',
  'sdg-progress', 'who-funding', 'excess-mortality', 'cb-gold', 'gold-reserves', 'farm-decline', 'pisa', 'free-speech-feeling', 'birth-collapse', 'big-three',
  'de-bank-branches', 'us-middle-wealth', 'us-consumer-debt',
  'de-budget-split', 'de-megaprojects',
  'chatkontrolle', 'asset-register',
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
    clustered(POOL.filter((d) => d.tags?.includes(t.id))).slice(0, RING_MAX),
  ]),
);

/** Floor for the ring radius, so a small filtered set still spaces out well. */
export const MIN_COUNT = 5;
