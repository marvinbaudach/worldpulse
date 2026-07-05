import { CanvasTexture, SRGBColorSpace } from 'three';
import {
  areaChart,
  choroplethMap,
  debtClock,
  hBarChart,
  lineChart,
  nukeMap,
  treemap,
  weatherForecast,
} from './charts';
import type { Frame } from './draw';
import { SERIES } from './theme';
import { live, type TrendSeries } from '../data/store';
import {
  CLIMATE_PANEL,
  CONFLICT_PANEL,
  DEBT_TREND_FALLBACK,
  DOLLAR_PANEL,
  CONTINENT_FERTILITY,
  INTERNET_PANEL,
  LIFE_PANEL,
  M2_PANEL,
  NUKE_TESTS_PANEL,
  OBESITY_PANEL,
  OVERDOSE_PANEL,
  REFUGEE_PANEL,
  SWISS_POP_FALLBACK,
  US_INTEREST_PANEL,
  WORLD_POP_FALLBACK,
} from '../data/sources';

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

const [blue, aqua, yellow, green, violet, red, magenta, orange] = SERIES;

/** Compact factory for the bundled single-series trend panels. */
function trendCard(
  id: string,
  title: string,
  label: string,
  panel: TrendSeries,
  color: string,
  fmt: (v: number) => string,
  seed: number,
): Dashboard {
  return {
    id,
    title,
    draw: (f) =>
      areaChart(f, {
        label,
        value: panel.latest,
        fmt,
        delta: null,
        seed,
        color,
        data: panel.series,
        ticks: panel.ticks,
        xLabels: panel.xLabels,
      }),
  };
}


/**
 * Estimated nuclear warhead inventories (Federation of American Scientists,
 * 2025 status). No live API exists for this — estimates change yearly.
 */
const NUKE_STATES = [
  { name: 'Russland', iso: 'RUS', lon: 60, lat: 60, count: 5449 },
  { name: 'USA', iso: 'USA', lon: -98, lat: 39, count: 5277 },
  { name: 'China', iso: 'CHN', lon: 104, lat: 35, count: 600 },
  { name: 'Frankreich', iso: 'FRA', lon: 2.5, lat: 46.5, count: 290 },
  { name: 'Großbritannien', iso: 'GBR', lon: -1.5, lat: 53, count: 225 },
  { name: 'Indien', iso: 'IND', lon: 79, lat: 22, count: 180 },
  { name: 'Pakistan', iso: 'PAK', lon: 69, lat: 30, count: 170 },
  { name: 'Israel', iso: 'ISR', lon: 35.2, lat: 31.5, count: 90 },
  { name: 'Nordkorea', iso: 'PRK', lon: 127, lat: 40, count: 50 },
];
const NUKE_TOTAL = NUKE_STATES.reduce((sum, s) => sum + s.count, 0);

/**
 * The panel pool — live public data (US Treasury, World Bank,
 * Open-Meteo, Wikimedia). Every config is built inside `draw`, so a panel
 * picks up its dataset on the very next frame after the fetcher fills the
 * store; until then it falls back to the seeded demo series. Each page load
 * shows a random selection (see DASHBOARDS below).
 */
const POOL: Dashboard[] = [
  {
    id: 'military',
    title: 'Militärausgaben · Top 10',
    draw: (f) => {
      const m = live.military;
      hBarChart(f, {
        label: `Militärausgaben · ${m?.year ?? '2024'}`,
        value: m?.total ?? 1.6e12,
        delta: null,
        color: orange,
        unit: '$',
        rows: m?.rows ?? [
          { name: 'USA', v: 9.97e11 },
          { name: 'China', v: 3.14e11 },
          { name: 'Russland', v: 1.49e11 },
          { name: 'Deutschland', v: 8.8e10 },
          { name: 'Indien', v: 8.6e10 },
        ],
      });
    },
  },
  {
    id: 'us-debt',
    title: 'US-Staatsschulden',
    live: true,
    draw: (f) => {
      const d = live.debt;
      debtClock(f, {
        label: 'US-Staatsschulden',
        latest: d?.latest ?? 39.4e12,
        latestMs: d?.latestMs ?? Date.now() - 86_400_000,
        ratePerMs: d?.ratePerMs ?? 0.06,
        yoyPct: d?.yoyPct ?? 5.8,
        series: d?.series ?? DEBT_TREND_FALLBACK.series,
        ticks: d?.ticks ?? DEBT_TREND_FALLBACK.ticks,
        color: yellow,
        isLive: !!d,
      });
    },
  },
  {
    id: 'nukes',
    title: 'Atomsprengköpfe weltweit',
    draw: (f) =>
      nukeMap(f, {
        label: 'Atomsprengköpfe',
        total: NUKE_TOTAL,
        states: NUKE_STATES,
        world: live.worldMap,
        source: 'FAS-Schätzung 2025',
      }),
  },
  {
    id: 'homicide-map',
    title: 'Mordrate weltweit',
    draw: (f) => {
      const hm = live.homicide;
      choroplethMap(f, {
        label: 'Mordrate',
        value: hm?.world ?? 5.6,
        fmt: (v) => `${v.toFixed(1)} /100k`,
        valueByIso: hm?.byIso,
        world: live.worldMap,
        rows: hm?.rows ?? [
          { name: 'Jamaika', v: 53.3 },
          { name: 'Südafrika', v: 45.5 },
          { name: 'Honduras', v: 31.1 },
          { name: 'Brasilien', v: 19.3 },
          { name: 'Mexiko', v: 18.5 },
        ],
        rowFmt: (v) => v.toFixed(1),
        source: 'World Bank · Tötungsdelikte pro 100k',
      });
    },
  },
  {
    id: 'homicide-trend',
    title: 'Mordraten · 6 Länder',
    draw: (f) => {
      const hm = live.homicide;
      lineChart(f, {
        label: 'Morde /100k · seit 1990',
        value: hm?.cheLatest ?? 0.5,
        unit: '',
        fmt: (v) => v.toFixed(2),
        delta: null,
        seed: 41,
        series: [
          { name: 'BRA', color: orange, data: hm?.bra },
          { name: 'RUS', color: red, data: hm?.rus },
          { name: 'USA', color: magenta, data: hm?.usa },
          { name: 'DEU', color: aqua, data: hm?.deu },
          { name: 'CHE', color: blue, data: hm?.che },
          { name: 'JPN', color: green, data: hm?.jpn },
        ],
        ticks: hm?.ticks ?? ['0', '5', '10'],
        xLabels: ['1990', '2002', '2013', 'heute'],
      });
    },
  },
  {
    id: 'climate',
    title: 'Globale Temperatur · 800.000 Jahre',
    draw: (f) => {
      const c = live.climate ?? CLIMATE_PANEL;
      lineChart(f, {
        label: 'Temperatur · 800k Jahre',
        value: c.latestTemp,
        unit: '',
        fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}°C`,
        delta: null,
        seed: 53,
        series: [{ name: 'Temperatur-Anomalie °C', color: orange, data: c.temp }],
        ticks: c.ticks,
        xLabels: ['vor 800k', 'vor 530k', 'vor 270k', 'heute'],
        shade: { mask: c.iceMask, label: '❄ Eiszeiten' },
      });
    },
  },
  {
    id: 'swiss-pop',
    title: 'Schweizer Bevölkerung · 500 Jahre',
    draw: (f) => {
      const p = live.swissPop ?? SWISS_POP_FALLBACK;
      areaChart(f, {
        label: 'Schweizer Bevölkerung · seit 1500',
        value: p.latest,
        fmt: (v) => `${(v / 1e6).toFixed(2)}M`,
        delta: p.yoyPct,
        seed: 19,
        color: magenta,
        data: p.series,
        ticks: p.ticks,
        xLabels: p.xLabels,
      });
    },
  },
  {
    id: 'world-pop',
    title: 'Weltbevölkerung · 2000 Jahre',
    draw: (f) => {
      const p = live.worldPop ?? WORLD_POP_FALLBACK;
      areaChart(f, {
        label: 'Weltbevölkerung · 2000 Jahre',
        value: p.latest,
        fmt: (v) => `${(v / 1e9).toFixed(2)}B`,
        // No delta chip: a YoY figure under a 2000-year curve reads as if
        // it were the growth over the whole span.
        delta: null,
        seed: 29,
        color: blue,
        data: p.series,
        ticks: p.ticks,
        xLabels: p.xLabels,
      });
    },
  },
  {
    id: 'forecast',
    title: 'Zürich · 7-Tage-Prognose',
    draw: (f) => {
      const w = live.weather;
      weatherForecast(f, {
        label: 'Zürich · 7-Tage-Prognose',
        current: w?.currentTemp ?? 18,
        days:
          w?.forecast ??
          [
            { day: 'Heute', code: 1, min: 14, max: 24 },
            { day: 'Sa', code: 0, min: 15, max: 27 },
            { day: 'So', code: 3, min: 16, max: 25 },
            { day: 'Mo', code: 61, min: 13, max: 20 },
            { day: 'Di', code: 95, min: 12, max: 19 },
            { day: 'Mi', code: 2, min: 13, max: 22 },
            { day: 'Do', code: 0, min: 15, max: 26 },
          ],
      });
    },
  },
  {
    id: 'conflict-deaths',
    title: 'Tote in bewaffneten Konflikten',
    draw: (f) =>
      areaChart(f, {
        label: 'Kriegstote · seit 1900',
        value: CONFLICT_PANEL.latest,
        fmt: (v) => `${Math.round(v / 1000)}k`,
        // No delta: the series is spike-driven (Rwanda, Ukraine), a YoY
        // number under it would read as noise.
        delta: null,
        seed: 61,
        color: magenta,
        data: CONFLICT_PANEL.series,
        ticks: CONFLICT_PANEL.ticks,
        xLabels: CONFLICT_PANEL.xLabels,
      }),
  },
  {
    id: 'refugees',
    title: 'Vertriebene weltweit',
    draw: (f) =>
      areaChart(f, {
        label: 'Vertriebene · UNHCR',
        value: REFUGEE_PANEL.latest,
        fmt: (v) => `${Math.round(v / 1e6)}M`,
        delta: REFUGEE_PANEL.yoyPct,
        seed: 67,
        color: aqua,
        data: REFUGEE_PANEL.series,
        ticks: REFUGEE_PANEL.ticks,
        xLabels: REFUGEE_PANEL.xLabels,
      }),
  },
  {
    id: 'us-interest',
    title: 'US-Zinszahlungen des Bundes',
    draw: (f) =>
      areaChart(f, {
        label: 'US-Zinslast · jährlich',
        value: US_INTEREST_PANEL.latest,
        fmt: (v) => `$${(v / 1e12).toFixed(2)}T`,
        delta: US_INTEREST_PANEL.yoyPct,
        seed: 71,
        color: yellow,
        data: US_INTEREST_PANEL.series,
        ticks: US_INTEREST_PANEL.ticks,
        xLabels: US_INTEREST_PANEL.xLabels,
      }),
  },
  {
    id: 'overdose',
    title: 'US-Drogentote (Überdosis)',
    draw: (f) =>
      areaChart(f, {
        label: 'US-Überdosis-Tote · jährlich',
        value: OVERDOSE_PANEL.latest,
        fmt: (v) => `${Math.round(v / 1000)}k`,
        delta: OVERDOSE_PANEL.yoyPct,
        seed: 73,
        color: orange,
        data: OVERDOSE_PANEL.series,
        ticks: OVERDOSE_PANEL.ticks,
        xLabels: OVERDOSE_PANEL.xLabels,
      }),
  },
  {
    id: 'debt-gdp',
    title: 'Staatsschulden · % des BIP',
    draw: (f) =>
      hBarChart(f, {
        // IMF World Economic Outlook estimates (general government gross
        // debt, 2024/25) — revised twice a year, no keyless live API.
        label: 'Staatsschulden / BIP · IWF',
        value: 93, // global public debt-to-GDP
        fmt: (v) => `${Math.round(v)}%`,
        rowFmt: (v) => `${Math.round(v)}%`,
        delta: null,
        color: violet,
        unit: '',
        rows: [
          { name: 'Japan', v: 237 },
          { name: 'Griechenland', v: 148 },
          { name: 'Italien', v: 137 },
          { name: 'USA', v: 123 },
          { name: 'Frankreich', v: 113 },
          { name: 'Kanada', v: 107 },
          { name: 'Belgien', v: 105 },
          { name: 'Spanien', v: 102 },
          { name: 'Großbritannien', v: 101 },
          { name: 'Portugal', v: 94 },
        ],
      }),
  },
  {
    id: 'pop-share',
    title: 'Anteile an der Weltbevölkerung',
    draw: (f) =>
      treemap(f, {
        // UN World Population Prospects 2024 (millions).
        label: 'Bevölkerungsanteile · UN 2024',
        value: 8.16e9,
        fmt: (v) => `${(v / 1e9).toFixed(2)}B`,
        rows: [
          { name: 'Indien', v: 1451 },
          { name: 'China', v: 1419 },
          { name: 'USA', v: 345 },
          { name: 'Indonesien', v: 284 },
          { name: 'Pakistan', v: 251 },
          { name: 'Nigeria', v: 233 },
          { name: 'Brasilien', v: 212 },
          { name: 'Bangladesch', v: 174 },
          { name: 'Russland', v: 144 },
          { name: 'Mexiko', v: 131 },
          { name: 'Rest der Welt', v: 3516, muted: true },
        ],
      }),
  },
  trendCard('life-exp', 'Globale Lebenserwartung', 'Lebenserwartung · seit 1900', LIFE_PANEL, green, (v) => `${v.toFixed(1)}y`, 89),
  trendCard('m2', 'US-Geldmenge · M2', 'US-Geldmenge M2', M2_PANEL, yellow, (v) => `$${(v / 1e12).toFixed(1)}T`, 97),
  trendCard('internet', 'Menschen online weltweit', 'Internetnutzer · ITU', INTERNET_PANEL, blue, (v) => `${(v / 1e9).toFixed(1)}B`, 103),
  trendCard('nuke-tests', 'Atomtests pro Jahr', 'Atomtests · seit 1945', NUKE_TESTS_PANEL, red, (v) => `${Math.round(v)}`, 107),
  trendCard('obesity', 'Adipositas weltweit', 'Adipositas-Quote', OBESITY_PANEL, magenta, (v) => `${v.toFixed(0)}%`, 109),
  {
    id: 'fertility',
    title: 'Geburtenrate der Kontinente',
    draw: (f) =>
      lineChart(f, {
        label: 'Geburten pro Frau · UN',
        value: CONTINENT_FERTILITY.world,
        unit: '',
        fmt: (v) => v.toFixed(1),
        delta: null,
        seed: 113,
        series: [
          { name: 'Afrika', color: orange, data: CONTINENT_FERTILITY.rows[0].data },
          { name: 'Asien', color: aqua, data: CONTINENT_FERTILITY.rows[1].data },
          { name: 'Lateinamerika', color: magenta, data: CONTINENT_FERTILITY.rows[2].data },
          { name: 'Nordamerika', color: blue, data: CONTINENT_FERTILITY.rows[3].data },
          { name: 'Europa', color: violet, data: CONTINENT_FERTILITY.rows[4].data },
        ],
        ticks: CONTINENT_FERTILITY.ticks,
        xLabels: ['1900', '1941', '1983', 'heute'],
      }),
  },
  trendCard('dollar', 'Kaufkraft des Dollars seit 1913', '1913er-Dollar · Restwert', DOLLAR_PANEL, yellow, (v) => `${(v * 100).toFixed(0)}¢`, 127),
  {
    id: 'pandemics',
    title: 'Tödlichste Pandemien',
    draw: (f) =>
      hBarChart(f, {
        // Midpoint estimates; death tolls this old are ranges, not counts.
        label: 'Tödlichste Pandemien',
        value: 300e6,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Pocken · 20. Jh.', v: 300e6 },
          { name: 'Schwarzer Tod', v: 100e6 },
          { name: 'Spanische Grippe', v: 50e6 },
          { name: 'HIV/AIDS', v: 42e6 },
          { name: 'Justinianische Pest', v: 40e6 },
          { name: 'COVID-19', v: 21e6 },
        ],
      }),
  },
  {
    id: 'armies',
    title: 'Größte Armeen · aktive Soldaten',
    draw: (f) =>
      hBarChart(f, {
        // IISS Military Balance 2024, active-duty personnel.
        label: 'Größte Armeen · aktiv',
        value: 2.04e6,
        delta: null,
        color: orange,
        unit: '',
        rows: [
          { name: 'China', v: 2_035_000 },
          { name: 'Indien', v: 1_460_000 },
          { name: 'USA', v: 1_330_000 },
          { name: 'Russland', v: 1_320_000 },
          { name: 'Nordkorea', v: 1_280_000 },
          { name: 'Pakistan', v: 654_000 },
          { name: 'Iran', v: 610_000 },
          { name: 'Südkorea', v: 500_000 },
          { name: 'Vietnam', v: 482_000 },
          { name: 'Ägypten', v: 440_000 },
        ],
      }),
  },
  {
    id: 'reserve-fx',
    title: 'Weltreservewährungen',
    draw: (f) =>
      treemap(f, {
        // IMF COFER, allocated FX reserves Q3 2024 (shares in %).
        label: 'Reservewährungen · IWF',
        value: 12.3e12,
        fmt: (v) => `$${(v / 1e12).toFixed(1)}T`,
        rows: [
          { name: 'US-Dollar', v: 57.8 },
          { name: 'Euro', v: 20.0 },
          { name: 'Yen', v: 5.7 },
          { name: 'Pfund', v: 4.9 },
          { name: 'Kanad. Dollar', v: 2.8 },
          { name: 'Renminbi', v: 2.2 },
          { name: 'Austral. Dollar', v: 2.2 },
          { name: 'Andere', v: 4.4, muted: true },
        ],
      }),
  },
  {
    id: 'energy-mix',
    title: 'Globaler Energiemix',
    draw: (f) =>
      treemap(f, {
        // Share of primary energy 2023 (Energy Institute Statistical Review).
        label: 'Primärenergie · 2023',
        value: 620,
        fmt: (v) => `${Math.round(v)} EJ`,
        rows: [
          { name: 'Öl', v: 31.7 },
          { name: 'Kohle', v: 26.5 },
          { name: 'Gas', v: 23.3 },
          { name: 'Wasserkraft', v: 6.4 },
          { name: 'Kernkraft', v: 4.0 },
          { name: 'Wind', v: 3.5 },
          { name: 'Solar', v: 2.1 },
          { name: 'Andere', v: 2.5, muted: true },
        ],
      }),
  },
  {
    id: 'wealth',
    title: 'Globale Vermögensverteilung',
    draw: (f) =>
      hBarChart(f, {
        // UBS Global Wealth Report 2024 — Anteil am weltweiten Nettovermögen.
        // Die ärmere Hälfte der Menschheit hält zusammen rund 1 Prozent.
        label: 'Vermögensanteile · UBS',
        value: 454e12,
        fmt: (v) => `$${Math.round(v / 1e12)}T`,
        rowFmt: (v) => `${Math.round(v)}%`,
        delta: null,
        color: yellow,
        unit: '',
        rows: [
          { name: 'Reichstes 1 %', v: 46 },
          { name: 'Nächste 9 %', v: 39 },
          { name: 'Mittlere 40 %', v: 14 },
          { name: 'Ärmere Hälfte (50 %)', v: 1 },
        ],
      }),
  },
  {
    id: 'recent-wars',
    title: 'Tote der jüngsten Kriege',
    draw: (f) =>
      hBarChart(f, {
        // Mittelwerte gängiger Schätzungen (SOHR, UN, AU, Costs of War);
        // teils inkl. indirekter Opfer — die Spannen sind groß.
        label: 'Kriegstote · seit 2000',
        value: 2.56e6,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Syrien · seit 2011', v: 610_000 },
          { name: 'Tigray · 2020–22', v: 600_000 },
          { name: 'Jemen · 2014–22', v: 377_000 },
          { name: 'Ukraine · seit 2022', v: 300_000 },
          { name: 'Irak · 2003–11', v: 280_000 },
          { name: 'Afghanistan · 2001–21', v: 176_000 },
          { name: 'Sudan · seit 2023', v: 150_000 },
          { name: 'Gaza · seit 2023', v: 68_000 },
        ],
      }),
  },
  {
    id: 'wiki',
    title: 'Wikipedia · Top-Artikel',
    draw: (f) => {
      const wk = live.wiki;
      hBarChart(f, {
        label: 'Wikipedia · Top heute',
        value: wk?.topViews ?? 412_000,
        delta: null,
        color: blue,
        unit: '',
        rows: wk?.rows ?? [
          { name: 'Todesfälle 2026', v: 168_000 },
          { name: 'ChatGPT', v: 112_000 },
          { name: 'Bitcoin', v: 64_000 },
          { name: 'Deutschland', v: 44_000 },
          { name: 'Zweiter Weltkrieg', v: 24_000 },
        ],
      });
    },
  },
  {
    id: 'swiss-trends',
    title: 'Schweizer Trends · Wikipedia',
    draw: (f) => {
      const s = live.swiss;
      hBarChart(f, {
        label: 'Schweizer Trends · Wikipedia',
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

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Each page load shuffles the whole pool once; the carousel then shows the
 * first `count` entries (user-adjustable), so raising the count only appends
 * panels without reshuffling the ones already on screen.
 */
export const ALL_DASHBOARDS: Dashboard[] = shuffled(POOL);

/** Panels shown by default; the count control moves between the bounds. */
export const DEFAULT_COUNT = 9;
export const MIN_COUNT = 5;

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
