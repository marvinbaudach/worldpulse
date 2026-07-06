import {
  areaChart,
  choroplethMap,
  debtClock,
  hBarChart,
  lineChart,
  nukeMap,
  timelineChart,
  treemap,
  wealthSplit,
} from './charts';
import { SERIES } from './theme';
import { CHINA_SURVEILLANCE, CPI_INVERTED, EU_DEBT_ABS, NUKE_STATES, NUKE_TOTAL } from './geo';
import type { Dashboard } from './types';
import { live, type TrendSeries } from '../data/store';
import {
  AI_JOBS_COMPARE,
  CAMERAS_PANEL,
  CASHLESS_COMPARE,
  CLIMATE_PANEL,
  CONFLICT_PANEL,
  DATA_REQUESTS,
  DEBT_TREND_FALLBACK,
  DOLLAR_PANEL,
  CONTINENT_FERTILITY,
  INTERNET_PANEL,
  SHUTDOWN_PANEL,
  LIFE_PANEL,
  DE_FOREIGN_SUSPECTS_PANEL,
  DE_INSOLVENCY_CLAIMS_PANEL,
  DE_INSOLVENCY_PANEL,
  DE_MIGRATION_PANEL,
  INDUSTRY_COMPARE,
  GDP_COMPARE,
  M2_COMPARE,
  M2_PANEL,
  NUKE_TESTS_PANEL,
  OBESITY_PANEL,
  OVERDOSE_PANEL,
  PISA_DE,
  REFUGEE_PANEL,
  SWISS_POP_FALLBACK,
  TEEN_SADNESS,
  US_HOMICIDE_PANEL,
  US_INTEREST_PANEL,
  US_OBESITY_FASTFOOD,
  WORLD_POP_FALLBACK,
} from '../data/bundled';

export { type Dashboard, SETTLED_T } from './types';
export { type DashboardTexture, createDashboardTexture } from './texture';

/** Filter chips shown in the bottom bar, in display order. */
export const TAGS: { id: string; label: string }[] = [
  { id: 'geld', label: 'GELD' },
  { id: 'krieg', label: 'KRIEG' },
  { id: 'deutschland', label: 'DEUTSCHLAND' },
  { id: 'soziales', label: 'SOZIALES' },
  { id: 'gesundheit', label: 'GESUNDHEIT' },
  { id: 'schweiz', label: 'SCHWEIZ' },
  { id: 'welt', label: 'WELT' },
];

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
 * The panel pool — live public data (US Treasury, World Bank, Open-Meteo,
 * Wikimedia). Every config is built inside `draw`, so a panel picks up its
 * dataset on the very next frame after the fetcher fills the store; until
 * then it falls back to the seeded demo series. Each page load shows a
 * random selection (see ALL_DASHBOARDS below). Map reference datasets live
 * in geo.ts, the bundled historical series in ../data/bundled.
 */
const POOL: Dashboard[] = [
  {
    id: 'military',
    title: 'Militärausgaben · Top 10',
    dynamic: true,
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
    dynamic: true,
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
    dynamic: true,
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
    dynamic: true,
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
          { name: '🇧🇷', color: green, data: hm?.bra },
          { name: '🇷🇺', color: red, data: hm?.rus },
          { name: '🇺🇸', color: blue, data: hm?.usa },
          { name: '🇩🇪', color: yellow, data: hm?.deu },
          { name: '🇨🇭', color: violet, data: hm?.che },
          { name: '🇯🇵', color: magenta, data: hm?.jpn },
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
    dynamic: true,
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
    dynamic: true,
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
  trendCard('us-homicide', 'Mordrate USA · seit 1900', 'Mordrate · 🇺🇸 · pro 100k', US_HOMICIDE_PANEL, red, (v) => v.toFixed(1), 163),
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
          { name: 'Großbritannien', v: 101 },
          { name: 'China', v: 88 },
          { name: 'Deutschland', v: 63 },
          { name: 'Schweiz', v: 38 },
          { name: 'Russland', v: 20 },
        ],
      }),
  },
  {
    id: 'eu-debt-map',
    title: 'Größte Schuldenberge der EU',
    draw: (f) =>
      choroplethMap(f, {
        // Europe window of the world map, shaded by ABSOLUTE debt so it reads
        // as systemic threat: the big economies carrying trillions (France,
        // Italy, Germany) burn darkest, not tiny highly-indebted Greece.
        label: 'Staatsschulden · EU · absolut',
        value: 14.6e12,
        fmt: (v) => `${(v / 1e12).toFixed(1)} Bio €`,
        valueByIso: EU_DEBT_ABS,
        world: live.worldMap,
        bounds: { lonMin: -12, lonMax: 35, latMin: 34, latMax: 71 },
        rows: [
          { name: 'Frankreich', v: 3305e9 },
          { name: 'Italien', v: 2970e9 },
          { name: 'Deutschland', v: 2690e9 },
          { name: 'Spanien', v: 1620e9 },
          { name: 'Belgien', v: 635e9 },
        ],
        rowFmt: (v) => `${(v / 1e12).toFixed(2)} Bio €`,
        source: 'Eurostat 2024 · Bruttostaatsschulden absolut',
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
          { name: 'Indien', v: 1451, short: '🇮🇳' },
          { name: 'China', v: 1419, short: '🇨🇳' },
          { name: 'USA', v: 345, short: '🇺🇸' },
          { name: 'Indonesien', v: 284, short: '🇮🇩' },
          { name: 'Pakistan', v: 251, short: '🇵🇰' },
          { name: 'Nigeria', v: 233, short: '🇳🇬' },
          { name: 'Brasilien', v: 212, short: '🇧🇷' },
          { name: 'Bangladesch', v: 174, short: '🇧🇩' },
          { name: 'Russland', v: 144, short: '🇷🇺' },
          { name: 'Mexiko', v: 131, short: '🇲🇽' },
          { name: 'Rest der Welt', v: 3516, muted: true },
        ],
      }),
  },
  trendCard('life-exp', 'Globale Lebenserwartung', 'Lebenserwartung · seit 1900', LIFE_PANEL, green, (v) => `${v.toFixed(1)}y`, 89),
  {
    id: 'm2',
    title: 'Geldmenge · USA vs. Schweiz',
    draw: (f) =>
      lineChart(f, {
        // M2 growth indexed to 2000 = 1x — comparable across currencies.
        label: 'Geldmenge M2 · 2000 = 1×',
        value: M2_COMPARE.usLatest,
        unit: '',
        fmt: (v) => `${v.toFixed(1)}×`,
        delta: null,
        seed: 97,
        series: [
          { name: '🇺🇸 USA', color: yellow, data: M2_COMPARE.rows[0].data },
          { name: '🇪🇺 Euro', color: violet, data: M2_COMPARE.rows[1].data },
          { name: '🇨🇭 CHF', color: red, data: M2_COMPARE.rows[2].data },
        ],
        ticks: M2_COMPARE.ticks,
        xLabels: ['1995', '2005', '2014', 'heute'],
      }),
  },
  trendCard('m2-history', 'US-Geldmenge seit 1900', 'US-Geldmenge M2 · seit 1900', M2_PANEL, yellow, (v) => `$${(v / 1e12).toFixed(1)}T`, 97),
  {
    id: 'ai-jobs',
    title: 'KI und Berufseinstieg · USA',
    draw: (f) =>
      lineChart(f, {
        // Since 2023 the recent-graduate rate decouples from the overall
        // one — the entry-level rungs AI automates first.
        label: 'Arbeitslos · 🇺🇸 Absolventen vs. Gesamt',
        value: AI_JOBS_COMPARE.gradLatest,
        unit: '',
        fmt: (v) => `${v.toFixed(1)}%`,
        delta: null,
        seed: 157,
        series: [
          { name: 'Absolventen', color: magenta, data: AI_JOBS_COMPARE.rows[0].data },
          { name: 'Gesamt', color: blue, data: AI_JOBS_COMPARE.rows[1].data },
        ],
        ticks: AI_JOBS_COMPARE.ticks,
        xLabels: ['2015', '2018', '2022', 'heute'],
      }),
  },
  {
    id: 'youth-unemployment',
    title: 'Jugendarbeitslosigkeit international',
    draw: (f) =>
      hBarChart(f, {
        // Youth unemployment rate (ages 15–24), OECD/Eurostat/ILO
        // harmonised 2024 figures. Southern Europe still tops the list a
        // decade after the euro crisis; Switzerland and Germany, with their
        // dual apprenticeship systems, anchor the low end.
        label: 'Jugendarbeitslosigkeit · 15–24 J. · 2024',
        value: 14.9,
        fmt: (v) => `Ø ${v.toFixed(1)}%`,
        rowFmt: (v) => `${v.toFixed(1)}%`,
        delta: null,
        color: orange,
        unit: '',
        rows: [
          { name: 'Spanien', v: 26.5 },
          { name: 'Schweden', v: 22.5 },
          { name: 'Italien', v: 20.3 },
          { name: 'Frankreich', v: 17.2 },
          { name: 'China (Stadt)', v: 17.1 },
          { name: 'EU-27', v: 14.9 },
          { name: 'USA', v: 9.0 },
          { name: 'Schweiz', v: 8.0 },
          { name: 'Deutschland', v: 6.8 },
          { name: 'Japan', v: 4.0 },
        ],
      }),
  },
  {
    id: 'unemployment',
    title: 'Arbeitslosigkeit international',
    draw: (f) =>
      hBarChart(f, {
        // Harmonised unemployment rate, all ages, OECD/Eurostat 2024
        // (comparable definition, not national registered rates). Spain and
        // France lead; Germany, Japan and Switzerland sit at the low end.
        label: 'Arbeitslosenquote · harmonisiert · 2024',
        value: 5.9,
        fmt: (v) => `Ø ${v.toFixed(1)}%`,
        rowFmt: (v) => `${v.toFixed(1)}%`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Spanien', v: 11.4 },
          { name: 'Griechenland', v: 9.4 },
          { name: 'Schweden', v: 8.4 },
          { name: 'Frankreich', v: 7.4 },
          { name: 'Italien', v: 6.5 },
          { name: 'EU-27', v: 5.9 },
          { name: 'Schweiz', v: 4.3 },
          { name: 'USA', v: 4.1 },
          { name: 'Deutschland', v: 3.4 },
          { name: 'Japan', v: 2.5 },
        ],
      }),
  },
  {
    id: 'poverty',
    title: 'Armut international',
    draw: (f) =>
      hBarChart(f, {
        // Relative income poverty: share living on under 50 % of the
        // national median disposable income (OECD, latest year). The US
        // and Japan top the list of rich nations; Switzerland and Germany
        // sit in the middle, the Nordics lowest.
        label: 'Armutsquote · < 50 % Medianeinkommen · OECD',
        value: 11.4,
        fmt: (v) => `Ø ${v.toFixed(1)}%`,
        rowFmt: (v) => `${v.toFixed(1)}%`,
        delta: null,
        color: violet,
        unit: '',
        rows: [
          { name: 'USA', v: 18.0 },
          { name: 'Japan', v: 15.7 },
          { name: 'Spanien', v: 14.7 },
          { name: 'Italien', v: 14.4 },
          { name: 'Großbritannien', v: 11.2 },
          { name: 'Deutschland', v: 10.9 },
          { name: 'Schweiz', v: 9.9 },
          { name: 'Schweden', v: 9.3 },
          { name: 'Frankreich', v: 8.4 },
          { name: 'Dänemark', v: 6.5 },
        ],
      }),
  },
  trendCard('de-insolvenzen', 'Firmeninsolvenzen Deutschland', 'Firmeninsolvenzen · 🇩🇪 · Destatis', DE_INSOLVENCY_PANEL, red, (v) => `${(v / 1000).toFixed(1)}k`, 137),
  trendCard('de-insolvenz-schaden', 'Insolvenz-Schäden Deutschland', 'Gläubigerforderungen · 🇩🇪 · Mrd €', DE_INSOLVENCY_CLAIMS_PANEL, orange, (v) => `${Math.round(v)} Mrd €`, 167),
  {
    id: 'de-industry',
    title: 'Industrieproduktion · DEU vs. USA vs. China',
    draw: (f) =>
      lineChart(f, {
        // Industrial production indexed to 2015 = 100; the headline
        // tracks Germany's slide from the 2018 peak.
        label: 'Industrie · 🇩🇪 · 2015 = 100',
        value: INDUSTRY_COMPARE.deuLatest,
        unit: '',
        fmt: (v) => `${v.toFixed(0)}`,
        delta: null,
        seed: 139,
        series: [
          { name: '🇨🇳 China', color: red, data: INDUSTRY_COMPARE.rows[0].data },
          { name: '🇺🇸 USA', color: blue, data: INDUSTRY_COMPARE.rows[1].data },
          { name: '🇩🇪 DEU', color: yellow, data: INDUSTRY_COMPARE.rows[2].data },
        ],
        ticks: INDUSTRY_COMPARE.ticks,
        xLabels: ['1950', '1975', '2000', 'heute'],
      }),
  },
  trendCard('de-migration', 'Migrationsanteil Deutschland', 'Migrationshintergrund · 🇩🇪', DE_MIGRATION_PANEL, aqua, (v) => `${v.toFixed(1)}%`, 149),
  trendCard('de-crime-foreign', 'Nichtdeutsche Tatverdächtige · Anteil laut PKS', 'Nichtdeutsche Tatverdächtige · 🇩🇪', DE_FOREIGN_SUSPECTS_PANEL, magenta, (v) => `${v.toFixed(1)}%`, 151),
  {
    id: 'gdp-growth',
    title: 'Wirtschaftsleistung im Vergleich',
    draw: (f) =>
      lineChart(f, {
        // Real GDP indexed to 2015 = 1x; the headline tracks Germany,
        // whose economy has been flat to shrinking since 2019.
        label: 'BIP real · 🇩🇪 · 2015 = 1×',
        value: GDP_COMPARE.deuLatest,
        unit: '',
        fmt: (v) => `${v.toFixed(2)}×`,
        delta: null,
        seed: 131,
        series: [
          { name: '🇮🇳 IND', color: yellow, data: GDP_COMPARE.rows[0].data },
          { name: '🇨🇳 CHN', color: red, data: GDP_COMPARE.rows[1].data },
          { name: '🇺🇸 USA', color: blue, data: GDP_COMPARE.rows[2].data },
          { name: '🇩🇪 DEU', color: green, data: GDP_COMPARE.rows[3].data },
          { name: '🇯🇵 JPN', color: violet, data: GDP_COMPARE.rows[4].data },
        ],
        ticks: GDP_COMPARE.ticks,
        xLabels: ['2010', '2015', '2020', 'heute'],
      }),
  },
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
          { name: 'Afrika', color: red, data: CONTINENT_FERTILITY.rows[0].data },
          { name: 'Asien', color: green, data: CONTINENT_FERTILITY.rows[1].data },
          { name: 'Lateinamerika', color: yellow, data: CONTINENT_FERTILITY.rows[2].data },
          { name: 'Nordamerika', color: blue, data: CONTINENT_FERTILITY.rows[3].data },
          { name: 'Europa', color: violet, data: CONTINENT_FERTILITY.rows[4].data },
        ],
        ticks: CONTINENT_FERTILITY.ticks,
        xLabels: ['1900', '1941', '1983', 'heute'],
      }),
  },
  trendCard('dollar', 'Kaufkraft des Dollars seit 1913', '1913er-Dollar · Restwert', DOLLAR_PANEL, yellow, (v) => `${(v * 100).toFixed(0)}¢`, 127),
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
      wealthSplit(f, {
        // UBS Global Wealth Report 2024 — share of global net wealth per
        // population group. The poorer half of humanity holds ~1 percent.
        label: 'Wem gehört das Vermögen?',
        value: 454e12,
        fmt: (v) => `$${Math.round(v / 1e12)}T`,
        axisTop: 'Bevölkerung',
        axisBottom: 'Vermögen',
        groups: [
          { name: 'Reichstes 1 %', pop: 1, wealth: 46, color: red },
          { name: 'Nächste 9 %', pop: 9, wealth: 39, color: yellow },
          { name: 'Mittlere 40 %', pop: 40, wealth: 14, color: blue },
          { name: 'Ärmere Hälfte', pop: 50, wealth: 1, color: '#4a5468' },
        ],
        source: 'UBS Global Wealth Report 2024',
      }),
  },
  {
    id: 'incarceration',
    title: 'Gefängnisquote international',
    draw: (f) =>
      hBarChart(f, {
        // World Prison Brief (2023–25 figures), prisoners per 100k
        // population, shown as share of the population behind bars.
        // Germany and Japan anchor the low end for contrast.
        label: 'Inhaftierte · Anteil der Bevölkerung',
        value: 11.5e6,
        fmt: (v) => `${(v / 1e6).toFixed(1)} Mio`,
        rowFmt: (v) => `${(v / 1000).toFixed(2)} %`,
        delta: null,
        color: violet,
        unit: '',
        rows: [
          { name: 'El Salvador', v: 1086 },
          { name: 'Kuba', v: 794 },
          { name: 'Ruanda', v: 637 },
          { name: 'USA', v: 531 },
          { name: 'Türkei', v: 408 },
          { name: 'Brasilien', v: 390 },
          { name: 'Russland', v: 300 },
          { name: 'Schweiz', v: 73 },
          { name: 'Deutschland', v: 67 },
          { name: 'Japan', v: 33 },
        ],
      }),
  },
  {
    id: 'obesity-nations',
    title: 'Adipositas international',
    draw: (f) =>
      hBarChart(f, {
        // Adult obesity prevalence (BMI >= 30), WHO / NCD-RisC 2022
        // estimates. Nauru tops the global list; Japan and Vietnam
        // anchor the low end for contrast.
        label: 'Adipositas · Anteil der Erwachsenen',
        value: 8.9e8,
        fmt: (v) => `${(v / 1e6).toFixed(0)} Mio`,
        rowFmt: (v) => `${v.toFixed(0)} %`,
        delta: null,
        color: orange,
        unit: '',
        rows: [
          { name: 'Nauru', v: 66 },
          { name: 'Kuwait', v: 45 },
          { name: 'USA', v: 42 },
          { name: 'Ägypten', v: 39 },
          { name: 'Türkei', v: 37 },
          { name: 'Mexiko', v: 36 },
          { name: 'Deutschland', v: 23 },
          { name: 'Schweiz', v: 12 },
          { name: 'China', v: 8 },
          { name: 'Japan', v: 5 },
        ],
      }),
  },
  {
    id: 'life-exp-nations',
    title: 'Lebenserwartung international',
    draw: (f) =>
      hBarChart(f, {
        // Life expectancy at birth, both sexes (UN WPP 2024 / OWID,
        // rounded). Top and bottom of the global range plus Germany,
        // the US and India as reference points in between.
        label: 'Lebenserwartung · Jahre · UN 2024',
        value: 73.3,
        fmt: (v) => `Ø ${v.toFixed(1)} J.`,
        rowFmt: (v) => `${v.toFixed(1)} J.`,
        delta: null,
        color: green,
        unit: '',
        rows: [
          { name: 'Monaco', v: 86.4 },
          { name: 'Japan', v: 84.7 },
          { name: 'Schweiz', v: 84.0 },
          { name: 'Singapur', v: 83.7 },
          { name: 'Deutschland', v: 81.4 },
          { name: 'USA', v: 79.3 },
          { name: 'Indien', v: 72.0 },
          { name: 'Nigeria', v: 54.6 },
          { name: 'Tschad', v: 53.7 },
          { name: 'Lesotho', v: 53.6 },
        ],
      }),
  },
  {
    id: 'tax-burden',
    title: 'Steuer- und Abgabenlast',
    draw: (f) =>
      hBarChart(f, {
        // OECD tax wedge 2024: income tax plus employee and employer
        // social contributions, single earner without children, as a
        // share of total labor cost. Germany is second-highest in the
        // OECD; Switzerland sits near the bottom.
        label: 'Abgabenkeil · Single · OECD 2024',
        value: 34.9,
        fmt: (v) => `Ø ${v.toFixed(1)}%`,
        rowFmt: (v) => `${v.toFixed(1)}%`,
        delta: null,
        color: yellow,
        unit: '',
        rows: [
          { name: 'Belgien', v: 52.6 },
          { name: 'Deutschland', v: 47.9 },
          { name: 'Frankreich', v: 47.2 },
          { name: 'Österreich', v: 47.1 },
          { name: 'Italien', v: 45.1 },
          { name: 'Schweden', v: 42.4 },
          { name: 'Spanien', v: 40.7 },
          { name: 'Großbritannien', v: 31.3 },
          { name: 'USA', v: 30.1 },
          { name: 'Schweiz', v: 22.9 },
        ],
      }),
  },
  {
    id: 'power-prices',
    title: 'Strompreise für Haushalte',
    draw: (f) =>
      hBarChart(f, {
        // Household electricity prices incl. taxes, euro cents per kWh,
        // rounded 2024 figures (Eurostat / GlobalPetrolPrices). Germany
        // is among the most expensive markets worldwide.
        label: 'Strompreis · Haushalte · ct/kWh',
        value: 40,
        fmt: (v) => `${v.toFixed(0)} ct`,
        rowFmt: (v) => `${v.toFixed(0)} ct`,
        delta: null,
        color: blue,
        unit: '',
        rows: [
          { name: 'Deutschland', v: 40 },
          { name: 'Dänemark', v: 38 },
          { name: 'Irland', v: 37 },
          { name: 'Italien', v: 35 },
          { name: 'Großbritannien', v: 34 },
          { name: 'Österreich', v: 30 },
          { name: 'Schweiz', v: 28 },
          { name: 'Frankreich', v: 27 },
          { name: 'USA', v: 15 },
          { name: 'China', v: 8 },
        ],
      }),
  },
  {
    id: 'corruption',
    title: 'Korruption weltweit',
    draw: (f) =>
      choroplethMap(f, {
        // Transparency International CPI 2024, inverted (100 - score) so
        // the most corrupt countries render darkest on the red ramp.
        // The top-5 list below calls out the worst performers.
        label: 'Korruption · dunkler = korrupter',
        value: 57,
        fmt: (v) => `Ø ${v.toFixed(0)}/100`,
        valueByIso: CPI_INVERTED,
        world: live.worldMap,
        rows: [
          { name: 'Südsudan', v: 92 },
          { name: 'Somalia', v: 91 },
          { name: 'Venezuela', v: 90 },
          { name: 'Syrien', v: 88 },
          { name: 'Libyen', v: 87 },
          { name: 'Schweiz', v: 19 },
        ],
        rowFmt: (v) => `${v.toFixed(0)} /100`,
        source: 'Transparency International CPI 2024 · invertiert',
      }),
  },
  {
    id: 'us-wars',
    title: 'Kriege der USA · seit 1945',
    draw: (f) =>
      timelineChart(f, {
        // US wars and interventions as catalogued by Daniele Ganser
        // ("Imperium USA" / "Illegale Kriege"). Death tolls are midpoints
        // of common estimates and heavily contested — treat as magnitudes.
        label: 'US-Kriege · Tote seit 1945',
        value: 6.86e6,
        fmt: (v) => `${(v / 1e6).toFixed(1)} Mio`,
        color: red,
        yearStart: 1946,
        yearEnd: 2026,
        source: 'nach Daniele Ganser · Schätzwerte, teils umstritten',
        events: [
          { name: 'Korea', from: 1950, to: 1953, deaths: 3_000_000 },
          { name: 'Iran · Putsch', from: 1953, deaths: 300 },
          { name: 'Guatemala · Putsch', from: 1954, deaths: 200 },
          { name: 'Kuba · Schweinebucht', from: 1961, deaths: 300 },
          { name: 'Vietnam', from: 1964, to: 1975, deaths: 3_000_000 },
          { name: 'Nicaragua · Contras', from: 1981, to: 1990, deaths: 30_000 },
          { name: 'Golfkrieg', from: 1990, to: 1991, deaths: 100_000 },
          { name: 'Serbien', from: 1999, deaths: 3_500 },
          { name: 'Afghanistan', from: 2001, to: 2021, deaths: 176_000 },
          { name: 'Irak', from: 2003, to: 2011, deaths: 500_000 },
          { name: 'Libyen', from: 2011, deaths: 30_000 },
          { name: 'Syrien', from: 2014, to: 2019, deaths: 20_000 },
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
    id: 'pisa-de',
    title: 'PISA-Absturz Deutschland',
    draw: (f) =>
      lineChart(f, {
        // OECD PISA mean scores; the 2022 cycle is the steepest drop since
        // PISA began, all three domains at record lows.
        label: 'PISA · 🇩🇪 · Punkte',
        value: PISA_DE.deuLatest,
        unit: '',
        fmt: (v) => `${v.toFixed(0)}`,
        delta: null,
        seed: 179,
        series: [
          { name: 'Mathematik', color: blue, data: PISA_DE.rows[0].data },
          { name: 'Lesen', color: yellow, data: PISA_DE.rows[1].data },
          { name: 'Naturwiss.', color: green, data: PISA_DE.rows[2].data },
        ],
        ticks: PISA_DE.ticks,
        xLabels: ['2000', '2007', '2015', '2022'],
      }),
  },
  {
    id: 'teen-depression',
    title: 'Depression bei US-Teenagern',
    draw: (f) =>
      lineChart(f, {
        // CDC YRBS: persistent sadness/hopelessness. The gap opens after
        // ~2012 as smartphones saturate teen life; girls climb far steeper.
        label: 'Anhaltende Niedergeschlagenheit · 🇺🇸 · 14–18 J.',
        value: TEEN_SADNESS.girlsLatest,
        unit: '',
        fmt: (v) => `${v.toFixed(0)}%`,
        delta: null,
        seed: 181,
        series: [
          { name: 'Mädchen', color: magenta, data: TEEN_SADNESS.rows[0].data },
          { name: 'Jungen', color: blue, data: TEEN_SADNESS.rows[1].data },
        ],
        ticks: TEEN_SADNESS.ticks,
        xLabels: ['2011', '2015', '2019', '2023'],
      }),
  },
  {
    id: 'obesity-fastfood',
    title: 'Adipositas USA & die Fast-Food-Ära',
    draw: (f) =>
      lineChart(f, {
        // NHANES adult obesity; the shaded band marks the fast-food era —
        // 1970s drive-throughs and cheap corn syrup, the decades it tripled.
        label: 'Adipositas · 🇺🇸 Erwachsene',
        value: US_OBESITY_FASTFOOD.latest,
        unit: '',
        fmt: (v) => `${v.toFixed(0)}%`,
        delta: null,
        seed: 173,
        series: [{ name: 'Adipositas-Quote', color: orange, data: US_OBESITY_FASTFOOD.data }],
        ticks: US_OBESITY_FASTFOOD.ticks,
        xLabels: ['1962', '1982', '2002', 'heute'],
        shade: { mask: US_OBESITY_FASTFOOD.fastfoodMask, label: '🍔 Fast-Food-Ära' },
      }),
  },
  {
    id: 'surveillance',
    title: 'Am meisten überwachte Städte',
    draw: (f) =>
      hBarChart(f, {
        // Public CCTV cameras per city (Comparitech "Most surveilled cities",
        // rounded). Chinese megacities dominate; Delhi and London are the
        // non-Chinese outliers. Counts are estimates and vary by source.
        label: 'CCTV-Kameras je Stadt · Comparitech · Schätzwerte',
        value: 4.6e6,
        fmt: (v) => `${(v / 1e6).toFixed(1)} Mio`,
        rowFmt: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)} Mio` : `${Math.round(v / 1000)}k`),
        delta: null,
        color: aqua,
        unit: '',
        rows: [
          { name: 'Peking 🇨🇳', v: 1_150_000 },
          { name: 'Shanghai 🇨🇳', v: 1_000_000 },
          { name: 'Delhi 🇮🇳', v: 940_000 },
          { name: 'London 🇬🇧', v: 690_000 },
          { name: 'Chennai 🇮🇳', v: 280_000 },
          { name: 'Moskau 🇷🇺', v: 210_000 },
          { name: 'Singapur 🇸🇬', v: 90_000 },
          { name: 'New York 🇺🇸', v: 74_000 },
          { name: 'Berlin 🇩🇪', v: 40_000 },
          { name: 'Zürich 🇨🇭', v: 15_000 },
        ],
      }),
  },
  trendCard('cameras-world', 'Überwachungskameras weltweit', 'Installierte CCTV-Kameras · IHS · Schätzung', CAMERAS_PANEL, aqua, (v) => `${(v / 1e9).toFixed(2)} Mrd`, 183),
  {
    id: 'internet-shutdowns',
    title: 'Internet-Abschaltungen durch Regierungen',
    draw: (f) =>
      areaChart(f, {
        // Access Now #KeepItOn: government-ordered shutdowns per year.
        label: 'Internet-Shutdowns · pro Jahr · Access Now',
        value: SHUTDOWN_PANEL.latest,
        fmt: (v) => `${Math.round(v)}`,
        delta: SHUTDOWN_PANEL.yoyPct,
        seed: 185,
        color: red,
        data: SHUTDOWN_PANEL.series,
        ticks: SHUTDOWN_PANEL.ticks,
        xLabels: SHUTDOWN_PANEL.xLabels,
      }),
  },
  {
    id: 'gov-data-requests',
    title: 'Behörden-Datenanfragen an Big Tech',
    draw: (f) =>
      lineChart(f, {
        // Google & Meta transparency reports: law-enforcement requests for
        // user data, both climbing steeply.
        label: 'Behördenanfragen nach Nutzerdaten · pro Jahr',
        value: DATA_REQUESTS.metaLatest,
        unit: '',
        fmt: (v) => `${Math.round(v / 1000)}k`,
        delta: null,
        seed: 187,
        series: [
          { name: 'Meta', color: blue, data: DATA_REQUESTS.rows[0].data },
          { name: 'Google', color: yellow, data: DATA_REQUESTS.rows[1].data },
        ],
        ticks: DATA_REQUESTS.ticks,
        xLabels: ['2013', '2017', '2021', 'heute'],
      }),
  },
  {
    id: 'sdg-progress',
    title: 'Agenda 2030 · Stand der SDG-Ziele',
    draw: (f) =>
      treemap(f, {
        // UN Sustainable Development Goals Report 2024: of the assessable
        // targets, only ~17% are on track, a third stagnate or reverse.
        label: 'SDG-Ziele · Stand 2024 · UN',
        value: 100,
        fmt: (v) => `${Math.round(v)}%`,
        rows: [
          { name: 'stagniert / rückläufig', v: 35, short: '⛔' },
          { name: 'zu langsam', v: 48, short: '🐢' },
          { name: 'auf Kurs', v: 17, short: '✅' },
        ],
      }),
  },
  {
    id: 'cbdc',
    title: 'Digitales Zentralbankgeld weltweit',
    draw: (f) =>
      treemap(f, {
        // Atlantic Council CBDC Tracker 2024: 130+ countries exploring a
        // central bank digital currency; only a handful have launched.
        label: 'CBDC-Projekte · Länder · Atlantic Council',
        value: 134,
        fmt: (v) => `${Math.round(v)} Länder`,
        rows: [
          { name: 'Forschung', v: 39, short: '🔬' },
          { name: 'Pilot', v: 44, short: '🧪' },
          { name: 'Entwicklung', v: 20, short: '⚙️' },
          { name: 'gestartet', v: 3, short: '🚀' },
          { name: 'inaktiv', v: 28, short: '💤', muted: true },
        ],
      }),
  },
  {
    id: 'cashless',
    title: 'Weg vom Bargeld',
    draw: (f) =>
      lineChart(f, {
        // Cash share at the point of sale, % of transactions (Riksbank,
        // Bundesbank, ECB SPACE; estimates). Sweden is nearly cashless.
        label: 'Barzahlungen am Ladentisch · Anteil · Schätzwerte',
        value: CASHLESS_COMPARE.sweLatest,
        unit: '',
        fmt: (v) => `${v.toFixed(0)}%`,
        delta: null,
        seed: 189,
        series: [
          { name: 'Eurozone', color: violet, data: CASHLESS_COMPARE.rows[0].data },
          { name: 'Deutschland', color: yellow, data: CASHLESS_COMPARE.rows[1].data },
          { name: 'Schweden', color: aqua, data: CASHLESS_COMPARE.rows[2].data },
        ],
        ticks: CASHLESS_COMPARE.ticks,
        xLabels: ['2016', '2019', '2022', 'heute'],
      }),
  },
  {
    id: 'china-surveillance',
    title: 'Chinas Überwachungstechnik weltweit',
    draw: (f) =>
      choroplethMap(f, {
        // Carnegie AIGS Index + IPVM/press on Huawei/Hikvision/Dahua exports.
        // Darker = state "safe city" system; light = Chinese cameras common.
        label: 'Chinesische Überwachungstechnik · dunkler = Staatssystem',
        value: 80,
        fmt: (v) => `${Math.round(v)} Länder`,
        valueByIso: CHINA_SURVEILLANCE,
        world: live.worldMap,
        rows: [
          { name: 'China · Hersteller', v: 3 },
          { name: 'Ecuador · ECU-911', v: 2 },
          { name: 'Serbien · Belgrad', v: 2 },
          { name: 'Paraguay · Asunción', v: 2 },
          { name: 'Deutschland · Hikvision', v: 1 },
          { name: 'Schweiz · Hikvision', v: 1 },
        ],
        rowFmt: (v) => (v >= 3 ? 'Hersteller' : v >= 2 ? 'Safe-City' : 'Kameras'),
        source: 'Carnegie AIGS-Index / IPVM · dokumentiert, nicht abschließend',
      }),
  },
  {
    id: '5g-stations',
    title: '5G-Ausbau · führende Länder',
    draw: (f) =>
      hBarChart(f, {
        // Installed 5G base stations per country (operator/regulator figures,
        // rounded estimates). China counts base stations in the millions and
        // dwarfs everyone — well over half the world's total.
        label: '5G-Basisstationen · Schätzwerte',
        value: 5.1e6,
        fmt: (v) => `${(v / 1e6).toFixed(1)} Mio`,
        rowFmt: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)} Mio` : `${Math.round(v / 1000)}k`),
        delta: null,
        color: violet,
        unit: '',
        rows: [
          { name: 'China 🇨🇳', v: 3_770_000 },
          { name: 'Indien 🇮🇳', v: 450_000 },
          { name: 'Südkorea 🇰🇷', v: 350_000 },
          { name: 'Japan 🇯🇵', v: 230_000 },
          { name: 'USA 🇺🇸', v: 200_000 },
          { name: 'Deutschland 🇩🇪', v: 90_000 },
          { name: 'Großbritannien 🇬🇧', v: 45_000 },
          { name: 'Schweiz 🇨🇭', v: 15_000 },
        ],
      }),
  },
  {
    id: 'un-resolutions',
    title: 'UN-Resolutionen gegen einzelne Länder',
    draw: (f) =>
      hBarChart(f, {
        // UN General Assembly country-specific resolutions, 2022 session
        // (UN Watch tally). Israel alone draws more than all others combined;
        // the USA appears only via the annual Cuba-embargo resolution.
        label: 'UN-Vollversammlung · Resolutionen gegen Länder · 2022',
        value: 26,
        fmt: (v) => `${Math.round(v)}`,
        rowFmt: (v) => `${Math.round(v)}`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Israel 🇮🇱', v: 15 },
          { name: 'Russland 🇷🇺', v: 6 },
          { name: 'USA (Kuba-Embargo) 🇺🇸', v: 1 },
          { name: 'Iran 🇮🇷', v: 1 },
          { name: 'Nordkorea 🇰🇵', v: 1 },
          { name: 'Syrien 🇸🇾', v: 1 },
          { name: 'Myanmar 🇲🇲', v: 1 },
        ],
      }),
  },
  {
    id: 'un-vetoes',
    title: 'Vetos im UN-Sicherheitsrat',
    draw: (f) =>
      hBarChart(f, {
        // Security Council vetoes 1946–2024 (UN Dag Hammarskjöld Library,
        // rounded). Russia/USSR lead all-time; the USA is second overall and
        // first in recent decades, most often shielding Israel.
        label: 'Vetos im UN-Sicherheitsrat · seit 1946 · gerundet',
        value: 282,
        fmt: (v) => `${Math.round(v)}`,
        rowFmt: (v) => `${Math.round(v)}`,
        delta: null,
        color: orange,
        unit: '',
        rows: [
          { name: 'Russland / UdSSR 🇷🇺', v: 128 },
          { name: 'USA 🇺🇸', v: 87 },
          { name: 'Großbritannien 🇬🇧', v: 29 },
          { name: 'China 🇨🇳', v: 21 },
          { name: 'Frankreich 🇫🇷', v: 16 },
        ],
      }),
  },
  {
    id: 'swiss-trends',
    title: 'Schweizer Trends · Wikipedia',
    dynamic: true,
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

// Theme tags per card; cards may carry several (the industry chart is both
// a Germany and a money story). Applied to the POOL right below.
const TAGS_BY_ID: Record<string, string[]> = {
  military: ['krieg'],
  'us-debt': ['geld'],
  nukes: ['krieg'],
  'homicide-map': ['soziales', 'welt'],
  'homicide-trend': ['soziales', 'schweiz'],
  climate: ['welt'],
  'swiss-pop': ['schweiz', 'soziales'],
  'world-pop': ['welt', 'soziales'],
  'conflict-deaths': ['krieg'],
  refugees: ['krieg', 'soziales'],
  'us-interest': ['geld'],
  overdose: ['gesundheit'],
  'debt-gdp': ['geld', 'deutschland', 'schweiz'],
  'eu-debt-map': ['geld'],
  'pop-share': ['welt', 'soziales'],
  'life-exp': ['gesundheit', 'welt'],
  'life-exp-nations': ['gesundheit', 'schweiz'],
  m2: ['geld', 'schweiz'],
  'm2-history': ['geld'],
  'ai-jobs': ['soziales', 'geld'],
  'youth-unemployment': ['soziales', 'geld', 'schweiz', 'deutschland'],
  unemployment: ['soziales', 'geld', 'schweiz', 'deutschland'],
  poverty: ['soziales', 'geld', 'schweiz', 'deutschland'],
  'de-insolvenzen': ['deutschland', 'geld'],
  'de-insolvenz-schaden': ['deutschland', 'geld'],
  'de-industry': ['deutschland', 'geld'],
  'de-migration': ['deutschland', 'soziales'],
  'de-crime-foreign': ['deutschland', 'soziales'],
  internet: ['welt'],
  'nuke-tests': ['krieg'],
  obesity: ['gesundheit', 'welt'],
  'obesity-nations': ['gesundheit', 'schweiz'],
  'gdp-growth': ['geld', 'deutschland'],
  fertility: ['welt', 'soziales'],
  dollar: ['geld'],
  armies: ['krieg'],
  'reserve-fx': ['geld'],
  'energy-mix': ['welt'],
  wealth: ['geld', 'soziales'],
  'tax-burden': ['geld', 'deutschland', 'schweiz'],
  'power-prices': ['geld', 'deutschland', 'schweiz'],
  incarceration: ['soziales', 'schweiz'],
  corruption: ['soziales', 'welt', 'schweiz'],
  'us-wars': ['krieg'],
  'us-homicide': ['soziales'],
  'recent-wars': ['krieg'],
  'pisa-de': ['deutschland', 'soziales'],
  'teen-depression': ['gesundheit', 'soziales'],
  'obesity-fastfood': ['gesundheit'],
  surveillance: ['welt', 'soziales', 'schweiz'],
  'cameras-world': ['welt', 'soziales'],
  'internet-shutdowns': ['welt', 'soziales'],
  'gov-data-requests': ['welt', 'soziales'],
  'sdg-progress': ['welt'],
  cbdc: ['geld', 'welt'],
  cashless: ['geld', 'welt', 'deutschland'],
  '5g-stations': ['welt', 'deutschland', 'schweiz'],
  'china-surveillance': ['welt', 'soziales', 'deutschland', 'schweiz'],
  'un-resolutions': ['welt', 'krieg'],
  'un-vetoes': ['welt', 'krieg'],
  'swiss-trends': ['schweiz'],
};
for (const d of POOL) d.tags = TAGS_BY_ID[d.id] ?? [];

/**
 * Hand-picked headliners: these lead the ring so the strongest panels sit up
 * front on load; the rest of the pool follows behind them.
 */
const FEATURED = new Set([
  'us-wars', 'corruption', 'incarceration', 'obesity-nations', 'nukes',
  'us-debt', 'us-interest', 'm2', 'dollar', 'wealth', 'homicide-map',
  'world-pop', 'climate', 'de-insolvenzen', 'conflict-deaths', 'refugees',
  'military', 'gdp-growth', 'de-industry', 'recent-wars',
  'youth-unemployment', 'unemployment', 'poverty',
  'pisa-de', 'teen-depression', 'obesity-fastfood', 'surveillance',
  'cameras-world', 'internet-shutdowns', 'gov-data-requests',
  'sdg-progress', 'cbdc', 'cashless', '5g-stations', 'china-surveillance',
  'un-resolutions', 'un-vetoes',
]);

/**
 * Featured panels come first (shuffled among themselves each page load),
 * the remaining pool shuffled after them. The whole pool is on stage; a
 * theme filter narrows it to the tagged cards.
 */
export const ALL_DASHBOARDS: Dashboard[] = [
  ...shuffled(POOL.filter((d) => FEATURED.has(d.id))),
  ...shuffled(POOL.filter((d) => !FEATURED.has(d.id))),
];

/** Floor for the ring radius, so a small filtered set still spaces out well. */
export const MIN_COUNT = 5;
