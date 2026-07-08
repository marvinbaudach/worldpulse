// Bundled real-data panels: figures from sources that are revised yearly at
// best and have no keyless live API, so they ship as sparse historical anchors
// and get interpolated into the same draw-ready shapes the live fetchers
// produce. These also back the fallbacks for the panels that do fetch, so the
// ring keeps its true curves even with every API unreachable.

import { localeNum, localePct, t as tr } from '../i18n';
import type { TrendSeries } from './store';
import {
  compareSeries,
  interpAt,
  niceScale,
  norm,
  resample,
  trend,
  yearly,
} from './series';

// ---------------------------------------------------------------------------
// US Treasury debt — the 125-year trend behind the live debt clock.

/** Treasury "Historical Debt Outstanding" fiscal-year totals. */
const DEBT_HISTORY: [number, number][] = [
  [1900, 2.1e9],
  [1920, 26e9],
  [1940, 43e9],
  [1945, 259e9],
  [1960, 286e9],
  [1970, 371e9],
  [1980, 908e9],
  [1990, 3.23e12],
  [2000, 5.67e12],
  [2008, 10.02e12],
  [2012, 16.43e12],
  [2016, 19.57e12],
  [2020, 26.95e12],
  [2023, 34e12],
];

export function debtTrend(latest: number): { series: number[]; ticks: string[] } {
  const year = new Date().getFullYear();
  const series = yearly([...DEBT_HISTORY, [year, latest]]);
  const s = niceScale(0, latest, (v) => `$${localeNum(v / 1e12, 0)} ${tr('Bio.')}`);
  return {
    series: norm(resample(series, 40), s.lo, s.hi),
    ticks: s.ticks,
  };
}

/** Real-shape fallback: flat for 80 years, then the wall. */
export const DEBT_TREND_FALLBACK = debtTrend(39.4e12);

// ---------------------------------------------------------------------------
// Population anchors — also consumed by the live population fetcher, which
// prepends them to the World Bank series so the panels span centuries.

/**
 * Swiss population within today's borders: historical estimates up to 1800,
 * then federal census figures (BFS) until the World Bank series takes over.
 */
export const CH_CENSUS: [number, number][] = [
  [1500, 800_000],
  [1600, 1_000_000],
  [1700, 1_200_000],
  [1800, 1_660_000],
  [1850, 2_392_740],
  [1880, 2_831_787],
  [1900, 3_315_443],
  [1920, 3_880_320],
  [1930, 4_066_400],
  [1941, 4_265_703],
  [1950, 4_714_992],
];

/**
 * World population estimates (HYDE / Our World in Data) from Year 0 to the
 * start of the World Bank series — includes the Black Death dip around 1400.
 */
export const WORLD_HISTORY: [number, number][] = [
  [0, 230e6],
  [500, 240e6],
  [1000, 295e6],
  [1300, 392e6],
  [1400, 350e6],
  [1500, 461e6],
  [1600, 554e6],
  [1700, 603e6],
  [1800, 990e6],
  [1850, 1.26e9],
  [1900, 1.65e9],
  [1920, 1.86e9],
  [1940, 2.3e9],
  [1950, 2.49e9],
];

export const SWISS_POP_FALLBACK: TrendSeries = trend(
  [...CH_CENSUS, [2025, 9_092_436]],
  (v) => `${localeNum(v / 1e6, 0)} ${tr('Mio')}`,
  ['1500', '1675', '1850', 'heute'],
);

export const WORLD_POP_FALLBACK: TrendSeries = trend(
  [...WORLD_HISTORY, [2025, 8.215e9]],
  (v) => `${localeNum(v / 1e9, 0)} ${tr('Mrd')}`,
  ['Jahr 0', '675', '1350', 'heute'],
);

// World population from 1770 on (UN WPP / Our World in Data). Starting at the
// eve of the Industrial Revolution keeps the hockey-stick but spreads the era
// markers across the plot instead of cramming them into the last 10 % of a
// two-millennia axis.
export const WORLD_POP_SINCE_1770: TrendSeries = trend(
  [
    [1770, 0.90e9], [1800, 0.99e9], [1850, 1.26e9], [1900, 1.65e9],
    [1927, 2.0e9], [1950, 2.49e9], [1960, 3.03e9], [1970, 3.70e9],
    [1980, 4.46e9], [1990, 5.33e9], [2000, 6.15e9], [2010, 6.96e9],
    [2020, 7.84e9], [2025, 8.22e9],
  ],
  (v) => `${localeNum(v / 1e9, 2)} ${tr('Mrd')}`,
  ['1770', '1855', '1940', 'heute'],
);

// ---------------------------------------------------------------------------
// Paleoclimate: Antarctic temperature anomaly over 800,000 years from the
// EPICA Dome C / Vostok ice cores. The record's sawtooth is eight glacial
// cycles — temperature swinging ~-8 °C (ice ages) to ~+2.5 °C (interglacials);
// the shaded bands are the glacial periods. CO2 kept in the anchors for the
// ice-age threshold but no longer plotted. Bundled — the point is the shape.

// [thousands of years before today, CO2 ppm, Antarctic temp anomaly °C]
const CLIMATE_ANCHORS: [number, number, number][] = [
  [800, 220, -4],
  [780, 210, -5],
  [740, 250, -1], // MIS 19 interglacial
  [710, 200, -6],
  [680, 245, -2], // MIS 17
  [650, 200, -6],
  [620, 260, 0], // MIS 15
  [590, 235, -3],
  [570, 270, 0.5],
  [530, 215, -4],
  [500, 250, -1], // MIS 13
  [480, 225, -4],
  [450, 190, -8], // deep glacial
  [430, 210, -5],
  [410, 285, 1.5], // MIS 11 interglacial
  [380, 205, -5],
  [350, 195, -7],
  [337, 240, -3],
  [325, 300, 2.5], // MIS 9 — highest natural CO2
  [300, 250, -1],
  [280, 210, -5],
  [250, 190, -7],
  [240, 245, -2],
  [215, 275, 1], // MIS 7
  [200, 240, -2],
  [190, 220, -4],
  [150, 190, -7.5], // glacial
  [135, 200, -6],
  [125, 287, 2], // Eemian interglacial (MIS 5e)
  [115, 260, 0],
  [100, 190, -7],
  [80, 225, -4.5],
  [65, 230, -4],
  [50, 190, -6.5],
  [30, 200, -6],
  [18, 185, -8], // Last Glacial Maximum
  [11, 265, -0.5], // end of the last ice age
  [1, 280, 0.2], // pre-industrial Holocene
  [0.2, 300, 0.5],
  [0, 420, 1.2], // today — Mauna Loa
];

const CLIMATE_SPAN_KYR = 800;

function climatePanel() {
  // interpAt needs x (kyr-ago) ascending; anchors list it descending.
  const co2Pts = CLIMATE_ANCHORS.map(([ya, co2]) => [ya, co2] as [number, number]).toReversed();
  const tempPts = CLIMATE_ANCHORS.map(([ya, , t]) => [ya, t] as [number, number]).toReversed();

  const n = 220;
  const co2raw: number[] = [];
  const tempraw: number[] = [];
  for (let i = 0; i < n; i++) {
    const ya = CLIMATE_SPAN_KYR - (CLIMATE_SPAN_KYR * i) / (n - 1); // oldest -> today
    co2raw.push(interpAt(co2Pts, ya));
    tempraw.push(interpAt(tempPts, ya));
  }
  const ts = niceScale(Math.min(...tempraw) - 0.5, Math.max(...tempraw) + 0.5, (v) => `${v > 0 ? '+' : ''}${localeNum(v, 0)}°`);
  return {
    temp: norm(tempraw, ts.lo, ts.hi),
    ticks: ts.ticks,
    latestTemp: CLIMATE_ANCHORS[CLIMATE_ANCHORS.length - 1][2],
    // Ice ages: glacial periods sit below ~230 ppm CO2.
    iceMask: co2raw.map((v, i) => v < 230 && i < n - 3),
  };
}

export const CLIMATE_PANEL = climatePanel();

// ---------------------------------------------------------------------------
// Bundled real-data panels without a live API: deaths in armed conflicts
// (UCDP via Our World in Data), forcibly displaced people (UNHCR Global
// Trends), US federal net interest (OMB/CBO) and US overdose deaths (CDC).

const CONFLICT_ANCHORS: [number, number][] = [
  [1900, 20_000],
  [1905, 100_000], // Russo-Japanese war
  [1913, 150_000], // Balkan wars
  [1914, 1_500_000],
  [1916, 3_000_000], // Verdun, Somme
  [1918, 3_500_000],
  [1920, 800_000], // Russian civil war
  [1925, 100_000],
  [1930, 80_000],
  [1937, 600_000], // Sino-Japanese war, Spain
  [1939, 2_000_000],
  [1942, 10_000_000],
  [1944, 15_000_000], // WWII peak
  [1945, 12_000_000],
  [1947, 500_000], // partition of India, Chinese civil war
  [1950, 700_000], // Korea
  [1953, 350_000],
  [1960, 150_000],
  [1965, 300_000], // Vietnam
  [1971, 500_000], // Bangladesh
  [1979, 200_000],
  [1984, 250_000], // Iran-Iraq
  [1989, 144_000],
  [1992, 110_000],
  [1994, 810_000], // Rwanda
  [1996, 90_000],
  [1999, 130_000],
  [2004, 60_000],
  [2009, 55_000],
  [2012, 90_000],
  [2014, 130_000], // Syria peak
  [2017, 100_000],
  [2020, 85_000],
  [2022, 310_000], // Ukraine, Tigray
  [2023, 235_000],
  [2024, 190_000],
];

export const CONFLICT_PANEL: TrendSeries = trend(
  CONFLICT_ANCHORS,
  (v) => (v >= 1e6 ? `${localeNum(v / 1e6, 0)} ${tr('Mio')}` : `${Math.round(v / 1000)}k`),
  ['1900', '1941', '1983', 'heute'],
  64,
);

const REFUGEE_ANCHORS: [number, number][] = [
  [1990, 35e6],
  [1995, 40e6],
  [2000, 38e6],
  [2005, 37e6],
  [2010, 41e6],
  [2013, 51e6],
  [2015, 65e6],
  [2017, 71e6],
  [2019, 79e6],
  [2021, 89e6],
  [2022, 108e6],
  [2023, 117e6],
  [2024, 123e6],
];

export const REFUGEE_PANEL: TrendSeries = trend(
  REFUGEE_ANCHORS,
  (v) => `${Math.round(v / 1e6)} ${tr('Mio')}`,
  ['1990', '2001', '2013', 'heute'],
);

const US_INTEREST_ANCHORS: [number, number][] = [
  [1990, 184e9],
  [1995, 232e9],
  [2000, 222e9],
  [2005, 184e9],
  [2010, 196e9],
  [2015, 223e9],
  [2019, 375e9],
  [2020, 345e9],
  [2021, 352e9],
  [2022, 475e9],
  [2023, 659e9],
  [2024, 882e9],
  [2025, 1_000e9],
];

export const US_INTEREST_PANEL: TrendSeries = trend(
  US_INTEREST_ANCHORS,
  (v) => (v >= 1e12 ? `$${localeNum(v / 1e12, 1)} ${tr('Bio.')}` : `$${Math.round(v / 1e9)} ${tr('Mrd')}`),
  ['1990', '2002', '2013', 'heute'],
);

const OVERDOSE_ANCHORS: [number, number][] = [
  // Pre-1999 figures are NCHS drug-poisoning estimates (the modern CDC
  // series starts 1999): low thousands through the 50s/60s, first heroin
  // wave around 1970, slow climb through the 80s/90s.
  [1950, 2_000],
  [1960, 3_000],
  [1970, 7_000],
  [1975, 5_500],
  [1979, 6_100],
  [1985, 8_000],
  [1990, 10_000],
  [1995, 14_000],
  [1999, 16_849],
  [2002, 23_518],
  [2005, 29_813],
  [2008, 36_450],
  [2011, 41_340],
  [2014, 47_055],
  [2016, 63_632],
  [2017, 70_237],
  [2019, 70_630],
  [2020, 91_799],
  [2021, 106_699],
  [2022, 107_941],
  [2023, 105_007],
  [2024, 87_000],
];

export const OVERDOSE_PANEL: TrendSeries = trend(
  OVERDOSE_ANCHORS,
  (v) => `${Math.round(v / 1000)}k`,
  ['1950', '1975', '2000', 'heute'],
);

// --- More bundled panels (yearly-revised sources, no keyless live APIs) ---

// US homicide rate per 100k (CDC vital statistics / FBI UCR, rounded).
// Two great waves: Prohibition peaking 1933 and the 1970s–90s crime wave,
// then the long decline, the 2020–21 spike and the fall since.
export const US_HOMICIDE_PANEL: TrendSeries = trend(
  [
    [1900, 1.2], [1910, 4.6], [1920, 6.8], [1933, 9.7], [1940, 6.3],
    [1950, 4.6], [1960, 5.1], [1970, 7.9], [1980, 10.2], [1990, 9.4],
    [2000, 5.5], [2010, 4.8], [2014, 4.4], [2020, 6.5], [2021, 6.8],
    [2023, 5.7], [2024, 5.0],
  ],
  (v) => localeNum(v, 1),
  ['1900', '1941', '1983', 'heute'],
);

// Global life expectancy at birth, years (Riley 2005 / OWID pre-1950, UN WPP
// after). Roughly flat near ~29 for centuries — reliable global estimates
// start ~1770 — then the modern jump: the 1918 dip is the flu pandemic.
export const LIFE_PANEL: TrendSeries = trend(
  [
    [1770, 28.5], [1800, 28.5], [1820, 29], [1850, 29.3], [1870, 29.7],
    [1900, 32], [1913, 34], [1918, 30], [1930, 40], [1950, 46], [1960, 51],
    [1970, 58], [1980, 61], [1990, 64], [2000, 66], [2010, 70],
    [2019, 72.8], [2021, 71], [2024, 73.3],
  ],
  (v) => `${Math.round(v)}y`,
  ['1770', '1854', '1939', 'heute'],
  40,
);

// US M2 money supply, USD. Pre-1959 from Friedman & Schwartz's monetary
// history (M2 definition shifts slightly over the century), from 1959 on
// Federal Reserve H.6.
export const M2_PANEL: TrendSeries = trend(
  [
    [1900, 0.01e12], [1915, 0.018e12], [1920, 0.035e12], [1929, 0.046e12],
    [1933, 0.032e12], [1940, 0.055e12], [1945, 0.127e12], [1950, 0.15e12],
    [1960, 0.3e12], [1970, 0.6e12], [1980, 1.5e12], [1990, 3.2e12],
    [2000, 4.9e12], [2008, 8.2e12], [2015, 12.3e12], [2020, 19.1e12],
    [2022, 21.7e12], [2024, 21.4e12],
  ],
  (v) => `$${localeNum(v / 1e12, 0)} ${tr('Bio.')}`,
  ['1900', '1941', '1983', 'heute'],
);

// Broad money (M2) indexed to 2000 = 1x — USA (Fed H.6) vs euro area (ECB)
// vs Switzerland (SNB). Indexing makes the growth comparable across
// currencies; anchors are rounded from the central banks' series. The euro
// area did not exist before 1999, so its 1990 point is the ECB's back-cast
// area-wide aggregate. All three span 1990–2024 so the lines align.
export const M2_COMPARE = compareSeries(
  [
    { name: 'USA', pts: [[1990, 0.67], [1995, 0.73], [2000, 1.0], [2005, 1.37], [2010, 1.8], [2015, 2.51], [2020, 3.9], [2022, 4.43], [2024, 4.37]] },
    { name: 'Eurozone', pts: [[1990, 0.6], [1995, 0.75], [2000, 1.0], [2005, 1.35], [2010, 1.8], [2015, 2.05], [2020, 2.65], [2024, 2.85]] },
    { name: 'Schweiz', pts: [[1990, 0.72], [1995, 0.85], [2000, 1.0], [2005, 1.2], [2010, 1.75], [2015, 2.3], [2020, 2.55], [2024, 2.5]] },
  ],
  (v) => `${localeNum(v, 1)}×`,
  /** Latest US multiple, for the headline. */
  { usLatest: 4.4 },
);

// Jobs hit by German corporate insolvencies per year (Creditreform
// "betroffene Arbeitsplätze", approximate). Unlike a raw case count this
// weights by firm size — a single large collapse (Schlecker, Galeria, big
// carmakers' suppliers) moves it far more than thousands of tiny ones, which
// is why the 2024–25 surge is so steep even though case counts are below the
// 2003 peak. Rough estimates, not an exact series.
export const DE_INSOLVENCY_JOBS_PANEL: TrendSeries = trend(
  [
    [2000, 480_000], [2003, 613_000], [2006, 433_000], [2009, 582_000],
    [2012, 330_000], [2015, 232_000], [2019, 218_000], [2021, 155_000],
    [2022, 175_000], [2023, 205_000], [2024, 320_000], [2025, 350_000],
  ],
  (v) => `${Math.round(v / 1000)}k`,
  ['2000', '2008', '2017', 'heute'],
);

// Creditor claims from German corporate insolvencies, billion EUR
// (Destatis, rounded). Single mega-cases dominate the spikes: 2009
// financial-crisis wave (Arcandor, Qimonda), 2020 Wirecard, 2021
// Greensill — and 2024's 58bn came from far fewer, much bigger cases.
export const DE_INSOLVENCY_CLAIMS_PANEL: TrendSeries = trend(
  [
    [2000, 27], [2003, 40], [2006, 31], [2009, 85], [2012, 52],
    [2015, 17], [2019, 27], [2020, 44], [2021, 48], [2022, 15],
    [2023, 27], [2024, 58], [2025, 48],
  ],
  (v) => `${localeNum(v, 0)}`,
  ['2000', '2008', '2017', 'heute'],
);

// Industrial production indexed to 2015 = 100 (Destatis, Fed G.17, NBS;
// rounded). Germany peaked in 2018 and has lost roughly a fifth since,
// the US is flat, China keeps compounding.
// Pre-1990 Germany is West Germany; pre-2000 China is a rough magnitude
// estimate — reliable indexed series only start with the reform era.
export const INDUSTRY_COMPARE = compareSeries(
  [
    { name: 'China', pts: [[1950, 0.3], [1970, 1.5], [1980, 3], [1990, 8], [2000, 24], [2005, 41], [2008, 60], [2010, 72], [2015, 100], [2020, 130], [2022, 143], [2024, 158], [2025, 166]] },
    { name: 'USA', pts: [[1950, 15], [1960, 22], [1970, 35], [1980, 48], [1990, 62], [2000, 91], [2005, 95], [2008, 100], [2009, 89], [2015, 100], [2018, 103], [2020, 96], [2022, 103], [2024, 102], [2025, 103]] },
    { name: 'Deutschland', pts: [[1950, 12], [1960, 32], [1970, 55], [1980, 66], [1990, 78], [2000, 84], [2005, 91], [2008, 104], [2009, 86], [2011, 102], [2015, 100], [2018, 105], [2020, 91], [2022, 93], [2023, 91], [2024, 87], [2025, 85]] },
  ],
  (v) => `${localeNum(v, 0)}`,
  /** Germany's latest index level, for the headline. */
  { deuLatest: 85 },
);

// Share of Germany's population with a migration background, %
// (Destatis Mikrozensus; 2024 first results: 25.2m people = 30.4%).
// The concept only exists since 2005 — earlier points are rough
// back-estimates (guest-worker era onward, West Germany before 1990;
// post-war German expellees don't count as migration background).
export const DE_MIGRATION_PANEL: TrendSeries = trend(
  [
    [1950, 1.5], [1960, 2.5], [1970, 6], [1980, 10], [1990, 14],
    [2000, 18], [2005, 18.6], [2010, 19.3], [2013, 20.5], [2015, 21.0],
    [2017, 23.6], [2019, 26.0], [2022, 28.7], [2024, 30.4],
  ],
  (v) => `${localePct(v, 0)}`,
  ['1950', '1975', '2000', 'heute'],
);

// Cross-border migration over Germany's borders, all persons, millions per
// year (Destatis Wanderungsstatistik, rounded). Immigration (Zuzüge) always
// runs above emigration (Fortzüge) except in the 2008/09 dip; the gap between
// the two lines is the net migration that actually moves the population. The
// three peaks: the early-90s Balkan-war / ethnic-German-resettler wave, the
// 2015 refugee surge, and the 2022 Ukraine displacement.
export const DE_MIGRATION_FLOWS = compareSeries(
  [
    { name: 'Einwanderung', pts: [[1991, 1.20], [1992, 1.50], [1995, 1.10], [2000, 0.84], [2005, 0.71], [2009, 0.72], [2013, 1.23], [2015, 2.14], [2016, 1.87], [2018, 1.58], [2020, 1.19], [2022, 2.67], [2023, 1.93]] },
    { name: 'Auswanderung', pts: [[1991, 0.60], [1992, 0.72], [1995, 0.70], [2000, 0.67], [2005, 0.63], [2009, 0.73], [2013, 0.80], [2015, 1.00], [2016, 1.37], [2018, 1.19], [2020, 0.97], [2022, 1.20], [2023, 1.27]] },
  ],
  (v) => `${localeNum(v, 1)} ${tr('Mio')}`,
  /** Latest immigration figure (2023 Zuzüge), for the headline. */
  { inLatest: 1.93 },
);

// Migration between Germany and Poland, all persons, thousands per year
// (BiB/Destatis Wanderungsstatistik 1974–2024; pre-1991 former West Germany,
// method break from 2016). Full annual series — the crossings carry the
// story: the Aussiedler waves peaking 1988/89, the EU-accession (2004) and
// Freizügigkeit (2011) boom with arrivals near 200k/yr, then a steady slide —
// and in 2024 departures exceed arrivals for the first time since 1993
// (83.9k in vs 95.1k out, saldo −11.2k).
export const PL_MIGRATION_COMPARE = compareSeries(
  [
    { name: '→ 🇩🇪 Zuzüge', pts: [[1974, 12.8], [1975, 20.5], [1976, 45.1], [1977, 51.2], [1978, 58.3], [1979, 63.2], [1980, 67.9], [1981, 135.3], [1982, 58.8], [1983, 55.5], [1984, 82.4], [1985, 89.7], [1986, 105.4], [1987, 158.2], [1988, 313.8], [1989, 455.1], [1990, 300.7], [1991, 145.7], [1992, 143.7], [1993, 81.7], [1994, 88.1], [1995, 99.7], [1996, 91.3], [1997, 85.6], [1998, 82.0], [1999, 90.2], [2000, 94.1], [2001, 100.5], [2002, 101.0], [2003, 104.9], [2004, 139.8], [2005, 159.2], [2006, 163.6], [2007, 153.6], [2008, 131.3], [2009, 122.8], [2010, 125.9], [2011, 172.7], [2012, 184.3], [2013, 197.0], [2014, 197.9], [2015, 195.7], [2016, 163.8], [2017, 152.5], [2018, 146.2], [2019, 130.7], [2020, 103.5], [2021, 96.0], [2022, 107.1], [2023, 106.2], [2024, 83.9]] },
    { name: '→ 🇵🇱 Fortzüge', pts: [[1974, 9.4], [1975, 13.0], [1976, 13.9], [1977, 16.2], [1978, 18.0], [1979, 20.7], [1980, 28.6], [1981, 50.0], [1982, 33.6], [1983, 35.5], [1984, 52.8], [1985, 58.1], [1986, 62.8], [1987, 71.5], [1988, 101.4], [1989, 145.9], [1990, 162.1], [1991, 118.0], [1992, 112.1], [1993, 104.8], [1994, 70.3], [1995, 77.0], [1996, 78.9], [1997, 79.1], [1998, 70.6], [1999, 69.5], [2000, 71.4], [2001, 76.0], [2002, 78.7], [2003, 82.9], [2004, 104.5], [2005, 105.5], [2006, 112.5], [2007, 120.8], [2008, 132.4], [2009, 122.6], [2010, 103.2], [2011, 106.5], [2012, 114.4], [2013, 125.4], [2014, 138.7], [2015, 132.4], [2016, 137.2], [2017, 119.1], [2018, 127.0], [2019, 130.4], [2020, 98.2], [2021, 92.2], [2022, 89.4], [2023, 91.4], [2024, 95.1]] },
  ],
  (v) => `${Math.round(v)}k`,
  /** Latest arrivals figure (2024 Zuzüge, thousands), for the config. */
  { inLatest: 83.9 },
);

// German resident population, millions, present-territory boundaries (Destatis;
// pre-1990 figures sum both German states, rounded). Near-flat for decades —
// low birth rates mean the population only grows when net migration is strong
// enough to offset the deaths-over-births gap. The post-2010 climb to a record
// ~84m rides on the migration waves, not on births.
export const DE_POPULATION_PANEL: TrendSeries = trend(
  [
    [1950, 68.4], [1960, 72.7], [1970, 78.1], [1980, 78.3], [1990, 79.4],
    [1995, 81.8], [2000, 82.2], [2005, 82.4], [2010, 81.8], [2015, 82.2],
    [2019, 83.1], [2022, 84.4], [2024, 83.6],
  ],
  (v) => `${localeNum(v, 1)} ${tr('Mio')}`,
  ['1950', '1975', '2000', 'heute'],
);

// Share of non-German suspects in the police crime statistics (BKA PKS),
// excluding immigration-law offenses that only foreigners can commit.
// Rounded from published PKS yearbooks; 2024 is a record 35.4%.
// Suspect counts are not convictions and skew with age/urbanity/reporting.
// Two shares on one scale, so the suspect share can be read against the
// population base it should be normalized to. Line 1: share of non-German
// suspects in the PKS (excluding immigration-only offenses), rounded from the
// yearbooks. Line 2: share of foreign nationals in the resident population
// (Ausländeranteil, Destatis). Both use nationality, so they are comparable.
// The gap between the lines is the over-representation: foreigners run at
// roughly twice their population share among suspects — a level driven by the
// young-male, urban age structure of the migrant population, not measured here.
export const DE_FOREIGN_COMPARE = compareSeries(
  [
    { name: 'Tatverdächtige', pts: [[2005, 22.5], [2010, 21.9], [2014, 24.3], [2016, 30.5], [2019, 30.4], [2022, 33.4], [2023, 34.4], [2024, 35.4]] },
    { name: 'Ausländeranteil', pts: [[2005, 8.8], [2010, 8.7], [2014, 10.0], [2016, 11.2], [2019, 12.5], [2022, 14.6], [2023, 15.3], [2024, 16.0]] },
  ],
  (v) => `${localePct(v, 0)}`,
  /** Latest non-German suspect share, for the headline. */
  { tvLatest: 35.4 },
);

// Aggravated and serious bodily harm (gefährliche und schwere Körperverletzung,
// PKS key 2220), Germany, recorded cases per year, rounded from the PKS
// yearbooks. This is the deepest honest violence series available nationwide
// (unified all-Germany PKS runs since 1993): a rise to a mid-2000s peak, a
// long decline through the 2010s, the pandemic dip, then a climb back to the
// old high by 2023. Not knife-specific — knives are only broken out since 2020.
export const DE_ASSAULT_PANEL: TrendSeries = trend(
  [
    [1993, 93_000], [1997, 110_000], [2000, 128_000], [2004, 151_000],
    [2007, 155_000], [2010, 152_000], [2013, 138_000], [2016, 140_000],
    [2018, 137_000], [2020, 132_000], [2021, 126_000], [2022, 134_000],
    [2023, 154_000], [2024, 149_000],
  ],
  (v) => `${Math.round(v / 1000)}k`,
  ['1993', '2003', '2013', 'heute'],
);

// Knife violence in NRW public space, cases per year — LKA NRW Lagebild
// "Gewalt im öffentlichen Raum · Tatmittel Messer" (Tatmittel are only
// recorded in the PKS since 2019). NRW is used deliberately: there is NO
// consistent multi-year NATIONAL series — the BKA introduced a nationwide
// "Messerangriffe" category only with the PKS 2024 (29,014 cases that
// year), so a Germany-wide trend before 2024 cannot be shown honestly.
// 2022 is derived from the reported +42.6% rise to 2023; 2024 = +16%.
export const DE_KNIFE_ATTACKS_PANEL: TrendSeries = trend(
  [
    [2022, 2480], [2023, 3536], [2024, 4103],
  ],
  (v) => `${Math.round(v)}`,
  ['2022', '2023', '2024', 'heute'],
);

// Suspect rate (TVBZ) for violent crime by age band, males, Germans vs.
// Afghan nationals — suspects per 100k of the respective resident group,
// PKS 2024 via BT-Drs. 21/145 (population: Census 2022, 31 Dec 2023).
// The classic age-crime curve: the raw 8.9× gap between all men (272 vs.
// 2,409) halves to ~4.1× when same-age 18-21-year-olds are compared — but
// stays ~9.5× among adults 21+, so age structure explains the youth gap,
// not everything. Suspects, not convictions; small resident denominators
// make single cells noisy (BKA caveat in the same document).
export const DE_TVBZ_AGE_COMPARE = (() => {
  const afghan = [1_617, 5_748, 3_972, 1_885];
  const german = [331, 1_148, 979, 199];
  const fmt = (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`);
  const s = niceScale(0, Math.max(...afghan), fmt);
  return {
    rows: [
      { name: 'Afghanen', data: norm(afghan, s.lo, s.hi) },
      { name: 'Deutsche', data: norm(german, s.lo, s.hi) },
    ],
    ticks: s.ticks,
  };
})();

// Germany's tax-and-contribution ratio: taxes plus compulsory social
// security contributions as a share of GDP (OECD Revenue Statistics,
// "tax-to-GDP", rounded). Climbed from ~32% in the 1960s to a record
// ~39% in the early 2020s. Pre-1990 is West Germany.
export const DE_TAX_QUOTA_PANEL: TrendSeries = trend(
  [
    [1965, 31.6], [1970, 31.5], [1975, 34.3], [1980, 36.4], [1985, 36.1],
    [1990, 34.8], [1995, 36.2], [2000, 36.2], [2005, 33.9], [2010, 34.9],
    [2015, 36.8], [2018, 38.5], [2019, 38.6], [2020, 38.0], [2021, 39.3],
    [2022, 39.3], [2023, 37.4],
  ],
  (v) => `${localePct(v, 1)}`,
  ['1965', '1985', '2005', 'heute'],
);

// German household electricity price, euro cents per kWh incl. taxes and
// levies (BDEW / Destatis / Eurostat, rounded). It roughly tripled since
// 2000 as the EEG renewables surcharge, grid fees and the 2021 CO2 price
// stacked on — then spiked with the 2022 energy crisis. Germany is now
// among the most expensive electricity markets worldwide.
export const DE_POWER_PRICE_PANEL: TrendSeries = trend(
  [
    [1991, 14], [1998, 17], [2000, 14], [2003, 17], [2006, 19],
    [2009, 23], [2012, 26], [2015, 29], [2018, 30], [2020, 32],
    [2021, 32], [2022, 37], [2023, 42], [2024, 40], [2025, 39],
  ],
  (v) => `${localeNum(v, 0)} ct`,
  ['1991', '2002', '2013', 'heute'],
);

// Open (not-yet-executed) arrest warrants held by Berlin authorities,
// thousands — rounded approximations from Berlin Senate answers to
// parliamentary questions (Senatsverwaltung für Justiz) and press
// reporting. Definitions vary (all open warrants vs. only those whose
// subject has absconded), so treat this as a magnitude/trend, not an
// exact count; the earlier points are especially rough.
export const BERLIN_WARRANTS_PANEL: TrendSeries = trend(
  [
    [2013, 12_000], [2015, 14_000], [2017, 16_500], [2019, 18_500],
    [2020, 19_500], [2021, 20_500], [2022, 22_000], [2023, 24_000],
    [2024, 26_000],
  ],
  (v) => `${localeNum(v / 1000, 0)}k`,
  ['2013', '2017', '2021', 'heute'],
);

// Germany's government-spending ratio (Staatsquote): total general
// government expenditure as a share of GDP (Destatis / BMF / Eurostat;
// pre-1950 from Andic & Veverka / Flora historical estimates, rounded).
// The long-run rise ("Wagner's law"): ~10% in the Kaiserreich, past 25%
// after WWI, then crises ratchet it up — the Depression, the 1975 oil
// shock, the 1995 reunification peak (partly Treuhand debt assumption),
// 2009's financial crisis, and Corona's ~51% record in 2020/21. Pre-1950
// covers the whole German Reich; pre-1990 is West Germany. War years
// (1914-18, 1939-45) are left unanchored — their >60% spikes would swamp
// the axis and hide the peacetime trend.
export const DE_STATE_QUOTA_PANEL: TrendSeries = trend(
  [
    [1880, 10], [1900, 14], [1913, 15], [1925, 26], [1929, 31],
    [1932, 34], [1938, 42], [1950, 30], [1960, 32.9], [1970, 38.3],
    [1975, 48.9], [1980, 47.9], [1985, 46.4], [1990, 44.5], [1995, 54.8],
    [2000, 45.1], [2005, 47.0], [2008, 44.3], [2009, 47.6], [2010, 47.9],
    [2013, 44.7], [2015, 44.0], [2019, 45.2], [2020, 50.9], [2021, 51.1],
    [2022, 49.5], [2023, 48.4], [2024, 49.5],
  ],
  (v) => `${localePct(v, 1)}`,
  ['1880', '1930', '1975', 'heute'],
);

// Germany's old-age dependency ratio: people 65+ per 100 of working age
// (20-64), Destatis 15th coordinated population projection (moderate
// variant) for the years past 2024, rounded. The "pensioner problem":
// it roughly doubles from ~25 in the 1970s to ~55 by 2060 as the boomer
// cohorts retire — ever fewer workers carry ever more retirees.
export const DE_OLD_AGE_PANEL: TrendSeries = trend(
  [
    [1950, 16], [1960, 18], [1970, 25], [1980, 24], [1990, 24],
    [2000, 26], [2010, 31], [2020, 37], [2024, 40], [2030, 46],
    [2035, 49], [2040, 50], [2050, 53], [2060, 55],
  ],
  (v) => `${localeNum(v, 0)}`,
  ['1950', '1987', '2023', '2060'],
);

// Germany's official registered unemployment vs. the Bundesagentur für
// Arbeit's own broader "Unterbeschäftigung" measure, with the long-term
// unemployed as a subset — annual averages in millions (BA statistics;
// Unterbeschäftigung ohne Kurzarbeit, published since 2009). The headline
// "Arbeitslose" (§16 SGB III) excludes anyone in a labour-market measure,
// short-term sick, in activation/training or under the 58+/§53a special rules —
// the broader figure adds them back and runs roughly a million higher. The
// long-term line (1+ year without work) sits below the official count and
// shows how much of it is structurally stuck: about a third. Same source
// throughout, so this is the state's own un-spun number.
export const DE_UNDEREMPLOYMENT_COMPARE = compareSeries(
  [
    { name: 'Unterbeschäftigung', pts: [[2009, 4.60], [2011, 4.02], [2013, 3.85], [2015, 3.61], [2017, 3.36], [2019, 3.06], [2020, 3.52], [2022, 3.18], [2023, 3.40], [2024, 3.58]] },
    { name: 'Arbeitslose (offiziell)', pts: [[2009, 3.42], [2011, 2.98], [2013, 2.95], [2015, 2.79], [2017, 2.53], [2019, 2.27], [2020, 2.70], [2022, 2.42], [2023, 2.61], [2024, 2.79]] },
    { name: 'Langzeitarbeitslose', pts: [[2009, 1.13], [2011, 1.06], [2013, 1.07], [2015, 1.04], [2017, 0.90], [2019, 0.72], [2020, 0.82], [2021, 1.00], [2022, 0.93], [2024, 1.03]] },
  ],
  (v) => `${localeNum(v, 1)} ${tr('Mio')}`,
  /** Latest underemployment figure, for the headline. */
  { underLatest: 3.58 },
);

// Share of world merchandise exports, %, Germany vs. China vs. USA (WTO,
// rounded). On a share basis Germany's line actually falls — from ~12% around
// 1990 to ~7% today — while China climbs from under 2% to ~14.5% and the USA
// drifts from ~11% to ~8%. This is the "Exportweltmeister → abschmieren" story
// the absolute-dollar view hides: nominal exports keep rising with world
// prices, but Germany's slice of the pie shrinks. Germany's ~10% peak share
// around 2003 is exactly when it held the world's #1 export crown.
export const DE_EXPORT_COMPARE = compareSeries(
  [
    { name: 'Deutschland', pts: [[1990, 12.0], [1995, 10.1], [2000, 8.5], [2003, 10.0], [2005, 9.3], [2008, 9.1], [2010, 8.2], [2015, 8.1], [2018, 8.0], [2020, 7.9], [2023, 7.1], [2024, 7.0]] },
    { name: 'China', pts: [[1990, 1.8], [1995, 2.9], [2000, 3.9], [2005, 7.3], [2008, 8.9], [2009, 9.6], [2010, 10.3], [2015, 13.7], [2018, 12.7], [2020, 14.7], [2022, 14.4], [2024, 14.5]] },
    { name: 'USA', pts: [[1990, 11.3], [1995, 11.3], [2000, 12.1], [2005, 8.6], [2008, 8.0], [2010, 8.4], [2015, 9.1], [2018, 8.5], [2020, 8.1], [2024, 8.4]] },
  ],
  (v) => `${localePct(v, 0)}`,
  /** Latest German world-export share, for the headline. */
  { deuLatest: 7.0 },
);

// US unemployment: recent college graduates vs all workers, % (NY Fed /
// BLS, rounded). Aggregate unemployment shows no AI effect yet — the
// canary is the entry-level gap widening since 2023: the rungs AI
// automates first are exactly the jobs graduates start in.
export const AI_JOBS_COMPARE = compareSeries(
  [
    { name: 'Absolventen', pts: [[2015, 5.0], [2018, 3.9], [2019, 3.9], [2020, 9.0], [2021, 5.6], [2022, 4.0], [2023, 4.4], [2024, 5.0], [2025, 5.8]] },
    { name: 'Gesamt', pts: [[2015, 5.3], [2018, 3.9], [2019, 3.7], [2020, 8.1], [2021, 5.4], [2022, 3.6], [2023, 3.6], [2024, 4.0], [2025, 4.2]] },
  ],
  (v) => `${localePct(v, 0)}`,
  /** Latest recent-graduate rate, for the headline. */
  { gradLatest: 5.8 },
);

// People online worldwide (ITU).
export const INTERNET_PANEL: TrendSeries = trend(
  [
    [1990, 0.003e9], [1995, 0.04e9], [2000, 0.41e9], [2005, 1.02e9],
    [2010, 2.0e9], [2015, 3.2e9], [2020, 4.7e9], [2024, 5.5e9],
  ],
  (v) => `${localeNum(v / 1e9, 1)} ${tr('Mrd')}`,
  ['1990', '2001', '2013', 'heute'],
);

// Bitcoin, gold, the S&P 500 and US M2 money supply on one shared logarithmic
// dollar axis since 1915. The absolute levels differ wildly; the point is the
// shape — every surge in the money supply (1971 gold-standard exit, 2008 QE,
// 2020 pandemic printing) pulls all three asset prices up with it. Figures are
// approximate annual values (M2 in $, gold $/oz, S&P index level, BTC $); BTC
// is floored to a cent before it existed (2009) so it reads flat-then-vertical.
export const ASSET_MEGACOMPARE = (() => {
  const LO = -2; // log10 of $0.01 — plot floor
  const HI = 14; // log10 of $100T — plot ceiling
  const N = 111; // one sample per year, 1915..2025
  const defs: { name: string; pts: [number, number][] }[] = [
    { name: 'M2', pts: [[1915, 13e9], [1929, 46e9], [1933, 32e9], [1940, 55e9], [1950, 151e9], [1960, 312e9], [1970, 626e9], [1980, 1.6e12], [1990, 3.28e12], [2000, 4.92e12], [2008, 8.19e12], [2015, 12.33e12], [2020, 19.13e12], [2022, 21.7e12], [2025, 21.6e12]] },
    { name: 'Gold', pts: [[1915, 20.67], [1934, 35], [1968, 39], [1971, 41], [1980, 615], [2000, 280], [2008, 870], [2011, 1571], [2020, 1770], [2024, 2380], [2025, 2600]] },
    { name: 'S&P 500', pts: [[1915, 9], [1929, 26], [1932, 7], [1942, 9], [1950, 20], [1968, 100], [1980, 120], [2000, 1430], [2009, 900], [2013, 1650], [2020, 3230], [2024, 5000], [2025, 6000]] },
    { name: 'BTC', pts: [[1915, 0.01], [2009, 0.01], [2011, 5], [2013, 130], [2015, 300], [2017, 13000], [2019, 7000], [2021, 47000], [2023, 30000], [2024, 65000], [2025, 95000]] },
  ];
  // Interpolate in log space (geometric growth reads straight), then normalise
  // every series against the same LO..HI decade window so all four share an axis.
  const rows = defs.map((d) => ({
    name: d.name,
    data: norm(resample(yearly(d.pts.map(([yr, v]) => [yr, Math.log10(v)] as [number, number])), N), LO, HI),
  }));
  const fmtD = (v: number) =>
    v >= 1e12 ? `$${localeNum(v / 1e12)} ${tr('Bio.')}` : v >= 1e9 ? `$${localeNum(v / 1e9)} ${tr('Mrd')}` : v >= 1e6 ? `$${localeNum(v / 1e6)} ${tr('Mio')}` : v >= 1e3 ? `$${localeNum(v / 1e3)}k` : `$${v}`;
  const ticks = Array.from({ length: 5 }, (_, i) => fmtD(10 ** (LO + (i * (HI - LO)) / 4)));
  return { rows, ticks, btcLatest: 95000 };
})();

// Journalists jailed worldwide on 1 December each year (CPJ annual prison
// census, running since 1992). Recent years are firm CPJ totals — the record
// 370 in 2022, 320 (2023), 361 (2024), with 300+ every year since 2020;
// earlier anchors are approximate census figures. The long climb tracks the
// crackdown on the free press: China, Turkey's post-2016 purge, then Belarus,
// Iran and Israel.
export const JAILED_JOURNALISTS_PANEL: TrendSeries = trend(
  [
    [1992, 100], [2000, 81], [2005, 125], [2008, 125], [2010, 145],
    [2012, 232], [2015, 199], [2016, 259], [2017, 262], [2019, 250],
    [2020, 274], [2021, 293], [2022, 370], [2023, 320], [2024, 361],
  ],
  (v) => `${Math.round(v)}`,
  ['1992', '2003', '2013', 'heute'],
);

// RSF World Press Freedom Index — per-country score (0–100, higher = freer),
// current post-2022 methodology. Germany holds in the 80s ("good"), the US has
// slid out of the 70s toward the "problematic" band, Thailand sits mid-table,
// and China and Saudi Arabia hug the very bottom worldwide. Figures track RSF's
// annual country scores; the 2025 values are approximate.
export const PRESS_FREEDOM_COMPARE = compareSeries(
  [
    { name: 'Deutschland', pts: [[2022, 82.0], [2023, 81.9], [2024, 83.8], [2025, 82.0]] },
    { name: 'USA', pts: [[2022, 72.7], [2023, 71.2], [2024, 66.6], [2025, 60.0]] },
    { name: 'Thailand', pts: [[2022, 50.2], [2023, 45.1], [2024, 44.1], [2025, 43.0]] },
    { name: 'China', pts: [[2022, 25.2], [2023, 23.0], [2024, 23.4], [2025, 22.6]] },
    { name: 'Saudi-Arabien', pts: [[2022, 28.3], [2023, 25.5], [2024, 27.6], [2025, 24.0]] },
  ],
  (v) => localeNum(v, 1),
  /** Latest German score, for the headline. */
  { deLatest: 82.0 },
);

// PEN America Index of School Book Bans — documented cases per US school year.
// Bans exploded from 2,532 (2021–22) to a peak of 10,046 (2023–24), then eased
// to 6,870 (2024–25) — though PEN notes titles pulled in earlier years stay off
// the shelves uncounted, so the dip understates books still unavailable.
export const BOOK_BANS_PANEL: TrendSeries = trend(
  [[2021, 2532], [2022, 3362], [2023, 10046], [2024, 6870]],
  (v) => (v >= 1000 ? `${localeNum(v / 1000, 1)}k` : `${v}`),
  ['21/22', '22/23', '23/24', '24/25'],
);

// Undernourished people worldwide, millions (FAO State of Food Security 2024).
// Hunger (SDG 2) fell for a decade, bottomed near 2017 (~570M), then climbed
// with the pandemic and food-price shocks to ~733M in 2023 — the goal is
// moving backwards. FAO revised its method over time, so treat as magnitudes.
export const HUNGER_PANEL: TrendSeries = trend(
  [
    [2005, 810], [2010, 640], [2015, 589], [2017, 572], [2019, 581],
    [2020, 638], [2021, 745], [2022, 735], [2023, 733],
  ],
  (v) => `${Math.round(v)} ${tr('Mio')}`,
  ['2005', '2011', '2017', 'heute'],
);

// Share of the world in extreme poverty, % below $2.15/day (World Bank PIP,
// 2017 PPP). A historic collapse from ~38% (1990) to ~9%, but progress stalled
// and 2020 brought the first rise in a generation (pandemic). Ending extreme
// poverty by 2030 (SDG 1) will be missed — projections stay near 7%.
export const EXTREME_POVERTY_PANEL: TrendSeries = trend(
  [
    [1990, 38], [2000, 29], [2010, 16], [2015, 10.8], [2019, 8.9],
    [2020, 9.7], [2022, 9.0], [2024, 8.5],
  ],
  (v) => `${localePct(v, 1)}`,
  ['1990', '2001', '2013', 'heute'],
);

// Global oil consumption, million barrels per day (Energy Institute
// Statistical Review of World Energy; pre-1965 from historical BP / Our World
// in Data series). The only real dents before COVID-2020 are the 1973 and
// 1979 oil-crisis demand shocks — otherwise a near-unbroken climb.
export const OIL_CONSUMPTION_PANEL: TrendSeries = trend(
  [
    [1900, 0.5], [1920, 1.2], [1940, 6], [1950, 10.5], [1960, 21],
    [1965, 31], [1973, 56], [1979, 65], [1983, 59], [1990, 66],
    [2000, 76], [2008, 86], [2010, 88], [2019, 100], [2020, 91],
    [2023, 102],
  ],
  (v) => `${localeNum(v, 0)} mb/d`,
  ['1900', '1941', '1982', 'heute'],
);

// Nuclear test explosions per year (Arms Control Association).
export const NUKE_TESTS_PANEL: TrendSeries = trend(
  [
    [1945, 3], [1951, 18], [1957, 55], [1958, 116], [1959, 0],
    [1961, 71], [1962, 178], [1964, 60], [1968, 79], [1972, 57],
    [1980, 51], [1985, 36], [1990, 18], [1992, 8], [1996, 5],
    [1998, 6], [2000, 0], [2006, 1], [2013, 1], [2017, 1], [2024, 0],
  ],
  (v) => `${Math.round(v)}`,
  ['1945', '1971', '1998', 'heute'],
  64,
);

// Adult obesity share worldwide, % (WHO / NCD-RisC, series starts 1975).
// Pre-1975 points are rough back-extrapolations — no global surveys exist
// that far back, only sparse national data suggesting a low, slow rise.
export const OBESITY_PANEL: TrendSeries = trend(
  [
    [1900, 1.5], [1925, 1.9], [1950, 2.5], [1960, 3.1], [1970, 4.1],
    [1975, 4.7], [1985, 6.4], [1995, 8.5], [2005, 10.3],
    [2010, 11.7], [2016, 13.1], [2022, 16],
  ],
  (v) => `${localePct(v, 0)}`,
  ['1900', '1940', '1980', 'heute'],
);

// Births per woman by continent — UN WPP 2024 from 1950 on, pre-1950 from
// Gapminder/OWID estimates (coarser, but the transition shapes are real).
export const CONTINENT_FERTILITY = compareSeries(
  [
    { name: 'Afrika', pts: [[1900, 6.6], [1930, 6.6], [1950, 6.6], [1970, 6.7], [1990, 5.9], [2000, 5.1], [2010, 4.7], [2024, 4.1]] },
    { name: 'Asien', pts: [[1900, 5.5], [1930, 5.6], [1950, 5.8], [1970, 5.6], [1990, 3.3], [2000, 2.6], [2010, 2.2], [2024, 1.9]] },
    { name: 'Lateinamerika', pts: [[1900, 6.0], [1930, 5.9], [1950, 5.8], [1970, 5.3], [1990, 3.3], [2000, 2.6], [2010, 2.2], [2024, 1.8]] },
    { name: 'Nordamerika', pts: [[1900, 3.8], [1920, 3.2], [1935, 2.2], [1950, 3.3], [1958, 3.7], [1970, 2.3], [1990, 2.0], [2010, 1.9], [2024, 1.6]] },
    { name: 'Europa', pts: [[1900, 4.5], [1915, 3.4], [1930, 2.5], [1950, 2.7], [1970, 2.2], [1990, 1.7], [2000, 1.4], [2010, 1.6], [2024, 1.4]] },
  ],
  (v) => localeNum(v, 1),
  /** Global births per woman, for the headline. */
  { world: 2.2 },
);

// PISA mean scores for Germany, points (OECD PISA 2000–2022). All three
// domains fell to record lows in 2022 — the steepest single-cycle drop since
// PISA began, sharpened by the pandemic school closures. Every series spans
// the full 2000–2022 window so the lines stay temporally aligned.
export const PISA_DE = compareSeries(
  [
    { name: 'Mathematik', pts: [[2000, 490], [2003, 503], [2006, 504], [2009, 513], [2012, 514], [2015, 506], [2018, 500], [2022, 475]] },
    { name: 'Lesen', pts: [[2000, 484], [2003, 491], [2006, 495], [2009, 497], [2012, 508], [2015, 509], [2018, 498], [2022, 480]] },
    { name: 'Naturwiss.', pts: [[2000, 487], [2003, 502], [2006, 516], [2009, 520], [2012, 524], [2015, 509], [2018, 503], [2022, 492]] },
  ],
  (v) => `${localeNum(v, 0)}`,
  /** Latest maths score, for the headline. */
  { deuLatest: 475 },
);

// Interpolate sparse year->value anchors onto n even samples and flag which
// samples fall in a given era, so a single-series line can carry a shaded
// band (like the fast-food panel). Baseline forced to 0 so flat early years
// read as genuinely low, not scaled up to fill the panel.
function maskedTrend(anchors: [number, number][], fmt: (v: number) => string, maskFrom: number) {
  const [y0, y1] = [anchors[0][0], anchors[anchors.length - 1][0]];
  const n = 60;
  const raw: number[] = [];
  const years: number[] = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * i) / (n - 1);
    years.push(y);
    raw.push(interpAt(anchors, y));
  }
  const s = niceScale(0, Math.max(...raw), fmt);
  return {
    data: norm(raw, s.lo, s.hi),
    ticks: s.ticks,
    latest: anchors[anchors.length - 1][1],
    mask: years.map((y) => y >= maskFrom),
  };
}

// US high-schoolers reporting persistent feelings of sadness or hopelessness,
// % (CDC Youth Risk Behavior Survey), now reaching back to 1999. The rate is
// roughly flat through the pre-smartphone years, then girls climb steeply
// after ~2012 as smartphones and social media saturate teen life. Both series
// share one scale; the shaded band marks the smartphone era.
const TEEN_SAD_GIRLS: [number, number][] = [
  [1999, 35], [2001, 34], [2003, 36], [2005, 37], [2007, 36], [2009, 33],
  [2011, 36], [2013, 36], [2015, 40], [2017, 41], [2019, 47], [2021, 57], [2023, 53],
];
const TEEN_SAD_BOYS: [number, number][] = [
  [1999, 22], [2001, 22], [2003, 22], [2005, 21], [2007, 21], [2009, 19],
  [2011, 21], [2013, 21], [2015, 20], [2017, 21], [2019, 27], [2021, 29], [2023, 28],
];

function teenSadnessPanel() {
  const y0 = 1999;
  const y1 = 2023;
  const n = 60;
  const years: number[] = [];
  const girlsRaw: number[] = [];
  const boysRaw: number[] = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * i) / (n - 1);
    years.push(y);
    girlsRaw.push(interpAt(TEEN_SAD_GIRLS, y));
    boysRaw.push(interpAt(TEEN_SAD_BOYS, y));
  }
  const s = niceScale(0, Math.max(...girlsRaw), (v) => `${localePct(v, 0)}`);
  return {
    girls: norm(girlsRaw, s.lo, s.hi),
    boys: norm(boysRaw, s.lo, s.hi),
    ticks: s.ticks,
    girlsLatest: 53,
    socialMask: years.map((y) => y >= 2012),
  };
}
export const TEEN_SADNESS = teenSadnessPanel();

// US suicide rate by age band, per 100k (CDC WONDER), from 1980. The older
// bands carry by far the highest rates (20–24 > 15–19 > 10–14); the youngest
// band is lowest but rose fastest in relative terms after ~2010. All three
// span 1980–2021 so the lines align. Note the rates were already high in the
// 1980s, long before the internet — not a clean single-cause story.
export const SUICIDE_BY_AGE = compareSeries(
  [
    { name: '10–14 J.', pts: [[1980, 0.8], [1990, 1.5], [2000, 1.3], [2007, 0.9], [2015, 2.1], [2021, 2.4]] },
    { name: '15–19 J.', pts: [[1980, 8.5], [1990, 11.1], [2000, 8.0], [2007, 6.9], [2015, 9.8], [2018, 11.4], [2021, 11.0]] },
    { name: '20–24 J.', pts: [[1980, 16.1], [1990, 15.1], [2000, 12.5], [2007, 12.5], [2015, 15.0], [2018, 17.0], [2021, 18.0]] },
  ],
  (v) => localeNum(v, 1),
  /** Latest 20–24 rate, for the headline. */
  { oldestLatest: 18.0 },
);

// US adolescents (12–17) with a past-year major depressive episode, %
// (SAMHSA NSDUH). Flat near 8% through 2011, then climbing steeply as
// smartphones and social media take over teen life.
export const TEEN_MDE = maskedTrend(
  [
    [2004, 9.0], [2007, 8.2], [2010, 8.0], [2011, 8.2], [2013, 10.7],
    [2015, 12.5], [2017, 13.3], [2019, 15.7], [2021, 20.1], [2022, 19.5],
  ],
  (v) => `${localePct(v, 0)}`,
  2012,
);

// Daily entertainment screen media among US teens (13–18), hours, starting a
// decade before colour TV (~1965) so the black-and-white-TV baseline is
// visible. Pre-2015 points come from TV-era time-use studies (Nielsen / Kaiser
// Family Foundation) and are TV-dominated — a rough, definition-shifting splice
// onto the smartphone-era Common Sense Media Census, but the shape is the
// story: ~2h of TV in the 1950s to ~8h across all screens today. Excludes
// school and homework screen time.
export const TEEN_SCREEN_PANEL: TrendSeries = trend(
  [
    [1955, 2.3], [1965, 2.5], [1980, 3.0], [1999, 3.9], [2004, 4.4],
    [2009, 5.6], [2015, 6.7], [2019, 7.4], [2021, 8.6], [2023, 8.4],
  ],
  (v) => `${localeNum(v, 1)} h`,
  ['1955', '1978', '2000', 'heute'],
);

// Share of US adolescents (12–17) dispensed an antidepressant in the year, %,
// back to 1970. Near zero before Prozac (1988) — tricyclics were rarely given
// to children; the SSRI era opens the climb. Pre-2000 points are rough
// estimates (youth-specific dispensing data is sparse that far back), post-2010
// tracks IQVIA/CDC. The shape — from almost nothing to the mid-single digits.
export const TEEN_RX_PANEL: TrendSeries = trend(
  [
    [1970, 0.1], [1988, 0.4], [1995, 1.2], [2002, 2.4], [2010, 3.0],
    [2016, 4.2], [2019, 5.0], [2022, 6.3],
  ],
  (v) => `${localePct(v, 1)}`,
  ['1970', '1987', '2004', 'heute'],
);

// Installed nuclear generating capacity in Germany, GW net (BMWK / IAEA PRIS).
// 19 reactors in 2000; the 2011 Fukushima decision shut the 8 oldest at once,
// and the last three went off-grid in April 2023 — the full phase-out.
export const DE_NUCLEAR_PANEL: TrendSeries = trend(
  [
    [2000, 22.4], [2004, 21.3], [2006, 20.3], [2010, 20.5], [2011, 12.7],
    [2015, 12.1], [2017, 10.8], [2019, 9.5], [2022, 4.3], [2023, 0],
  ],
  (v) => `${localeNum(v, 1)} GW`,
  ['2000', '2008', '2016', '2023'],
);

// Total installed net electricity generating capacity in Germany, GW (BNetzA
// / Fraunhofer ISE / AGEB, all sources). It roughly doubles from 2000 to
// today even as nuclear goes to zero — wind and solar were built out faster
// than the retirements. Caveat: much of the new capacity is intermittent, so
// nameplate GW overstates the firm, dispatchable power the grid can lean on.
export const DE_TOTAL_CAP_PANEL: TrendSeries = trend(
  [
    [2002, 120], [2008, 141], [2010, 153], [2015, 195], [2018, 209],
    [2020, 222], [2023, 245],
  ],
  (v) => `${Math.round(v)} GW`,
  ['2002', '2009', '2016', '2023'],
);

// Grid-stabilization interventions in Germany: yearly redispatch volume,
// TWh (Bundesnetzagentur "Netz- und Systemsicherheit"). Near zero before the
// Energiewende, then leaping as wind in the north has to be throttled and
// southern plants ramped to hold the grid — a real measure of rising strain.
// Note: this is intervention effort, NOT customer blackouts; actual outage
// minutes (SAIDI) stayed among the world's lowest.
export const DE_GRID_INTERVENTIONS_PANEL: TrendSeries = trend(
  [
    [2000, 0.02], [2005, 0.05], [2009, 0.2], [2010, 0.3], [2012, 2.6],
    [2014, 5.2], [2015, 16.0], [2017, 20.4], [2019, 13.7], [2021, 12.2],
    [2023, 14.8],
  ],
  (v) => `${localeNum(v, 1)} TWh`,
  ['2000', '2008', '2016', '2023'],
);

// US installed generating capacity by source, GW (EIA). Coal peaks ~2011
// then retires; nuclear stays roughly flat; wind+solar climb from almost
// nothing to the largest of the three. All three span 2000–2023 so the lines
// stay aligned. Wind and solar are weather-dependent, so their nameplate GW
// overstates firm, on-demand power — the grid-strain that intermittency adds
// shows up in the redispatch panel, not here.
export const US_ENERGY_MIX = compareSeries(
  [
    { name: 'Kohle', pts: [[2000, 305], [2011, 318], [2016, 275], [2019, 229], [2023, 190]] },
    { name: 'Kernkraft', pts: [[2000, 98], [2010, 101], [2016, 99], [2023, 95]] },
    { name: 'Wind + Solar', pts: [[2000, 3], [2010, 40], [2015, 95], [2019, 160], [2023, 290]] },
  ],
  (v) => `${Math.round(v)} GW`,
  /** Latest wind+solar capacity, for the headline. */
  { renewLatest: 290 },
);

// German installed generating capacity by source since reunification, GW
// (BNetzA / Fraunhofer ISE). The Energiewende in one chart: nuclear collapses
// to zero (2023), coal is drawn down, and wind+solar surge from a rounding
// error to by far the largest block. The 1990 anchor catches reunification —
// the combined fleet still ran the East German lignite plants and the
// Greifswald reactors (shut down that year). All three span 1990–2024 so the
// lines align. Nameplate GW — wind/solar's firm output is a fraction of it.
export const DE_ENERGY_MIX = compareSeries(
  [
    { name: 'Kohle', pts: [[1990, 55], [1995, 52], [2005, 50], [2015, 50], [2020, 44], [2024, 35]] },
    { name: 'Kernkraft', pts: [[1990, 24], [1995, 22.7], [2000, 22.4], [2010, 20.5], [2011, 12.7], [2015, 12.1], [2019, 9.5], [2022, 4.3], [2023, 0], [2024, 0]] },
    { name: 'Wind + Solar', pts: [[1990, 0.5], [1995, 2], [2000, 6], [2010, 45], [2015, 85], [2020, 115], [2024, 172]] },
  ],
  (v) => `${Math.round(v)} GW`,
  /** Latest wind+solar capacity, for the headline. */
  { renewLatest: 172 },
);

// US adult obesity share, % (NHANES from 1962; pre-1962 are rough estimates
// from early insurance/anthropometric data — a low, flat baseline). The
// shaded band marks the fast-food era: the 1970s drive-through boom and, from
// the 1980s, cheap high-fructose corn syrup in soft drinks — the decades US
// obesity roughly tripled.
const US_OBESITY_ANCHORS: [number, number][] = [
  [1900, 3.0], [1920, 4.0], [1940, 8.0], [1955, 10.0],
  [1962, 13.0], [1971, 14.5], [1978, 15.0], [1988, 22.9], [1994, 23.2],
  [2000, 30.5], [2004, 32.2], [2008, 33.7], [2012, 34.9], [2016, 39.6],
  [2018, 42.4], [2022, 41.9],
];

function obesityFastfoodPanel() {
  const [y0, y1] = [US_OBESITY_ANCHORS[0][0], US_OBESITY_ANCHORS[US_OBESITY_ANCHORS.length - 1][0]];
  const n = 60;
  const raw: number[] = [];
  const years: number[] = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * i) / (n - 1);
    years.push(y);
    raw.push(interpAt(US_OBESITY_ANCHORS, y));
  }
  const s = niceScale(0, Math.max(...raw), (v) => `${localePct(v, 0)}`);
  return {
    data: norm(raw, s.lo, s.hi),
    ticks: s.ticks,
    latest: US_OBESITY_ANCHORS[US_OBESITY_ANCHORS.length - 1][1],
    // Fast food goes nationwide with the 1970s drive-through boom.
    fastfoodMask: years.map((y) => y >= 1972),
  };
}

export const US_OBESITY_FASTFOOD = obesityFastfoodPanel();

// --- Surveillance & Agenda 2030 bundled panels ---

// Installed surveillance cameras worldwide, count (IHS Markit / market
// estimates). ~350M in 2016, roughly a billion by 2021 and still climbing —
// China alone holds over half. Pre-2010 points are rough back-estimates.
export const CAMERAS_PANEL: TrendSeries = trend(
  [
    [2000, 25e6], [2006, 60e6], [2012, 160e6], [2016, 350e6],
    [2018, 570e6], [2021, 1e9], [2023, 1.1e9], [2025, 1.25e9],
  ],
  (v) => `${localeNum(v / 1e9, 2)} ${tr('Mrd')}`,
  ['2000', '2008', '2017', 'heute'],
);

// Government-ordered internet shutdowns per year (Access Now / #KeepItOn).
// India leads the count year after year; 2023–24 are record highs, driven
// by conflict shutdowns (Myanmar, Sudan, Ukraine-occupied regions).
export const SHUTDOWN_PANEL: TrendSeries = trend(
  [
    [2016, 75], [2017, 108], [2018, 196], [2019, 213], [2020, 159],
    [2021, 182], [2022, 187], [2023, 283], [2024, 296],
  ],
  (v) => `${Math.round(v)}`,
  ['2016', '2019', '2021', 'heute'],
);

// US states with an enacted online age-verification law (requires an ID or
// face/age check to access covered sites). Free Speech Coalition / age-
// verification tracker, rounded. Louisiana was first (effective Jan 2023);
// after the Supreme Court upheld Texas's law in June 2025 the count jumped
// again. The quantified on-ramp to mandatory digital ID: age checks normalise
// showing your face or papers just to use the internet.
export const AGE_VERIF_PANEL: TrendSeries = trend(
  [
    [2022, 0], [2023, 8], [2024, 19], [2025, 24],
  ],
  (v) => `${Math.round(v)}`,
  ['2022', '2023', '2024', 'heute'],
);

// Countries with a national online age-verification mandate enacted (porn
// and/or social media): China's real-name minor mode, Germany's JMStV
// enforcement, France's SREN law, Australia's under-16 social-media ban, the
// UK's Online Safety Act (enforced July 2025), plus first followers (Italy,
// Ireland, EU pilots…). Rough count — scope differs per country. The UK is
// the template case: an ID or face scan gates adult content, and unverified
// accounts drop into restricted child modes via the platforms' and Apple's/
// Google's age-assurance hooks.
export const AGE_VERIF_NATIONS_PANEL: TrendSeries = trend(
  [
    [2019, 2], [2021, 3], [2023, 5], [2024, 8], [2025, 15],
  ],
  (v) => `${Math.round(v)}`,
  ['2019', '2021', '2023', 'heute'],
);

// States collecting air-passenger data (API/PNR systems; UN CTED / ICAO,
// rounded estimates). UN Security Council resolutions 2178 (2014) and 2396
// (2017) oblige every member state to collect Advance Passenger Information
// and build PNR capability, and since 2023 an ICAO standard makes PNR
// collection binding — every ticket, route and payment record lands in state
// databases before boarding.
export const PNR_PANEL: TrendSeries = trend(
  [
    [2005, 25], [2010, 40], [2014, 50], [2017, 60],
    [2019, 70], [2022, 85], [2025, 100],
  ],
  (v) => `${Math.round(v)}`,
  ['2005', '2012', '2019', 'heute'],
);

// Jurisdictions that have passed the FATF "travel rule" — mandatory KYC on
// crypto transfers, extending bank-style identification to the last mostly
// pseudonymous payment rail (FATF targeted updates: 2023 survey 35 of 98,
// 2024 survey 65 of 94 jurisdictions with legislation; EU enforcement via
// the Transfer of Funds Regulation since Dec 2024). Rounded.
export const KYC_PANEL: TrendSeries = trend(
  [
    [2019, 5], [2020, 10], [2021, 18], [2022, 29],
    [2023, 35], [2024, 65], [2025, 73],
  ],
  (v) => `${Math.round(v)}`,
  ['2019', '2021', '2023', 'heute'],
);

// People without an officially recognised proof of identity, worldwide
// (World Bank ID4D Global Dataset). The gap closes fast — India's Aadhaar
// alone enrolled over a billion people — so this is the global digital-ID
// rollout curve read in reverse. The methodology was revised several times
// and the latest point is a rough extrapolation.
export const ID_GAP_PANEL: TrendSeries = trend(
  [
    [2016, 1.5e9], [2017, 1.1e9], [2018, 1.0e9], [2021, 8.5e8], [2025, 7.5e8],
  ],
  (v) => `${localeNum(v / 1e9, 2)} ${tr('Mrd')}`,
  ['2016', '2019', '2022', 'heute'],
);

// Government requests for user data to Big Tech, count of requests per year
// (Google & Meta transparency reports, rounded). Both climb steeply as
// platforms become the default evidence trove for law enforcement.
export const DATA_REQUESTS = compareSeries(
  [
    { name: 'Meta', pts: [[2013, 25_000], [2016, 59_000], [2019, 140_000], [2022, 237_000], [2024, 320_000]] },
    { name: 'Google', pts: [[2013, 27_000], [2016, 45_000], [2019, 85_000], [2022, 130_000], [2024, 165_000]] },
  ],
  (v) => `${Math.round(v / 1000)}k`,
  /** Latest Meta request count, for the headline. */
  { metaLatest: 320_000 },
);

// Share of cash at the point of sale, % of transactions (Riksbank, Bundesbank,
// ECB SPACE study; rounded, estimates). Sweden is nearly cashless; the euro
// area and Germany still pay far more in cash but the slide is steady.
// Cash share of point-of-sale purchases. Euro area/Germany from the ECB SPACE
// study, Sweden from the Riksbank; the four extra countries from the FIS/
// Worldpay Global Payments Report and Bank of Russia (approximate, rounded).
// China, South Korea and Russia are the "cashless suspects" — Japan is the
// honest counter-example: rich yet still heavily cash-based (~40%).
export const CASHLESS_COMPARE = compareSeries(
  [
    { name: 'Eurozone', pts: [[2016, 79], [2019, 72], [2022, 59], [2024, 52]] },
    { name: 'Deutschland', pts: [[2016, 80], [2019, 74], [2021, 58], [2023, 51], [2024, 50]] },
    { name: 'Schweden', pts: [[2016, 20], [2019, 13], [2022, 9], [2024, 8]] },
    { name: 'Südkorea', pts: [[2016, 26], [2019, 17], [2022, 15], [2024, 14]] },
    { name: 'China', pts: [[2016, 40], [2019, 19], [2022, 10], [2024, 8]] },
    { name: 'Japan', pts: [[2016, 62], [2019, 53], [2022, 46], [2024, 41]] },
    { name: 'Russland', pts: [[2016, 60], [2019, 48], [2022, 34], [2024, 27]] },
  ],
  (v) => `${localePct(v, 0)}`,
  /** Latest Swedish cash share, for the headline. */
  { sweLatest: 8 },
);

// Marriages and divorces in Germany per 1,000 inhabitants (Destatis /
// historical statistics; early years and war-era spikes rounded). Marriages
// fall by half across the century; divorces climb, peak around 2004 and have
// declined since — so "ever more divorces" no longer holds.
export const DE_FAMILY = compareSeries(
  [
    { name: 'Heiraten', pts: [[1900, 8.5], [1920, 14.5], [1933, 9.7], [1950, 10.7], [1960, 9.4], [1970, 7.4], [1980, 6.3], [1990, 6.5], [2000, 5.1], [2010, 4.7], [2022, 4.4]] },
    { name: 'Scheidungen', pts: [[1900, 0.15], [1920, 0.6], [1933, 0.8], [1950, 1.5], [1960, 0.9], [1970, 1.3], [1980, 1.6], [1990, 1.9], [2000, 2.4], [2004, 2.6], [2010, 2.3], [2022, 1.6]] },
  ],
  (v) => localeNum(v, 1),
  /** Latest marriage rate, for the headline. */
  { marLatest: 4.4 },
);

// Share of single-person households in Germany, % (Destatis; pre-1950
// estimates). One in seven at 1900, now over 40% — the structural side of
// the shrinking family.
export const DE_SINGLE_HH_PANEL: TrendSeries = trend(
  [
    [1900, 7], [1925, 11], [1950, 12], [1961, 21], [1970, 25],
    [1980, 31], [1990, 34], [2000, 36], [2011, 40], [2022, 41],
  ],
  (v) => `${localePct(v, 0)}`,
  ['1900', '1940', '1980', 'heute'],
);

// Female labour-force participation rate, Germany, % of women ~15–64
// (census/Destatis). Definitions shifted over the century and pre-1990 figures
// are West Germany only (the GDR ran far higher, ~80%), so the early points are
// rough and comparability is limited. The 1882 imperial census already counted
// a high female share thanks to unpaid family labour in agriculture — the rate
// dipped as the economy urbanised, then climbed steadily to today.
export const DE_FEMALE_LFP_PANEL: TrendSeries = trend(
  [
    [1882, 40], [1907, 30], [1925, 35], [1950, 44], [1961, 47], [1970, 46],
    [1980, 50], [1991, 57], [2000, 63], [2010, 70], [2016, 74], [2023, 76],
  ],
  (v) => `${localePct(v, 0)}`,
  ['1882', '1930', '1980', 'heute'],
);

// US alcohol-induced deaths per year (CDC WONDER, alcohol-induced causes:
// liver disease, poisoning, etc. — excludes drunk-driving crashes). A steady
// climb, then the pandemic spike: +40% from 2019 to the 2021 peak.
export const US_ALCOHOL_DEATHS_PANEL: TrendSeries = trend(
  [
    [1999, 19_500], [2005, 21_600], [2010, 25_700], [2015, 33_200],
    [2018, 37_300], [2019, 39_000], [2020, 49_000], [2021, 54_300],
    [2022, 51_200],
  ],
  (v) => `${Math.round(v / 1000)}k`,
  ['1999', '2007', '2015', 'heute'],
);

// Purchasing power of one 1913 US dollar (BLS CPI).
export const DOLLAR_PANEL: TrendSeries = trend(
  [
    [1913, 1.0], [1920, 0.49], [1933, 0.76], [1945, 0.55], [1960, 0.33],
    [1975, 0.18], [1985, 0.092], [2000, 0.057], [2010, 0.045], [2024, 0.032],
  ],
  (v) => `${localeNum(v * 100, 0)}¢`,
  ['1913', '1950', '1987', 'heute'],
);

// Nominal vs. real gross wage index for Germany (Destatis Nominal-/Reallohn-
// index, 2015 = 100; earlier years back-cast from the Verdienststatistik).
// The gap is the point: nominal pay climbs steadily, but after inflation the
// real line barely moves for two decades — and 2022 was the sharpest real-wage
// loss since records began, only clawed back from 2023 on. You "earn more" in
// numbers while your purchasing power stands still.
export const DE_WAGE_COMPARE = compareSeries(
  [
    { name: 'Nominallohn', pts: [[2000, 78], [2005, 83], [2010, 89], [2015, 100], [2018, 107], [2020, 108], [2022, 112], [2024, 122]] },
    { name: 'Reallohn', pts: [[2000, 92], [2005, 93], [2010, 95], [2015, 100], [2018, 104], [2020, 104], [2022, 100], [2024, 104]] },
  ],
  (v) => localeNum(v, 0),
  /** Latest real-wage index, for the headline. */
  { realLatest: 104 },
);

// Central-bank balance sheets, Fed (USD) vs ECB (EUR), trillions (Fed H.4.1 /
// ECB weekly financial statement; rounded). Near-flat until 2008, then two
// vertical legs: the QE response to the financial crisis and the 2020 pandemic
// printing that roughly doubled both in under two years. This is the money
// behind the M2 and asset-price cards.
export const CB_BALANCE_COMPARE = compareSeries(
  [
    { name: '🇺🇸 Fed', pts: [[2000, 0.6], [2007, 0.9], [2008, 2.2], [2011, 2.9], [2014, 4.5], [2019, 4.2], [2021, 8.8], [2022, 8.5], [2024, 7.0]] },
    { name: '🇪🇺 EZB', pts: [[2000, 0.8], [2007, 1.5], [2008, 2.0], [2012, 3.0], [2014, 2.2], [2018, 4.7], [2021, 8.6], [2022, 8.0], [2024, 6.4]] },
  ],
  (v) => `${localeNum(v, 0)} ${tr('Bio.')}`,
  /** Latest Fed balance sheet, for the headline. */
  { fedLatest: 7.0 },
);

// Wealth divergence indexed to 2010 = 1×: total billionaire net worth (Forbes
// annual, ~$3.6T in 2010 → ~$14T) against Germany's real wage index. The
// asset-owning tier compounds ~4× as money printing lifts stocks and property,
// while wages after inflation gain barely a tenth — the Cantillon effect made
// visible. Different populations, shared shape: who the new money reaches.
export const WEALTH_DIVERGE_COMPARE = compareSeries(
  [
    { name: '💰 Milliardäre', pts: [[2010, 1.0], [2015, 1.96], [2018, 2.53], [2020, 2.22], [2021, 3.64], [2022, 3.53], [2024, 3.94]] },
    { name: '👷 Reallohn 🇩🇪', pts: [[2010, 1.0], [2015, 1.05], [2018, 1.09], [2020, 1.09], [2022, 1.05], [2024, 1.09]] },
  ],
  (v) => `${localeNum(v, 1)}×`,
  /** Latest billionaire multiple, for the headline. */
  { richLatest: 3.9 },
);

// Food vs. fertilizer price indices (FAO Food Price Index, 2014–16 = 100;
// World Bank fertilizer index, rebased onto the same window). The two move
// together, and fertilizer swings harder: natural gas is the feedstock for
// nitrogen fertilizer, so an energy shock (2008, and the 2022 gas crisis)
// spikes fertilizer first and feeds straight through to food. Any new energy
// squeeze on the Gulf gas trade would transmit the same way.
export const FOOD_FERT_COMPARE = compareSeries(
  [
    { name: '🌾 Nahrung', pts: [[2000, 53], [2005, 63], [2008, 118], [2011, 132], [2015, 93], [2020, 98], [2022, 144], [2023, 124], [2024, 122]] },
    { name: '🧪 Dünger', pts: [[2000, 40], [2005, 60], [2008, 200], [2011, 145], [2015, 90], [2020, 75], [2022, 230], [2023, 120], [2024, 112]] },
  ],
  (v) => `${Math.round(v)}`,
  /** Latest food index, for the headline. */
  { foodLatest: 122 },
);

// German statutory pension level ("Sicherungsniveau vor Steuern": standard
// pension as a share of the average wage), with the official projection out to
// 2040 (Rentenversicherungsbericht). A slow slide from ~55% to a legislated
// 48% floor that holds only through 2039 — after which projections drop toward
// ~45%. Each retiree's pension buys a smaller slice of an average wage.
export const DE_PENSION_LEVEL_PANEL: TrendSeries = trend(
  [
    [1990, 55.0], [2000, 52.9], [2005, 52.6], [2010, 51.6], [2015, 47.7],
    [2020, 49.4], [2024, 48.2], [2030, 48.0], [2035, 46.5], [2040, 45.0],
  ],
  (v) => `${localePct(v, 0)}`,
  ['1990', '2007', '2024', '2040'],
);

// Rent burden on new lettings in Germany's seven largest cities: median asking
// rent as a share of median household net income (empirica / IW estimates for
// Berlin, Hamburg, München, Köln, Frankfurt, Stuttgart, Düsseldorf; rounded).
// Roughly a fifth of income in 2010, now a third-plus — asking rents ran far
// ahead of pay through the cheap-money years.
export const DE_RENT_BURDEN_PANEL: TrendSeries = trend(
  [
    [2010, 22], [2013, 25], [2015, 27], [2018, 30], [2020, 32],
    [2022, 33], [2024, 35],
  ],
  (v) => `${localePct(v, 0)}`,
  ['2010', '2015', '2020', 'heute'],
);

// Countries exploring a central bank digital currency (Atlantic Council CBDC
// Tracker). 35 when the tracker started counting in May 2020, 146 today —
// covering 98% of global GDP. Three have fully launched (Bahamas, Jamaica,
// Nigeria); the digital euro entered its preparation phase in 2023.
export const CBDC_PANEL: TrendSeries = trend(
  [
    [2020, 35], [2021, 87], [2022, 114], [2023, 130], [2024, 134],
    [2025, 137], [2026, 146],
  ],
  (v) => `${Math.round(v)}`,
  ['2020', '2022', '2024', 'heute'],
);

// Freedom House "Freedom in the World": countries whose aggregate score
// declined vs improved, per report year. Declines have outnumbered gains
// every single year for two decades now — 20 consecutive years of global
// freedom decline as of the 2026 report.
export const FREEDOM_COMPARE = compareSeries(
  [
    { name: 'verschlechtert', pts: [[2013, 54], [2014, 61], [2015, 72], [2016, 67], [2017, 71], [2018, 68], [2019, 64], [2020, 73], [2021, 60], [2022, 35], [2023, 52], [2024, 60], [2025, 54]] },
    { name: 'verbessert', pts: [[2013, 40], [2014, 33], [2015, 43], [2016, 36], [2017, 35], [2018, 50], [2019, 37], [2020, 28], [2021, 25], [2022, 34], [2023, 21], [2024, 34], [2025, 35]] },
  ],
  (v) => `${Math.round(v)}`,
  /** Latest count of declining countries, for the headline. */
  { declinedLatest: 54 },
);

// Criminal investigations under §188 StGB ("Politikerbeleidigung") after the
// 2021 expansion made insulting politicians a separate ex-officio offence:
// ~1,400 proceedings in 2022, 4,792 by 2025 — a 216% rise in two years
// (Bundestag / state justice ministry figures; 2023 interpolated).
export const DE_SPEECH_PANEL: TrendSeries = trend(
  [[2022, 1_400], [2024, 4_424], [2025, 4_792]],
  (v) => `${localeNum(v / 1000, 1)}k`,
  ['2022', '2023', '2024', 'heute'],
);

// UK arrests for online messages under s.127 Communications Act 2003 and s.1
// Malicious Communications Act 1988 (police FOI data via The Times, 2025):
// 5,502 arrests in 2017, 12,183 in 2023 — about 33 per day, +121%. Fewer than
// 10% of those arrested in 2023 were convicted.
export const UK_SPEECH_ARRESTS_PANEL: TrendSeries = trend(
  [[2017, 5_502], [2020, 7_700], [2023, 12_183]],
  (v) => `${localeNum(v / 1000, 0)}k`,
  ['2017', '2019', '2021', '2023'],
);

// Homeownership among young households: England 25–34-year-olds (English
// Housing Survey / IFS) and US under-35 householders (Census HVS), % owning.
// England collapses from two-thirds in 1991 to ~a third by 2014; the US never
// recovers its 2004 peak. Rounded survey figures.
export const YOUNG_HOME_COMPARE = compareSeries(
  [
    { name: 'England 25–34', pts: [[1991, 67], [2004, 59], [2014, 36], [2024, 45]] },
    { name: 'USA unter 35', pts: [[1991, 38], [2004, 43], [2016, 35], [2024, 36]] },
  ],
  (v) => `${localePct(v, 0)}`,
  /** Latest England share, for the headline. */
  { engLatest: 45 },
);

// Active low- and zero-emission zones in Europe (Clean Cities Campaign /
// urbanaccessregulations.eu). Sweden pioneered the first in 1996; Germany's
// Umweltzonen wave followed 2008ff; national laws in France, Spain and Poland
// push the count past 500. Early years approximate.
export const LEZ_PANEL: TrendSeries = trend(
  [[1996, 1], [2007, 15], [2012, 100], [2019, 228], [2022, 320], [2025, 507]],
  (v) => `${Math.round(v)}`,
  ['1996', '2006', '2015', 'heute'],
);

// Cumulative FDA-approved gene and gene-modified cell therapies (CAR-T, AAV,
// lentiviral, CRISPR). Three approvals in all of 2017; the curve steepens
// sharply after 2020 — Casgevy in 2023 was the first approved CRISPR edit of
// human DNA. Counts from FDA CBER approval lists.
export const GENE_THERAPY_PANEL: TrendSeries = trend(
  [
    [2017, 3], [2018, 3], [2019, 4], [2020, 5], [2021, 9], [2022, 15],
    [2023, 22], [2024, 31], [2025, 34],
  ],
  (v) => `${Math.round(v)}`,
  ['2017', '2020', '2023', 'heute'],
);

// Share of world population living in autocracies (V-Dem Democracy Reports,
// electoral + closed autocracies). 48% in 2013, 72% a decade later — the
// "third wave of autocratization"; the big step includes V-Dem downgrading
// India to an electoral autocracy in its 2021 report.
export const AUTOCRACY_SHARE_PANEL: TrendSeries = trend(
  [[2013, 48], [2020, 68], [2021, 70], [2022, 72], [2023, 71], [2024, 72]],
  (v) => `${localePct(v, 0)}`,
  ['2013', '2017', '2021', 'heute'],
);

// Smartphone users worldwide (Statista / DataReportal, rounded estimates).
// From a niche gadget in 2007 to 4.7 billion people carrying a networked
// tracking device — with global average use around 4h40m per day.
export const SMARTPHONE_PANEL: TrendSeries = trend(
  [
    [2007, 0.12e9], [2010, 0.3e9], [2012, 1.06e9], [2016, 2.5e9],
    [2020, 3.6e9], [2025, 4.7e9],
  ],
  (v) => `${localeNum(v / 1e9, 1)} ${tr('Mrd')}`,
  ['2007', '2013', '2019', 'heute'],
);
