// Climate datasets: per-country anchor points for the live world-temperature
// map (derived from the bundled outlines, so no extra geometry ships) and a
// crude latitude/season climatology as its offline fallback.

import { WORLD } from './world';

// ---------------------------------------------------------------------------
// Per-country temperature anchors: one representative point per country, the
// bounding-box centre of its largest outline ring. Good enough for a weather
// reading — Open-Meteo's model grid covers every land cell, and a centre that
// drifts into a neighbour or the sea still samples the same climate zone.

export interface TempAnchor {
  iso: string;
  lon: number;
  lat: number;
}

function anchorOf(rings: number[][][]): { lon: number; lat: number } {
  let best = rings[0];
  let bestArea = -1;
  for (const ring of rings) {
    let lonMin = 180, lonMax = -180, latMin = 90, latMax = -90;
    for (const [lon, lat] of ring) {
      lonMin = Math.min(lonMin, lon);
      lonMax = Math.max(lonMax, lon);
      latMin = Math.min(latMin, lat);
      latMax = Math.max(latMax, lat);
    }
    const area = (lonMax - lonMin) * (latMax - latMin);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  let lonMin = 180, lonMax = -180, latMin = 90, latMax = -90;
  for (const [lon, lat] of best) {
    lonMin = Math.min(lonMin, lon);
    lonMax = Math.max(lonMax, lon);
    latMin = Math.min(latMin, lat);
    latMax = Math.max(latMax, lat);
  }
  return { lon: (lonMin + lonMax) / 2, lat: (latMin + latMax) / 2 };
}

export const TEMP_ANCHORS: TempAnchor[] = WORLD
  // Antarctica sits below the map crop (60°S) — no point fetching it.
  .filter((c) => c.id !== 'ATA')
  .map((c) => {
    const { lon, lat } = anchorOf(c.rings);
    return { iso: c.id, lon, lat };
  });

// ---------------------------------------------------------------------------
// Offline fallback: a latitude/season climatology. Deliberately crude (no
// continentality, no altitude) — it only keeps the map plausible until the
// Open-Meteo reading lands, and the card labels it as an approximation.

const NOW_MONTH = new Date().getMonth();

/** Rough expected 2-m temperature (°C) at a latitude for a month (0-based). */
export function climatologyTemp(lat: number, month = NOW_MONTH): number {
  const abs = Math.abs(lat);
  const annualMean = 27 - 0.55 * abs;
  const amplitude = 0.32 * abs;
  // +1 around July in the north, inverted for the southern hemisphere.
  const season = Math.cos((2 * Math.PI * (month - 6.5)) / 12);
  return annualMean + amplitude * season * (lat >= 0 ? 1 : -1);
}

export const FALLBACK_TEMPS: Record<string, number> = Object.fromEntries(
  TEMP_ANCHORS.map((a) => [a.iso, climatologyTemp(a.lat)]),
);

/**
 * Crude offline diurnal range around the climatology mean: hot, dry, low-latitude
 * belts swing hardest between afternoon high and pre-dawn low, so the amplitude
 * grows toward the equator. Deliberately rough — only fills the range list until
 * the live Open-Meteo min/max lands.
 */
function climatologyRange(lat: number, mean: number): { min: number; max: number } {
  const swing = 6 + 8 * Math.max(0, 1 - Math.abs(lat) / 45);
  return { min: mean - swing * 0.6, max: mean + swing * 0.4 };
}

const FALLBACK_RANGES: Record<string, { min: number; max: number }> = Object.fromEntries(
  TEMP_ANCHORS.map((a) => [a.iso, climatologyRange(a.lat, climatologyTemp(a.lat))]),
);

// German display names for the ranked "hottest now" list — a hot-belt subset
// (both hemispheres) so the ranking never surfaces an ISO code without a name.
const TEMP_NAME_BY_ISO: Record<string, string> = {
  KWT: 'Kuwait', IRQ: 'Irak', SAU: 'Saudi-Arabien', ARE: 'VAE', IRN: 'Iran',
  PAK: 'Pakistan', IND: 'Indien', EGY: 'Ägypten', DZA: 'Algerien',
  LBY: 'Libyen', MLI: 'Mali', NER: 'Niger', TCD: 'Tschad', SDN: 'Sudan',
  NGA: 'Nigeria', MEX: 'Mexiko', USA: 'USA', ESP: 'Spanien',
  GRC: 'Griechenland', ITA: 'Italien', TUR: 'Türkei', BRA: 'Brasilien',
  VEN: 'Venezuela', AUS: 'Australien', IDN: 'Indonesien',
};

/**
 * Top-4 hottest countries (from the named subset) for the ranked list. When a
 * `rangeByIso` is supplied (live Open-Meteo, or the offline climatology fallback)
 * each row carries today's low/high so the list can show the daily range.
 */
export function hottestRows(
  byIso: Record<string, number>,
  rangeByIso?: Record<string, { min: number; max: number }>,
): { name: string; v: number; min?: number; max?: number }[] {
  return Object.entries(TEMP_NAME_BY_ISO)
    .filter(([iso]) => byIso[iso] !== undefined)
    .map(([iso, name]) => {
      const r = rangeByIso?.[iso];
      return { name, v: byIso[iso], min: r?.min, max: r?.max };
    })
    .toSorted((a, b) => b.v - a.v)
    .slice(0, 4);
}

export const FALLBACK_TEMP_ROWS = hottestRows(FALLBACK_TEMPS, FALLBACK_RANGES);
