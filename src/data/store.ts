// Mutable store for the live datasets plus a tiny pub/sub. The dashboard
// draw closures read from `live` on every frame, so a panel picks up real
// data the moment its fetcher resolves; subscribers re-render the settled
// textures. Fields stay undefined when a source fails — the charts then keep
// their procedural fallback data, so the ring never looks broken offline.

/** Normalized series plus everything the chart needs around it. */
export interface TrendSeries {
  series: number[];
  ticks: string[];
  latest: number;
  yoyPct: number;
  xLabels: string[];
}

/** A measured daily series co-normalized against a flat reference baseline
    (e.g. a pre-crisis average), for a two-line "now vs. normal" chart. Both
    arrays share one nice y-scale so the gap between them reads truthfully. */
export interface BaselineTrend {
  /** Measured series, normalized 0..1, chronological. */
  daily: number[];
  /** Flat reference at `baselineRaw`, same length as `daily`, normalized 0..1. */
  baseline: number[];
  ticks: string[];
  xLabels: string[];
  /** Latest raw measured value. */
  latest: number;
  /** Raw baseline value (for the legend label). */
  baselineRaw: number;
}

export interface LiveData {
  /** Most-read Wikipedia articles from Switzerland (all languages). */
  swiss?: {
    rows: { name: string; v: number }[];
    topViews: number;
  };
  /** Military expenditure, top 10 countries (World Bank, latest year). */
  military?: {
    rows: { name: string; v: number }[];
    total: number;
    year: string;
  };
  /** US national debt (Treasury "Debt to the Penny"). */
  debt?: {
    /** Latest official total and its record timestamp (ms). */
    latest: number;
    latestMs: number;
    /** Average growth per millisecond over the recent window. */
    ratePerMs: number;
    /** Monthly totals, last 12 months, normalized 0..1. */
    series: number[];
    ticks: string[];
    yoyPct: number;
  };
  /** Swiss population since 1920 (census anchors + World Bank yearly). */
  swissPop?: TrendSeries;
  /** World population since 1960 (World Bank). */
  worldPop?: TrendSeries;
  /** Antarctic temperature anomaly over 800,000 years (ice cores). */
  climate?: {
    temp: number[];
    ticks: string[];
    latestTemp: number;
    /** True where the sample falls in a glacial period (ice age). */
    iceMask: boolean[];
  };
  /** Country outlines for the map panels, keyed by ISO3 country code. */
  worldMap?: { id: string; rings: number[][][] }[];
  /** Current 2-m temperature per country (Open-Meteo, one anchor point each). */
  worldTemp?: {
    byIso: Record<string, number>;
    /** Hottest countries right now, for the ranked list. `min`/`max` are today's
        low/high at the same anchor, so the list can show the daily range. */
    rows: { name: string; v: number; min?: number; max?: number }[];
  };
  /** Middle-East conflict: live Gaza/West-Bank casualties (Tech for Palestine).
      The Hormuz and missile figures the card shows alongside are bundled and
      dated (no keyless live feed exists) — see data/geo.ts. */
  mideast?: {
    /** Gaza: cumulative killed, of which children; plus injured. */
    killed: number;
    children: number;
    injured: number;
    /** West Bank cumulative killed. */
    westBankKilled: number;
    /** Provider's own as-of date, e.g. "2026-07-08". */
    lastUpdate: string;
    /** Recent daily killed (oldest→newest) for the trend sparkline. */
    daily: number[];
  };
  /** Intentional homicides per 100k (World Bank, latest year per country). */
  homicide?: {
    byIso: Record<string, number>;
    rows: { name: string; v: number }[];
    world: number;
    /** Country trends since 1990, shared scale. */
    che: number[];
    deu: number[];
    usa: number[];
    rus: number[];
    bra: number[];
    jpn: number[];
    cheLatest: number;
    ticks: string[];
  };
  /** Suicide mortality per 100k (World Bank / WHO, latest year per country). */
  suicide?: {
    byIso: Record<string, number>;
    rows: { name: string; v: number }[];
    world: number;
  };
  /** Extreme poverty: share under $2.15/day (World Bank PIP, SI.POV.DDAY,
      latest year per country). */
  poverty?: {
    byIso: Record<string, number>;
    rows: { name: string; v: number }[];
    world: number;
  };
  /** Strait of Hormuz daily tanker transits (IMF PortWatch, satellite AIS)
      against the pre-crisis average — the live "now vs. normal" tanker curve. */
  hormuzTankers?: BaselineTrend;
}

export const live: LiveData = {};

/** 'data' = a REST dataset arrived; 'tick' = the price socket moved. */
export type LiveUpdateKind = 'data' | 'tick';

const subs = new Set<(kind: LiveUpdateKind) => void>();

export function onLiveUpdate(cb: (kind: LiveUpdateKind) => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function emitLiveUpdate(kind: LiveUpdateKind): void {
  subs.forEach((cb) => cb(kind));
}
