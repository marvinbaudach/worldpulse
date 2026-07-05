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
    /** Daily highs (14 days, shared scale) for the two-city line chart. */
    lineZurich: number[];
    lineGeneva: number[];
    tempTicks: string[];
    zurichHigh: number;
    /** Today's high vs yesterday's, in percent (for the KPI tile chip). */
    highDeltaPct: number;
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
  /** CHF strength: EUR and USD per CHF as % change over one year (ECB). */
  fx?: {
    eur: number[];
    usd: number[];
    ticks: string[];
    usdNow: number;
    usdYoyPct: number;
  };
  /** Country outlines for the map panels, keyed by ISO3 country code. */
  worldMap?: { id: string; rings: number[][][] }[];
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
