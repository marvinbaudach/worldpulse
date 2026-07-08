// The dashboard card pool. Each card builds its chart config inside `draw`, so
// it picks up live data on the next frame and otherwise falls back to a seeded
// or bundled series. Tagging, ordering and the public registry live in index.ts.

import { localeNum, localePct, t as tr } from '../i18n';
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
import { CPI_INVERTED, EU_DEBT_GDP, NUKE_STATES, NUKE_TOTAL, US_TROOPS_ABROAD } from './geo';
import type { Dashboard } from './types';
import { live } from '../data/store';
import {
  AI_JOBS_COMPARE,
  CAMERAS_PANEL,
  CB_BALANCE_COMPARE,
  CONFLICT_PANEL,
  DEBT_TREND_FALLBACK,
  DE_FAMILY,
  DE_PENSION_LEVEL_PANEL,
  DE_RENT_BURDEN_PANEL,
  DE_WAGE_COMPARE,
  FOOD_FERT_COMPARE,
  WEALTH_DIVERGE_COMPARE,
  AGE_VERIF_PANEL,
  AGE_VERIF_NATIONS_PANEL,
  PNR_PANEL,
  KYC_PANEL,
  ID_GAP_PANEL,
  DE_SINGLE_HH_PANEL,
  DOLLAR_PANEL,
  CONTINENT_FERTILITY,
  INTERNET_PANEL,
  HUNGER_PANEL,
  EXTREME_POVERTY_PANEL,
  LIFE_PANEL,
  DE_FOREIGN_COMPARE,
  DE_ASSAULT_PANEL,
  DE_KNIFE_ATTACKS_PANEL,
  DE_TVBZ_AGE_COMPARE,
  DE_INSOLVENCY_JOBS_PANEL,
  DE_MIGRATION_PANEL,
  DE_MIGRATION_FLOWS,
  DE_POPULATION_PANEL,
  DE_TAX_QUOTA_PANEL,
  DE_POWER_PRICE_PANEL,
  BERLIN_WARRANTS_PANEL,
  DE_OLD_AGE_PANEL,
  DE_STATE_QUOTA_PANEL,
  DE_UNDEREMPLOYMENT_COMPARE,
  INDUSTRY_COMPARE,
  M2_COMPARE,
  M2_PANEL,
  NUKE_TESTS_PANEL,
  PL_MIGRATION_COMPARE,
  PRESS_FREEDOM_COMPARE,
  BOOK_BANS_PANEL,
  JAILED_JOURNALISTS_PANEL,
  ASSET_MEGACOMPARE,
  OIL_CONSUMPTION_PANEL,
  OVERDOSE_PANEL,
  REFUGEE_PANEL,
  SWISS_POP_FALLBACK,
  DE_ENERGY_MIX,
  DE_EXPORT_COMPARE,
  DE_FEMALE_LFP_PANEL,
  TEEN_MDE,
  TEEN_RX_PANEL,
  TEEN_SCREEN_PANEL,
  US_ALCOHOL_DEATHS_PANEL,
  US_INTEREST_PANEL,
  US_OBESITY_FASTFOOD,
  WORLD_POP_SINCE_1770,
  CASHLESS_COMPARE,
  CBDC_PANEL,
  FREEDOM_COMPARE,
  DE_SPEECH_PANEL,
  UK_SPEECH_ARRESTS_PANEL,
  YOUNG_HOME_COMPARE,
  LEZ_PANEL,
  SHUTDOWN_PANEL,
  GENE_THERAPY_PANEL,
  SMARTPHONE_PANEL,
  AUTOCRACY_SHARE_PANEL,
} from '../data/bundled';
import {
  blue,
  aqua,
  yellow,
  green,
  violet,
  red,
  magenta,
  orange,
  trendCard,
  eraMarkers,
  deInt,
} from './cardHelpers';

/**
 * The panel pool — live public data (US Treasury, World Bank, Open-Meteo,
 * Wikimedia). Every config is built inside `draw`, so a panel picks up its
 * dataset on the very next frame after the fetcher fills the store; until
 * then it falls back to the seeded demo series. Each page load shows a
 * random selection (see ALL_DASHBOARDS below). Map reference datasets live
 * in geo.ts, the bundled historical series in ../data/bundled.
 */
export const POOL: Dashboard[] = [
  {
    id: 'military',
    title: 'Militärausgaben · Top 10',
    source:
      'World Bank · Militärausgaben in laufenden US-$, live abgerufen (letztes Jahr je Land); Fallback-Reihenfolge nach SIPRI 2025.',
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
    source:
      'US Treasury Fiscal Data · „Debt to the Penny", live abgerufen; Langfrist-Trend aus Treasury Historical Debt Outstanding. Zwischen den Tagesständen hochgerechnet.',
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
        // The turns behind the runaway climb on the 1900–2026 axis: the end of
        // the gold standard, then the two crisis borrowing waves.
        markers: eraMarkers(1900, 2026, [
          [1971, '⛓️‍💥 Gold-Ende 1971'],
          [2008, '🏦 Finanzkrise 2008'],
          [2020, '💸 Corona 2020'],
        ]),
      });
    },
  },
  {
    id: 'nukes',
    title: 'Atomsprengköpfe weltweit',
    source: 'Federation of American Scientists (FAS) · Schätzung 2025.',
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
    source:
      'World Bank · vorsätzliche Tötungen je 100k Einwohner, live abgerufen; letztes verfügbares Jahr je Land.',
    dynamic: true,
    draw: (f) => {
      const hm = live.homicide;
      choroplethMap(f, {
        label: 'Mordrate',
        value: hm?.world ?? 5.6,
        fmt: (v) => `${localeNum(v, 1)} /100k`,
        valueByIso: hm?.byIso,
        world: live.worldMap,
        rows: hm?.rows ?? [
          { name: 'Jamaika', v: 53.3 },
          { name: 'Südafrika', v: 45.5 },
          { name: 'Honduras', v: 31.1 },
          { name: 'Brasilien', v: 19.3 },
          { name: 'Mexiko', v: 18.5 },
        ],
        rowFmt: (v) => localeNum(v, 1),
        source: 'World Bank · Tötungsdelikte pro 100k',
      });
    },
  },
  {
    id: 'swiss-pop',
    title: 'Schweizer Bevölkerung · 500 Jahre',
    source:
      'BFS-Volkszählungen ab 1850, davor historische Schätzungen; ab 1960 World Bank, live abgerufen.',
    dynamic: true,
    draw: (f) => {
      const p = live.swissPop ?? SWISS_POP_FALLBACK;
      areaChart(f, {
        label: 'Schweizer Bevölkerung · seit 1500',
        value: p.latest,
        fmt: (v) => `${localeNum(v / 1e6, 2)} ${tr('Mio')}`,
        delta: p.yoyPct,
        seed: 19,
        color: magenta,
        data: p.series,
        ticks: p.ticks,
        xLabels: p.xLabels,
        // The two real inflections on an otherwise smooth curve: the 1848
        // federal state / industrial take-off (growth steepens), and the
        // post-1950 immigration wave (~26% of residents are foreign-born
        // today).
        markers: eraMarkers(1500, 2025, [
          [1848, '🏭 Industrialisierung'],
          [1960, '🌍 Zuwanderung'],
        ]),
      });
    },
  },
  {
    id: 'world-pop',
    title: 'Weltbevölkerung · seit 1770',
    source:
      'UN World Population Prospects / Our World in Data; frühe Jahre historische Schätzungen.',
    draw: (f) => {
      const p = WORLD_POP_SINCE_1770;
      areaChart(f, {
        label: 'Weltbevölkerung · seit 1770',
        value: p.latest,
        fmt: (v) => `${localeNum(v / 1e9, 2)} ${tr('Mrd')}`,
        // No delta chip: a YoY figure under a 250-year curve reads as if it
        // were the growth over the whole span.
        delta: null,
        seed: 29,
        color: blue,
        data: p.series,
        ticks: p.ticks,
        xLabels: p.xLabels,
        // Benz's 1886 automobile marks the start of the fossil-fuel era that
        // powered the population explosion.
        markers: eraMarkers(1770, 2025, [[1886, '⛽ Benzin']]),
      });
    },
  },
  {
    id: 'oil-consumption',
    title: 'Weltweiter Ölverbrauch',
    source:
      'Energy Institute Statistical Review of World Energy; vor 1965 historische BP-/Our-World-in-Data-Reihen.',
    draw: (f) =>
      areaChart(f, {
        label: 'Ölverbrauch · Mio. Barrel/Tag',
        value: OIL_CONSUMPTION_PANEL.latest,
        fmt: (v) => `${localeNum(v, 0)} mb/d`,
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
        markers: eraMarkers(1900, 2023, [[1973, '⛽ Ölkrise 1973']]),
      }),
  },
  {
    id: 'conflict-deaths',
    title: 'Tote in bewaffneten Konflikten',
    source:
      'UCDP via Our World in Data · Tote in bewaffneten Konflikten; gerundete Anker, interpoliert.',
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
        // Dominant spikes labelled directly on the 1900–2024 range.
        markers: eraMarkers(1900, 2024, [
          [1916, '⚔️ 1. Weltkrieg'],
          [1945, '⚔️ 2. Weltkrieg'],
          [1994, '🇷🇼 Ruanda'],
          [2022, '🇺🇦 Ukraine'],
        ]),
      }),
  },
  {
    id: 'refugees',
    title: 'Vertriebene weltweit',
    source: 'UNHCR Global Trends · gewaltsam Vertriebene weltweit, gerundet.',
    draw: (f) =>
      areaChart(f, {
        label: 'Vertriebene',
        value: REFUGEE_PANEL.latest,
        fmt: (v) => `${Math.round(v / 1e6)} ${tr('Mio')}`,
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
        markers: eraMarkers(1990, 2024, [
          [2011, '🏴 Syrien 2011'],
          [2014, '🇺🇦 Ukraine 2014'],
          [2023, '🇸🇩 Sudan 2023'],
        ]),
      }),
  },
  {
    id: 'refugees-interventions',
    title: 'Vertriebene & westliche Militäreinsätze',
    source:
      'UNHCR Global Trends; Einsatz-Marker nach öffentlichen Quellen. Die größten Sprünge (Syrien 2013–15, Ukraine 2022) gehen auf Nicht-NATO-Kriege zurück.',
    draw: (f) =>
      areaChart(f, {
        // Same UNHCR displacement curve, but marked with the NATO-led
        // operations (Kosovo, Afghanistan, Libya) and, honestly labeled, the
        // US-led Iraq coalition — which was NOT a NATO operation. The point is
        // that the biggest jumps (2013-15 Syria, 2022 Ukraine) are NON-NATO
        // wars: the interventions explain some displacement, not the surge.
        label: 'Vertriebene · mit Militäreinsätzen',
        value: REFUGEE_PANEL.latest,
        fmt: (v) => `${Math.round(v / 1e6)} ${tr('Mio')}`,
        delta: REFUGEE_PANEL.yoyPct,
        seed: 67,
        color: aqua,
        data: REFUGEE_PANEL.series,
        ticks: REFUGEE_PANEL.ticks,
        xLabels: REFUGEE_PANEL.xLabels,
        markers: eraMarkers(1990, 2024, [
          [1999, '🎗️ Kosovo · NATO'],
          [2001, '🇦🇫 Afghanistan · NATO'],
          [2003, '🇮🇶 Irak · US-Koalition'],
          [2011, '🇱🇾 Libyen · NATO'],
        ]),
      }),
  },
  {
    id: 'us-interest',
    title: 'US-Zinszahlungen des Bundes',
    source: 'OMB / CBO · Netto-Zinsausgaben des US-Bundes pro Jahr, gerundet.',
    draw: (f) =>
      areaChart(f, {
        label: 'US-Zinslast · jährlich',
        value: US_INTEREST_PANEL.latest,
        fmt: (v) => `$${localeNum(v / 1e12, 2)} ${tr('Bio.')}`,
        delta: US_INTEREST_PANEL.yoyPct,
        seed: 71,
        color: yellow,
        data: US_INTEREST_PANEL.series,
        ticks: US_INTEREST_PANEL.ticks,
        xLabels: US_INTEREST_PANEL.xLabels,
        // The vertical part on the 1990–2025 axis: the Fed's 2022 rate hikes
        // (fastest in 40 years) repriced the debt and the interest bill soared.
        markers: eraMarkers(1990, 2025, [[2022, '📈 Fed-Zinswende 2022']]),
      }),
  },
  {
    id: 'overdose',
    title: 'US-Drogentote (Überdosis)',
    source: 'CDC · Überdosis-Tote ab 1999; frühere Werte NCHS-Schätzungen.',
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
        markers: eraMarkers(1950, 2024, [
          [1970, 'Heroin'],
          [1986, 'Crack'],
          [1999, 'OxyContin'],
          [2015, 'Fentanyl'],
        ]),
      }),
  },
  {
    id: 'debt-gdp',
    title: 'Staatsschulden · % des BIP',
    source:
      'IWF World Economic Outlook · Bruttostaatsschulden in % des BIP, Schätzwerte 2024/25.',
    draw: (f) =>
      hBarChart(f, {
        // IMF World Economic Outlook estimates (general government gross
        // debt, 2024/25) — revised twice a year, no keyless live API.
        label: 'Staatsschulden / BIP',
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
    source: 'Eurostat 2024 · Schuldenquote in % des BIP.',
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
    source: 'UN World Population Prospects 2024.',
    draw: (f) =>
      treemap(f, {
        // UN World Population Prospects 2024 (millions).
        label: 'Bevölkerungsanteile',
        value: 8.16e9,
        fmt: (v) => `${localeNum(v / 1e9, 2)} ${tr('Mrd')}`,
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
  trendCard('life-exp', 'Globale Lebenserwartung', 'Lebenserwartung · seit 1770', LIFE_PANEL, green, (v) => `${localeNum(v, 1)}y`, 89, eraMarkers(1770, 2024, [
    // The mid-century surge on the 1770–2024 axis.
    [1945, '💊 Antibiotika'],
  ]), 'Riley (2005) / Our World in Data vor 1950, danach UN World Population Prospects.'),
  {
    id: 'm2',
    title: 'Geldmenge · USA vs. Schweiz',
    source:
      'Fed H.6, EZB und SNB · M2 indexiert auf 2000 = 1×, gerundete Anker; Eurozone vor 1999 rückgerechnet.',
    draw: (f) =>
      lineChart(f, {
        // M2 growth indexed to 2000 = 1x — comparable across currencies.
        label: 'Geldmenge M2 · 2000 = 1×',
        value: M2_COMPARE.usLatest,
        unit: '',
        fmt: (v) => `${localeNum(v, 1)}×`,
        delta: null,
        seed: 97,
        series: [
          { name: '🇺🇸 USA', color: yellow, data: M2_COMPARE.rows[0].data },
          { name: '🇪🇺 Euro', color: violet, data: M2_COMPARE.rows[1].data },
          { name: '🇨🇭 CHF', color: red, data: M2_COMPARE.rows[2].data },
        ],
        ticks: M2_COMPARE.ticks,
        xLabels: ['1990', '2001', '2013', 'heute'],
      }),
  },
  trendCard('m2-history', 'US-Geldmenge seit 1900', 'US-Geldmenge M2 · seit 1900', M2_PANEL, yellow, (v) => `$${localeNum(v / 1e12, 1)} ${tr('Bio.')}`, 97, eraMarkers(1900, 2024, [
    // The turns behind the money-supply explosion on the 1900–2024 axis:
    // the end of gold convertibility and the two big money-printing waves.
    [1971, '⛓️‍💥 Gold-Ende 1971'],
    [2008, '🏦 QE 2008'],
    [2020, '💸 Corona 2020'],
  ]), 'Federal Reserve H.6 ab 1959; davor Friedman & Schwartz — die M2-Definition verschiebt sich über das Jahrhundert leicht.'),
  {
    id: 'ai-jobs',
    title: 'KI und Berufseinstieg · USA',
    source:
      'NY Fed / BLS · Arbeitslosenquote junger Hochschulabsolventen vs. alle Erwerbspersonen, gerundet.',
    draw: (f) =>
      lineChart(f, {
        // Since 2023 the recent-graduate rate decouples from the overall
        // one — the entry-level rungs AI automates first.
        label: 'Arbeitslos · 🇺🇸 Absolventen vs. Gesamt',
        value: AI_JOBS_COMPARE.gradLatest,
        unit: '',
        fmt: (v) => `${localePct(v, 1)}`,
        delta: null,
        seed: 157,
        series: [
          { name: 'Absolventen', color: magenta, data: AI_JOBS_COMPARE.rows[0].data },
          { name: 'Gesamt', color: blue, data: AI_JOBS_COMPARE.rows[1].data },
        ],
        ticks: AI_JOBS_COMPARE.ticks,
        xLabels: ['2015', '2018', '2022', 'heute'],
        markers: eraMarkers(2015, 2025, [
          [2020, '🦠 Pandemie'],
          [2023, '🤖 LLM'],
        ]),
      }),
  },
  {
    id: 'youth-unemployment',
    title: 'Jugendarbeitslosigkeit international',
    source: 'OECD / Eurostat / ILO · harmonisierte Jugendarbeitslosenquote (15–24 J.), 2024.',
    draw: (f) =>
      hBarChart(f, {
        // Youth unemployment rate (ages 15–24), OECD/Eurostat/ILO
        // harmonised 2024 figures. Southern Europe still tops the list a
        // decade after the euro crisis; Switzerland and Germany, with their
        // dual apprenticeship systems, anchor the low end.
        label: 'Jugendarbeitslosigkeit · 15–24 J. · 2024',
        value: 14.9,
        fmt: (v) => `Ø ${localePct(v, 1)}`,
        rowFmt: (v) => `${localePct(v, 1)}`,
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
    source:
      'OECD / Eurostat 2024 · harmonisierte Arbeitslosenquote, nicht die nationalen Meldezahlen.',
    draw: (f) =>
      hBarChart(f, {
        // Harmonised unemployment rate, all ages, OECD/Eurostat 2024
        // (comparable definition, not national registered rates). Spain and
        // France lead; Germany, Japan and Switzerland sit at the low end.
        label: 'Arbeitslosenquote · harmonisiert · 2024',
        value: 5.9,
        fmt: (v) => `Ø ${localePct(v, 1)}`,
        rowFmt: (v) => `${localePct(v, 1)}`,
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
    source:
      'OECD · relative Einkommensarmut: Anteil unter 50 % des Median-Nettoeinkommens, jeweils letztes verfügbares Jahr.',
    draw: (f) =>
      hBarChart(f, {
        // Relative income poverty: share living on under 50 % of the
        // national median disposable income (OECD, latest year). The US
        // and Japan top the list of rich nations; Switzerland and Germany
        // sit in the middle, the Nordics lowest.
        label: 'Armutsquote · < 50 % Medianeinkommen',
        value: 11.4,
        fmt: (v) => `Ø ${localePct(v, 1)}`,
        rowFmt: (v) => `${localePct(v, 1)}`,
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
  {
    id: 'poorest-nations',
    title: 'Ärmste Länder der Welt',
    source:
      'Weltbank PIP · Anteil unter 2,15 $/Tag (KKP 2017), letztes verfügbares Jahr je Land, gerundete Schätzwerte.',
    draw: (f) =>
      hBarChart(f, {
        // Share of the population living in extreme poverty, under $2.15/day
        // (World Bank PIP, 2017 PPP, latest available year per country; rounded
        // estimates). Almost the entire list is sub-Saharan Africa; Yemen is the
        // West-Asian outlier, impoverished by nearly a decade of war.
        label: 'Extreme Armut · Anteil unter 2,15 $/Tag · Weltbank',
        value: 75,
        fmt: (v) => `${Math.round(v)}%`,
        rowFmt: (v) => `${Math.round(v)}%`,
        delta: null,
        color: orange,
        unit: '',
        rows: [
          { name: 'Madagaskar', v: 75 },
          { name: 'Malawi', v: 70 },
          { name: 'Südsudan', v: 68 },
          { name: 'Zentralafr. Republik', v: 66 },
          { name: 'Burundi', v: 65 },
          { name: 'Mosambik', v: 63 },
          { name: 'DR Kongo', v: 62 },
          { name: 'Sambia', v: 61 },
          { name: 'Jemen', v: 55 },
          { name: 'Nigeria', v: 31 },
        ],
      }),
  },
  trendCard('de-insolvenz-jobs', 'Insolvenzen · betroffene Arbeitsplätze', 'Jobs in Firmenpleiten · 🇩🇪', DE_INSOLVENCY_JOBS_PANEL, red, (v) => `${Math.round(v / 1000)}k`, 137, eraMarkers(2000, 2025, [
    // The 2020 lockdown plus the suspended filing obligation pushed the count
    // to an artificial low; the rebound comes once the support ran out.
    [2009, '🏦 Finanzkrise 2009'],
    [2020, '🦠 Corona-Lockdown'],
  ]), 'Creditreform · von Firmeninsolvenzen betroffene Arbeitsplätze; grobe Schätzwerte, keine exakte Reihe.'),
  {
    id: 'de-underemployment',
    title: 'Arbeitslosigkeit · offiziell vs. real',
    source:
      'Bundesagentur für Arbeit · Arbeitslose, Unterbeschäftigung (ohne Kurzarbeit) und Langzeitarbeitslose, Jahresdurchschnitte.',
    draw: (f) =>
      lineChart(f, {
        // The BA's own "Unterbeschäftigung" runs ~1M above the headline
        // "Arbeitslose": the gap is everyone in measures, short-term sick or
        // under special rules who is removed from the official count. The
        // long-term line below shows how much is structurally stuck.
        label: 'Arbeitslosigkeit · 🇩🇪 · Mio',
        value: DE_UNDEREMPLOYMENT_COMPARE.underLatest,
        unit: '',
        fmt: (v) => `${localeNum(v, 1)} ${tr('Mio')}`,
        delta: null,
        seed: 269,
        series: [
          { name: 'Unterbeschäftigung', color: red, data: DE_UNDEREMPLOYMENT_COMPARE.rows[0].data },
          { name: 'Offiziell', color: yellow, data: DE_UNDEREMPLOYMENT_COMPARE.rows[1].data },
          { name: 'Langzeit', color: aqua, data: DE_UNDEREMPLOYMENT_COMPARE.rows[2].data },
        ],
        ticks: DE_UNDEREMPLOYMENT_COMPARE.ticks,
        xLabels: ['2009', '2014', '2019', 'heute'],
        markers: eraMarkers(2009, 2024, [[2020, '🦠 Corona']]),
      }),
  },
  {
    id: 'de-industry',
    title: 'Industrieproduktion · DEU vs. USA vs. China',
    source:
      'Destatis, Fed G.17, NBS China · Industrieproduktion, 2015 = 100, gerundet; China vor 2000 grob geschätzt, Deutschland vor 1990 nur West.',
    draw: (f) =>
      lineChart(f, {
        // Industrial production indexed to 2015 = 100; the headline
        // tracks Germany's slide from the 2018 peak.
        label: 'Industrie · 🇩🇪 · 2015 = 100',
        value: INDUSTRY_COMPARE.deuLatest,
        unit: '',
        fmt: (v) => `${localeNum(v, 0)}`,
        delta: null,
        seed: 139,
        series: [
          { name: '🇨🇳 China', color: red, data: INDUSTRY_COMPARE.rows[0].data },
          { name: '🇺🇸 USA', color: blue, data: INDUSTRY_COMPARE.rows[1].data },
          { name: '🇩🇪 DEU', color: yellow, data: INDUSTRY_COMPARE.rows[2].data },
        ],
        ticks: INDUSTRY_COMPARE.ticks,
        xLabels: ['1950', '1975', '2000', 'heute'],
        // What tipped China's line vertical on the 1950–2024 axis: Deng's 1978
        // reforms open the economy, WTO entry in 2001 is where it goes steep.
        markers: eraMarkers(1950, 2024, [
          [1978, '⚙️ Reform 1978'],
          [2001, '🌐 WTO 2001'],
        ]),
      }),
  },
  {
    id: 'de-exports',
    title: 'Exportweltmeister · DEU vs. China vs. USA',
    source: 'WTO · Anteile an den Weltwarenexporten, gerundet.',
    draw: (f) =>
      lineChart(f, {
        // Share of world merchandise exports: Germany's ~10% peak around 2003
        // (the #1 crown) slides to ~7% today, China climbs from under 2% to
        // ~14.5% — the decline the absolute-dollar view hides.
        label: 'Anteil an Weltexporten · %',
        value: DE_EXPORT_COMPARE.deuLatest,
        unit: '',
        fmt: (v) => `${localePct(v, 0)}`,
        delta: null,
        seed: 277,
        series: [
          { name: '🇩🇪 DEU', color: yellow, data: DE_EXPORT_COMPARE.rows[0].data },
          { name: '🇨🇳 China', color: magenta, data: DE_EXPORT_COMPARE.rows[1].data },
          { name: '🇺🇸 USA', color: blue, data: DE_EXPORT_COMPARE.rows[2].data },
        ],
        ticks: DE_EXPORT_COMPARE.ticks,
        xLabels: ['1990', '2001', '2013', 'heute'],
        // Germany takes the export crown in 2003, loses it to China in 2009.
        markers: eraMarkers(1990, 2024, [
          [2003, '🏆 🇩🇪 Weltmeister'],
          [2009, '🇨🇳 China überholt'],
        ]),
      }),
  },
  trendCard('de-migration', 'Migrationsanteil Deutschland', 'Migrationshintergrund · 🇩🇪', DE_MIGRATION_PANEL, aqua, (v) => `${localePct(v, 1)}`, 149, eraMarkers(1950, 2024, [
    // The four big waves on the 1950–2024 axis: guest-worker recruitment, the
    // post-1990 Aussiedler/Balkan influx, the 2015 asylum wave, and Ukraine.
    [1960, '🛠️ Gastarbeiter'],
    [1990, '🧱 Aussiedler 1990'],
    [2015, '🏴 Asyl 2015'],
    [2014, '🇺🇦 Ukraine 2014'],
  ]), 'Destatis Mikrozensus · Bevölkerung mit Migrationshintergrund; das Konzept existiert erst seit 2005, frühere Werte grob rückgeschätzt.'),
  {
    id: 'de-migration-flows',
    title: 'Ein- und Auswanderung · Deutschland',
    source: 'Destatis Wanderungsstatistik · Zu- und Fortzüge über die Grenze, gerundet.',
    draw: (f) =>
      lineChart(f, {
        // Gross flows across the border; the gap between the two lines is the
        // net migration that drives the population curve on the next card.
        label: 'Wanderung über die Grenze · 🇩🇪 · pro Jahr',
        value: DE_MIGRATION_FLOWS.inLatest,
        unit: '',
        fmt: (v) => `${localeNum(v, 1)} ${tr('Mio')}`,
        delta: null,
        seed: 317,
        series: [
          { name: 'Einwanderung', color: aqua, data: DE_MIGRATION_FLOWS.rows[0].data },
          { name: 'Auswanderung', color: orange, data: DE_MIGRATION_FLOWS.rows[1].data },
        ],
        ticks: DE_MIGRATION_FLOWS.ticks,
        xLabels: ['1991', '2002', '2013', 'heute'],
        markers: eraMarkers(1991, 2023, [
          [1992, '🧱 Balkan/Aussiedler'],
          [2015, '📈 Zuwanderung 2015'],
          [2022, '🇺🇦 Vollinvasion 2022'],
        ]),
      }),
  },
  {
    id: 'pl-migration',
    title: 'Wanderungen Polen ↔ Deutschland',
    source:
      'BiB/Destatis · Wanderungsstatistik; ab 2016 Methodenbruch, Werte nur bedingt vergleichbar.',
    draw: (f) =>
      lineChart(f, {
        // Fifty years of Poland↔Germany migration: the Aussiedler waves
        // peaking 1988/89, the EU-accession/Freizügigkeit boom with arrivals
        // near 200k/yr — and since 2016 the quiet reversal. 2024 is the first
        // year since 1993 with more departures than arrivals.
        label: 'Wanderungen · 🇵🇱 ↔ 🇩🇪 · Tsd. pro Jahr',
        value: PL_MIGRATION_COMPARE.inLatest,
        unit: '',
        fmt: (v) => `${Math.round(v)}k`,
        delta: null,
        seed: 263,
        series: [
          { name: '→ 🇩🇪 Zuzüge', color: blue, data: PL_MIGRATION_COMPARE.rows[0].data },
          { name: '→ 🇵🇱 Fortzüge', color: red, data: PL_MIGRATION_COMPARE.rows[1].data },
        ],
        ticks: PL_MIGRATION_COMPARE.ticks,
        xLabels: ['1974', '1991', '2007', 'heute'],
        markers: eraMarkers(1974, 2024, [
          [1988, '🧳 Aussiedler'],
          [2004, '🇪🇺 EU-Beitritt'],
          [2011, '🛠️ Freizügigkeit'],
          [2024, '↩️ Saldo kippt'],
        ]),
      }),
  },
  trendCard('de-population', 'Bevölkerung Deutschland · seit 1950', 'Bevölkerung · 🇩🇪 · Jahresende', DE_POPULATION_PANEL, blue, (v) => `${localeNum(v, 1)} ${tr('Mio.')}`, 319, eraMarkers(1950, 2024, [
    // The population only moves on migration: near-flat for decades, a record
    // ~84m after the 2015 and 2022 waves, since births stay below deaths.
    [1990, '🇩🇪 Wiedervereinigung 1990'],
    [2015, '📈 Zuwanderung 2015'],
    [2022, '🇺🇦 Vollinvasion 2022'],
  ]), 'Destatis · Bevölkerungsstand in heutigen Grenzen; vor 1990 beide deutsche Staaten summiert, gerundet.'),
  {
    id: 'de-crime-foreign',
    title: 'Nichtdeutsche Tatverdächtige · gegen Bevölkerungsanteil',
    source:
      'BKA · PKS (nichtdeutsche Tatverdächtige, ohne ausländerrechtliche Delikte) gegen den Destatis-Ausländeranteil. Tatverdächtige, keine Verurteilten; nicht alters- oder sozialbereinigt.',
    draw: (f) =>
      lineChart(f, {
        // Suspect share read against the foreign population share: most of the
        // rise tracks the growing base; the gap above it is over-representation.
        label: 'Nichtdeutsche · 🇩🇪 · Tatverdächtige vs. Bevölkerungsanteil',
        value: DE_FOREIGN_COMPARE.tvLatest,
        unit: '',
        fmt: (v) => `${localePct(v, 1)}`,
        delta: null,
        seed: 151,
        series: [
          { name: 'Tatverdächtige', color: magenta, data: DE_FOREIGN_COMPARE.rows[0].data },
          { name: 'Ausländeranteil', color: blue, data: DE_FOREIGN_COMPARE.rows[1].data },
        ],
        ticks: DE_FOREIGN_COMPARE.ticks,
        xLabels: ['2005', '2011', '2018', 'heute'],
      }),
  },
  // Nationwide long series, PKS aggravated-assault key 2220 (gefährliche und
  // schwere Körperverletzung), cases/year — the honest deep-history violence
  // metric where the knife-specific data does not reach back.
  trendCard('de-assault', 'Gefährliche & schwere Körperverletzung', 'Gef. & schwere Körperverletzung · 🇩🇪 · Fälle/Jahr', DE_ASSAULT_PANEL, red, (v) => `${Math.round(v / 1000)}k`, 331, eraMarkers(1993, 2024, [
    // Rose to a mid-2000s peak, fell through the 2010s, dipped in the pandemic
    // year, then climbed back to that old high by 2023.
    [2007, '📈 Höchststand 2000er'],
    [2021, '🦠 Corona-Tief'],
  ]), 'BKA · PKS, Schlüssel 2220 (gefährliche und schwere Körperverletzung), erfasste Fälle pro Jahr, gerundet.'),
  // NRW, not Germany: no honest nationwide knife-violence time series exists
  // before the 2024 PKS, so this shows NRW's LKA public-space knife report.
  trendCard('de-knife-attacks', 'Messergewalt · NRW', 'Messergewalt · NRW · öffentl. Raum', DE_KNIFE_ATTACKS_PANEL, red, deInt, 313, undefined, 'LKA NRW · Lagebild „Gewalt im öffentlichen Raum", Tatmittel Messer. Keine ehrliche Bundesreihe vor der PKS 2024; 2022 aus der gemeldeten Steigerungsrate abgeleitet.'),
  {
    id: 'de-tvbz-violence',
    title: 'Gewaltkriminalität · TVBZ nach Staatsangehörigkeit',
    source:
      'BKA · PKS 2024, TVBZ via Bundestags-Drucksache 21/145. Tatverdächtige, keine Verurteilten; je 100k der jeweiligen Wohnbevölkerung (Zensus 2022). Nicht alters- oder sozialbereinigt — siehe die Alterskarte.',
    draw: (f) =>
      hBarChart(f, {
        // Suspect rate for violent crime (PKS sum key 892000), males, per
        // 100k of each nationality's resident population in Germany — PKS
        // 2024 via BT-Drs. 21/145 (population: Census 2022, 31 Dec 2023).
        // Suspects, not convictions. The BKA cautions that small resident
        // denominators make single-nationality rates noisy and that asylum
        // populations carry multiple risk factors (age, poverty, war) —
        // see the age-band card for how much age structure explains.
        label: 'Gewaltkriminalität · Tatverdächtige Männer je 100k · 2024',
        value: 3388,
        fmt: deInt,
        rowFmt: deInt,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: '🇲🇦 Marokko', v: 3388 },
          { name: '🇸🇾 Syrien', v: 2608 },
          { name: '🇮🇶 Irak', v: 2479 },
          { name: '🇦🇫 Afghanistan', v: 2409 },
          { name: '🇧🇬 Bulgarien', v: 1353 },
          { name: '🇷🇸 Serbien', v: 1246 },
          { name: '🇷🇴 Rumänien', v: 908 },
          { name: '🇹🇷 Türkei', v: 904 },
          { name: '🇩🇪 Deutschland · Referenz', v: 272 },
        ],
      }),
  },
  {
    id: 'de-tvbz-age',
    title: 'Gewaltkriminalität · Deutsche vs. Afghanen nach Alter',
    source:
      'BKA · PKS 2024, TVBZ via Bundestags-Drucksache 21/145. Altersgleich schrumpft der rohe 8,9×-Abstand bei 18–21 auf ~4×, bleibt ab 21 aber ~9,5×. Tatverdächtige, keine Verurteilten.',
    draw: (f) =>
      lineChart(f, {
        // Same metric split by age band (see DE_TVBZ_AGE_COMPARE for the
        // source discussion): the honest "adjusted" view of the raw gap.
        label: 'Gewalt-Tatverdächtige · Männer je 100k · nach Alter · 2024',
        value: 3972,
        unit: '',
        fmt: deInt,
        delta: null,
        seed: 337,
        series: [
          { name: 'Afghanen', color: red, data: DE_TVBZ_AGE_COMPARE.rows[0].data },
          { name: 'Deutsche', color: blue, data: DE_TVBZ_AGE_COMPARE.rows[1].data },
        ],
        ticks: DE_TVBZ_AGE_COMPARE.ticks,
        xLabels: ['8–14 J.', '14–18 J.', '18–21 J.', 'ab 21 J.'],
      }),
  },
  {
    id: 'de-tvbz-rape',
    title: 'Vergewaltigung · TVBZ nach Staatsangehörigkeit',
    source:
      'BKA · PKS 2024 (Schlüssel 111000: Vergewaltigung & schwere sexuelle Übergriffe), TVBZ via Bundestags-Drucksache 21/145. Tatverdächtige, keine Verurteilten; kleine Bevölkerungsnenner machen einzelne Werte instabil.',
    draw: (f) =>
      hBarChart(f, {
        // Suspect rate for rape and serious sexual assault (PKS key 111000),
        // males, per 100k — same source and caveats as the violence card.
        label: 'Vergewaltigung & schwere Übergriffe · Männer je 100k · 2024',
        value: 209,
        fmt: deInt,
        rowFmt: deInt,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: '🇦🇫 Afghanistan', v: 209 },
          { name: '🇮🇶 Irak', v: 190 },
          { name: '🇮🇷 Iran', v: 145 },
          { name: '🇸🇾 Syrien', v: 141 },
          { name: '🇧🇬 Bulgarien', v: 80 },
          { name: '🇷🇸 Serbien', v: 78 },
          { name: '🇹🇷 Türkei', v: 64 },
          { name: '🇷🇴 Rumänien', v: 43 },
          { name: '🇩🇪 Deutschland · Referenz', v: 20 },
        ],
      }),
  },
  {
    id: 'ch-zurich-afghan-crime',
    title: 'Afghanen · Kanton Zürich · Übervertretung',
    source:
      'Kriminalstatistik Kanton Zürich 2024, via NZZ. Beschuldigten-Anteile gegen Bevölkerungsanteil (~0,4 %). Nicht altersbereinigt: 37 % der afghanischen Asylsuchenden sind 13–24, über 4 Männer pro Frau.',
    draw: (f) =>
      hBarChart(f, {
        // Canton Zurich crime statistics 2024 (reported via NZZ): Afghan
        // nationals are ~0.4% of the canton's population but ~3.5% of
        // sexual-offence suspects (~9×) and ~10× overrepresented in offences
        // against life and limb. Factors vs. the rest of the population, NOT
        // age-adjusted — 37% of Afghan asylum seekers are 13-24 with 4+ men
        // per woman, so the same age caveat as the German cards applies.
        label: 'Afghanen · Kanton Zürich · Übervertretung ggü. übriger Bev.',
        value: 10,
        fmt: (v) => `${Math.round(v)}×`,
        rowFmt: (v) => `${Math.round(v)}×`,
        delta: null,
        color: orange,
        unit: '',
        rows: [
          { name: '🔪 Delikte gegen Leib & Leben', v: 10 },
          { name: '🚨 Sexualdelikte', v: 9 },
          { name: '👥 Bevölkerungsanteil · Referenz', v: 1 },
        ],
      }),
  },
  trendCard('de-tax-quota', 'Steuer- & Abgabenquote Deutschland', 'Steuer- & Abgabenquote · 🇩🇪 · % des BIP', DE_TAX_QUOTA_PANEL, yellow, (v) => `${localePct(v, 1)}`, 259, eraMarkers(1965, 2023, [
    // Taxes plus social contributions as a share of GDP — the state's take hit
    // a historical high of ~39% in the early 2020s.
    // Rise through the 1970s: expansion of the welfare state and social
    // insurance contributions under Brandt/Schmidt.
    [1970, '🏛️ Sozialstaatsausbau'],
    [1991, '🧱 Soli 1991'],
    // Low point: final stage of the Schröder tax reform (top rate 53→42%,
    // base rate to 15%) took effect Jan 2005, plus a weak economy.
    [2005, '✂️ Steuerreform 2005'],
    [2021, '📈 Rekord ~39%'],
  ]), 'OECD Revenue Statistics · Steuern plus Sozialabgaben in % des BIP, gerundet; vor 1990 Westdeutschland.'),
  trendCard('de-power-prices', 'Strompreis Deutschland', 'Strompreis · 🇩🇪 · Haushalte · ct/kWh', DE_POWER_PRICE_PANEL, blue, (v) => `${localeNum(v, 0)} ct`, 271, eraMarkers(1991, 2025, [
    // The household price roughly tripled since 2000. The EEG renewables law
    // (2000) kicked off the green transition; the nuclear phase-out decision
    // (2011) and the 2022 energy crisis pushed it to among the world's highest.
    [2000, '🌱 EEG · Grüne Wende'],
    [2011, '☢️ Atomausstieg'],
    [2022, '⚡ Energiekrise'],
  ]), 'BDEW / Destatis / Eurostat · Haushaltsstrompreis inkl. Steuern und Umlagen, ct/kWh, gerundet.'),
  trendCard('berlin-warrants', 'Offene Haftbefehle · Berlin', 'Offene Haftbefehle · Berlin', BERLIN_WARRANTS_PANEL, red, (v) => `${localeNum(v / 1000, 0)}k`, 283, undefined, 'Senatsverwaltung für Justiz Berlin (parlamentarische Anfragen) und Presseberichte. Definitionen variieren — Größenordnung, frühe Werte grob geschätzt.'),
  trendCard('de-state-quota', 'Staatsquote Deutschland', 'Staatsquote · 🇩🇪 · Staatsausgaben % des BIP', DE_STATE_QUOTA_PANEL, orange, (v) => `${localePct(v, 1)}`, 227, eraMarkers(1880, 2024, [
    // Government spending as a share of GDP on the 1880–2024 axis: the secular
    // rise from ~10% in the Kaiserreich, the 1929 Depression, the 1975 oil
    // shock, the 1995 reunification peak, and Corona's ~51% record in 2020.
    [1929, '📉 Weltwirtschaftskrise'],
    [1975, '🛢️ Ölkrise'],
    [1990, '🧱 Wiedervereinigung'],
    [2020, '💸 Corona'],
  ]), 'Destatis / BMF / Eurostat · Staatsausgaben in % des BIP; vor 1950 historische Schätzungen, Kriegsjahre ausgespart, vor 1990 Westdeutschland.'),
  {
    id: 'de-old-age-ratio',
    title: 'Altenquotient Deutschland · die Rentnerlast',
    source:
      'Destatis · 65+ je 100 im Alter 20–64; ab 2024 15. koordinierte Bevölkerungsvorausberechnung (moderate Variante) — Prognose, keine Messung.',
    draw: (f) =>
      areaChart(f, {
        // Old-age dependency ratio, 65+ per 100 of working age (20-64). The
        // headline stays on today's ~40 rather than the panel's 2060 endpoint,
        // so it reads as the current burden, with the projected climb behind it.
        label: 'Altenquotient · 🇩🇪 · 65+ je 100 im Alter 20–64 · Prognose bis 2060',
        value: 40,
        fmt: (v) => `${localeNum(v, 0)}`,
        delta: null,
        seed: 281,
        color: red,
        data: DE_OLD_AGE_PANEL.series,
        ticks: DE_OLD_AGE_PANEL.ticks,
        xLabels: DE_OLD_AGE_PANEL.xLabels,
        // The near-doubling on the 1950–2060 axis: the boomer cohorts start
        // retiring in the 2020s, and everything right of "heute" is Destatis
        // projection, not measured data.
        markers: eraMarkers(1950, 2060, [
          [2024, '📍 heute'],
          [2035, '👴 Boomer in Rente'],
        ]),
      }),
  },
  {
    id: 'de-aging-nations',
    title: 'Alterung international · Rentnerlast',
    source: 'UN World Population Prospects 2024 · 65+ je 100 im Erwerbsalter (20–64), gerundet.',
    draw: (f) =>
      hBarChart(f, {
        // Old-age dependency ratio, people 65+ per 100 of working age (20-64),
        // UN World Population Prospects 2024, rounded. Japan leads the aged
        // world; Germany and Italy sit near the top; Africa's young nations
        // anchor the low end — the scale of the demographic divide.
        label: 'Alterung · 65+ je 100 Erwerbstätige',
        value: 30,
        fmt: (v) => `Ø ${localeNum(v, 0)}`,
        rowFmt: (v) => `${localeNum(v, 0)}`,
        delta: null,
        color: violet,
        unit: '',
        rows: [
          { name: 'Japan 🇯🇵', v: 55 },
          { name: 'Italien 🇮🇹', v: 41 },
          { name: 'Deutschland 🇩🇪', v: 40 },
          { name: 'Frankreich 🇫🇷', v: 38 },
          { name: 'Spanien 🇪🇸', v: 34 },
          { name: 'USA 🇺🇸', v: 30 },
          { name: 'China 🇨🇳', v: 22 },
          { name: 'Brasilien 🇧🇷', v: 16 },
          { name: 'Indien 🇮🇳', v: 11 },
          { name: 'Nigeria 🇳🇬', v: 6 },
        ],
      }),
  },
  {
    id: 'internet-shutdowns',
    title: 'Internet-Shutdowns · Top-Länder',
    source: 'Access Now · #KeepItOn-Report 2024.',
    draw: (f) =>
      hBarChart(f, {
        // Access Now / #KeepItOn 2024: 296 staatlich verhängte Netzsperren in
        // 54 Ländern — Rekord. Vier Staaten stehen für 69 % aller Fälle;
        // Myanmar (Militärregime) verdrängte Indien erstmals von Platz 1.
        label: 'Internet-Shutdowns · 🌐 · 2024',
        value: 296,
        delta: null,
        color: red,
        unit: '',
        fmt: (v) => `${v}`,
        rowFmt: (v) => `${v}`,
        rows: [
          { name: 'Myanmar', v: 85 },
          { name: 'Indien', v: 84 },
          { name: 'Pakistan', v: 21 },
          { name: 'Russland', v: 19 },
          { name: 'Irak', v: 5 },
          { name: 'Bangladesch', v: 4 },
          { name: 'Äthiopien', v: 3 },
        ],
      }),
  },
  {
    id: 'press-freedom-nations',
    title: 'Pressefreiheit · Ländervergleich',
    source:
      'Reporter ohne Grenzen · World Press Freedom Index, Länder-Scores 0–100; Werte für 2025 näherungsweise.',
    draw: (f) =>
      lineChart(f, {
        // RSF country scores (0–100, higher = freer). Germany stays high, the
        // US falls year on year, Thailand sits mid-table, and China and Saudi
        // Arabia hug the global floor.
        label: 'Pressefreiheit · RSF-Score · 0–100',
        value: PRESS_FREEDOM_COMPARE.deLatest,
        unit: '',
        fmt: (v) => localeNum(v, 1),
        delta: null,
        seed: 173,
        // Flags alone as legend labels — the full names overran the panel — and
        // hues spread across the wheel (green/blue/yellow/violet/red) so no two
        // adjacent lines share a warm tone.
        series: [
          { name: '🇩🇪', color: green, data: PRESS_FREEDOM_COMPARE.rows[0].data },
          { name: '🇺🇸', color: blue, data: PRESS_FREEDOM_COMPARE.rows[1].data },
          { name: '🇹🇭', color: yellow, data: PRESS_FREEDOM_COMPARE.rows[2].data },
          { name: '🇸🇦', color: violet, data: PRESS_FREEDOM_COMPARE.rows[4].data },
          { name: '🇨🇳', color: red, data: PRESS_FREEDOM_COMPARE.rows[3].data },
        ],
        ticks: PRESS_FREEDOM_COMPARE.ticks,
        xLabels: ['2022', '2023', '2024', 'heute'],
      }),
  },
  trendCard('book-bans', 'Buchverbote an US-Schulen', 'Buchverbote · 🇺🇸 · Fälle/Schuljahr', BOOK_BANS_PANEL, orange, (v) => (v >= 1000 ? `${localeNum(v / 1000, 1)}k` : `${v}`), 179, eraMarkers(2021, 2024, [
    [2023, '📚 Höhepunkt 23/24'],
  ]), 'PEN America · Index of School Book Bans, dokumentierte Fälle je Schuljahr.'),
  trendCard('jailed-journalists', 'Inhaftierte Journalisten', 'Inhaftierte Journalisten · 🌍', JAILED_JOURNALISTS_PANEL, red, deInt, 181, eraMarkers(1992, 2024, [
    // The crackdowns that step the curve up on the 1992–2024 axis: Egypt after
    // the 2013 coup, Turkey's mass jailings after the 2016 coup attempt, Belarus
    // after the 2020 election protests, and Israel's detention of Palestinian
    // journalists after the 2023 Gaza war (CPJ ranked it a top jailer that year).
    [2013, '🇪🇬 Ägypten 2013'],
    [2016, '🇹🇷 Türkei 2016'],
    [2020, '🇧🇾 Belarus 2020'],
    [2023, '🇮🇱 Israel 2023'],
  ]), 'CPJ · jährlicher Gefängnis-Zensus (Stichtag 1. Dezember); frühe Jahre näherungsweise.'),
  {
    id: 'asset-correlation',
    title: 'BTC · Gold · S&P 500 · M2 · seit 1915',
    source:
      'Fed H.6 (M2), historische Jahreswerte für Gold, S&P 500 und Bitcoin; näherungsweise, im Log-Raum interpoliert.',
    draw: (f) =>
      lineChart(f, {
        // Shared log dollar axis over 110 years: the absolute levels differ,
        // the correlation is in the shape — each M2 surge (1971 gold-standard
        // exit, 2008 QE, 2020 printing) drags gold, stocks and BTC up together.
        label: 'BTC · Gold · S&P 500 · M2 · log$ · seit 1915',
        value: ASSET_MEGACOMPARE.btcLatest,
        unit: '',
        fmt: (v) => `$${Math.round(v / 1000)}k`,
        delta: null,
        seed: 191,
        series: [
          { name: '💵 M2', color: green, data: ASSET_MEGACOMPARE.rows[0].data },
          { name: '🥇 Gold', color: yellow, data: ASSET_MEGACOMPARE.rows[1].data },
          { name: '📈 S&P 500', color: blue, data: ASSET_MEGACOMPARE.rows[2].data },
          { name: '₿ BTC', color: magenta, data: ASSET_MEGACOMPARE.rows[3].data },
        ],
        ticks: ASSET_MEGACOMPARE.ticks,
        xLabels: ['1915', '1952', '1988', 'heute'],
        markers: eraMarkers(1915, 2025, [
          [1971, '⛓️‍💥 Gold-Ende'],
          [2008, '🏦 QE'],
          [2020, '💸 Corona'],
        ]),
      }),
  },
  trendCard('internet', 'Menschen online weltweit', 'Internetnutzer', INTERNET_PANEL, blue, (v) => `${localeNum(v / 1e9, 1)} ${tr('Mrd')}`, 103, [
    // Significant inflection points on the 1990–2024 span. at = (year-1990)/34.
    { at: 0.03, label: '🌐 WWW frei' },
    { at: 0.5, label: '📱 Smartphone' },
    { at: 0.82, label: '🌍 Halbe Menschheit' },
  ], 'ITU · Internetnutzer weltweit.'),
  trendCard('world-hunger', 'Welthunger · Unterernährte', 'Unterernährte weltweit · SDG 2', HUNGER_PANEL, red, (v) => `${Math.round(v)} ${tr('Mio')}`, 71, eraMarkers(2005, 2023, [
    [2017, '📉 Tiefpunkt'],
    [2020, '🦠 Pandemie'],
  ]), 'FAO · The State of Food Security and Nutrition (2024). Methodik mehrfach revidiert — Größenordnungen.'),
  trendCard('extreme-poverty', 'Extreme Armut weltweit', 'Extreme Armut · < $2,15/Tag · SDG 1', EXTREME_POVERTY_PANEL, yellow, (v) => `${localePct(v, 1)}`, 73, eraMarkers(1990, 2024, [
    [2020, '🦠 Pandemie · 1. Anstieg seit Jahrzehnten'],
  ]), 'Weltbank PIP · Anteil der Weltbevölkerung unter 2,15 $/Tag (KKP 2017).'),
  trendCard('nuke-tests', 'Atomtests pro Jahr', 'Atomtests · seit 1945', NUKE_TESTS_PANEL, red, deInt, 107, eraMarkers(1945, 2024, [
    [1963, '☢️ Teststopp 1963'],
    [1996, '✍️ CTBT 1996'],
    [2017, '🇰🇵 Nordkorea'],
  ]), 'Arms Control Association · Atomtests pro Jahr.'),
  {
    id: 'fertility',
    title: 'Geburtenrate der Kontinente',
    source:
      'UN World Population Prospects 2024; vor 1950 Gapminder-/Our-World-in-Data-Schätzungen (gröber).',
    draw: (f) =>
      lineChart(f, {
        label: 'Geburten pro Frau',
        value: CONTINENT_FERTILITY.world,
        unit: '',
        fmt: (v) => localeNum(v, 1),
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
  trendCard('dollar', 'Kaufkraft des Dollars seit 1913', '1913er-Dollar · Restwert', DOLLAR_PANEL, yellow, (v) => `${localeNum(v * 100, 0)}¢`, 127, eraMarkers(1913, 2024, [
    // Fed founding at the very start, and the 1971 end of the gold peg after
    // which the decline steepens, on the 1913–2024 axis.
    [1913, '🏦 Fed 1913'],
    [1971, '⛓️‍💥 Gold-Ende 1971'],
  ]), 'BLS · Verbraucherpreisindex (CPI): Restkaufkraft eines Dollars von 1913.'),
  {
    id: 'real-wages',
    title: 'Nominal- vs. Reallohn · Deutschland',
    source:
      'Destatis · Nominal- und Reallohnindex (2015 = 100); frühere Jahre aus der Verdienststatistik rückgerechnet.',
    draw: (f) =>
      lineChart(f, {
        // The gap between the two lines is the purchasing-power story: nominal
        // pay climbs, real pay (after inflation) stands nearly still.
        label: 'Lohnindex · 🇩🇪 · 2015 = 100',
        value: DE_WAGE_COMPARE.realLatest,
        unit: '',
        fmt: (v) => localeNum(v, 0),
        delta: null,
        seed: 239,
        series: [
          { name: 'Nominallohn', color: blue, data: DE_WAGE_COMPARE.rows[0].data },
          { name: 'Reallohn', color: yellow, data: DE_WAGE_COMPARE.rows[1].data },
        ],
        ticks: DE_WAGE_COMPARE.ticks,
        xLabels: ['2000', '2008', '2016', 'heute'],
        markers: eraMarkers(2000, 2024, [[2022, '📉 Reallohn-Einbruch']]),
      }),
  },
  {
    id: 'homeownership',
    title: 'Wohneigentumsquote · Europa',
    source: 'Eurostat 2023 · Wohneigentumsquote der Haushalte, gerundet.',
    draw: (f) =>
      hBarChart(f, {
        // Owner-occupancy rate, share of households living in their own home
        // (Eurostat 2023, rounded). Germany and Switzerland sit at the very
        // bottom of Europe — a continent of renters at its wealthy core.
        label: 'Wohneigentum · Anteil der Haushalte',
        value: 69,
        fmt: (v) => `Ø ${localePct(v, 0)}`,
        rowFmt: (v) => `${localePct(v, 0)}`,
        delta: null,
        color: blue,
        unit: '',
        rows: [
          { name: 'Rumänien', v: 95 },
          { name: 'Slowakei', v: 93 },
          { name: 'Kroatien', v: 91 },
          { name: 'Ungarn', v: 90 },
          { name: 'Polen', v: 87 },
          { name: 'Spanien', v: 75 },
          { name: 'Italien', v: 75 },
          { name: 'EU-27', v: 69 },
          { name: 'Frankreich', v: 63 },
          { name: 'Österreich', v: 54 },
          { name: 'Deutschland', v: 47 },
          { name: 'Schweiz', v: 42 },
        ],
      }),
  },
  {
    id: 'cb-balance',
    title: 'Zentralbankbilanzen · Fed vs. EZB',
    source:
      'Fed H.4.1 und EZB-Wochenausweis · Bilanzsummen in Billionen US-$ bzw. Euro, gerundet.',
    draw: (f) =>
      lineChart(f, {
        // Near-flat until 2008, then two vertical legs — QE and the 2020
        // pandemic printing that roughly doubled both balance sheets.
        label: 'Bilanzsumme · Fed vs. EZB · Bio.',
        value: CB_BALANCE_COMPARE.fedLatest,
        unit: '',
        fmt: (v) => `${localeNum(v, 1)} ${tr('Bio.')}`,
        delta: null,
        seed: 243,
        series: [
          { name: '🇺🇸 Fed', color: blue, data: CB_BALANCE_COMPARE.rows[0].data },
          { name: '🇪🇺 EZB', color: violet, data: CB_BALANCE_COMPARE.rows[1].data },
        ],
        ticks: CB_BALANCE_COMPARE.ticks,
        xLabels: ['2000', '2008', '2016', 'heute'],
        markers: eraMarkers(2000, 2024, [
          [2008, '🏦 QE 2008'],
          [2020, '💸 Corona 2020'],
        ]),
      }),
  },
  {
    id: 'wealth-divergence',
    title: 'Vermögen: Milliardäre vs. Löhne',
    source:
      'Forbes (Milliardärsvermögen weltweit) und Destatis-Reallohnindex, beide auf 2010 = 1× indexiert.',
    draw: (f) =>
      lineChart(f, {
        // Total billionaire net worth (Forbes) against Germany's real wage,
        // both indexed to 2010 = 1×. The asset tier compounds ~4×, wages after
        // inflation gain barely a tenth — the Cantillon effect made visible.
        label: 'Vermögen · Milliardäre vs. Reallohn · 2010 = 1×',
        value: WEALTH_DIVERGE_COMPARE.richLatest,
        unit: '',
        fmt: (v) => `${localeNum(v, 1)}×`,
        delta: null,
        seed: 247,
        series: [
          { name: '💰 Milliardäre', color: red, data: WEALTH_DIVERGE_COMPARE.rows[0].data },
          { name: '👷 Reallohn 🇩🇪', color: blue, data: WEALTH_DIVERGE_COMPARE.rows[1].data },
        ],
        ticks: WEALTH_DIVERGE_COMPARE.ticks,
        xLabels: ['2010', '2015', '2019', 'heute'],
        markers: eraMarkers(2010, 2024, [[2020, '💸 Corona']]),
      }),
  },
  {
    id: 'food-fertilizer',
    title: 'Nahrungs- & Düngemittelpreise',
    source:
      'FAO Food Price Index (2014–16 = 100) und Weltbank-Düngemittelindex, auf dasselbe Basisfenster umgerechnet.',
    draw: (f) =>
      lineChart(f, {
        // Fertilizer swings harder than food and drags it along: natural gas
        // is the feedstock for nitrogen fertilizer, so every energy shock —
        // 2008, the 2022 gas crisis — spikes fertilizer first, then food.
        label: 'Preisindex · Nahrung & Dünger',
        value: FOOD_FERT_COMPARE.foodLatest,
        unit: '',
        fmt: deInt,
        delta: null,
        seed: 251,
        series: [
          { name: '🌾 Nahrung', color: green, data: FOOD_FERT_COMPARE.rows[0].data },
          { name: '🧪 Dünger', color: orange, data: FOOD_FERT_COMPARE.rows[1].data },
        ],
        ticks: FOOD_FERT_COMPARE.ticks,
        xLabels: ['2000', '2008', '2016', 'heute'],
        markers: eraMarkers(2000, 2024, [
          [2008, '🌾 Preiskrise'],
          [2022, '⛽ Gaskrise'],
        ]),
      }),
  },
  trendCard('pension-level', 'Rentenniveau · Deutschland', 'Rentenniveau · 🇩🇪 · % des Durchschnittslohns', DE_PENSION_LEVEL_PANEL, magenta, (v) => `${localePct(v, 0)}`, 253, eraMarkers(1990, 2040, [
    // The legislated 48% floor holds only through 2039; projections then slide.
    [2025, '⚖️ Haltelinie 48%'],
    [2039, '📉 danach ~45%'],
  ]), 'Rentenversicherungsbericht · Sicherungsniveau vor Steuern; die Werte nach ~2024 sind amtliche Projektion.'),
  trendCard('rent-burden', 'Mietbelastung · Großstädte Deutschland', 'Mietbelastung · Neuvermietung · 🇩🇪 Top-7-Städte · % des Einkommens', DE_RENT_BURDEN_PANEL, red, (v) => `${localePct(v, 0)}`, 257, undefined, 'empirica / IW-Schätzungen · Median-Angebotsmiete zu Median-Nettoeinkommen, Top-7-Städte, gerundet.'),
  {
    id: 'armies',
    title: 'Größte Armeen · aktive Soldaten',
    source: 'IISS Military Balance 2024 · aktive Soldaten.',
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
    id: 'military-per-soldier',
    title: 'Militärausgaben je Soldat',
    source:
      'SIPRI 2024 (Budgets) geteilt durch aktive Soldaten (IISS Military Balance 2024), gerundet.',
    draw: (f) =>
      hBarChart(f, {
        // Budget (SIPRI 2024) divided by active personnel (IISS 2024): how
        // capital- vs. manpower-intensive an army is. Western forces spend
        // ~$500-750k per head; manpower-heavy armies a fraction of that.
        label: 'Ausgaben je aktivem Soldaten · 2024',
        value: 750_000,
        delta: null,
        color: orange,
        unit: '$',
        rows: [
          { name: 'USA', v: 750_000 },
          { name: 'Großbritannien', v: 554_000 },
          { name: 'Deutschland', v: 489_000 },
          { name: 'Frankreich', v: 317_000 },
          { name: 'Saudi-Arabien', v: 313_000 },
          { name: 'China', v: 154_000 },
          { name: 'Russland', v: 113_000 },
          { name: 'Südkorea', v: 96_000 },
          { name: 'Indien', v: 59_000 },
        ],
      }),
  },
  {
    id: 'military-gdp',
    title: 'Militärlast · % des BIP',
    source: 'SIPRI 2024 · Militärausgaben in % des BIP.',
    draw: (f) =>
      hBarChart(f, {
        // Military burden: spending as a share of GDP (SIPRI 2024). War and
        // siege economies top it; the big absolute spenders sit far lower.
        label: 'Militärausgaben · % des BIP',
        value: 34,
        fmt: (v) => `${localePct(v, 1)}`,
        rowFmt: (v) => `${localePct(v, 1)}`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Ukraine', v: 34.0 },
          { name: 'Israel', v: 8.8 },
          { name: 'Algerien', v: 8.0 },
          { name: 'Saudi-Arabien', v: 7.3 },
          { name: 'Oman', v: 7.3 },
          { name: 'Russland', v: 7.1 },
          { name: 'USA', v: 3.4 },
          { name: 'Indien', v: 2.3 },
          { name: 'Deutschland', v: 1.9 },
          { name: 'China', v: 1.7 },
        ],
      }),
  },
  {
    id: 'wealth',
    title: 'Globale Vermögensverteilung',
    source: 'UBS Global Wealth Report 2024 · Anteile am globalen Nettovermögen.',
    draw: (f) =>
      wealthSplit(f, {
        // UBS Global Wealth Report 2024 — share of global net wealth per
        // population group. The poorer half of humanity holds ~1 percent.
        label: 'Wem gehört das Vermögen?',
        value: 454e12,
        fmt: (v) => `$${Math.round(v / 1e12)} ${tr('Bio.')}`,
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
    source: 'World Prison Brief · Gefangene je 100k Einwohner, Stand 2023–25.',
    draw: (f) =>
      hBarChart(f, {
        // World Prison Brief (2023–25 figures), prisoners per 100k
        // population, shown as share of the population behind bars.
        // Germany and Japan anchor the low end for contrast.
        label: 'Inhaftierte · Anteil der Bevölkerung',
        value: 11.5e6,
        fmt: (v) => `${localeNum(v / 1e6, 1)} ${tr('Mio')}`,
        rowFmt: (v) => `${localePct(v / 1000, 2)}`,
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
    source: 'WHO / NCD-RisC 2022 · Adipositas-Prävalenz Erwachsener (BMI ≥ 30), Schätzwerte.',
    draw: (f) =>
      hBarChart(f, {
        // Adult obesity prevalence (BMI >= 30), WHO / NCD-RisC 2022
        // estimates. Nauru tops the global list; Japan and Vietnam
        // anchor the low end for contrast.
        label: 'Adipositas · Anteil der Erwachsenen',
        value: 8.9e8,
        fmt: (v) => `${localeNum(v / 1e6, 0)} ${tr('Mio')}`,
        rowFmt: (v) => `${localePct(v, 0)}`,
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
    source: 'UN World Population Prospects 2024 / Our World in Data, gerundet.',
    draw: (f) =>
      hBarChart(f, {
        // Life expectancy at birth, both sexes (UN WPP 2024 / OWID,
        // rounded). Top and bottom of the global range plus Germany,
        // the US and India as reference points in between.
        label: 'Lebenserwartung · Jahre',
        value: 73.3,
        fmt: (v) => `Ø ${localeNum(v, 1)} J.`,
        rowFmt: (v) => `${localeNum(v, 1)} J.`,
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
    source:
      'OECD Taxing Wages 2024 · Abgabenkeil für Alleinstehende ohne Kinder, in % der Arbeitskosten.',
    draw: (f) =>
      hBarChart(f, {
        // OECD tax wedge 2024: income tax plus employee and employer
        // social contributions, single earner without children, as a
        // share of total labor cost. Germany is second-highest in the
        // OECD; Switzerland sits near the bottom.
        label: 'Abgabenkeil · Single',
        value: 34.9,
        fmt: (v) => `Ø ${localePct(v, 1)}`,
        rowFmt: (v) => `${localePct(v, 1)}`,
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
    source:
      'Eurostat / GlobalPetrolPrices · Haushaltsstrompreise inkl. Steuern, gerundete 2024er-Werte.',
    draw: (f) =>
      hBarChart(f, {
        // Household electricity prices incl. taxes, euro cents per kWh,
        // rounded 2024 figures (Eurostat / GlobalPetrolPrices). Germany
        // is among the most expensive markets worldwide.
        label: 'Strompreis · Haushalte · ct/kWh',
        value: 40,
        fmt: (v) => `${localeNum(v, 0)} ct`,
        rowFmt: (v) => `${localeNum(v, 0)} ct`,
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
    source:
      'Transparency International · Corruption Perceptions Index 2024, invertiert dargestellt (100 − Score).',
    draw: (f) =>
      choroplethMap(f, {
        // Transparency International CPI 2024, inverted (100 - score) so
        // the most corrupt countries render darkest on the red ramp.
        // The top-5 list below calls out the worst performers.
        label: 'Korruption · kräftiger rot = korrupter',
        value: 57,
        fmt: (v) => `Ø ${localeNum(v, 0)}/100`,
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
        rowFmt: (v) => `${localeNum(v, 0)} /100`,
      }),
  },
  {
    id: 'modern-slavery',
    title: 'Moderne Sklaverei · Länder',
    source:
      'Walk Free · Global Slavery Index 2023; Weltwert ~50 Mio nach ILO/Walk Free 2021. Schätzwerte.',
    draw: (f) =>
      hBarChart(f, {
        // Global Slavery Index 2023 (Walk Free) — people living in modern
        // slavery: forced labour, debt bondage, forced marriage. ~50M
        // worldwide per the ILO/Walk Free 2021 global estimate; absolute
        // counts are highest in the most populous countries.
        label: 'Moderne Sklaverei · Menschen',
        value: 50e6,
        fmt: (v) => `${localeNum(v / 1e6, 0)} ${tr('Mio')}`,
        rowFmt: (v) => `${localeNum(v / 1e6, 1)} ${tr('Mio')}`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Indien 🇮🇳', v: 11.0e6 },
          { name: 'China 🇨🇳', v: 5.8e6 },
          { name: 'Nordkorea 🇰🇵', v: 2.7e6 },
          { name: 'Pakistan 🇵🇰', v: 2.3e6 },
          { name: 'Russland 🇷🇺', v: 1.9e6 },
          { name: 'Indonesien 🇮🇩', v: 1.8e6 },
          { name: 'Nigeria 🇳🇬', v: 1.6e6 },
          { name: 'Türkei 🇹🇷', v: 1.3e6 },
          { name: 'Bangladesch 🇧🇩', v: 1.2e6 },
          { name: 'USA 🇺🇸', v: 1.1e6 },
        ],
      }),
  },
  {
    id: 'us-bases',
    title: 'US-Militärstützpunkte weltweit',
    source: 'US-Verteidigungsministerium (DMDC / Base Structure Report), via SIPER.',
    draw: (f) =>
      choroplethMap(f, {
        // US troops on foreign soil by host country (DoD DMDC, via SIPER).
        // The USA officially runs ~587 bases in at least 42 foreign countries;
        // the map shades each host by troop count, darkest where most sit.
        label: 'US-Truppen im Ausland · ≥ 42 Länder',
        value: 42,
        fmt: (v) => `${v} ${tr('Länder')}`,
        valueByIso: US_TROOPS_ABROAD,
        world: live.worldMap,
        rows: [
          { name: 'Japan', v: 53700 },
          { name: 'Deutschland', v: 35000 },
          { name: 'Südkorea', v: 24000 },
          { name: 'Kuwait', v: 13500 },
          { name: 'Italien', v: 12500 },
        ],
        rowFmt: (v) => `${Math.round(v / 1000)}k ${tr('Soldaten')}`,
        source: 'DoD DMDC / Base Structure Report · via SIPER',
      }),
  },
  {
    id: 'us-wars',
    title: 'Kriege der USA · seit 1945',
    source:
      'Zusammenstellung nach Daniele Ganser („Imperium USA"). Totenzahlen sind Mittelwerte gängiger Schätzungen, teils stark umstritten — Größenordnungen, keine exakten Zahlen.',
    draw: (f) =>
      timelineChart(f, {
        // US wars and interventions as catalogued by Daniele Ganser
        // ("Imperium USA" / "Illegale Kriege"). Death tolls are midpoints
        // of common estimates and heavily contested — treat as magnitudes.
        // Only wars with more than 10k deaths — covert coups (Iran 1953,
        // Guatemala 1954, Bay of Pigs) and sub-10k interventions (Serbia) are
        // left out so the timeline stays a war chart, not a regime-change list.
        label: 'US-Kriege · Tote seit 1945',
        value: 7.156e6,
        fmt: (v) => `${localeNum(v / 1e6, 1)} ${tr('Mio')}`,
        color: red,
        yearStart: 1946,
        yearEnd: 2026,
        source: 'nach Daniele Ganser · Schätzwerte, teils umstritten',
        events: [
          { name: 'Korea', from: 1950, to: 1953, deaths: 3_000_000 },
          { name: 'Vietnam', from: 1964, to: 1975, deaths: 3_000_000 },
          // Laos & Kambodscha: the covert bombing campaigns alongside Vietnam;
          // direct US military action, so they belong on a war timeline. Death
          // tolls are wide ranges — conservative midpoints here.
          { name: 'Laos', from: 1964, to: 1973, deaths: 50_000 },
          { name: 'Kambodscha', from: 1969, to: 1973, deaths: 100_000 },
          { name: 'Nicaragua · Contras', from: 1981, to: 1990, deaths: 30_000 },
          { name: 'Golfkrieg', from: 1990, to: 1991, deaths: 100_000 },
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
    source:
      'Mittelwerte gängiger Schätzungen (SOHR, UN, AU, Costs of War); teils inkl. indirekter Opfer, die Spannen sind groß.',
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
    source:
      'SAMHSA · National Survey on Drug Use and Health: depressive Episode im Jahr, 12–17 J.',
    draw: (f) =>
      lineChart(f, {
        // SAMHSA NSDUH: past-year major depressive episode, ages 12–17. Flat
        // near 8% through 2011, then climbing steeply — tracks the smartphone era.
        label: 'Depressive Episode im Jahr · 🇺🇸 · 12–17 J.',
        value: TEEN_MDE.latest,
        unit: '',
        fmt: (v) => `${localePct(v, 0)}`,
        delta: null,
        seed: 187,
        series: [{ name: 'Betroffene', color: magenta, data: TEEN_MDE.data }],
        ticks: TEEN_MDE.ticks,
        xLabels: ['2004', '2010', '2016', '2022'],
        shade: { mask: TEEN_MDE.mask, label: '📱 Soziale Medien' },
      }),
  },
  trendCard('female-lfp', 'Frauenerwerbsquote · Deutschland', 'Frauenerwerbsquote · 🇩🇪 · seit 1882', DE_FEMALE_LFP_PANEL, aqua, (v) => `${localePct(v, 0)}`, 211, eraMarkers(1882, 2023, [
    // One belegbarer milestone: from 1958 married women no longer needed the
    // husband's consent to take a job (Gleichberechtigungsgesetz).
    [1958, '⚖️ Gleichberechtigung 1958'],
  ]), 'Volkszählungen / Destatis; Definitionen wechseln, vor 1990 nur Westdeutschland — frühe Werte grob und nur begrenzt vergleichbar.'),
  {
    id: 'teen-screen',
    title: 'Bildschirmzeit US-Teenager',
    source:
      'Nielsen / Kaiser Family Foundation (TV-Ära) und Common Sense Media Census — grob zusammengefügt, Definitionen wechseln; die Form ist die Aussage.',
    draw: (f) =>
      areaChart(f, {
        label: 'Unterhaltungsmedien · 🇺🇸 · 13–18 J. · Std./Tag',
        value: TEEN_SCREEN_PANEL.latest,
        fmt: (v) => `${localeNum(v, 1)} h`,
        delta: null,
        seed: 193,
        color: violet,
        data: TEEN_SCREEN_PANEL.series,
        ticks: TEEN_SCREEN_PANEL.ticks,
        xLabels: ['1955', '1978', '2000', 'heute'],
        // Era markers across the 1955–2023 span.
        markers: eraMarkers(1955, 2023, [
          [1965, '📺 Farb-TV'],
          [1995, '🎮 PlayStation'],
          [2010, '📱 Soziale Medien'],
        ]),
      }),
  },
  trendCard('teen-antidepressants', 'Antidepressiva bei US-Jugendlichen', 'Antidepressiva-Rezepte · 🇺🇸 · 12–17 J. · Anteil', TEEN_RX_PANEL, aqua, (v) => `${localePct(v, 1)}`, 199, eraMarkers(1970, 2022, [
    // The climb opens with the SSRI era and steepens in the smartphone years,
    // on the 1970–2022 axis. The 2012 line is the correlation, not proof.
    [1988, '💊 Prozac 1988'],
    [2012, '📱 Soziale Medien'],
  ]), 'IQVIA / CDC ab 2010; frühere Werte grob geschätzt — jugendspezifische Verordnungsdaten sind weit zurück spärlich.'),
  {
    id: 'de-energy-mix',
    title: 'Deutscher Strommix · Kohle, Kernkraft, Erneuerbare',
    source:
      'BNetzA / Fraunhofer ISE · installierte Netto-Leistung in GW; Nennleistung, nicht gesicherte Leistung.',
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
          { name: 'Kernkraft', color: violet, data: DE_ENERGY_MIX.rows[1].data },
          { name: 'Wind + Solar', color: green, data: DE_ENERGY_MIX.rows[2].data },
        ],
        ticks: DE_ENERGY_MIX.ticks,
        xLabels: ['1990', '2001', '2013', '2024'],
      }),
  },
  {
    id: 'obesity-fastfood',
    title: 'Adipositas USA & die Fast-Food-Ära',
    source:
      'NHANES ab 1962; frühere Werte grobe Schätzungen aus frühen Versicherungs- und Vermessungsdaten.',
    draw: (f) =>
      lineChart(f, {
        // NHANES adult obesity; the shaded band marks the fast-food era —
        // 1970s drive-throughs and cheap corn syrup, the decades it tripled.
        label: 'Adipositas · 🇺🇸 Erwachsene',
        value: US_OBESITY_FASTFOOD.latest,
        unit: '',
        fmt: (v) => `${localePct(v, 0)}`,
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
    source:
      'Comparitech · „Most surveilled cities"; gerundete Schätzwerte, je nach Quelle abweichend.',
    draw: (f) =>
      hBarChart(f, {
        // Public CCTV cameras per city (Comparitech "Most surveilled cities",
        // rounded). Chinese megacities dominate; Delhi and London are the
        // non-Chinese outliers. Counts are estimates and vary by source.
        label: 'CCTV-Kameras je Stadt',
        value: 4.6e6,
        fmt: (v) => `${localeNum(v / 1e6, 1)} ${tr('Mio')}`,
        rowFmt: (v) => (v >= 1e6 ? `${localeNum(v / 1e6, 2)} ${tr('Mio')}` : `${Math.round(v / 1000)}k`),
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
  trendCard('cameras-world', 'Überwachungskameras weltweit', 'Installierte CCTV-Kameras', CAMERAS_PANEL, aqua, (v) => `${localeNum(v / 1e9, 2)} ${tr('Mrd')}`, 183, eraMarkers(2000, 2025, [
    [2008, '🏅 Peking · Ausbaustart China'],
    [2021, '🎥 1 Mrd weltweit'],
  ]), 'IHS Markit / Marktschätzungen · installierte Überwachungskameras weltweit; vor 2010 grob rückgeschätzt.'),
  {
    id: 'gov-requests-country',
    title: 'Behördenanfragen an Big Tech · Top-Länder',
    source:
      'Transparenzberichte von Meta, Google und Apple · Behördenanfragen zu Nutzerdaten pro Jahr, näherungsweise.',
    draw: (f) =>
      hBarChart(f, {
        // Government requests for user data, per year (Meta + Google/Apple
        // transparency reports, approximate, latest reporting period).
        label: 'Behördenanfragen zu Nutzerdaten',
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
    source: 'Google Transparency Report · behördliche Löschanfragen pro Jahr, näherungsweise.',
    draw: (f) =>
      hBarChart(f, {
        // Government requests to remove content, per year (Google Transparency
        // Report, approximate). Russia dominates by a wide margin.
        label: 'Behörden-Löschanfragen · Google/YouTube · pro Jahr',
        value: 32_000,
        delta: null,
        color: red,
        unit: '',
        fmt: (v) => `${Math.round(v / 1000)}k`,
        rowFmt: (v) => `${localeNum(v / 1000, 1)}k`,
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
    id: '5g-stations',
    title: '5G-Ausbau · führende Länder',
    source: 'Betreiber- und Regulierungsbehörden-Angaben, gerundete Schätzwerte.',
    draw: (f) =>
      hBarChart(f, {
        // Installed 5G base stations per country (operator/regulator figures,
        // rounded estimates). China counts base stations in the millions and
        // dwarfs everyone — well over half the world's total.
        label: '5G-Basisstationen · Schätzwerte',
        value: 5.1e6,
        fmt: (v) => `${localeNum(v / 1e6, 1)} ${tr('Mio')}`,
        rowFmt: (v) => (v >= 1e6 ? `${localeNum(v / 1e6, 2)} ${tr('Mio')}` : `${Math.round(v / 1000)}k`),
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
    source:
      'IWF / nationale Statistiken, Jahresraten ≈ 2024, gerundet; Krisenwerte schwanken stark — Größenordnungen.',
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
    source:
      'UN Watch · länderspezifische Resolutionen der UN-Generalversammlung seit 2015, gerundet.',
    draw: (f) =>
      hBarChart(f, {
        // UN General Assembly country-specific resolutions, cumulative since
        // 2015 (UN Watch tallies, rounded): 140 against Israel vs. 68 against
        // all other countries combined. The USA's count is the recurring
        // annual Cuba-embargo resolution.
        label: 'UN-Resolutionen gegen Staaten · seit 2015',
        value: 190,
        fmt: deInt,
        rowFmt: deInt,
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
    source:
      'Destatis / historische Statistik · Eheschließungen und Scheidungen je 1.000 Einwohner; frühe Jahre gerundet.',
    draw: (f) =>
      lineChart(f, {
        // Destatis: marriages halve across the century, divorces peak ~2004
        // and fall since — the "ever more divorces" belief no longer holds.
        label: 'Heiraten & Scheidungen · 🇩🇪 · je 1000 Einw.',
        value: DE_FAMILY.marLatest,
        unit: '',
        fmt: (v) => localeNum(v, 1),
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
  trendCard('single-households', 'Einpersonenhaushalte · Deutschland', 'Einpersonenhaushalte · 🇩🇪 · Anteil · seit 1900', DE_SINGLE_HH_PANEL, violet, (v) => `${localePct(v, 0)}`, 193, eraMarkers(1900, 2022, [
    // Neutral legal/demographic milestones that bracket the steep 1961–1980
    // rise. Deliberately not a single "feminism" cause — the trend is driven
    // by the pill, no-fault divorce, urbanisation and an ageing (widowed)
    // population together.
    [1961, '💊 Pille'],
    [1977, '⚖️ Scheidungsreform'],
  ]), 'Destatis · Anteil der Einpersonenhaushalte; vor 1950 Schätzungen.'),
  {
    id: 'digital-id',
    title: 'Digitale ID · Bevölkerungsabdeckung',
    source: 'Weltbank ID4D / nationale Programme, gerundete Schätzwerte.',
    draw: (f) =>
      hBarChart(f, {
        // Share of the population with a usable national digital ID (World
        // Bank ID4D / national programs, rounded estimates). Estonia and
        // India's Aadhaar are near-universal; Switzerland's state e-ID only
        // launches around 2026, so it anchors the low end.
        label: 'Digitale ID · Bevölkerungsabdeckung',
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
  trendCard(
    'digital-id-gap',
    'Digitale ID · die letzte Milliarde',
    'Menschen ohne amtliche ID · weltweit',
    ID_GAP_PANEL,
    aqua,
    (v) => `${localeNum(v / 1e9, 2)} ${tr('Mrd')}`,
    373,
    eraMarkers(2016, 2025, [
      [2017, '🇮🇳 Aadhaar · 1 Mrd erfasst'],
      [2024, '🇪🇺 eIDAS 2.0'],
    ]),
    'Weltbank ID4D Global Dataset · Menschen ohne amtlichen Identitätsnachweis; Methodik mehrfach revidiert, letzter Wert grob extrapoliert.',
  ),
  trendCard(
    'age-verify',
    'Ausweispflicht fürs Netz',
    'Alterskontrolle online · US-Staaten mit Gesetz',
    AGE_VERIF_PANEL,
    orange,
    deInt,
    347,
    eraMarkers(2022, 2025, [
      [2023, 'Louisiana'],
      [2025, 'Supreme Court'],
    ]),
    'Free Speech Coalition / Age-Verification-Tracker · US-Staaten mit Alterskontroll-Gesetz, gerundet.',
  ),
  trendCard(
    'age-verify-nations',
    'Ausweis fürs Internet · Länder',
    'Alterskontrolle online · Länder mit Pflicht',
    AGE_VERIF_NATIONS_PANEL,
    orange,
    deInt,
    353,
    eraMarkers(2019, 2025, [
      [2023, '🇫🇷 SREN-Gesetz'],
      [2024, '🇦🇺 Social-Media-Verbot'],
      [2025, '🇬🇧 Online Safety Act'],
    ]),
    'Nationale Gesetze (u. a. 🇬🇧 Online Safety Act, 🇦🇺 U16-Verbot) · Länder mit Alterskontroll-Pflicht online, grobe Zählung.',
  ),
  trendCard(
    'air-pnr',
    'Überwachung im Flugverkehr',
    'Fluggastdaten · Staaten mit Erfassung',
    PNR_PANEL,
    aqua,
    deInt,
    359,
    eraMarkers(2005, 2025, [
      [2014, 'UN-Resolution 2178'],
      [2017, 'UN: PNR-Pflicht'],
      [2023, 'ICAO-Standard'],
    ]),
    'UN CTED / ICAO · Staaten, die Fluggastdaten (API/PNR) erfassen, gerundete Schätzwerte.',
  ),
  trendCard(
    'kyc-crypto',
    'KYC-Pflicht für Krypto',
    'Länder mit Travel-Rule-Gesetz',
    KYC_PANEL,
    yellow,
    deInt,
    367,
    eraMarkers(2019, 2025, [
      [2019, 'FATF-Empfehlung'],
      [2024, 'EU-Geldtransfer-VO'],
    ]),
    'FATF Targeted Updates · Länder mit KYC-Pflicht für Kryptotransfers (Travel Rule), gerundet.',
  ),
  {
    id: 'alcohol-nations',
    title: 'Alkoholkonsum international',
    source: 'WHO 2019 · registrierter Alkoholkonsum, Liter Reinalkohol pro Kopf (15+).',
    draw: (f) =>
      hBarChart(f, {
        // Recorded alcohol per capita, litres of pure alcohol, adults 15+
        // (WHO 2019). Eastern Europe tops it; Germany drinks heavily too,
        // Türkiye anchors the low end.
        label: 'Alkohol · Liter Reinalkohol pro Kopf',
        value: 15.2,
        fmt: (v) => `${localeNum(v, 1)} L`,
        rowFmt: (v) => `${localeNum(v, 1)} L`,
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
    source:
      'CDC WONDER · alkoholbedingte Todesfälle (Lebererkrankungen, Vergiftungen; ohne Verkehrstote).',
    draw: (f) =>
      areaChart(f, {
        // CDC: alcohol-induced deaths rose steadily, then spiked ~40% in the
        // pandemic — economic and social stress driving heavier drinking.
        label: 'Alkoholtote · 🇺🇸 · pro Jahr',
        value: US_ALCOHOL_DEATHS_PANEL.latest,
        fmt: (v) => `${localeNum(v / 1000, 0)}k`,
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
    source: 'C40-Mitgliederliste; Metro-Einwohnerzahlen nach UN-Schätzungen, gerundet.',
    draw: (f) =>
      hBarChart(f, {
        // C40 is a ~100-city climate network (Bloomberg-funded). Many members
        // are among the world's largest urban agglomerations (UN metro pops).
        label: 'Größte C40-Städte · Einwohner (Metro)',
        value: 37,
        fmt: (v) => `${Math.round(v)} ${tr('Mio')}`,
        rowFmt: (v) => `${Math.round(v)} ${tr('Mio')}`,
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
    source:
      'Oxford COVID-19 Government Response Tracker (OxCGRT) via Our World in Data · Stringency-Index, Ø 2020–22, näherungsweise. Misst die Härte, nicht die Wirkung.',
    draw: (f) =>
      hBarChart(f, {
        // Oxford COVID-19 Government Response Tracker (OxCGRT) stringency
        // index, 0–100, averaged over the pandemic (2020–2022) via OWID.
        // Measures how restrictive a government's response was overall
        // (lockdowns, closures, travel bans), NOT how well it worked.
        // China's zero-COVID keeps it hardest for longest; Sweden anchors
        // the low end. Approximate averages — treat as magnitudes.
        label: 'Härte der Corona-Maßnahmen · Ø 2020–22',
        value: 62,
        fmt: (v) => `Ø ${Math.round(v)}/100`,
        rowFmt: deInt,
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
    source:
      'Presseberichte 2020–21, gerundete Schätzwerte; was als „Lockdown" zählt, variiert je Quelle.',
    draw: (f) =>
      hBarChart(f, {
        // Cumulative days under hard stay-at-home lockdown by city, as widely
        // reported in the press (2020–2021). Melbourne's 262 days is the
        // world record for a single city; Buenos Aires and Manila follow.
        // Rounded estimates — definitions of "lockdown" vary by source.
        label: 'Tage im Lockdown · Städte · 2020–21',
        value: 262,
        fmt: (v) => `${Math.round(v)} ${tr('Tage')}`,
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
          // Switzerland never ordered stay-at-home; only the first-wave
          // shutdown (16 Mar – 11 May 2020, ~56 days) closed public life.
          { name: 'Zürich 🇨🇭', v: 56 },
          { name: 'Stockholm 🇸🇪', v: 0 },
        ],
      }),
  },
  {
    id: 'covid-vax-percapita',
    title: 'Corona-Impfungen · Dosen pro Kopf',
    source:
      'Our World in Data · verabreichte Impfdosen je 100 Einwohner, kumuliert 2020–23, näherungsweise.',
    draw: (f) =>
      hBarChart(f, {
        // COVID-19 vaccine doses administered per 100 people (Our World in
        // Data, cumulative). Per-capita view: which countries jabbed their
        // population most densely, not just most in absolute terms. Cuba
        // tops it with a home-grown 3-dose regimen (Abdala/Soberana); the
        // world average sits near ~170 doses per 100. Approximate.
        label: 'Corona-Impfdosen · je 100 Einw. · 2020–23',
        value: 170,
        fmt: (v) => `Ø ${Math.round(v)}/100`,
        rowFmt: deInt,
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
  {
    id: 'cashless',
    title: 'Bargeld im Rückzug',
    source:
      'EZB-SPACE-Studie, Riksbank, FIS/Worldpay Global Payments Report, Bank of Russia · Bargeldanteil am Point of Sale, gerundete Schätzwerte.',
    draw: (f) =>
      lineChart(f, {
        // Cash share of point-of-sale transactions: Sweden, South Korea, China
        // and Russia are already nearly cashless; Germany and the euro area
        // follow the same slope a decade behind — the quiet prerequisite for
        // fully programmable money. Japan is the outlier: rich yet still ~40%
        // cash, proof the slide is a policy choice, not a law of nature.
        label: 'Barzahlungen · Anteil der Käufe',
        value: CASHLESS_COMPARE.sweLatest,
        unit: '%',
        fmt: (v) => `${localePct(v, 0)}`,
        delta: null,
        seed: 241,
        series: [
          { name: '🇪🇺', color: blue, data: CASHLESS_COMPARE.rows[0].data },
          { name: '🇩🇪', color: yellow, data: CASHLESS_COMPARE.rows[1].data },
          { name: '🇸🇪', color: red, data: CASHLESS_COMPARE.rows[2].data },
          { name: '🇰🇷', color: green, data: CASHLESS_COMPARE.rows[3].data },
          { name: '🇨🇳', color: magenta, data: CASHLESS_COMPARE.rows[4].data },
          { name: '🇯🇵', color: aqua, data: CASHLESS_COMPARE.rows[5].data },
          { name: '🇷🇺', color: orange, data: CASHLESS_COMPARE.rows[6].data },
        ],
        ticks: CASHLESS_COMPARE.ticks,
        xLabels: ['2016', '2019', '2022', 'heute'],
      }),
  },
  {
    id: 'fiat-lifespan',
    title: 'Fiat-Währungen · Lebensdauer',
    source:
      'Dokumentierte Einzelfälle bis Hyperinflation oder Währungsreform — bewusst nicht die vom FT widerlegte „Ø 27 Jahre"-Zahl.',
    draw: (f) =>
      hBarChart(f, {
        // Years a paper/fiat currency lasted before hyperinflation or a
        // currency reform wiped it out — documented individual cases, not the
        // popular "avg. 27 years / 775 currencies" (DollarDaze) figure, which
        // the FT debunked (most of those deaths were wars and decolonisation,
        // and true fiat only exists since 1971). The still-running US-Dollar,
        // 54 years into the pure-fiat experiment since Nixon closed the gold
        // window, tops the list — no pure fiat regime has yet reached 60.
        label: 'Fiat-Währungen · Jahre bis Kollaps oder Reform',
        value: 54,
        fmt: (v) => `${Math.round(v)} J.`,
        rowFmt: (v) => `${v} J.`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: '🇺🇸 US-Dollar · seit 1971 ⏳', v: 54 },
          { name: '🇿🇼 Zimbabwe-Dollar', v: 29 },
          { name: '🇩🇪 Reichsmark', v: 24 },
          { name: '🇭🇺 Pengő', v: 19 },
          { name: '🇻🇪 Bolívar fuerte', v: 10 },
          { name: '🇩🇪 Papiermark', v: 9 },
          { name: '🇺🇸 Continental', v: 6 },
          { name: '🇫🇷 Assignat', v: 6 },
          { name: '🇦🇷 Austral', v: 6 },
        ],
      }),
  },
  {
    id: 'cash-limits',
    title: 'Bargeld-Obergrenzen · Europa',
    source:
      'Nationale Gesetze / EU-Geldwäscheverordnung · Obergrenzen für Barzahlungen, gerundet; Deutschland & Österreich bisher ohne Limit — ab 2027 gilt EU-weit 10.000 €.',
    draw: (f) =>
      hBarChart(f, {
        // Legal caps on cash payments (national law; the EU AML Regulation
        // adds a union-wide €10,000 ceiling from 2027). Shorter bar =
        // stricter cap. Germany and Austria have no national limit yet and
        // only enter via the EU ceiling.
        label: 'Bargeld-Obergrenze je Zahlung',
        value: 10_000,
        fmt: (v) => `${deInt(v)} €`,
        rowFmt: (v) => `${deInt(v)} €`,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Slowakei 🇸🇰', v: 15_000 },
          { name: 'Tschechien 🇨🇿', v: 10_700 },
          { name: 'EU ab 2027 🇪🇺', v: 10_000 },
          { name: 'Italien 🇮🇹', v: 5_000 },
          { name: 'Polen 🇵🇱', v: 3_500 },
          { name: 'Portugal 🇵🇹', v: 3_000 },
          { name: 'Belgien 🇧🇪', v: 3_000 },
          { name: 'Frankreich 🇫🇷', v: 1_000 },
          { name: 'Spanien 🇪🇸', v: 1_000 },
          { name: 'Griechenland 🇬🇷', v: 500 },
        ],
      }),
  },
  trendCard('cbdc', 'Digitales Zentralbankgeld · Länder', 'Länder mit CBDC-Projekt', CBDC_PANEL, violet, deInt, 251, eraMarkers(2020, 2026, [
    [2020, '🇧🇸 Sand Dollar · 1. CBDC'],
    [2021, '🇳🇬 eNaira'],
    [2022, '🇮🇳 Digitale Rupie'],
    [2023, '🇪🇺 Digitaler Euro'],
    [2023, '🇷🇺 Digitaler Rubel'],
    [2024, '🇨🇳 e-CNY'],
    [2024, '🇨🇭 Digitaler Franken'],
    [2025, '🇺🇸 CBDC-Verbot'],
  ]), 'Atlantic Council · CBDC Tracker.'),
  {
    id: 'freedom-decline',
    title: 'Freiheit weltweit · 20 Jahre Rückgang',
    source:
      'Freedom House · „Freedom in the World": Länder mit verschlechtertem vs. verbessertem Score pro Berichtsjahr.',
    draw: (f) =>
      lineChart(f, {
        // Freedom House annual score changes: the red line (countries getting
        // less free) has stayed above the green one every year for two
        // decades — the "democratic recession" in a single picture.
        label: 'Länder pro Jahr',
        value: FREEDOM_COMPARE.declinedLatest,
        unit: '',
        fmt: deInt,
        delta: null,
        seed: 257,
        series: [
          { name: 'verschlechtert', color: red, data: FREEDOM_COMPARE.rows[0].data },
          { name: 'verbessert', color: green, data: FREEDOM_COMPARE.rows[1].data },
        ],
        ticks: FREEDOM_COMPARE.ticks,
        xLabels: ['2013', '2017', '2021', 'heute'],
        markers: eraMarkers(2013, 2025, [[2020, '🦠 Corona-Jahr']]),
      }),
  },
  {
    id: 'covid-rights',
    title: 'Corona · Grundrechtseingriffe weltweit',
    source: 'ICNL/ECNL · COVID-19 Civic Freedom Tracker, Länder mit Grundrechtseingriffen 2020–22.',
    draw: (f) =>
      hBarChart(f, {
        // ICNL/ECNL COVID-19 Civic Freedom Tracker: how many of ~198 countries
        // enacted pandemic measures cutting into each basic right. Assembly
        // was restricted in 156 countries — more than three quarters of the
        // world locked down the right to protest at once.
        label: 'Länder mit Eingriffen · 2020–22',
        value: 156,
        fmt: (v) => `${Math.round(v)} ${tr('Länder')}`,
        rowFmt: deInt,
        delta: null,
        color: red,
        unit: '',
        rows: [
          { name: 'Versammlungsfreiheit', v: 156 },
          { name: 'Notstand ausgerufen', v: 112 },
          { name: 'Meinungsfreiheit', v: 62 },
          { name: 'Überwachung ausgeweitet', v: 62 },
        ],
      }),
  },
  trendCard('de-speech-cases', 'Politikerbeleidigung · Verfahren', 'Verfahren nach §188 StGB · 🇩🇪 · pro Jahr', DE_SPEECH_PANEL, red, deInt, 263, eraMarkers(2022, 2025, [
    // §188 was expanded in 2021: insults against politicians became a
    // separate ex-officio offence — prosecutions tripled within two years.
    [2022, '⚖️ §188 verschärft 2021'],
  ]), 'Bundestags- und Landesjustizangaben · Verfahren nach §188 StGB; Wert für 2023 interpoliert.'),
  trendCard('uk-speech-arrests', 'Verhaftet für Posts · England', 'Festnahmen wegen Online-Posts · 🇬🇧 · pro Jahr', UK_SPEECH_ARRESTS_PANEL, orange, deInt, 269, eraMarkers(2017, 2023, [
    // The Australian reference case sits on the same axis: Zoe Buhler,
    // arrested (handcuffed, pregnant, at home) for a Facebook protest event
    // during Victoria's 2020 lockdown.
    [2020, '🇦🇺 Zoe Buhler · Facebook-Post'],
  ]), 'Polizei-FOI-Daten via The Times (2025) · Festnahmen nach s.127 Communications Act / s.1 Malicious Communications Act. Unter 10 % der 2023 Festgenommenen wurden verurteilt.'),
  {
    id: 'young-homeownership',
    title: '„You\'ll own nothing" · Wohneigentum U35',
    source:
      'English Housing Survey / IFS und US Census (Housing Vacancy Survey), gerundete Survey-Werte.',
    draw: (f) =>
      lineChart(f, {
        // Homeownership among young households: two-thirds of English 25–34s
        // owned in 1991, barely a third by 2014. The US never regained its
        // 2004 peak. Owning a home is quietly leaving the normal biography.
        label: 'Wohneigentum junger Haushalte',
        value: YOUNG_HOME_COMPARE.engLatest,
        unit: '%',
        fmt: (v) => `${localePct(v, 0)}`,
        delta: null,
        seed: 271,
        series: [
          { name: '🏴 England 25–34', color: blue, data: YOUNG_HOME_COMPARE.rows[0].data },
          { name: '🇺🇸 USA unter 35', color: yellow, data: YOUNG_HOME_COMPARE.rows[1].data },
        ],
        ticks: YOUNG_HOME_COMPARE.ticks,
        xLabels: ['1991', '2002', '2013', 'heute'],
        markers: eraMarkers(1991, 2024, [[2008, '🏦 Finanzkrise']]),
      }),
  },
  trendCard('lez-zones', 'Zufahrtsverbotszonen · Europa', 'Umwelt- & Null-Emissions-Zonen', LEZ_PANEL, green, deInt, 277, eraMarkers(1996, 2025, [
    [2008, '🇩🇪 Umweltzonen-Welle'],
    [2023, '🇬🇧 ULEZ ganz London'],
  ]), 'Clean Cities Campaign / urbanaccessregulations.eu; frühe Jahre näherungsweise.'),
  trendCard('shutdowns-per-year', 'Internet-Abschaltungen pro Jahr', 'Staatliche Netzsperren', SHUTDOWN_PANEL, red, deInt, 281, eraMarkers(2016, 2024, [
    // Shutdowns are the standard response to protest movements — Iran 2019
    // went dark nationwide for a week; 2023/24 are all-time records.
    [2019, '🇮🇷 Iran offline'],
    [2023, '📈 Rekord'],
  ]), 'Access Now · #KeepItOn, staatlich verhängte Netzsperren pro Jahr.'),
  trendCard('gene-therapies', 'Gentherapien · zugelassen', 'Gen- & Zelltherapien · kumuliert', GENE_THERAPY_PANEL, magenta, deInt, 283, eraMarkers(2017, 2025, [
    [2017, '🧬 Erste CAR-T'],
    [2023, '✂️ Erste CRISPR-Therapie'],
  ]), 'FDA CBER · zugelassene Gen- und Zelltherapien, kumuliert.'),
  trendCard('autocracy-share', 'Menschheit unter Autokratie', 'Weltbevölkerung in Autokratien', AUTOCRACY_SHARE_PANEL, red, (v) => `${localePct(v, 0)}`, 307, eraMarkers(2013, 2024, [
    [2016, '🇹🇷 Türkei: Ausnahmezustand'],
    [2020, '🇮🇳 Indien: Wahlautokratie'],
    [2021, '🇲🇲 Myanmar: Militärputsch'],
  ]), 'V-Dem Democracy Reports · Anteil der Weltbevölkerung in Wahl- und geschlossenen Autokratien.'),
  trendCard('smartphone-leash', 'Smartphones · die freiwillige Fußfessel', 'Smartphone-Nutzer · 🌍 · Ø 4h37m/Tag', SMARTPHONE_PANEL, aqua, (v) => `${localeNum(v / 1e9, 1)} ${tr('Mrd')}`, 293, eraMarkers(2007, 2025, [
    [2007, '📱 iPhone'],
    [2008, '🤖 Android'],
    [2016, '🌍 Jeder Dritte'],
  ]), 'Statista / DataReportal · Smartphone-Nutzer weltweit, gerundete Schätzwerte.'),
];
