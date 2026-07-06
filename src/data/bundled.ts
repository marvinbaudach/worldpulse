// Bundled real-data panels: figures from sources that are revised yearly at
// best and have no keyless live API, so they ship as sparse historical anchors
// and get interpolated into the same draw-ready shapes the live fetchers
// produce. These also back the fallbacks for the panels that do fetch, so the
// ring keeps its true curves even with every API unreachable.

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
  const s = niceScale(0, latest, (v) => `$${(v / 1e12).toFixed(0)}T`);
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
  (v) => `${(v / 1e6).toFixed(0)}M`,
  ['1500', '1675', '1850', 'heute'],
);

export const WORLD_POP_FALLBACK: TrendSeries = trend(
  [...WORLD_HISTORY, [2025, 8.215e9]],
  (v) => `${(v / 1e9).toFixed(0)}B`,
  ['Jahr 0', '675', '1350', 'heute'],
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
  const ts = niceScale(Math.min(...tempraw) - 0.5, Math.max(...tempraw) + 0.5, (v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}°`);
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
  (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${Math.round(v / 1000)}k`),
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
  (v) => `${Math.round(v / 1e6)}M`,
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
  (v) => (v >= 1e12 ? `$${(v / 1e12).toFixed(1)}T` : `$${Math.round(v / 1e9)}B`),
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
  (v) => v.toFixed(1),
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
  (v) => `$${(v / 1e12).toFixed(0)}T`,
  ['1900', '1941', '1983', 'heute'],
);

// Broad money (M2) indexed to 2000 = 1x — USA (Fed H.6) vs euro area (ECB)
// vs Switzerland (SNB). Indexing makes the growth comparable across
// currencies; anchors are rounded from the central banks' series.
export const M2_COMPARE = compareSeries(
  [
    { name: 'USA', pts: [[1995, 0.73], [2000, 1.0], [2005, 1.37], [2010, 1.8], [2015, 2.51], [2020, 3.9], [2022, 4.43], [2024, 4.37]] },
    { name: 'Eurozone', pts: [[1995, 0.75], [2000, 1.0], [2005, 1.35], [2010, 1.8], [2015, 2.05], [2020, 2.65], [2024, 2.85]] },
    { name: 'Schweiz', pts: [[1995, 0.85], [2000, 1.0], [2005, 1.2], [2010, 1.75], [2015, 2.3], [2020, 2.55], [2024, 2.5]] },
  ],
  (v) => `${v.toFixed(1)}×`,
  /** Latest US multiple, for the headline. */
  { usLatest: 4.4 },
);

// Real GDP indexed to 2015 = 1x (IMF WEO / national accounts). The recent
// base year keeps the scale tight enough that Germany's post-2019
// stagnation reads as the flatline it is.
export const GDP_COMPARE = compareSeries(
  [
    { name: 'Indien', pts: [[2010, 0.71], [2015, 1.0], [2019, 1.3], [2020, 1.22], [2022, 1.45], [2024, 1.65]] },
    { name: 'China', pts: [[2010, 0.73], [2015, 1.0], [2019, 1.28], [2020, 1.31], [2022, 1.42], [2024, 1.55]] },
    { name: 'USA', pts: [[2010, 0.9], [2015, 1.0], [2019, 1.1], [2020, 1.07], [2022, 1.18], [2024, 1.25]] },
    { name: 'Deutschland', pts: [[2010, 0.94], [2015, 1.0], [2017, 1.05], [2019, 1.08], [2020, 1.03], [2022, 1.09], [2023, 1.09], [2024, 1.08]] },
    { name: 'Japan', pts: [[2010, 0.95], [2015, 1.0], [2019, 1.03], [2020, 0.99], [2022, 1.02], [2024, 1.02]] },
  ],
  (v) => `${v.toFixed(1)}×`,
  /** Germany's latest multiple, for the headline. */
  { deuLatest: 1.08 },
);

// German corporate insolvencies per year (Destatis). Fell steadily from
// the 2003 peak to the 2021 low, then three consecutive surges — the
// steepest rises since the early-2000s crisis.
export const DE_INSOLVENCY_PANEL: TrendSeries = trend(
  [
    [2000, 28_235], [2003, 39_320], [2006, 34_137], [2009, 32_687],
    [2012, 28_297], [2015, 23_101], [2019, 18_749], [2021, 13_993],
    [2022, 14_590], [2023, 17_814], [2024, 21_812], [2025, 24_064],
  ],
  (v) => `${(v / 1000).toFixed(0)}k`,
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
  (v) => `${v.toFixed(0)}`,
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
  (v) => `${v.toFixed(0)}`,
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
  (v) => `${v.toFixed(0)}%`,
  ['1950', '1975', '2000', 'heute'],
);

// Share of non-German suspects in the police crime statistics (BKA PKS),
// excluding immigration-law offenses that only foreigners can commit.
// Rounded from published PKS yearbooks; 2024 is a record 35.4%.
// Suspect counts are not convictions and skew with age/urbanity/reporting.
export const DE_FOREIGN_SUSPECTS_PANEL: TrendSeries = trend(
  [
    [2005, 22.5], [2010, 21.9], [2014, 24.3], [2016, 30.5],
    [2019, 30.4], [2022, 33.4], [2023, 34.4], [2024, 35.4],
  ],
  (v) => `${v.toFixed(0)}%`,
  ['2005', '2011', '2018', 'heute'],
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
  (v) => `${v.toFixed(0)}%`,
  /** Latest recent-graduate rate, for the headline. */
  { gradLatest: 5.8 },
);

// People online worldwide (ITU).
export const INTERNET_PANEL: TrendSeries = trend(
  [
    [1990, 0.003e9], [1995, 0.04e9], [2000, 0.41e9], [2005, 1.02e9],
    [2010, 2.0e9], [2015, 3.2e9], [2020, 4.7e9], [2024, 5.5e9],
  ],
  (v) => `${(v / 1e9).toFixed(1)}B`,
  ['1990', '2001', '2013', 'heute'],
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
    [1950, 2.5], [1960, 3.1], [1970, 4.1],
    [1975, 4.7], [1985, 6.4], [1995, 8.5], [2005, 10.3],
    [2010, 11.7], [2016, 13.1], [2022, 16],
  ],
  (v) => `${v.toFixed(0)}%`,
  ['1950', '1975', '2000', 'heute'],
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
  (v) => v.toFixed(1),
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
  (v) => `${v.toFixed(0)}`,
  /** Latest maths score, for the headline. */
  { deuLatest: 475 },
);

// US high-schoolers reporting persistent feelings of sadness or hopelessness,
// % (CDC Youth Risk Behavior Survey). The gap opens after ~2012 as
// smartphones and social media saturate teen life; girls climb far steeper.
export const TEEN_SADNESS = compareSeries(
  [
    { name: 'Mädchen', pts: [[2011, 36], [2013, 36], [2015, 40], [2017, 41], [2019, 47], [2021, 57], [2023, 53]] },
    { name: 'Jungen', pts: [[2011, 21], [2013, 21], [2015, 21], [2017, 21], [2019, 27], [2021, 29], [2023, 28]] },
  ],
  (v) => `${v.toFixed(0)}%`,
  /** Latest girls' rate, for the headline. */
  { girlsLatest: 53 },
);

// US adult obesity share, % (NHANES). The shaded band marks the fast-food
// era: the 1970s drive-through boom and, from the 1980s, cheap high-fructose
// corn syrup in soft drinks — the decades US obesity roughly tripled.
const US_OBESITY_ANCHORS: [number, number][] = [
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
  const s = niceScale(0, Math.max(...raw), (v) => `${v.toFixed(0)}%`);
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
  (v) => `${(v / 1e9).toFixed(2)} Mrd`,
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
export const CASHLESS_COMPARE = compareSeries(
  [
    { name: 'Eurozone', pts: [[2016, 79], [2019, 72], [2022, 59], [2024, 52]] },
    { name: 'Deutschland', pts: [[2016, 80], [2019, 74], [2021, 58], [2023, 51], [2024, 50]] },
    { name: 'Schweden', pts: [[2016, 20], [2019, 13], [2022, 9], [2024, 8]] },
  ],
  (v) => `${v.toFixed(0)}%`,
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
  (v) => v.toFixed(1),
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
  (v) => `${v.toFixed(0)}%`,
  ['1900', '1940', '1980', 'heute'],
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
  (v) => `${(v * 100).toFixed(0)}¢`,
  ['1913', '1950', '1987', 'heute'],
);
