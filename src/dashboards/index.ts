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
import { CPI_INVERTED, EU_DEBT_GDP, NUKE_STATES, NUKE_TOTAL, US_TROOPS_ABROAD } from './geo';
import type { Dashboard } from './types';
import { live, type TrendSeries } from '../data/store';
import {
  AI_JOBS_COMPARE,
  CAMERAS_PANEL,
  CLIMATE_PANEL,
  CONFLICT_PANEL,
  DATA_REQUESTS,
  DEBT_TREND_FALLBACK,
  DE_FAMILY,
  DE_SINGLE_HH_PANEL,
  DOLLAR_PANEL,
  CONTINENT_FERTILITY,
  INTERNET_PANEL,
  LIFE_PANEL,
  DE_FOREIGN_SUSPECTS_PANEL,
  DE_INSOLVENCY_JOBS_PANEL,
  DE_MIGRATION_PANEL,
  INDUSTRY_COMPARE,
  GDP_COMPARE,
  M2_COMPARE,
  M2_PANEL,
  NUKE_TESTS_PANEL,
  OIL_CONSUMPTION_PANEL,
  OVERDOSE_PANEL,
  REFUGEE_PANEL,
  SWISS_POP_FALLBACK,
  DE_ENERGY_MIX,
  US_ENERGY_MIX,
  SUICIDE_BY_AGE,
  TEEN_MDE,
  TEEN_RX_PANEL,
  TEEN_SCREEN_PANEL,
  US_ALCOHOL_DEATHS_PANEL,
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
  markers?: { at: number; label: string }[],
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
        markers,
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
      // Live World Bank feed (current USD, latest year per country). The
      // fallback below carries the SIPRI 2025 order until the fetch lands.
      const m = live.military;
      hBarChart(f, {
        label: `Militärausgaben · ${m?.year ?? '2025'}`,
        value: m?.total ?? 1.871e12,
        delta: null,
        color: orange,
        unit: '$',
        rows: m?.rows ?? [
          { name: 'USA', v: 954e9 },
          { name: 'China', v: 336e9 },
          { name: 'Russland', v: 190e9 },
          { name: 'Deutschland', v: 114e9 },
          { name: 'Indien', v: 92e9 },
          { name: 'Großbritannien', v: 89e9 },
          { name: 'Saudi-Arabien', v: 83e9 },
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
        // Carl Benz's first automobile (1886) on the 0–2025 axis: the dawn of
        // the fossil-fuel era, right where the population curve goes vertical.
        marker: { at: 1886 / 2025, label: '⛽ Benzin ~1886' },
      });
    },
  },
  {
    id: 'oil-consumption',
    title: 'Weltweiter Ölverbrauch',
    draw: (f) =>
      areaChart(f, {
        label: 'Ölverbrauch · Mio. Barrel/Tag · Energy Institute',
        value: OIL_CONSUMPTION_PANEL.latest,
        fmt: (v) => `${v.toFixed(0)} mb/d`,
        // No delta: a single YoY figure under a 120-year curve reads as if it
        // were the growth over the whole span.
        delta: null,
        seed: 211,
        color: orange,
        data: OIL_CONSUMPTION_PANEL.series,
        ticks: OIL_CONSUMPTION_PANEL.ticks,
        xLabels: OIL_CONSUMPTION_PANEL.xLabels,
        // The 1973 OPEC embargo on the 1900–2023 axis: the first time global
        // oil demand ever fell — the dip right after this line.
        marker: { at: (1973 - 1900) / (2023 - 1900), label: '⛽ Ölkrise 1973' },
      }),
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
        // Dominant spikes labelled directly; `at` is the fraction along the
        // 1900–2024 range, i.e. (year - 1900) / 124.
        markers: [
          { at: 0.13, label: '⚔️ 1. Weltkrieg' },
          { at: 0.36, label: '⚔️ 2. Weltkrieg' },
          { at: 0.76, label: '🇷🇼 Ruanda' },
          { at: 0.98, label: '🇺🇦 Ukraine' },
        ],
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
        // War-start markers on the 1990–2024 axis: the Syrian war (2011) and
        // Ukraine (2014, Euromaidan/Crimea). The big refugee jumps come a few
        // years after each start — the 2013–15 surge for Syria, the 2022 spike
        // for Ukraine's full-scale invasion — so the lines mark the cause, the
        // curve to their right shows the effect.
        markers: [
          { at: (2011 - 1990) / (2024 - 1990), label: '🏴 Syrien 2011' },
          { at: (2014 - 1990) / (2024 - 1990), label: '🇺🇦 Ukraine 2014' },
        ],
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
        // The drug behind each era of the curve, on the 1950–2024 axis: the
        // first heroin wave, the 1980s crack epidemic, the OxyContin/Rx-opioid
        // surge from ~1999, and the fentanyl explosion driving the recent peak.
        markers: [
          { at: (1970 - 1950) / 74, label: 'Heroin' },
          { at: (1986 - 1950) / 74, label: 'Crack' },
          { at: (1999 - 1950) / 74, label: 'OxyContin' },
          { at: (2015 - 1950) / 74, label: 'Fentanyl' },
        ],
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
    title: 'EU-Schuldenquote · % des BIP',
    draw: (f) =>
      choroplethMap(f, {
        // Europe window shaded by the debt-to-GDP RATIO, not the absolute pile:
        // Greece and Italy burn darkest despite far smaller economies than
        // Germany, which sits mid-pack on the ratio.
        label: 'Staatsschulden / BIP · EU',
        value: 82,
        fmt: (v) => `⌀ ${Math.round(v)}%`,
        valueByIso: EU_DEBT_GDP,
        world: live.worldMap,
        bounds: { lonMin: -12, lonMax: 35, latMin: 34, latMax: 71 },
        rows: [
          { name: 'Griechenland', v: 154 },
          { name: 'Italien', v: 135 },
          { name: 'Frankreich', v: 112 },
          { name: 'Belgien', v: 105 },
          { name: 'Spanien', v: 102 },
        ],
        rowFmt: (v) => `${Math.round(v)}%`,
        source: 'Eurostat 2024 · Schuldenquote (% BIP)',
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
  trendCard('life-exp', 'Globale Lebenserwartung', 'Lebenserwartung · seit 1770', LIFE_PANEL, green, (v) => `${v.toFixed(1)}y`, 89, [
    // The two visible notches and the mid-century surge on the 1770–2024 axis.
    { at: (1918 - 1770) / (2024 - 1770), label: '🦠 Grippe 1918' },
    { at: (1945 - 1770) / (2024 - 1770), label: '💊 Antibiotika' },
    { at: (2021 - 1770) / (2024 - 1770), label: '🦠 COVID 2020' },
  ]),
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
  trendCard('m2-history', 'US-Geldmenge seit 1900', 'US-Geldmenge M2 · seit 1900', M2_PANEL, yellow, (v) => `$${(v / 1e12).toFixed(1)}T`, 97, [
    // The turns behind the money-supply explosion on the 1900–2024 axis:
    // the end of gold convertibility and the two big money-printing waves.
    { at: (1971 - 1900) / (2024 - 1900), label: '⛓️‍💥 Gold-Ende 1971' },
    { at: (2008 - 1900) / (2024 - 1900), label: '🏦 QE 2008' },
    { at: (2020 - 1900) / (2024 - 1900), label: '💸 Corona 2020' },
  ]),
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
  trendCard('de-insolvenz-jobs', 'Insolvenzen · betroffene Arbeitsplätze', 'Betroffene Beschäftigte · 🇩🇪 · Creditreform', DE_INSOLVENCY_JOBS_PANEL, red, (v) => `${Math.round(v / 1000)}k`, 137),
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
  trendCard('nuke-tests', 'Atomtests pro Jahr', 'Atomtests · seit 1945', NUKE_TESTS_PANEL, red, (v) => `${Math.round(v)}`, 107, [
    { at: 0.23, label: '☢️ Teststopp 1963' },
    { at: 0.65, label: '✍️ CTBT 1996' },
    { at: 0.91, label: '🇰🇵 Nordkorea' },
  ]),
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
  trendCard('dollar', 'Kaufkraft des Dollars seit 1913', '1913er-Dollar · Restwert', DOLLAR_PANEL, yellow, (v) => `${(v * 100).toFixed(0)}¢`, 127, [
    // Fed founding at the very start, and the 1971 end of the gold peg after
    // which the decline steepens, on the 1913–2024 axis.
    { at: (1913 - 1913) / (2024 - 1913), label: '🏦 Fed 1913' },
    { at: (1971 - 1913) / (2024 - 1913), label: '⛓️‍💥 Gold-Ende 1971' },
  ]),
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
    id: 'us-bases',
    title: 'US-Militärstützpunkte weltweit',
    draw: (f) =>
      choroplethMap(f, {
        // US troops on foreign soil by host country (DoD DMDC, via SIPER).
        // The USA officially runs ~587 bases in at least 42 foreign countries;
        // the map shades each host by troop count, darkest where most sit.
        label: 'US-Truppen im Ausland · ≥ 42 Länder',
        value: 42,
        fmt: (v) => `${v} Länder`,
        valueByIso: US_TROOPS_ABROAD,
        world: live.worldMap,
        rows: [
          { name: 'Japan', v: 53700 },
          { name: 'Deutschland', v: 35000 },
          { name: 'Südkorea', v: 24000 },
          { name: 'Kuwait', v: 13500 },
          { name: 'Italien', v: 12500 },
        ],
        rowFmt: (v) => `${Math.round(v / 1000)}k Soldaten`,
        source: 'DoD DMDC / Base Structure Report · via SIPER',
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
    id: 'teen-mde',
    title: 'Depression bei US-Jugendlichen',
    draw: (f) =>
      lineChart(f, {
        // SAMHSA NSDUH: past-year major depressive episode, ages 12–17. Flat
        // near 8% through 2011, then climbing steeply — tracks the smartphone era.
        label: 'Depressive Episode im Jahr · 🇺🇸 · 12–17 J.',
        value: TEEN_MDE.latest,
        unit: '',
        fmt: (v) => `${v.toFixed(0)}%`,
        delta: null,
        seed: 187,
        series: [{ name: 'Betroffene', color: magenta, data: TEEN_MDE.data }],
        ticks: TEEN_MDE.ticks,
        xLabels: ['2004', '2010', '2016', '2022'],
        shade: { mask: TEEN_MDE.mask, label: '📱 Soziale Medien' },
      }),
  },
  {
    id: 'suicide-by-age',
    title: 'Suizidrate USA nach Altersgruppe · seit 1980',
    draw: (f) =>
      lineChart(f, {
        // CDC WONDER: suicide rate per 100k by age band. Older bands are far
        // higher; the youngest rose fastest relatively. Already high in the
        // 1980s — not a clean single-cause story.
        label: 'Suizidrate · 🇺🇸 · je 100.000',
        value: SUICIDE_BY_AGE.oldestLatest,
        unit: '',
        fmt: (v) => v.toFixed(1),
        delta: null,
        seed: 191,
        series: [
          { name: '10–14 J.', color: yellow, data: SUICIDE_BY_AGE.rows[0].data },
          { name: '15–19 J.', color: orange, data: SUICIDE_BY_AGE.rows[1].data },
          { name: '20–24 J.', color: red, data: SUICIDE_BY_AGE.rows[2].data },
        ],
        ticks: SUICIDE_BY_AGE.ticks,
        xLabels: ['1980', '1994', '2007', '2021'],
      }),
  },
  {
    id: 'teen-screen',
    title: 'Bildschirmzeit US-Teenager',
    draw: (f) =>
      areaChart(f, {
        label: 'Unterhaltungsmedien · 🇺🇸 · 13–18 J. · Std./Tag',
        value: TEEN_SCREEN_PANEL.latest,
        fmt: (v) => `${v.toFixed(1)} h`,
        delta: null,
        seed: 193,
        color: violet,
        data: TEEN_SCREEN_PANEL.series,
        ticks: TEEN_SCREEN_PANEL.ticks,
        xLabels: ['1965', '1985', '2005', 'heute'],
        // Era markers across the 1965–2023 span (fraction of the x-range).
        markers: [
          { at: 0.01, label: '📺 Farb-TV' },
          { at: 0.52, label: '🎮 PlayStation' },
          { at: 0.78, label: '📱 Soziale Medien' },
        ],
      }),
  },
  trendCard('teen-antidepressants', 'Antidepressiva bei US-Jugendlichen', 'Antidepressiva-Rezepte · 🇺🇸 · 12–17 J. · Anteil', TEEN_RX_PANEL, aqua, (v) => `${v.toFixed(1)}%`, 199, [
    // The climb opens with the SSRI era and steepens in the smartphone years,
    // on the 1970–2022 axis. The 2012 line is the correlation, not proof.
    { at: (1988 - 1970) / (2022 - 1970), label: '💊 Prozac 1988' },
    { at: (2012 - 1970) / (2022 - 1970), label: '📱 Soziale Medien' },
  ]),
  {
    id: 'us-energy-mix',
    title: 'US-Strommix · Kohle, Kernkraft, Erneuerbare',
    draw: (f) =>
      lineChart(f, {
        // EIA installed capacity by source: coal retires, nuclear holds flat,
        // wind+solar overtake both. Nameplate GW — the intermittent sources'
        // firm, on-demand output is a fraction of it.
        label: 'Installierte Leistung · 🇺🇸 · GW',
        value: US_ENERGY_MIX.renewLatest,
        unit: '',
        fmt: (v) => `${Math.round(v)} GW`,
        delta: null,
        seed: 217,
        series: [
          { name: 'Kohle', color: orange, data: US_ENERGY_MIX.rows[0].data },
          { name: 'Kernkraft', color: yellow, data: US_ENERGY_MIX.rows[1].data },
          { name: 'Wind + Solar', color: green, data: US_ENERGY_MIX.rows[2].data },
        ],
        ticks: US_ENERGY_MIX.ticks,
        xLabels: ['2000', '2008', '2016', '2023'],
      }),
  },
  {
    id: 'de-energy-mix',
    title: 'Deutscher Strommix · Kohle, Kernkraft, Erneuerbare',
    draw: (f) =>
      lineChart(f, {
        // BNetzA/Fraunhofer installed capacity: nuclear to zero (2023), coal
        // drawn down, wind+solar surge past both. Nameplate GW — the
        // intermittent sources' firm output is a fraction of it.
        label: 'Installierte Leistung · 🇩🇪 · GW',
        value: DE_ENERGY_MIX.renewLatest,
        unit: '',
        fmt: (v) => `${Math.round(v)} GW`,
        delta: null,
        seed: 233,
        series: [
          { name: 'Kohle', color: orange, data: DE_ENERGY_MIX.rows[0].data },
          { name: 'Kernkraft', color: red, data: DE_ENERGY_MIX.rows[1].data },
          { name: 'Wind + Solar', color: green, data: DE_ENERGY_MIX.rows[2].data },
        ],
        ticks: DE_ENERGY_MIX.ticks,
        xLabels: ['1995', '2005', '2015', '2024'],
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
        xLabels: ['1900', '1940', '1980', 'heute'],
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
          { name: 'Bangkok 🇹🇭', v: 60_000 },
          { name: 'Hongkong 🇭🇰', v: 55_000 },
          { name: 'Berlin 🇩🇪', v: 40_000 },
          { name: 'Zürich 🇨🇭', v: 15_000 },
        ],
      }),
  },
  trendCard('cameras-world', 'Überwachungskameras weltweit', 'Installierte CCTV-Kameras · IHS · Schätzung', CAMERAS_PANEL, aqua, (v) => `${(v / 1e9).toFixed(2)} Mrd`, 183),
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
    id: 'gov-requests-country',
    title: 'Behördenanfragen an Big Tech · Top-Länder',
    draw: (f) =>
      hBarChart(f, {
        // Government requests for user data, per year (Meta + Google/Apple
        // transparency reports, approximate, latest reporting period).
        label: 'Behördenanfragen nach Nutzerdaten · pro Jahr · Transparenzberichte',
        value: 410_000,
        delta: null,
        color: blue,
        unit: '',
        fmt: (v) => `${Math.round(v / 1000)}k`,
        rowFmt: (v) => `${Math.round(v / 1000)}k`,
        rows: [
          { name: 'USA', v: 410_000 },
          { name: 'Indien', v: 100_000 },
          { name: 'Brasilien', v: 78_000 },
          { name: 'Großbritannien', v: 65_000 },
          { name: 'Frankreich', v: 62_000 },
          { name: 'Deutschland', v: 45_000 },
          { name: 'Italien', v: 40_000 },
          { name: 'Australien', v: 33_000 },
          { name: 'Spanien', v: 28_000 },
        ],
      }),
  },
  {
    id: 'youtube-removals',
    title: 'Regierungs-Löschanfragen an Google/YouTube',
    draw: (f) =>
      hBarChart(f, {
        // Government requests to remove content, per year (Google Transparency
        // Report, approximate). Russia dominates by a wide margin.
        label: 'Behörden-Löschanfragen · Google/YouTube · Transparenzbericht',
        value: 32_000,
        delta: null,
        color: red,
        unit: '',
        fmt: (v) => `${Math.round(v / 1000)}k`,
        rowFmt: (v) => `${(v / 1000).toFixed(1)}k`,
        rows: [
          { name: 'Russland', v: 32_000 },
          { name: 'Südkorea', v: 10_500 },
          { name: 'Indien', v: 7_000 },
          { name: 'Türkei', v: 6_200 },
          { name: 'Pakistan', v: 4_100 },
          { name: 'Brasilien', v: 3_000 },
        ],
      }),
  },
  {
    id: 'who-pandemic',
    title: 'WHO-Pandemieabkommen · Enthaltungen',
    draw: (f) =>
      treemap(f, {
        // WHA 20 May 2025: adopted by consensus (124 for, 0 against, 11
        // abstentions). All 11 abstainers shown as equal blocks — abstaining
        // is not "refused to sign"; ratification is a separate later step.
        label: 'WHO-Pandemievertrag · 124 dafür · 0 dagegen · Mai 2025',
        value: 11,
        fmt: (v) => `${Math.round(v)} Enthaltungen`,
        rows: [
          { name: 'Russland 🇷🇺', v: 1, short: '🇷🇺' },
          { name: 'Iran 🇮🇷', v: 1, short: '🇮🇷' },
          { name: 'Israel 🇮🇱', v: 1, short: '🇮🇱' },
          { name: 'Italien 🇮🇹', v: 1, short: '🇮🇹' },
          { name: 'Polen 🇵🇱', v: 1, short: '🇵🇱' },
          { name: 'Niederlande 🇳🇱', v: 1, short: '🇳🇱' },
          { name: 'Slowakei 🇸🇰', v: 1, short: '🇸🇰' },
          { name: 'Bulgarien 🇧🇬', v: 1, short: '🇧🇬' },
          { name: 'Ägypten 🇪🇬', v: 1, short: '🇪🇬' },
          { name: 'Paraguay 🇵🇾', v: 1, short: '🇵🇾' },
          { name: 'Jamaika 🇯🇲', v: 1, short: '🇯🇲' },
        ],
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
    id: 'inflation',
    title: 'Höchste Inflation weltweit',
    draw: (f) =>
      hBarChart(f, {
        // Annual consumer-price inflation, ~2024 (IMF/national estimates,
        // rounded). Crisis economies run hot; the values swing month to month,
        // so treat them as magnitudes. Germany anchors the low end.
        label: 'Höchste Inflation · Jahresrate ≈ 2024',
        value: 230,
        fmt: (v) => `${Math.round(v)}%`,
        rowFmt: (v) => `${Math.round(v)}%`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Argentinien 🇦🇷', v: 230 },
          { name: 'Sudan 🇸🇩', v: 145 },
          { name: 'Venezuela 🇻🇪', v: 100 },
          { name: 'Syrien 🇸🇾', v: 90 },
          { name: 'Türkei 🇹🇷', v: 65 },
          { name: 'Iran 🇮🇷', v: 40 },
          { name: 'Nigeria 🇳🇬', v: 33 },
          { name: 'Ägypten 🇪🇬', v: 28 },
          { name: 'Pakistan 🇵🇰', v: 24 },
          { name: 'Deutschland 🇩🇪', v: 2 },
          { name: 'Schweiz 🇨🇭', v: 1 },
        ],
      }),
  },
  {
    id: 'un-resolutions',
    title: 'UN-Resolutionen gegen einzelne Länder',
    draw: (f) =>
      hBarChart(f, {
        // UN General Assembly country-specific resolutions, cumulative since
        // 2015 (UN Watch tallies, rounded): 140 against Israel vs. 68 against
        // all other countries combined. The USA's count is the recurring
        // annual Cuba-embargo resolution.
        label: 'UN-Resolutionen gegen Staaten · seit 2015',
        value: 190,
        fmt: (v) => `${Math.round(v)}`,
        rowFmt: (v) => `${Math.round(v)}`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Israel 🇮🇱', v: 140 },
          { name: 'Russland 🇷🇺', v: 12 },
          { name: 'USA (Kuba-Embargo) 🇺🇸', v: 8 },
          { name: 'Nordkorea 🇰🇵', v: 8 },
          { name: 'Iran 🇮🇷', v: 8 },
          { name: 'Syrien 🇸🇾', v: 8 },
          { name: 'Myanmar 🇲🇲', v: 6 },
        ],
      }),
  },
  {
    id: 'de-family',
    title: 'Heiraten vs. Scheidungen · Deutschland',
    draw: (f) =>
      lineChart(f, {
        // Destatis: marriages halve across the century, divorces peak ~2004
        // and fall since — the "ever more divorces" belief no longer holds.
        label: 'Heiraten & Scheidungen · 🇩🇪 · je 1000 Einw.',
        value: DE_FAMILY.marLatest,
        unit: '',
        fmt: (v) => v.toFixed(1),
        delta: null,
        seed: 191,
        series: [
          { name: 'Heiraten', color: green, data: DE_FAMILY.rows[0].data },
          { name: 'Scheidungen', color: red, data: DE_FAMILY.rows[1].data },
        ],
        ticks: DE_FAMILY.ticks,
        xLabels: ['1900', '1940', '1980', 'heute'],
      }),
  },
  trendCard('single-households', 'Einpersonenhaushalte · Deutschland', 'Einpersonenhaushalte · 🇩🇪 · Anteil · seit 1900', DE_SINGLE_HH_PANEL, violet, (v) => `${v.toFixed(0)}%`, 193),
  {
    id: 'digital-id',
    title: 'Digitale ID · Bevölkerungsabdeckung',
    draw: (f) =>
      hBarChart(f, {
        // Share of the population with a usable national digital ID (World
        // Bank ID4D / national programs, rounded estimates). Estonia and
        // India's Aadhaar are near-universal; Switzerland's state e-ID only
        // launches around 2026, so it anchors the low end.
        label: 'Digitale ID · Bevölkerungsabdeckung · Schätzwerte',
        value: 99,
        fmt: (v) => `${Math.round(v)}%`,
        rowFmt: (v) => `${Math.round(v)}%`,
        delta: null,
        color: aqua,
        unit: '',
        rows: [
          { name: 'Estland 🇪🇪', v: 99 },
          { name: 'Indien 🇮🇳', v: 99 },
          { name: 'Singapur 🇸🇬', v: 97 },
          { name: 'Schweden 🇸🇪', v: 95 },
          { name: 'Belgien 🇧🇪', v: 90 },
          { name: 'Nigeria 🇳🇬', v: 65 },
          { name: 'Österreich 🇦🇹', v: 60 },
          { name: 'Deutschland 🇩🇪', v: 55 },
          { name: 'USA 🇺🇸', v: 20 },
          { name: 'Schweiz 🇨🇭', v: 5 },
        ],
      }),
  },
  {
    id: 'alcohol-nations',
    title: 'Alkoholkonsum international',
    draw: (f) =>
      hBarChart(f, {
        // Recorded alcohol per capita, litres of pure alcohol, adults 15+
        // (WHO 2019). Eastern Europe tops it; Germany drinks heavily too,
        // Türkiye anchors the low end.
        label: 'Alkohol · Liter Reinalkohol pro Kopf · WHO',
        value: 15.2,
        fmt: (v) => `${v.toFixed(1)} L`,
        rowFmt: (v) => `${v.toFixed(1)} L`,
        delta: null,
        color: magenta,
        unit: '',
        rows: [
          { name: 'Moldau 🇲🇩', v: 15.2 },
          { name: 'Tschechien 🇨🇿', v: 14.4 },
          { name: 'Litauen 🇱🇹', v: 13.2 },
          { name: 'Irland 🇮🇪', v: 13.0 },
          { name: 'Deutschland 🇩🇪', v: 12.8 },
          { name: 'Frankreich 🇫🇷', v: 12.3 },
          { name: 'Österreich 🇦🇹', v: 12.0 },
          { name: 'Russland 🇷🇺', v: 11.7 },
          { name: 'Schweiz 🇨🇭', v: 11.5 },
          { name: 'Türkei 🇹🇷', v: 1.5 },
        ],
      }),
  },
  {
    id: 'alcohol-deaths',
    title: 'US-Alkoholtote pro Jahr',
    draw: (f) =>
      areaChart(f, {
        // CDC: alcohol-induced deaths rose steadily, then spiked ~40% in the
        // pandemic — economic and social stress driving heavier drinking.
        label: 'Alkoholtote · 🇺🇸 · pro Jahr · CDC',
        value: US_ALCOHOL_DEATHS_PANEL.latest,
        fmt: (v) => `${(v / 1000).toFixed(0)}k`,
        delta: US_ALCOHOL_DEATHS_PANEL.yoyPct,
        seed: 197,
        color: red,
        data: US_ALCOHOL_DEATHS_PANEL.series,
        ticks: US_ALCOHOL_DEATHS_PANEL.ticks,
        xLabels: US_ALCOHOL_DEATHS_PANEL.xLabels,
      }),
  },
  {
    id: 'c40-cities',
    title: 'Größte C40-Städte',
    draw: (f) =>
      hBarChart(f, {
        // C40 is a ~100-city climate network (Bloomberg-funded). Many members
        // are among the world's largest urban agglomerations (UN metro pops).
        label: 'Größte C40-Städte · Einwohner (Metro)',
        value: 37,
        fmt: (v) => `${Math.round(v)} Mio`,
        rowFmt: (v) => `${Math.round(v)} Mio`,
        delta: null,
        color: blue,
        unit: '',
        rows: [
          { name: 'Tokio 🇯🇵', v: 37 },
          { name: 'Delhi 🇮🇳', v: 33 },
          { name: 'Shanghai 🇨🇳', v: 29 },
          { name: 'Dhaka 🇧🇩', v: 23 },
          { name: 'São Paulo 🇧🇷', v: 22 },
          { name: 'Kairo 🇪🇬', v: 22 },
          { name: 'Mexiko-Stadt 🇲🇽', v: 22 },
          { name: 'Peking 🇨🇳', v: 22 },
          { name: 'Mumbai 🇮🇳', v: 21 },
          { name: 'Istanbul 🇹🇷', v: 16 },
        ],
      }),
  },
  {
    id: 'covid-stringency',
    title: 'Corona-Maßnahmen · Härte im Schnitt',
    draw: (f) =>
      hBarChart(f, {
        // Oxford COVID-19 Government Response Tracker (OxCGRT) stringency
        // index, 0–100, averaged over the pandemic (2020–2022) via OWID.
        // Measures how restrictive a government's response was overall
        // (lockdowns, closures, travel bans), NOT how well it worked.
        // China's zero-COVID keeps it hardest for longest; Sweden anchors
        // the low end. Approximate averages — treat as magnitudes.
        label: 'Corona-Stringency-Index · Ø 2020–22 · OxCGRT',
        value: 62,
        fmt: (v) => `Ø ${Math.round(v)}/100`,
        rowFmt: (v) => `${Math.round(v)}`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'China 🇨🇳', v: 78 },
          { name: 'Honduras 🇭🇳', v: 74 },
          { name: 'Chile 🇨🇱', v: 71 },
          { name: 'Argentinien 🇦🇷', v: 69 },
          { name: 'Paraguay 🇵🇾', v: 68 },
          { name: 'Australien 🇦🇺', v: 62 },
          { name: 'Deutschland 🇩🇪', v: 60 },
          { name: 'USA 🇺🇸', v: 58 },
          { name: 'Neuseeland 🇳🇿', v: 55 },
          { name: 'Schweiz 🇨🇭', v: 48 },
          { name: 'Schweden 🇸🇪', v: 45 },
        ],
      }),
  },
  {
    id: 'covid-lockdowns',
    title: 'Längste Corona-Lockdowns · Städte',
    draw: (f) =>
      hBarChart(f, {
        // Cumulative days under hard stay-at-home lockdown by city, as widely
        // reported in the press (2020–2021). Melbourne's 262 days is the
        // world record for a single city; Buenos Aires and Manila follow.
        // Rounded estimates — definitions of "lockdown" vary by source.
        label: 'Tage im Lockdown · Städte · 2020–21 · Schätzwerte',
        value: 262,
        fmt: (v) => `${Math.round(v)} Tage`,
        rowFmt: (v) => `${Math.round(v)} T.`,
        delta: null,
        color: orange,
        unit: '',
        rows: [
          { name: 'Melbourne 🇦🇺', v: 262 },
          { name: 'Buenos Aires 🇦🇷', v: 234 },
          { name: 'Manila 🇵🇭', v: 210 },
          { name: 'Shanghai 🇨🇳', v: 130 },
          { name: 'Auckland 🇳🇿', v: 120 },
          { name: 'London 🇬🇧', v: 115 },
          { name: 'Paris 🇫🇷', v: 110 },
          { name: 'Rom 🇮🇹', v: 105 },
          { name: 'Berlin 🇩🇪', v: 75 },
          { name: 'Stockholm 🇸🇪', v: 0 },
        ],
      }),
  },
  {
    id: 'covid-vaccinations',
    title: 'Corona-Impfungen · verabreichte Dosen',
    draw: (f) =>
      hBarChart(f, {
        // Cumulative COVID-19 vaccine doses administered (Our World in Data,
        // final 2023 figures). Absolute counts, so the two population giants
        // dominate: China and India alone gave out ~40% of the world's
        // ~13.5 billion doses. Germany added as a European reference point.
        label: 'Corona-Impfdosen · gesamt · 2020–23 · OWID',
        value: 13.5e9,
        fmt: (v) => `${(v / 1e9).toFixed(1)} Mrd`,
        rowFmt: (v) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)} Mrd` : `${Math.round(v / 1e6)} Mio`),
        delta: null,
        color: green,
        unit: '',
        rows: [
          { name: 'China 🇨🇳', v: 3_491_000_000 },
          { name: 'Indien 🇮🇳', v: 2_206_000_000 },
          { name: 'USA 🇺🇸', v: 676_000_000 },
          { name: 'Brasilien 🇧🇷', v: 519_000_000 },
          { name: 'Indonesien 🇮🇩', v: 448_000_000 },
          { name: 'Japan 🇯🇵', v: 436_000_000 },
          { name: 'Bangladesch 🇧🇩', v: 363_000_000 },
          { name: 'Pakistan 🇵🇰', v: 346_000_000 },
          { name: 'Vietnam 🇻🇳', v: 266_000_000 },
          { name: 'Deutschland 🇩🇪', v: 192_000_000 },
        ],
      }),
  },
  {
    id: 'covid-vax-percapita',
    title: 'Corona-Impfungen · Dosen pro Kopf',
    draw: (f) =>
      hBarChart(f, {
        // COVID-19 vaccine doses administered per 100 people (Our World in
        // Data, cumulative). Per-capita view: which countries jabbed their
        // population most densely, not just most in absolute terms. Cuba
        // tops it with a home-grown 3-dose regimen (Abdala/Soberana); the
        // world average sits near ~170 doses per 100. Approximate.
        label: 'Corona-Impfdosen · je 100 Einw. · 2020–23 · OWID',
        value: 170,
        fmt: (v) => `Ø ${Math.round(v)}/100`,
        rowFmt: (v) => `${Math.round(v)}`,
        delta: null,
        color: aqua,
        unit: '',
        rows: [
          { name: 'Kuba 🇨🇺', v: 395 },
          { name: 'Japan 🇯🇵', v: 340 },
          { name: 'Chile 🇨🇱', v: 330 },
          { name: 'Singapur 🇸🇬', v: 285 },
          { name: 'VAE 🇦🇪', v: 280 },
          { name: 'Portugal 🇵🇹', v: 275 },
          { name: 'Vietnam 🇻🇳', v: 270 },
          { name: 'Südkorea 🇰🇷', v: 253 },
          { name: 'China 🇨🇳', v: 247 },
          { name: 'Deutschland 🇩🇪', v: 230 },
        ],
      }),
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
  climate: ['welt'],
  'swiss-pop': ['schweiz', 'soziales'],
  'world-pop': ['welt', 'soziales'],
  'oil-consumption': ['welt', 'geld'],
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
  'de-insolvenz-jobs': ['deutschland', 'geld'],
  'de-industry': ['deutschland', 'geld'],
  'de-migration': ['deutschland', 'soziales'],
  'de-crime-foreign': ['deutschland', 'soziales'],
  internet: ['welt'],
  'nuke-tests': ['krieg'],
  'obesity-nations': ['gesundheit', 'schweiz'],
  'gdp-growth': ['geld', 'deutschland'],
  fertility: ['welt', 'soziales'],
  dollar: ['geld'],
  armies: ['krieg'],
  wealth: ['geld', 'soziales'],
  'tax-burden': ['geld', 'deutschland', 'schweiz'],
  'power-prices': ['geld', 'deutschland', 'schweiz'],
  incarceration: ['soziales', 'schweiz'],
  corruption: ['soziales', 'welt', 'schweiz'],
  'us-bases': ['krieg', 'welt'],
  'us-wars': ['krieg'],
  'recent-wars': ['krieg'],
  'teen-mde': ['gesundheit', 'soziales'],
  'suicide-by-age': ['gesundheit', 'soziales'],
  'teen-screen': ['gesundheit', 'soziales'],
  'teen-antidepressants': ['gesundheit', 'soziales'],
  'us-energy-mix': ['welt'],
  'de-energy-mix': ['deutschland', 'welt'],
  'obesity-fastfood': ['gesundheit'],
  surveillance: ['welt', 'soziales', 'schweiz'],
  'cameras-world': ['welt', 'soziales'],
  'gov-data-requests': ['welt', 'soziales'],
  'gov-requests-country': ['welt', 'soziales'],
  'youtube-removals': ['welt', 'soziales'],
  'who-pandemic': ['welt'],
  cashless: ['geld', 'welt', 'deutschland'],
  '5g-stations': ['welt', 'deutschland', 'schweiz'],
  inflation: ['geld', 'welt', 'deutschland', 'schweiz'],
  'digital-id': ['welt', 'soziales', 'deutschland', 'schweiz'],
  'alcohol-nations': ['gesundheit', 'welt', 'deutschland', 'schweiz'],
  'alcohol-deaths': ['gesundheit'],
  'c40-cities': ['welt'],
  'un-resolutions': ['welt', 'krieg'],
  'de-family': ['deutschland', 'soziales'],
  'single-households': ['deutschland', 'soziales'],
  'covid-stringency': ['gesundheit', 'welt', 'soziales'],
  'covid-lockdowns': ['gesundheit', 'welt', 'soziales'],
  'covid-vaccinations': ['gesundheit', 'welt'],
  'covid-vax-percapita': ['gesundheit', 'welt'],
};
for (const d of POOL) d.tags = TAGS_BY_ID[d.id] ?? [];

/**
 * Hand-picked headliners: these lead the ring so the strongest panels sit up
 * front on load; the rest of the pool follows behind them.
 */
const FEATURED = new Set([
  'us-wars', 'us-bases', 'corruption', 'incarceration', 'obesity-nations', 'nukes',
  'us-debt', 'us-interest', 'm2', 'dollar', 'wealth', 'homicide-map',
  'world-pop', 'oil-consumption', 'climate', 'de-insolvenz-jobs', 'conflict-deaths', 'refugees',
  'military', 'gdp-growth', 'de-industry', 'recent-wars',
  'youth-unemployment', 'unemployment', 'poverty',
  'teen-mde', 'suicide-by-age',
  'teen-screen', 'teen-antidepressants', 'obesity-fastfood', 'surveillance',
  'cameras-world', 'gov-data-requests',
  'gov-requests-country', 'youtube-removals', 'who-pandemic', '5g-stations',
  'un-resolutions', 'de-family', 'single-households', 'inflation',
  'digital-id', 'alcohol-nations', 'alcohol-deaths', 'c40-cities',
  'covid-stringency', 'covid-lockdowns', 'covid-vaccinations', 'covid-vax-percapita',
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
