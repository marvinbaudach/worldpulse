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

export interface LiveData {
  weather?: {
    currentTemp: number;
    /** 7-day forecast (today first) with WMO weather codes. */
    forecast: { day: string; code: number; min: number; max: number }[];
  };
  wiki?: {
    rows: { name: string; v: number }[];
    topViews: number;
  };
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
  /** CO2 (ppm) and global temperature over 10,000 years, own scales. */
  climate?: {
    co2: number[];
    temp: number[];
    ticks: string[];
    latestCo2: number;
  };
  /** Gold in CHF/oz vs SNB monetary base, both normalized to own scale. */
  gold?: {
    gold: number[];
    base: number[];
    /** Gridline labels for the gold scale (CHF per ounce, in thousands). */
    ticks: string[];
    latest: number;
  };
  /** Country outlines for the map panels, keyed by ISO3 country code. */
  worldMap?: { id: string; rings: number[][][] }[];
  /** Intentional homicides per 100k (World Bank, latest year per country). */
  homicide?: {
    byIso: Record<string, number>;
    rows: { name: string; v: number }[];
    world: number;
    /** CH vs DE vs US since 1990, shared scale. */
    che: number[];
    deu: number[];
    usa: number[];
    cheLatest: number;
    ticks: string[];
  };
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
