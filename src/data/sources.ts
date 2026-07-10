// Fetchers for the free, keyless, CORS-enabled public APIs that feed the
// panels: Open-Meteo (weather), Wikimedia (pageviews), World Bank (military
// spend, population, homicide) and the US Treasury (debt). Each fetcher
// derives the draw-ready shape, caches it (see cache.ts) and writes it into
// the store; failures are logged and swallowed so one dead API never takes
// down the ring. Series math lives in series.ts, the bundled historical
// datasets and fallbacks in bundled.ts.

import { localeNum, t as tr } from '../i18n';
import { cached, fetchJson } from './cache';
import { baselineTrend, niceScale, norm, trend } from './series';
import { CH_CENSUS, WORLD_HISTORY, debtTrend } from './bundled';
import { emitLiveUpdate, live } from './store';
import { TEMP_ANCHORS, hottestRows, type TempAnchor } from './climate';
import { WORLD } from './world';

const MIN = 60_000;

// World Bank date ranges are built from the current year so the queries keep
// returning fresh vintages no matter when the app is opened — a fixed upper
// bound would silently freeze a panel at its last hardcoded year.
const THIS_YEAR = new Date().getFullYear();

// ---------------------------------------------------------------------------
// Open-Meteo — current 2-m temperature for one anchor point per country
// (bbox centre of its largest outline ring, see data/climate.ts). Open-Meteo
// accepts comma-separated coordinate lists; chunked so no URL gets silly.

interface MeteoCurrent {
  current: { temperature_2m: number };
  // Today's low/high at the same anchor (forecast_days=1), for the range list.
  daily?: { temperature_2m_max: number[]; temperature_2m_min: number[] };
}

/** Current temp per ISO plus today's low/high, for the map and the range list. */
interface WorldTemp {
  byIso: Record<string, number>;
  rangeByIso: Record<string, { min: number; max: number }>;
}

async function loadWorldTemp(): Promise<void> {
  // Cache key bumped (-v2) when the payload gained the daily min/max range, so a
  // stale entry in the old {iso: temp} shape can't deserialize into the new one.
  const { byIso, rangeByIso } = await cached<WorldTemp>('world-temp-v2', 30 * MIN, async () => {
    const CHUNK = 60;
    const chunks: TempAnchor[][] = [];
    for (let i = 0; i < TEMP_ANCHORS.length; i += CHUNK) {
      chunks.push(TEMP_ANCHORS.slice(i, i + CHUNK));
    }
    const results = await Promise.all(
      chunks.map((part) =>
        fetchJson<MeteoCurrent | MeteoCurrent[]>(
          'https://api.open-meteo.com/v1/forecast' +
            `?latitude=${part.map((a) => a.lat.toFixed(2)).join(',')}` +
            `&longitude=${part.map((a) => a.lon.toFixed(2)).join(',')}` +
            '&current=temperature_2m' +
            '&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto',
        ),
      ),
    );
    const temps: Record<string, number> = {};
    const ranges: Record<string, { min: number; max: number }> = {};
    results.forEach((res, ci) => {
      // A single-location query returns an object, multi-location an array.
      const list = Array.isArray(res) ? res : [res];
      list.forEach((loc, j) => {
        const iso = chunks[ci][j].iso;
        temps[iso] = loc.current.temperature_2m;
        const max = loc.daily?.temperature_2m_max?.[0];
        const min = loc.daily?.temperature_2m_min?.[0];
        if (max !== undefined && min !== undefined) ranges[iso] = { min, max };
      });
    });
    return { byIso: temps, rangeByIso: ranges };
  });

  live.worldTemp = { byIso, rows: hottestRows(byIso, rangeByIso) };
}

// ---------------------------------------------------------------------------
// Wikimedia pageviews — shared helpers for the per-country trends feed.

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
        `/indicator/MS.MIL.XPND.CD?format=json&date=${THIS_YEAR - 3}:${THIS_YEAR}&per_page=200`,
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
// Swiss series is extended back to 1500 and the world series to Year 0 with
// the bundled census/history anchors so the panels really span centuries.

async function loadPopulation(): Promise<void> {
  const points = await cached('population', 24 * 60 * MIN, async () => {
    const res = await fetchJson<[unknown, WorldBankRow[]]>(
      'https://api.worldbank.org/v2/country/CHE;WLD/indicator/SP.POP.TOTL' +
        `?format=json&date=1960:${THIS_YEAR + 1}&per_page=200`,
    );
    const pick = (code: string): [number, number][] =>
      (res[1] ?? [])
        .filter((r) => r.countryiso3code === code && r.value !== null)
        .map((r) => [Number(r.date), r.value as number]);
    return { che: pick('CHE'), wld: pick('WLD') };
  });

  live.swissPop = trend(
    [...CH_CENSUS, ...points.che],
    (v) => `${localeNum(v / 1e6, 0)} ${tr('Mio')}`,
    ['1500', '1675', '1850', 'heute'],
  );
  live.worldPop = trend(
    [...WORLD_HISTORY, ...points.wld],
    (v) => `${localeNum(v / 1e9, 0)} ${tr('Mrd')}`,
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
          `?format=json&date=${THIS_YEAR - 8}:${THIS_YEAR}&per_page=3000`,
      ),
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/CHE;DEU;USA;RUS;BRA;JPN/indicator/VC.IHR.PSRC.P5' +
          `?format=json&date=1990:${THIS_YEAR}&per_page=400`,
      ),
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL' +
          // mrv=1 → most recent non-null value per country, whenever that is.
          '?format=json&mrv=1&per_page=400',
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
  const s = niceScale(Math.min(...all), Math.max(...all), (v) => localeNum(v, 0));
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
// World Bank / WHO — suicide mortality per 100k: a world choropleth (latest
// year per country) plus a top-5 ranking. The figures are WHO-modelled
// estimates (SH.STA.SUIC.P5), so the card labels them as such. A 500k
// population floor keeps the ranking free of micro-state noise while retaining
// the genuinely high-rate small nations (Guyana, Eswatini, Suriname) that the
// 1M floor used for the homicide list would drop.

async function loadSuicide(): Promise<void> {
  const data = await cached('suicide', 24 * 60 * MIN, async () => {
    const [world, pop] = await Promise.all([
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/all/indicator/SH.STA.SUIC.P5' +
          `?format=json&date=${THIS_YEAR - 8}:${THIS_YEAR}&per_page=3000`,
      ),
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL' +
          // mrv=1 → most recent non-null population per country, whenever that is.
          '?format=json&mrv=1&per_page=400',
      ),
    ]);
    const populous = new Set(
      (pop[1] ?? [])
        .filter((r) => (r.value ?? 0) >= 500_000)
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
    return {
      byIso: Object.fromEntries([...latest.entries()].map(([iso3, e]) => [iso3, e.v])),
      world: latest.get('WLD')?.v ?? 9,
      top: [...latest.entries()]
        .filter(([iso3]) => iso3 !== 'WLD' && populous.has(iso3))
        .map(([, e]) => ({ name: e.name, v: e.v }))
        .toSorted((a, b) => b.v - a.v)
        .slice(0, 5),
    };
  });

  live.suicide = { byIso: data.byIso, rows: data.top, world: data.world };
}

// World Bank PIP — extreme poverty (SI.POV.DDAY): share of the population under
// $2.15/day (2017 PPP), the modern World Bank line. A world choropleth plus a
// top-6 ranking. Poverty surveys lag heavily and are irregular, so the query
// spans a wide window and keeps the latest year per country; a 500k population
// floor keeps the ranking free of micro-state noise.
async function loadPoverty(): Promise<void> {
  const data = await cached('poverty', 24 * 60 * MIN, async () => {
    const [world, pop] = await Promise.all([
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/all/indicator/SI.POV.DDAY' +
          `?format=json&date=${THIS_YEAR - 15}:${THIS_YEAR}&per_page=5000`,
      ),
      fetchJson<[unknown, WorldBankRow[]]>(
        'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL' +
          '?format=json&mrv=1&per_page=400',
      ),
    ]);
    const populous = new Set(
      (pop[1] ?? []).filter((r) => (r.value ?? 0) >= 500_000).map((r) => r.countryiso3code),
    );
    const latest = new Map<string, { name: string; v: number; year: string }>();
    for (const row of world[1] ?? []) {
      if (row.value === null || row.countryiso3code.length !== 3) continue;
      const prev = latest.get(row.countryiso3code);
      if (!prev || row.date > prev.year) {
        latest.set(row.countryiso3code, { name: row.country.value, v: row.value, year: row.date });
      }
    }
    return {
      byIso: Object.fromEntries([...latest.entries()].map(([iso3, e]) => [iso3, e.v])),
      world: latest.get('WLD')?.v ?? 9,
      top: [...latest.entries()]
        .filter(([iso3]) => iso3 !== 'WLD' && populous.has(iso3))
        .map(([, e]) => ({ name: e.name, v: e.v }))
        .toSorted((a, b) => b.v - a.v)
        .slice(0, 6),
    };
  });
  live.poverty = { byIso: data.byIso, rows: data.top, world: data.world };
}

// ---------------------------------------------------------------------------
// Tech for Palestine — Gaza & West-Bank casualties. Keyless, CORS-enabled
// static JSON (Cloudflare), refreshed ~daily. The only one of the Nahost
// card's three metrics with a real live feed; Hormuz and the missile figure
// are bundled and dated (see dashboards/geo.ts). No Iranian/Israeli-side
// figures — the feed covers Palestinian casualties only, labeled as such.

interface TfpSummary {
  gaza: {
    last_update: string;
    killed: { total: number; children: number };
    injured: { total: number };
  };
  west_bank: { killed: { total: number } };
}

// Some early daily rows carry only the extrapolated `ext_killed`; guard for both.
type TfpDaily = { report_date: string; killed?: number; ext_killed?: number }[];

async function loadMideast(): Promise<void> {
  const data = await cached('mideast', 3 * 60 * MIN, async () => {
    const [summary, daily] = await Promise.all([
      fetchJson<TfpSummary>('https://data.techforpalestine.org/api/v3/summary.min.json'),
      fetchJson<TfpDaily>('https://data.techforpalestine.org/api/v2/casualties_daily.min.json'),
    ]);
    return {
      killed: summary.gaza.killed.total,
      children: summary.gaza.killed.children,
      injured: summary.gaza.injured.total,
      westBankKilled: summary.west_bank.killed.total,
      lastUpdate: summary.gaza.last_update,
      daily: daily.slice(-30).map((d) => d.killed ?? d.ext_killed ?? 0),
    };
  });

  live.mideast = data;
}

// ---------------------------------------------------------------------------
// IMF PortWatch — daily TANKER transits through the Strait of Hormuz. Keyless,
// CORS-enabled ArcGIS feature service (satellite AIS on ~90k ships, IMF / Univ.
// of Oxford). One query pulls the recent daily series (the crisis/recovery
// curve); a second computes the pre-crisis average tanker/day (records before
// the 28 Feb 2026 war) as the flat "normal" reference. Weekly-updated daily
// data — so the card is `dynamic`, not `live`. The bundled counterpart is the
// monthly oil-volume panel (HORMUZ_OIL_PANEL); this one is live and by ship count.

const PORTWATCH_CHOKE =
  'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services' +
  '/Daily_Chokepoints_Data/FeatureServer/0/query';

// Strait of Hormuz is portid "chokepoint6"; n_tanker is the daily tanker count.
const HORMUZ_WHERE = "portid='chokepoint6'";
const HORMUZ_WAR_START = '2026-02-28';

interface ChokepointRow {
  attributes: { date: string; n_tanker: number };
}
interface ChokepointResp {
  features: ChokepointRow[];
}
interface AvgResp {
  features: { attributes: { avg_tanker: number | null } }[];
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const monthOf = (isoDate: string) => MONTH_SHORT[Number(isoDate.slice(5, 7)) - 1] ?? '';

async function loadHormuzTankers(): Promise<void> {
  const { values, baseline, xLabels } = await cached('hormuz-tankers', 6 * 60 * MIN, async () => {
    const avgStat = JSON.stringify([
      { statisticType: 'avg', onStatisticField: 'n_tanker', outStatisticFieldName: 'avg_tanker' },
    ]);
    const [recent, pre] = await Promise.all([
      fetchJson<ChokepointResp>(
        `${PORTWATCH_CHOKE}?where=${encodeURIComponent(HORMUZ_WHERE)}` +
          '&outFields=date,n_tanker&orderByFields=date%20DESC&resultRecordCount=140&f=json',
      ),
      fetchJson<AvgResp>(
        `${PORTWATCH_CHOKE}?where=${encodeURIComponent(`${HORMUZ_WHERE} AND date < DATE '${HORMUZ_WAR_START}'`)}` +
          `&outStatistics=${encodeURIComponent(avgStat)}&f=json`,
      ),
    ]);

    // Query is date DESC → reverse to chronological. Guard the daily count.
    const rows = (recent.features ?? [])
      .filter((ft) => ft.attributes?.date && typeof ft.attributes.n_tanker === 'number')
      .map((ft) => ({ date: ft.attributes.date, v: ft.attributes.n_tanker }))
      .toReversed();
    if (rows.length < 2) throw new Error('PortWatch: no Hormuz daily tanker rows');

    const n = rows.length;
    const labels = [
      monthOf(rows[0].date),
      monthOf(rows[Math.floor(n / 3)].date),
      monthOf(rows[Math.floor((2 * n) / 3)].date),
      'heute',
    ];
    return {
      values: rows.map((r) => r.v),
      baseline: Math.round(pre.features[0]?.attributes.avg_tanker ?? 54),
      xLabels: labels,
    };
  });

  live.hormuzTankers = baselineTrend(values, baseline, xLabels, (v) => localeNum(v, 0));
}

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
  { code: 'ZRH', source: 'OPEN-METEO', city: 'ZÜRICH', item: 'Welt-Temperaturen', load: loadWorldTemp },
  { code: 'SFO', source: 'WIKIMEDIA', city: 'SAN FRANCISCO', item: 'Schweizer Trends', load: loadSwissTrends },
  { code: 'WAS', source: 'US TREASURY', city: 'WASHINGTON', item: 'Staatsschulden', load: loadDebt },
  { code: 'WAS', source: 'WORLD BANK', city: 'WASHINGTON', item: 'Militärausgaben', load: loadMilitary },
  { code: 'WAS', source: 'WORLD BANK', city: 'WASHINGTON', item: 'Bevölkerung', load: loadPopulation },
  { code: 'WAS', source: 'WORLD BANK', city: 'WASHINGTON', item: 'Mordrate', load: loadHomicide },
  { code: 'WAS', source: 'WORLD BANK', city: 'WASHINGTON', item: 'Suizidrate', load: loadSuicide },
  { code: 'WAS', source: 'WORLD BANK', city: 'WASHINGTON', item: 'Extreme Armut', load: loadPoverty },
  { code: 'GZA', source: 'TECH FOR PALESTINE', city: 'GAZA', item: 'Opferzahlen', load: loadMideast },
  { code: 'HOR', source: 'IMF PORTWATCH', city: 'STRASSE VON HORMUS', item: 'Tanker-Transite', load: loadHormuzTankers },
];

/** Per-feed lifecycle, index-aligned with `LIVE_FEEDS`. Read by the loading
    screen to drive honest progress and its feed strip — a plain mutable array
    beside `live`, so the loader can poll it without a subscription (and so a
    localStorage-cached feed that settled before the loader mounted is still
    counted). `failed` still advances progress; a dead source must never stall
    the ring. */
export type FeedState = 'pending' | 'ok' | 'failed';
export const feedStates: FeedState[] = LIVE_FEEDS.map(() => 'pending');

/** How many feeds have settled (succeeded or failed) so far. */
export function feedsSettled(): number {
  return feedStates.reduce((n, s) => (s === 'pending' ? n : n + 1), 0);
}

let started = false;

/** Kick off all sources; each panel fills in as its dataset arrives. */
export function loadLiveData(): void {
  if (started) return; // StrictMode double-mount guard
  started = true;
  // The country outlines ship in the bundle — no fetch, no failure mode.
  live.worldMap = WORLD;
  // Heartbeat for the "live" panels (debt clock): re-render once a second.
  setInterval(() => emitLiveUpdate('tick'), 1000);
  LIVE_FEEDS.forEach((feed, i) => {
    feed
      .load()
      .then(() => {
        feedStates[i] = 'ok';
        return emitLiveUpdate('data'); // success-only: dashboards redraw on real data
      })
      .catch((err) => {
        feedStates[i] = 'failed';
        console.warn(
          `[live-data] ${feed.source} ${feed.item} failed, panel keeps demo data`,
          err,
        );
      });
  });
}
