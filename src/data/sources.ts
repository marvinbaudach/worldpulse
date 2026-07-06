// Fetchers for the free, keyless, CORS-enabled public APIs that feed the
// panels: Open-Meteo (weather), Wikimedia
// (pageviews), World Bank (military spend, population), the US Treasury
// (debt). Each fetcher derives the
// draw-ready shape, caches it (see cache.ts) and writes it into the store;
// failures are logged and swallowed so one dead API never takes down the ring.

import { cached, fetchJson } from './cache';
import { emitLiveUpdate, live, type TrendSeries } from './store';
import { WORLD } from './world';

const MIN = 60_000;

/** Normalize a series into 0..1 against a (lo, hi) range. */
function norm(series: number[], lo: number, hi: number): number[] {
  const span = Math.max(1e-9, hi - lo);
  return series.map((v) => (v - lo) / span);
}

/**
 * Nice axis: bounds snapped to a round step (1/2/2.5/5 x 10^k) and a label
 * for every gridline, so the y-axis reads 0/2/4/6... instead of 0.1/4.9/9.8.
 */
function niceScale(
  min: number,
  max: number,
  fmt: (v: number) => string,
): { lo: number; hi: number; ticks: string[] } {
  const span = Math.max(1e-9, max - min);
  const mag = Math.pow(10, Math.floor(Math.log10(span / 4)));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= 4.5) ?? 10 * mag;
  const lo = min >= 0 ? Math.max(0, Math.floor(min / step) * step) : Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const n = Math.round((hi - lo) / step);
  return {
    lo,
    hi,
    ticks: Array.from({ length: n + 1 }, (_, i) => fmt(lo + i * step)),
  };
}

/** Evenly resample a series down to n points (keeps first and last). */
function resample(series: number[], n: number): number[] {
  if (series.length <= n) return series;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(series[Math.round((i * (series.length - 1)) / (n - 1))]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Open-Meteo forecast — Zurich: 7-day forecast for the symbol panel plus the
// current temperature.

interface MeteoLocation {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
  current: { temperature_2m: number };
}

const DAY_NAME = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

async function loadWeather(): Promise<void> {
  const zurich = await cached('weather-ch3', 15 * MIN, () =>
    fetchJson<MeteoLocation>(
      'https://api.open-meteo.com/v1/forecast' +
        '?latitude=47.37&longitude=8.54' +
        '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
        '&current=temperature_2m' +
        '&timezone=Europe%2FZurich&forecast_days=7',
    ),
  );

  live.weather = {
    currentTemp: zurich.current.temperature_2m,
    forecast: zurich.daily.time.map((day, i) => ({
      day: i === 0 ? 'Heute' : DAY_NAME[new Date(`${day}T12:00:00`).getDay()],
      code: zurich.daily.weather_code[i],
      min: zurich.daily.temperature_2m_min[i],
      max: zurich.daily.temperature_2m_max[i],
    })),
  };
}


// ---------------------------------------------------------------------------
// Wikimedia — yesterday's most-viewed English Wikipedia articles.

interface WikiTop {
  items: { articles: { article: string; views: number }[] }[];
}

const WIKI_SKIP = /^(Main_Page|Special:|Wikipedia:|Portal:|File:|Help:|Talk:)/;

const WIKI_API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews';

/** UTC yyyy/mm/dd path segment, `daysAgo` days back. */
function wikiDatePath(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return (
    `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/` +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

/** Human article title, ellipsized to fit a panel row. */
function wikiTitle(article: string): string {
  const name = article.replaceAll('_', ' ');
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}

async function loadWiki(): Promise<void> {
  const rows = await cached('wiki', 3 * 60 * MIN, async () => {
    const data = await fetchJson<WikiTop>(
      `${WIKI_API}/top/en.wikipedia/all-access/${wikiDatePath(1)}`,
    );
    return data.items[0].articles
      .filter((a) => !WIKI_SKIP.test(a.article))
      .slice(0, 5)
      .map((a) => ({ name: wikiTitle(a.article), v: a.views }));
  });

  live.wiki = { rows, topViews: rows[0]?.v ?? 0 };
}

// ---------------------------------------------------------------------------
// Wikimedia — most-read Wikipedia articles from Switzerland, all languages.
// The per-country dataset lags a couple of days, so we try day-2 then day-3.

interface WikiCountry {
  items: { articles: { article: string; views_ceil: number }[] }[];
}

/** Main pages and search pages have no colon, so list them explicitly. */
const WIKI_MAIN = new Set(['Main_Page', 'Pagina_principale', 'Portada', 'Hoofdpagina']);

async function loadSwissTrends(): Promise<void> {
  const rows = await cached('swiss', 3 * 60 * MIN, async () => {
    let data: WikiCountry | null = null;
    for (const daysAgo of [2, 3]) {
      try {
        data = await fetchJson<WikiCountry>(
          `${WIKI_API}/top-per-country/CH/all-access/${wikiDatePath(daysAgo)}`,
        );
        break;
      } catch {
        // Not published yet — try one day earlier.
      }
    }
    if (!data) throw new Error('top-per-country/CH not available');
    return data.items[0].articles
      .filter((a) => !a.article.includes(':') && !WIKI_MAIN.has(a.article))
      .slice(0, 5)
      .map((a) => ({ name: wikiTitle(a.article), v: a.views_ceil }));
  });

  live.swiss = { rows, topViews: rows[0]?.v ?? 0 };
}

// ---------------------------------------------------------------------------
// World Bank — military expenditure (current USD) for the usual big spenders;
// the latest available year per country wins, then the top 10 are kept.

type WorldBankRow = {
  country: { value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
};

const MIL_CANDIDATES = 'USA;CHN;RUS;IND;SAU;GBR;DEU;UKR;FRA;JPN;KOR;ISR;POL;ITA;AUS';

async function loadMilitary(): Promise<void> {
  const data = await cached('military', 24 * 60 * MIN, async () => {
    const res = await fetchJson<[unknown, WorldBankRow[]]>(
      `https://api.worldbank.org/v2/country/${MIL_CANDIDATES}` +
        '/indicator/MS.MIL.XPND.CD?format=json&date=2022:2025&per_page=200',
    );
    const latest = new Map<string, { name: string; v: number; year: string }>();
    for (const row of res[1] ?? []) {
      if (row.value === null) continue;
      const prev = latest.get(row.countryiso3code);
      if (!prev || row.date > prev.year) {
        latest.set(row.countryiso3code, { name: row.country.value, v: row.value, year: row.date });
      }
    }
    const top = [...latest.values()].toSorted((a, b) => b.v - a.v).slice(0, 10);
    return { top, year: top[0]?.year ?? '' };
  });

  live.military = {
    rows: data.top.map(({ name, v }) => ({ name, v })),
    total: data.top.reduce((sum, r) => sum + r.v, 0),
    year: data.year,
  };
}

// ---------------------------------------------------------------------------
// US Treasury "Debt to the Penny" — official daily total public debt. The
// panel extrapolates between records with the average recent growth rate;
// the trend below the clock spans 125 years so today's steepness registers.

interface DebtFeed {
  data: { record_date: string; tot_pub_debt_out_amt: string }[];
}

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

function debtTrend(latest: number): { series: number[]; ticks: string[] } {
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

async function loadDebt(): Promise<void> {
  const rows = await cached('debt', 60 * MIN, async () => {
    const feed = await fetchJson<DebtFeed>(
      'https://api.fiscaldata.treasury.gov/services/api/fiscal_service' +
        '/v2/accounting/od/debt_to_penny' +
        // Brackets must be pre-encoded: the API edge rejects raw "[]" and
        // error responses carry no CORS headers.
        '?sort=-record_date&page%5Bsize%5D=400&fields=record_date,tot_pub_debt_out_amt',
    );
    return feed.data
      .map((d) => ({ t: Date.parse(`${d.record_date}T12:00:00Z`), v: Number(d.tot_pub_debt_out_amt) }))
      .toReversed(); // chronological
  });

  const latest = rows[rows.length - 1];
  // Average growth over the last ~30 records (business days ≈ 6 weeks).
  const back = rows[Math.max(0, rows.length - 31)];
  const ratePerMs = (latest.v - back.v) / Math.max(1, latest.t - back.t);

  const yearAgo = rows[0];
  const trend125 = debtTrend(latest.v);
  live.debt = {
    latest: latest.v,
    latestMs: latest.t,
    ratePerMs,
    series: trend125.series,
    ticks: trend125.ticks,
    yoyPct: ((latest.v - yearAgo.v) / yearAgo.v) * 100,
  };
}

// ---------------------------------------------------------------------------
// World Bank — population. One request covers Switzerland and the world; the
// Swiss series is extended back to 1920 with federal census figures so the
// panel really spans a century.

/**
 * Swiss population within today's borders: historical estimates up to 1800,
 * then federal census figures (BFS) until the World Bank series takes over.
 */
const CH_CENSUS: [number, number][] = [
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
const WORLD_HISTORY: [number, number][] = [
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

/** Interpolate a sparse year->value map into an even yearly series. */
function yearly(points: [number, number][]): number[] {
  const sorted = points.toSorted((a, b) => a[0] - b[0]);
  const out: number[] = [];
  for (let y = sorted[0][0]; y <= sorted[sorted.length - 1][0]; y++) {
    const nextI = sorted.findIndex(([py]) => py >= y);
    const [y1, v1] = sorted[Math.max(0, nextI - 1)];
    const [y2, v2] = sorted[nextI];
    out.push(y1 === y2 ? v1 : v1 + ((v2 - v1) * (y - y1)) / (y2 - y1));
  }
  return out;
}

function trend(
  points: [number, number][],
  fmt: (v: number) => string,
  xLabels: string[],
  // Long spans with sharp single-year spikes (world wars) need a finer
  // sampling or the peaks get skipped between samples.
  samples = 28,
): TrendSeries {
  const series = yearly(points);
  const s = niceScale(Math.min(...series), Math.max(...series), fmt);
  return {
    series: norm(resample(series, samples), s.lo, s.hi),
    ticks: s.ticks,
    latest: series[series.length - 1],
    yoyPct: ((series[series.length - 1] - series[series.length - 2]) / series[series.length - 2]) * 100,
    xLabels,
  };
}

async function loadPopulation(): Promise<void> {
  const points = await cached('population', 24 * 60 * MIN, async () => {
    const res = await fetchJson<[unknown, WorldBankRow[]]>(
      'https://api.worldbank.org/v2/country/CHE;WLD/indicator/SP.POP.TOTL' +
        '?format=json&date=1960:2026&per_page=200',
    );
    const pick = (code: string): [number, number][] =>
      (res[1] ?? [])
        .filter((r) => r.countryiso3code === code && r.value !== null)
        .map((r) => [Number(r.date), r.value as number]);
    return { che: pick('CHE'), wld: pick('WLD') };
  });

  live.swissPop = trend(
    [...CH_CENSUS, ...points.che],
    (v) => `${(v / 1e6).toFixed(0)}M`,
    ['1500', '1675', '1850', 'heute'],
  );
  live.worldPop = trend(
    [...WORLD_HISTORY, ...points.wld],
    (v) => `${(v / 1e9).toFixed(0)}B`,
    ['Jahr 0', '675', '1350', 'heute'],
  );
}

// ---------------------------------------------------------------------------
// World Bank — intentional homicides per 100k: a world choropleth (latest
// year per country) plus the Switzerland / Germany / US series since 1990.

async function loadHomicide(): Promise<void> {
  const data = await cached('homicide2', 24 * 60 * MIN, async () => {
    const [world, trio, pop] = await Promise.all([
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/all/indicator/VC.IHR.PSRC.P5' +
          '?format=json&date=2016:2024&per_page=3000',
      ),
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/CHE;DEU;USA;RUS;BRA;JPN/indicator/VC.IHR.PSRC.P5' +
          '?format=json&date=1990:2024&per_page=400',
      ),
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL' +
          '?format=json&date=2023&per_page=400',
      ),
    ]);
    // Micro-states dominate a raw per-capita ranking (three murders on an
    // island of 40k tops the chart), so the top-5 list requires 1M+ people.
    const populous = new Set(
      (pop[1] ?? [])
        .filter((r) => (r.value ?? 0) >= 1_000_000)
        .map((r) => r.countryiso3code),
    );

    const latest = new Map<string, { name: string; v: number; year: string }>();
    for (const row of world[1] ?? []) {
      if (row.value === null || row.countryiso3code.length !== 3) continue;
      const prev = latest.get(row.countryiso3code);
      if (!prev || row.date > prev.year) {
        latest.set(row.countryiso3code, { name: row.country.value, v: row.value, year: row.date });
      }
    }
    const series = (iso3: string) =>
      (trio[1] ?? [])
        .filter((r) => r.countryiso3code === iso3 && r.value !== null)
        .toSorted((a, b) => Number(a.date) - Number(b.date))
        .map((r) => r.value as number);
    return {
      byIso: Object.fromEntries([...latest.entries()].map(([iso3, e]) => [iso3, e.v])),
      world: latest.get('WLD')?.v ?? 5.6,
      top: [...latest.entries()]
        .filter(([iso3]) => iso3 !== 'WLD' && populous.has(iso3))
        .map(([, e]) => ({ name: e.name, v: e.v }))
        .toSorted((a, b) => b.v - a.v)
        .slice(0, 5),
      che: series('CHE'),
      deu: series('DEU'),
      usa: series('USA'),
      rus: series('RUS'),
      bra: series('BRA'),
      jpn: series('JPN'),
    };
  });

  const all = [
    ...data.che,
    ...data.deu,
    ...data.usa,
    ...data.rus,
    ...data.bra,
    ...data.jpn,
  ];
  const s = niceScale(Math.min(...all), Math.max(...all), (v) => v.toFixed(0));
  live.homicide = {
    byIso: data.byIso,
    rows: data.top,
    world: data.world,
    che: norm(data.che, s.lo, s.hi),
    deu: norm(data.deu, s.lo, s.hi),
    usa: norm(data.usa, s.lo, s.hi),
    rus: norm(data.rus, s.lo, s.hi),
    bra: norm(data.bra, s.lo, s.hi),
    jpn: norm(data.jpn, s.lo, s.hi),
    cheLatest: data.che[data.che.length - 1] ?? 0.5,
    ticks: s.ticks,
  };
}

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

/** Linear-interpolate sorted [x, y] points at x (clamped at the ends). */
function interpAt(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x2, y2] = points[i];
    if (x2 >= x) {
      const [x1, y1] = points[i - 1];
      return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
    }
  }
  return last[1];
}

const CLIMATE_SPAN_KYR = 800;

function climatePanel(): NonNullable<typeof live.climate> {
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
// Real-data fallbacks for the population panels: built from the bundled
// anchors, so even with every API unreachable the curves keep their true
// shape instead of demo noise.

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
// Bundled real-data panels without a live API: deaths in armed conflicts
// (UCDP via Our World in Data), forcibly displaced people (UNHCR Global
// Trends), US federal net interest (OMB/CBO) and US overdose deaths (CDC).
// These figures are revised yearly at best, so they ship as anchors just
// like the census series above.

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

// Global life expectancy at birth, years (UN WPP / OWID).
export const LIFE_PANEL: TrendSeries = trend(
  [
    [1900, 32], [1918, 30], [1930, 40], [1950, 46], [1960, 51],
    [1970, 58], [1980, 61], [1990, 64], [2000, 66], [2010, 70],
    [2019, 72.8], [2021, 71], [2024, 73.3],
  ],
  (v) => `${Math.round(v)}y`,
  ['1900', '1941', '1983', 'heute'],
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
const M2_COMPARE_ANCHORS: { name: string; pts: [number, number][] }[] = [
  { name: 'USA', pts: [[1995, 0.73], [2000, 1.0], [2005, 1.37], [2010, 1.8], [2015, 2.51], [2020, 3.9], [2022, 4.43], [2024, 4.37]] },
  { name: 'Eurozone', pts: [[1995, 0.75], [2000, 1.0], [2005, 1.35], [2010, 1.8], [2015, 2.05], [2020, 2.65], [2024, 2.85]] },
  { name: 'Schweiz', pts: [[1995, 0.85], [2000, 1.0], [2005, 1.2], [2010, 1.75], [2015, 2.3], [2020, 2.55], [2024, 2.5]] },
];

/** All three money stocks normalized onto one shared scale. */
export const M2_COMPARE = (() => {
  const yearlySets = M2_COMPARE_ANCHORS.map((c) => yearly(c.pts));
  const all = yearlySets.flat();
  const s = niceScale(Math.min(...all), Math.max(...all), (v) => `${v.toFixed(1)}×`);
  return {
    rows: M2_COMPARE_ANCHORS.map((c, i) => ({
      name: c.name,
      data: norm(resample(yearlySets[i], 48), s.lo, s.hi),
    })),
    ticks: s.ticks,
    /** Latest US multiple, for the headline. */
    usLatest: 4.4,
  };
})();

// Real GDP indexed to 2015 = 1x (IMF WEO / national accounts). The recent
// base year keeps the scale tight enough that Germany's post-2019
// stagnation reads as the flatline it is.
const GDP_COMPARE_ANCHORS: { name: string; pts: [number, number][] }[] = [
  { name: 'Indien', pts: [[2010, 0.71], [2015, 1.0], [2019, 1.3], [2020, 1.22], [2022, 1.45], [2024, 1.65]] },
  { name: 'China', pts: [[2010, 0.73], [2015, 1.0], [2019, 1.28], [2020, 1.31], [2022, 1.42], [2024, 1.55]] },
  { name: 'USA', pts: [[2010, 0.9], [2015, 1.0], [2019, 1.1], [2020, 1.07], [2022, 1.18], [2024, 1.25]] },
  { name: 'Deutschland', pts: [[2010, 0.94], [2015, 1.0], [2017, 1.05], [2019, 1.08], [2020, 1.03], [2022, 1.09], [2023, 1.09], [2024, 1.08]] },
  { name: 'Japan', pts: [[2010, 0.95], [2015, 1.0], [2019, 1.03], [2020, 0.99], [2022, 1.02], [2024, 1.02]] },
];

/** All five economies normalized onto one shared scale. */
export const GDP_COMPARE = (() => {
  const yearlySets = GDP_COMPARE_ANCHORS.map((c) => yearly(c.pts));
  const all = yearlySets.flat();
  const s = niceScale(Math.min(...all), Math.max(...all), (v) => `${v.toFixed(1)}×`);
  return {
    rows: GDP_COMPARE_ANCHORS.map((c, i) => ({
      name: c.name,
      data: norm(resample(yearlySets[i], 48), s.lo, s.hi),
    })),
    ticks: s.ticks,
    /** Germany's latest multiple, for the headline. */
    deuLatest: 1.08,
  };
})();

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

// Industrial production indexed to 2015 = 100 (Destatis, Fed G.17, NBS;
// rounded). Germany peaked in 2018 and has lost roughly a fifth since,
// the US is flat, China keeps compounding.
// Pre-1990 Germany is West Germany; pre-2000 China is a rough magnitude
// estimate — reliable indexed series only start with the reform era.
const INDUSTRY_COMPARE_ANCHORS: { name: string; pts: [number, number][] }[] = [
  { name: 'China', pts: [[1950, 0.3], [1970, 1.5], [1980, 3], [1990, 8], [2000, 24], [2005, 41], [2008, 60], [2010, 72], [2015, 100], [2020, 130], [2022, 143], [2024, 158], [2025, 166]] },
  { name: 'USA', pts: [[1950, 15], [1960, 22], [1970, 35], [1980, 48], [1990, 62], [2000, 91], [2005, 95], [2008, 100], [2009, 89], [2015, 100], [2018, 103], [2020, 96], [2022, 103], [2024, 102], [2025, 103]] },
  { name: 'Deutschland', pts: [[1950, 12], [1960, 32], [1970, 55], [1980, 66], [1990, 78], [2000, 84], [2005, 91], [2008, 104], [2009, 86], [2011, 102], [2015, 100], [2018, 105], [2020, 91], [2022, 93], [2023, 91], [2024, 87], [2025, 85]] },
];

/** All three industrial bases normalized onto one shared scale. */
export const INDUSTRY_COMPARE = (() => {
  const yearlySets = INDUSTRY_COMPARE_ANCHORS.map((c) => yearly(c.pts));
  const all = yearlySets.flat();
  const s = niceScale(Math.min(...all), Math.max(...all), (v) => `${v.toFixed(0)}`);
  return {
    rows: INDUSTRY_COMPARE_ANCHORS.map((c, i) => ({
      name: c.name,
      data: norm(resample(yearlySets[i], 48), s.lo, s.hi),
    })),
    ticks: s.ticks,
    /** Germany's latest index level, for the headline. */
    deuLatest: 85,
  };
})();

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
const AI_JOBS_ANCHORS: { name: string; pts: [number, number][] }[] = [
  { name: 'Absolventen', pts: [[2015, 5.0], [2018, 3.9], [2019, 3.9], [2020, 9.0], [2021, 5.6], [2022, 4.0], [2023, 4.4], [2024, 5.0], [2025, 5.8]] },
  { name: 'Gesamt', pts: [[2015, 5.3], [2018, 3.9], [2019, 3.7], [2020, 8.1], [2021, 5.4], [2022, 3.6], [2023, 3.6], [2024, 4.0], [2025, 4.2]] },
];

/** Both unemployment series normalized onto one shared scale. */
export const AI_JOBS_COMPARE = (() => {
  const yearlySets = AI_JOBS_ANCHORS.map((c) => yearly(c.pts));
  const all = yearlySets.flat();
  const s = niceScale(Math.min(...all), Math.max(...all), (v) => `${v.toFixed(0)}%`);
  return {
    rows: AI_JOBS_ANCHORS.map((c, i) => ({
      name: c.name,
      data: norm(resample(yearlySets[i], 48), s.lo, s.hi),
    })),
    ticks: s.ticks,
    /** Latest recent-graduate rate, for the headline. */
    gradLatest: 5.8,
  };
})();

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
const CONTINENT_FERTILITY_ANCHORS: { name: string; pts: [number, number][] }[] = [
  { name: 'Afrika', pts: [[1900, 6.6], [1930, 6.6], [1950, 6.6], [1970, 6.7], [1990, 5.9], [2000, 5.1], [2010, 4.7], [2024, 4.1]] },
  { name: 'Asien', pts: [[1900, 5.5], [1930, 5.6], [1950, 5.8], [1970, 5.6], [1990, 3.3], [2000, 2.6], [2010, 2.2], [2024, 1.9]] },
  { name: 'Lateinamerika', pts: [[1900, 6.0], [1930, 5.9], [1950, 5.8], [1970, 5.3], [1990, 3.3], [2000, 2.6], [2010, 2.2], [2024, 1.8]] },
  { name: 'Nordamerika', pts: [[1900, 3.8], [1920, 3.2], [1935, 2.2], [1950, 3.3], [1958, 3.7], [1970, 2.3], [1990, 2.0], [2010, 1.9], [2024, 1.6]] },
  { name: 'Europa', pts: [[1900, 4.5], [1915, 3.4], [1930, 2.5], [1950, 2.7], [1970, 2.2], [1990, 1.7], [2000, 1.4], [2010, 1.6], [2024, 1.4]] },
];

/** All six continents normalized onto one shared scale. */
export const CONTINENT_FERTILITY = (() => {
  const yearlySets = CONTINENT_FERTILITY_ANCHORS.map((c) => yearly(c.pts));
  const all = yearlySets.flat();
  const s = niceScale(Math.min(...all), Math.max(...all), (v) => v.toFixed(1));
  return {
    rows: CONTINENT_FERTILITY_ANCHORS.map((c, i) => ({
      name: c.name,
      data: norm(resample(yearlySets[i], 48), s.lo, s.hi),
    })),
    ticks: s.ticks,
    /** Global births per woman, for the headline. */
    world: 2.2,
  };
})();

// Purchasing power of one 1913 US dollar (BLS CPI).
export const DOLLAR_PANEL: TrendSeries = trend(
  [
    [1913, 1.0], [1920, 0.49], [1933, 0.76], [1945, 0.55], [1960, 0.33],
    [1975, 0.18], [1985, 0.092], [2000, 0.057], [2010, 0.045], [2024, 0.032],
  ],
  (v) => `${(v * 100).toFixed(0)}¢`,
  ['1913', '1950', '1987', 'heute'],
);

// ---------------------------------------------------------------------------

export interface LiveFeed {
  /** Uplink station code on the loading screen's route strip. */
  code: string;
  /** Data provider, as displayed on the loading screen. */
  source: string;
  /** Where the provider's API lives, as displayed on the loading screen. */
  city: string;
  /** What the feed delivers, as displayed on the loading screen. */
  item: string;
  load: () => Promise<void>;
}

/**
 * The single source of truth for every live fetch AND for the loading
 * screen's feed list — add or remove a fetcher here and the boot sequence
 * stays in sync with what the panels actually load.
 */
export const LIVE_FEEDS: LiveFeed[] = [
  { code: 'ZRH', source: 'OPEN-METEO', city: 'ZÜRICH', item: '7-Tage-Prognose', load: loadWeather },
  { code: 'SFO', source: 'WIKIMEDIA', city: 'SAN FRANCISCO', item: 'Top-Artikel', load: loadWiki },
  { code: 'SFO', source: 'WIKIMEDIA', city: 'SAN FRANCISCO', item: 'Schweizer Trends', load: loadSwissTrends },
  { code: 'WAS', source: 'US TREASURY', city: 'WASHINGTON', item: 'Staatsschulden', load: loadDebt },
  { code: 'WAS', source: 'WORLD BANK', city: 'WASHINGTON', item: 'Militärausgaben', load: loadMilitary },
  { code: 'WAS', source: 'WORLD BANK', city: 'WASHINGTON', item: 'Bevölkerung', load: loadPopulation },
  { code: 'WAS', source: 'WORLD BANK', city: 'WASHINGTON', item: 'Mordrate', load: loadHomicide },
];

let started = false;

/** Kick off all sources; each panel fills in as its dataset arrives. */
export function loadLiveData(): void {
  if (started) return; // StrictMode double-mount guard
  started = true;
  // The country outlines ship in the bundle — no fetch, no failure mode.
  live.worldMap = WORLD;
  // Heartbeat for the "live" panels (debt clock): re-render once a second.
  setInterval(() => emitLiveUpdate('tick'), 1000);
  LIVE_FEEDS.forEach((feed) => {
    feed
      .load()
      .then(() => emitLiveUpdate('data'))
      .catch((err) =>
        console.warn(
          `[live-data] ${feed.source} ${feed.item} failed, panel keeps demo data`,
          err,
        ),
      );
  });
}
