// Shared building blocks for the dashboard cards: the series colour palette
// and the two factories the card definitions lean on.

import { areaChart } from './charts';
import { SERIES } from './theme';
import type { Dashboard } from './types';
import type { TrendSeries } from '../data/store';

export const [blue, aqua, yellow, green, violet, red, magenta, orange] = SERIES;

/** Rounded integer with German thousands separators (12183 → "12.183"). */
export const deInt = (v: number): string => Math.round(v).toLocaleString('de-DE');

/** Compact factory for the bundled single-series trend panels. */
export function trendCard(
  id: string,
  title: string,
  label: string,
  panel: TrendSeries,
  color: string,
  fmt: (v: number) => string,
  seed: number,
  markers?: { at: number; label: string }[],
  source?: string,
): Dashboard {
  return {
    id,
    title,
    source,
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
 * Build era markers from [year, label] pairs on a [start, end] year axis, so
 * cards declare the years directly instead of hand-computing the 0..1 fraction
 * `(year - start) / (end - start)` on every line.
 */
export function eraMarkers(
  start: number,
  end: number,
  entries: [number, string][],
): { at: number; label: string }[] {
  return entries.map(([year, label]) => ({ at: (year - start) / (end - start), label }));
}
