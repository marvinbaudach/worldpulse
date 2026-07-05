// Fetchers for the free, keyless, CORS-enabled public APIs that feed the
// panels: Open-Meteo (weather), Wikimedia
// (pageviews), World Bank (military spend, population), the US Treasury
// (debt) and the ECB via frankfurter.dev (FX). Each fetcher derives the
// draw-ready shape, caches it (see cache.ts) and writes it into the store;
// failures are logged and swallowed so one dead API never takes down the ring.

import { cached, fetchJson } from './cache';
import { emitLiveUpdate, live, type TrendSeries } from './store';

const MIN = 60_000;

/** Normalize a series into 0..1 against a (lo, hi) range. */
function norm(series: number[], lo: number, hi: number): number[] {
  const span = Math.max(1e-9, hi - lo);
  return series.map((v) => (v - lo) / span);
}

/** Padded min/max of one or more series, for a shared plot scale. */
function range(series: number[][], pad = 0.08): { lo: number; hi: number } {
  const all = series.flat();
  const min = Math.min(...all);
  const max = Math.max(...all);
  const p = Math.max(1e-9, (max - min) * pad);
  return { lo: min - p, hi: max + p };
}

function ticks3(lo: number, hi: number, fmt: (v: number) => string): string[] {
  return [lo, (lo + hi) / 2, hi].map(fmt);
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
// Open-Meteo forecast — Zurich + Geneva in one request: 14 past daily highs
// for the line chart, a 7-day forecast for the symbol panel, current temp.

interface MeteoLocation {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
  current: { temperature_2m: number };
}

const DAY_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function loadWeather(): Promise<void> {
  const locs = await cached('weather-ch2', 15 * MIN, () =>
    fetchJson<MeteoLocation[]>(
      'https://api.open-meteo.com/v1/forecast' +
        '?latitude=47.37,46.20&longitude=8.54,6.14' +
        '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
        '&current=temperature_2m' +
        '&timezone=Europe%2FZurich&past_days=14&forecast_days=7',
    ),
  );
  const [zurich, geneva] = locs;

  // Daily arrays span day -14 .. +6 (21 entries): 1..14 is the 14-day past
  // window ending today, 14..21 the 7-day forecast starting today.
  const b14 = zurich.daily.temperature_2m_max.slice(1, 15);
  const m14 = geneva.daily.temperature_2m_max.slice(1, 15);
  const r = range([b14, m14]);

  const forecast = zurich.daily.time.slice(14).map((day, i) => ({
    day: i === 0 ? 'Today' : DAY_NAME[new Date(`${day}T12:00:00`).getDay()],
    code: zurich.daily.weather_code[14 + i],
    min: zurich.daily.temperature_2m_min[14 + i],
    max: zurich.daily.temperature_2m_max[14 + i],
  }));

  live.weather = {
    lineZurich: norm(b14, r.lo, r.hi),
    lineGeneva: norm(m14, r.lo, r.hi),
    tempTicks: ticks3(r.lo, r.hi, (v) => `${v.toFixed(0)}°`),
    zurichHigh: b14[b14.length - 1],
    highDeltaPct:
      ((b14[13] - b14[12]) / Math.max(1, Math.abs(b14[12]))) * 100,
    currentTemp: zurich.current.temperature_2m,
    forecast,
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

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
// panel extrapolates between records with the average recent growth rate.

interface DebtFeed {
  data: { record_date: string; tot_pub_debt_out_amt: string }[];
}

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

  // One value per month, last 12 months.
  const byMonth = new Map<string, number>();
  rows.forEach((r) => byMonth.set(new Date(r.t).toISOString().slice(0, 7), r.v));
  const monthly = [...byMonth.values()].slice(-12);
  const mr = range([monthly]);

  const yearAgo = rows[0];
  live.debt = {
    latest: latest.v,
    latestMs: latest.t,
    ratePerMs,
    series: norm(monthly, mr.lo, mr.hi),
    ticks: ticks3(mr.lo, mr.hi, (v) => `$${(v / 1e12).toFixed(1)}T`),
    yoyPct: ((latest.v - yearAgo.v) / yearAgo.v) * 100,
  };
}

// ---------------------------------------------------------------------------
// World Bank — population. One request covers Switzerland and the world; the
// Swiss series is extended back to 1920 with federal census figures so the
// panel really spans a century.

const CH_CENSUS: [number, number][] = [
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
): TrendSeries {
  const series = yearly(points);
  const r = range([series]);
  r.lo = Math.max(0, r.lo); // population axes never dip below zero
  return {
    series: norm(resample(series, 28), r.lo, r.hi),
    ticks: ticks3(r.lo, r.hi, fmt),
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
    (v) => `${(v / 1e6).toFixed(1)}M`,
    ['1920', '1955', '1990', 'today'],
  );
  live.worldPop = trend(
    [...WORLD_HISTORY, ...points.wld],
    (v) => `${(v / 1e9).toFixed(1)}B`,
    ['Year 0', '675', '1350', 'today'],
  );
}

// ---------------------------------------------------------------------------
// ECB reference rates via frankfurter.dev — CHF strength against EUR and USD
// over one year, as % change (the franc's classic safe-haven story).

interface FxRange {
  rates: Record<string, { EUR: number; USD: number }>;
}

/** Series as % change from its first value. */
const rel = (s: number[]) => s.map((v) => (v / s[0] - 1) * 100);

async function loadFx(): Promise<void> {
  const data = await cached('fx-chf', 6 * 60 * MIN, async () => {
    const start = iso(new Date(Date.now() - 365 * 86_400_000));
    return fetchJson<FxRange>(
      `https://api.frankfurter.dev/v1/${start}..?base=CHF&symbols=EUR,USD`,
    );
  });

  const days = Object.keys(data.rates).toSorted();
  const eur = resample(days.map((d) => data.rates[d].EUR), 28);
  const usd = resample(days.map((d) => data.rates[d].USD), 28);
  const eurRel = rel(eur);
  const usdRel = rel(usd);
  const r = range([eurRel, usdRel]);

  live.fx = {
    eur: norm(eurRel, r.lo, r.hi),
    usd: norm(usdRel, r.lo, r.hi),
    ticks: ticks3(r.lo, r.hi, (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`),
    usdNow: usd[usd.length - 1],
    usdYoyPct: usdRel[usdRel.length - 1],
  };
}

// ---------------------------------------------------------------------------
// Country outlines (GeoJSON, ~250 kB from a static CDN) for the map panels.
// Not cached: localStorage quota is precious and the CDN is cache-friendly.

interface WorldGeo {
  features: {
    id: string;
    geometry: { type: string; coordinates: number[][][] | number[][][][] };
  }[];
}

async function loadWorldMap(): Promise<void> {
  const geo = await fetchJson<WorldGeo>(
    'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json',
  );
  live.worldMap = geo.features.map((f) => {
    const polys =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates as number[][][]]
        : (f.geometry.coordinates as number[][][][]);
    const rings = polys
      .map((poly) => poly[0]) // outer ring only — holes are invisible at panel size
      .filter((outer) => outer.length >= 12) // skip micro-islands
      .map((outer) => outer.filter((_, i) => i % 2 === 0)); // halve the points
    return { id: f.id, rings };
  });
}

// ---------------------------------------------------------------------------

let started = false;

/** Kick off all sources; each panel fills in as its dataset arrives. */
export function loadLiveData(): void {
  if (started) return; // StrictMode double-mount guard
  started = true;
  // Heartbeat for the "live" panels (debt clock): re-render once a second.
  setInterval(() => emitLiveUpdate('tick'), 1000);
  const sources: [string, () => Promise<void>][] = [
    ['weather', loadWeather],
    ['wiki', loadWiki],
    ['swiss', loadSwissTrends],
    ['debt', loadDebt],
    ['military', loadMilitary],
    ['population', loadPopulation],
    ['fx', loadFx],
    ['worldmap', loadWorldMap],
  ];
  sources.forEach(([name, run]) => {
    run()
      .then(() => emitLiveUpdate('data'))
      .catch((err) => console.warn(`[live-data] ${name} failed, panel keeps demo data`, err));
  });
}
