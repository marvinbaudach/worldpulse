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

const DAY_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      day: i === 0 ? 'Today' : DAY_NAME[new Date(`${day}T12:00:00`).getDay()],
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
): TrendSeries {
  const series = yearly(points);
  const s = niceScale(Math.min(...series), Math.max(...series), fmt);
  return {
    series: norm(resample(series, 28), s.lo, s.hi),
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
    ['1500', '1675', '1850', 'today'],
  );
  live.worldPop = trend(
    [...WORLD_HISTORY, ...points.wld],
    (v) => `${(v / 1e9).toFixed(0)}B`,
    ['Year 0', '675', '1350', 'today'],
  );
}

// ---------------------------------------------------------------------------
// World Bank — intentional homicides per 100k: a world choropleth (latest
// year per country) plus the Switzerland / Germany / US series since 1990.

async function loadHomicide(): Promise<void> {
  const data = await cached('homicide', 24 * 60 * MIN, async () => {
    const [world, trio, pop] = await Promise.all([
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/all/indicator/VC.IHR.PSRC.P5' +
          '?format=json&date=2016:2024&per_page=3000',
      ),
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/CHE;DEU;USA/indicator/VC.IHR.PSRC.P5' +
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
    };
  });

  const all = [...data.che, ...data.deu, ...data.usa];
  const s = niceScale(Math.min(...all), Math.max(...all), (v) => v.toFixed(0));
  live.homicide = {
    byIso: data.byIso,
    rows: data.top,
    world: data.world,
    che: norm(data.che, s.lo, s.hi),
    deu: norm(data.deu, s.lo, s.hi),
    usa: norm(data.usa, s.lo, s.hi),
    cheLatest: data.che[data.che.length - 1] ?? 0.5,
    ticks: s.ticks,
  };
}

// ---------------------------------------------------------------------------
// Paleoclimate: atmospheric CO2 and global temperature over 10,000 years.
// Holocene values are ice-core reconstructions (EPICA Dome C / Law Dome for
// CO2; Marcott et al. 2013 for temperature), spliced with the modern
// instrumental record (Mauna Loa CO2; global surface-temperature anomaly).
// Bundled — the point is the 10k-year shape, not a live reading.

// [years before today, CO2 ppm, temperature anomaly °C vs 1961–1990]
const CLIMATE_ANCHORS: [number, number, number][] = [
  [10000, 265, -0.2],
  [8000, 260, 0.3], // Holocene climatic optimum
  [6000, 265, 0.4],
  [4000, 270, 0.2],
  [2000, 275, 0.0],
  [1000, 279, 0.05],
  [300, 280, -0.35], // ~1700, Little Ice Age
  [175, 285, -0.3], // ~1850, pre-industrial
  [125, 296, -0.2],
  [75, 311, -0.05],
  [50, 331, 0.0],
  [25, 361, 0.35],
  [0, 421, 1.1], // today
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

function climatePanel(): NonNullable<typeof live.climate> {
  // interpAt needs x (years-ago) ascending; anchors list it descending.
  const co2Pts = CLIMATE_ANCHORS.map(([ya, co2]) => [ya, co2] as [number, number]).toReversed();
  const tempPts = CLIMATE_ANCHORS.map(([ya, , t]) => [ya, t] as [number, number]).toReversed();

  const n = 90;
  const co2raw: number[] = [];
  const tempraw: number[] = [];
  for (let i = 0; i < n; i++) {
    const ya = 10000 - (10000 * i) / (n - 1); // 10000 -> 0 (oldest to today)
    co2raw.push(interpAt(co2Pts, ya));
    tempraw.push(interpAt(tempPts, ya));
  }
  const cs = niceScale(Math.min(...co2raw), Math.max(...co2raw), (v) => `${Math.round(v)}`);
  const tlo = Math.min(...tempraw) - 0.15;
  const thi = Math.max(...tempraw) + 0.15;
  return {
    co2: norm(co2raw, cs.lo, cs.hi),
    temp: norm(tempraw, tlo, thi),
    ticks: cs.ticks,
    latestCo2: CLIMATE_ANCHORS[CLIMATE_ANCHORS.length - 1][1],
  };
}

export const CLIMATE_PANEL = climatePanel();

// ---------------------------------------------------------------------------
// Gold priced in Swiss francs vs the SNB monetary base, 100 years. History
// comes from documented anchors (gold was pegged until 1971 — CHF ~150/oz —
// the base figures are approximate SNB year-end levels); today's gold price
// arrives live via the PAXG token (1 PAXG = 1 fine troy ounce) in CHF.

const GOLD_CHF_OZ: [number, number][] = [
  [1925, 107],
  [1945, 150],
  [1971, 150],
  [1974, 600],
  [1980, 1500],
  [1985, 700],
  [1999, 450],
  [2005, 560],
  [2011, 1615],
  [2015, 1100],
  [2020, 1870],
  [2024, 2150],
];

/** SNB monetary base, billions of CHF (approximate year-end levels). */
const SNB_BASE_BN: [number, number][] = [
  [1925, 1],
  [1950, 4.6],
  [1971, 14],
  [1985, 30],
  [2000, 41],
  [2008, 49],
  [2012, 340],
  [2015, 470],
  [2020, 700],
  [2022, 740],
  [2025, 460],
];

function goldPanel(latestGold: number): NonNullable<typeof live.gold> {
  const year = new Date().getFullYear();
  const gold = resample(yearly([...GOLD_CHF_OZ, [year, latestGold]]), 40);
  const base = resample(yearly(SNB_BASE_BN), 40);
  const s = niceScale(0, Math.max(...gold), (v) => `${(v / 1000).toFixed(1)}k`);
  return {
    gold: norm(gold, s.lo, s.hi),
    // Own scale: the point is the shared shape, not shared units.
    base: norm(base, 0, Math.max(...base) * 1.02),
    ticks: s.ticks,
    latest: latestGold,
  };
}

export const GOLD_FALLBACK = goldPanel(3300);

async function loadGold(): Promise<void> {
  const chf = await cached('gold-chf', 60 * MIN, async () => {
    const d = await fetchJson<{ 'pax-gold': { chf: number } }>(
      'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=chf',
    );
    return d['pax-gold'].chf;
  });
  live.gold = goldPanel(chf);
}

// ---------------------------------------------------------------------------
// Real-data fallbacks for the population panels: built from the bundled
// anchors, so even with every API unreachable the curves keep their true
// shape instead of demo noise.

export const SWISS_POP_FALLBACK: TrendSeries = trend(
  [...CH_CENSUS, [2025, 9_092_436]],
  (v) => `${(v / 1e6).toFixed(0)}M`,
  ['1500', '1675', '1850', 'today'],
);

export const WORLD_POP_FALLBACK: TrendSeries = trend(
  [...WORLD_HISTORY, [2025, 8.215e9]],
  (v) => `${(v / 1e9).toFixed(0)}B`,
  ['Year 0', '675', '1350', 'today'],
);

// ---------------------------------------------------------------------------

let started = false;

/** Kick off all sources; each panel fills in as its dataset arrives. */
export function loadLiveData(): void {
  if (started) return; // StrictMode double-mount guard
  started = true;
  // The country outlines ship in the bundle — no fetch, no failure mode.
  live.worldMap = WORLD;
  // Heartbeat for the "live" panels (debt clock): re-render once a second.
  setInterval(() => emitLiveUpdate('tick'), 1000);
  const sources: [string, () => Promise<void>][] = [
    ['weather', loadWeather],
    ['wiki', loadWiki],
    ['swiss', loadSwissTrends],
    ['debt', loadDebt],
    ['military', loadMilitary],
    ['population', loadPopulation],
    ['homicide', loadHomicide],
    ['gold', loadGold],
  ];
  sources.forEach(([name, run]) => {
    run()
      .then(() => emitLiveUpdate('data'))
      .catch((err) => console.warn(`[live-data] ${name} failed, panel keeps demo data`, err));
  });
}
