import { CanvasTexture, SRGBColorSpace } from 'three';
import {
  areaChart,
  debtClock,
  hBarChart,
  lineChart,
  nukeMap,
  weatherForecast,
} from './charts';
import type { Frame } from './draw';
import { SERIES } from './theme';
import { live } from '../data/store';

export interface Dashboard {
  id: string;
  title: string;
  /** True for panels that keep moving while idle — re-rendered on ticks. */
  live?: boolean;
  draw: (f: Frame) => void;
}

/**
 * Time fed into the one-shot idle render: far past every intro, so panels
 * show a settled chart until a hover replays the animation from 0.
 */
export const SETTLED_T = 9.7;

const [blue, aqua, yellow, , violet, , magenta, orange] = SERIES;

const degrees = (v: number) => `${v.toFixed(1)}°C`;

/**
 * Estimated nuclear warhead inventories (Federation of American Scientists,
 * 2025 status). No live API exists for this — estimates change yearly.
 */
const NUKE_STATES = [
  { name: 'Russia', iso: 'RUS', lon: 60, lat: 60, count: 5449 },
  { name: 'United States', iso: 'USA', lon: -98, lat: 39, count: 5277 },
  { name: 'China', iso: 'CHN', lon: 104, lat: 35, count: 600 },
  { name: 'France', iso: 'FRA', lon: 2.5, lat: 46.5, count: 290 },
  { name: 'United Kingdom', iso: 'GBR', lon: -1.5, lat: 53, count: 225 },
  { name: 'India', iso: 'IND', lon: 79, lat: 22, count: 180 },
  { name: 'Pakistan', iso: 'PAK', lon: 69, lat: 30, count: 170 },
  { name: 'Israel', iso: 'ISR', lon: 35.2, lat: 31.5, count: 90 },
  { name: 'North Korea', iso: 'PRK', lon: 127, lat: 40, count: 50 },
];
const NUKE_TOTAL = NUKE_STATES.reduce((sum, s) => sum + s.count, 0);

/**
 * The panel pool — live public data (US Treasury, World Bank, ECB,
 * Open-Meteo, Wikimedia). Every config is built inside `draw`, so a panel
 * picks up its dataset on the very next frame after the fetcher fills the
 * store; until then it falls back to the seeded demo series. Each page load
 * shows a random selection (see DASHBOARDS below).
 */
const POOL: Dashboard[] = [
  {
    id: 'city-temp',
    title: 'Daily High · Zurich vs Geneva',
    draw: (f) => {
      const w = live.weather;
      lineChart(f, {
        label: 'Daily High · 14 Days',
        value: w?.zurichHigh ?? 21.4,
        unit: '',
        fmt: degrees,
        delta: null,
        seed: 11,
        series: [
          { name: 'Zurich', color: blue, data: w?.lineZurich },
          { name: 'Geneva', color: aqua, data: w?.lineGeneva },
        ],
        ticks: w?.tempTicks ?? ['10°', '20°', '30°'],
        xLabels: ['-13d', '-9d', '-4d', 'today'],
      });
    },
  },
  {
    id: 'military',
    title: 'Military Spending · Top 10',
    draw: (f) => {
      const m = live.military;
      hBarChart(f, {
        label: `Military Spend · ${m?.year ?? '2024'}`,
        value: m?.total ?? 1.6e12,
        delta: null,
        color: orange,
        unit: '$',
        rows: m?.rows ?? [
          { name: 'United States', v: 9.97e11 },
          { name: 'China', v: 3.14e11 },
          { name: 'Russia', v: 1.49e11 },
          { name: 'Germany', v: 8.8e10 },
          { name: 'India', v: 8.6e10 },
        ],
      });
    },
  },
  {
    id: 'us-debt',
    title: 'US National Debt',
    live: true,
    draw: (f) => {
      const d = live.debt;
      debtClock(f, {
        label: 'US National Debt',
        latest: d?.latest ?? 39.4e12,
        latestMs: d?.latestMs ?? Date.now() - 86_400_000,
        ratePerMs: d?.ratePerMs ?? 0.06,
        yoyPct: d?.yoyPct ?? 5.8,
        series: d?.series ?? [0.1, 0.16, 0.24, 0.3, 0.35, 0.44, 0.5, 0.58, 0.66, 0.75, 0.83, 0.9],
        ticks: d?.ticks ?? ['$37T', '$38T', '$39T'],
        color: yellow,
        isLive: !!d,
      });
    },
  },
  {
    id: 'nukes',
    title: 'Nuclear Warheads Worldwide',
    draw: (f) =>
      nukeMap(f, {
        label: 'Nuclear Warheads',
        total: NUKE_TOTAL,
        states: NUKE_STATES,
        world: live.worldMap,
        source: 'FAS 2025 estimate',
      }),
  },
  {
    id: 'swiss-pop',
    title: 'Swiss Population · 100 Years',
    draw: (f) => {
      const p = live.swissPop;
      areaChart(f, {
        label: 'Swiss Population · since 1920',
        value: p?.latest ?? 9_092_000,
        fmt: (v) => `${(v / 1e6).toFixed(2)}M`,
        delta: p?.yoyPct ?? 0.8,
        seed: 19,
        color: magenta,
        data: p?.series,
        ticks: p?.ticks ?? ['4M', '6.5M', '9M'],
        xLabels: p?.xLabels ?? ['1920', '1955', '1990', 'today'],
      });
    },
  },
  {
    id: 'world-pop',
    title: 'World Population · 2000 Years',
    draw: (f) => {
      const p = live.worldPop;
      areaChart(f, {
        label: 'World Population · 2000 Years',
        value: p?.latest ?? 8.23e9,
        fmt: (v) => `${(v / 1e9).toFixed(2)}B`,
        delta: p?.yoyPct ?? 0.9,
        seed: 29,
        color: blue,
        data: p?.series,
        ticks: p?.ticks ?? ['0B', '4B', '8B'],
        xLabels: p?.xLabels ?? ['Year 0', '675', '1350', 'today'],
      });
    },
  },
  {
    id: 'chf-fx',
    title: 'Franc Strength · 1 Year',
    draw: (f) => {
      const fx = live.fx;
      lineChart(f, {
        label: 'CHF vs EUR & USD · 1y',
        value: fx?.usdNow ?? 1.26,
        unit: '',
        fmt: (v) => `$${v.toFixed(3)}`,
        delta: fx?.usdYoyPct ?? 4.2,
        seed: 31,
        series: [
          { name: 'USD per CHF', color: violet, data: fx?.usd },
          { name: 'EUR per CHF', color: aqua, data: fx?.eur },
        ],
        ticks: fx?.ticks ?? ['-2%', '+1%', '+4%'],
        xLabels: ['-12mo', '-8mo', '-4mo', 'now'],
      });
    },
  },
  {
    id: 'forecast',
    title: 'Zurich · 7-Day Forecast',
    draw: (f) => {
      const w = live.weather;
      weatherForecast(f, {
        label: 'Zurich · 7-Day Forecast',
        current: w?.currentTemp ?? 18,
        days:
          w?.forecast ??
          [
            { day: 'Today', code: 1, min: 14, max: 24 },
            { day: 'Sat', code: 0, min: 15, max: 27 },
            { day: 'Sun', code: 3, min: 16, max: 25 },
            { day: 'Mon', code: 61, min: 13, max: 20 },
            { day: 'Tue', code: 95, min: 12, max: 19 },
            { day: 'Wed', code: 2, min: 13, max: 22 },
            { day: 'Thu', code: 0, min: 15, max: 26 },
          ],
      });
    },
  },
  {
    id: 'wiki',
    title: 'Wikipedia · Top Articles',
    draw: (f) => {
      const wk = live.wiki;
      hBarChart(f, {
        label: 'Wikipedia · Top Today',
        value: wk?.topViews ?? 412_000,
        delta: null,
        color: blue,
        unit: '',
        rows: wk?.rows ?? [
          { name: 'Deaths in 2026', v: 168_000 },
          { name: 'ChatGPT', v: 112_000 },
          { name: 'Bitcoin', v: 64_000 },
          { name: 'Germany', v: 44_000 },
          { name: 'World War II', v: 24_000 },
        ],
      });
    },
  },
  {
    id: 'swiss-trends',
    title: 'Swiss Trends · Wikipedia',
    draw: (f) => {
      const s = live.swiss;
      hBarChart(f, {
        label: 'Swiss Trends · Wikipedia',
        value: s?.topViews ?? 4_100,
        delta: null,
        color: magenta,
        unit: '',
        rows: s?.rows ?? [
          { name: 'Fussball-WM 2026', v: 3_800 },
          { name: 'Lamine Yamal', v: 3_500 },
          { name: 'Vladimir Petković', v: 3_200 },
          { name: 'Roger Federer', v: 2_400 },
          { name: 'Schweiz', v: 1_900 },
        ],
      });
    },
  },
];

const RING_SIZE = 9;

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Each page load draws a fresh random selection and order from the pool, so
 * revisiting the ring stays interesting. Evaluated once at module load — the
 * ring radius derives from this length.
 */
export const DASHBOARDS: Dashboard[] = shuffled(POOL).slice(0, RING_SIZE);

export interface DashboardTexture {
  tex: CanvasTexture;
  /** Redraw the dashboard at time `t` and flag the texture for upload. */
  render: (t: number) => void;
  dispose: () => void;
}

/** Offscreen canvas + texture for one dashboard, pre-rendered settled. */
export function createDashboardTexture(
  dashboard: Dashboard,
  width: number,
  height: number,
): DashboardTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;

  const render = (t: number) => {
    if (!ctx) return;
    dashboard.draw({ ctx, w: width, h: height, t, u: width / 512 });
    tex.needsUpdate = true;
  };
  render(SETTLED_T);

  return { tex, render, dispose: () => tex.dispose() };
}
