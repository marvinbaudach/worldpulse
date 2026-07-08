// Choropleth-style world maps: the nuclear-arsenal map with radar pings, the
// value choropleth and the signed temperature map, each with a ranked top-N
// list below.

import { t as tr } from '../../i18n';
import { drawHeader, drawSurface, easeOut, fmtCompact, stagger, type Frame } from '../draw';
import { CRITICAL, FONT, GRID, INK_SECONDARY, MUTED } from '../theme';
import { drawRankedList, drawSource } from './shared';

export interface NukeMapCfg {
  label: string;
  total: number;
  /** Estimated warheads with a rough country-center anchor. */
  states: { name: string; iso: string; lon: number; lat: number; count: number }[];
  /** Country outlines keyed by ISO3; graticule-only fallback. */
  world?: { id: string; rings: number[][][] }[];
  source: string;
}

/**
 * World map with the nine nuclear states shaded red by stockpile size and a
 * radar ping pulsing over each arsenal, plus a direct-labeled top-5 list
 * below. Equirectangular, cropped to 85°N..60°S.
 */
export function nukeMap(f: Frame, cfg: NukeMapCfg): void {
  const { ctx, u, t, w } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label);
  const pad = 36 * u;

  const mx0 = pad;
  const mw = w - 2 * pad;
  const mh = mw / 2;
  const my0 = top + 4 * u;
  const px = (lon: number) => mx0 + ((lon + 180) / 360) * mw;
  const py = (lat: number) => my0 + ((85 - Math.min(85, Math.max(-60, lat))) / 145) * mh;
  const maxCount = Math.max(...cfg.states.map((s) => s.count));
  // Shading scales with sqrt so China/France stay visible next to the big two.
  const heat = (count: number) => Math.sqrt(count / maxCount);

  if (cfg.world) {
    const armed = new Map(cfg.states.map((s) => [s.iso, s.count]));
    for (const country of cfg.world) {
      const count = armed.get(country.id);
      // Nuclear states breathe: fill and border pulse, phase-salted per
      // country so the map never throbs in unison.
      const pulse = count === undefined ? 0 : 0.5 + 0.5 * Math.sin(t * 2.2 + (count % 97));
      ctx.fillStyle =
        count === undefined
          ? 'rgba(214,222,236,0.08)'
          : `rgba(208,59,59,${(0.18 + 0.5 * heat(count) + 0.12 * pulse).toFixed(2)})`;
      for (const ring of country.rings) {
        ctx.beginPath();
        ring.forEach(([lon, lat], i) => {
          if (i === 0) ctx.moveTo(px(lon), py(lat));
          else ctx.lineTo(px(lon), py(lat));
        });
        ctx.closePath();
        ctx.fill();
        if (count !== undefined) {
          ctx.strokeStyle = `rgba(255,107,94,${(0.15 + 0.55 * pulse).toFixed(2)})`;
          ctx.lineWidth = 1.4 * u;
          ctx.stroke();
        }
      }
    }
  } else {
    // No geometry (yet): a quiet graticule keeps the map readable.
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1 * u;
    for (let lon = -150; lon <= 150; lon += 30) {
      ctx.beginPath();
      ctx.moveTo(px(lon), my0);
      ctx.lineTo(px(lon), my0 + mh);
      ctx.stroke();
    }
    for (let lat = -60; lat <= 80; lat += 20) {
      ctx.beginPath();
      ctx.moveTo(mx0, py(lat));
      ctx.lineTo(mx0 + mw, py(lat));
      ctx.stroke();
    }
  }

  // Radar pings: an expanding, fading ring over every arsenal, phase-shifted
  // per state so the map keeps flickering with activity; core dot on top.
  cfg.states.forEach((s, i) => {
    const appear = stagger(t, i, 0.06);
    if (appear <= 0) return;
    const x = px(s.lon);
    const y = py(s.lat);
    const rMax = (8 + 20 * heat(s.count)) * u;
    const phase = (t * 0.55 + i * 0.31) % 1;
    ctx.globalAlpha = appear * (1 - phase) * 0.8;
    ctx.strokeStyle = CRITICAL;
    ctx.lineWidth = 1.8 * u;
    ctx.beginPath();
    ctx.arc(x, y, 2.5 * u + phase * rMax, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = appear;
    ctx.fillStyle = '#ff6b5e';
    ctx.beginPath();
    ctx.arc(x, y, 3 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Top-5 list under the map, direct-labeled.
  const rows = cfg.states.toSorted((a, b) => b.count - a.count).slice(0, 5);
  drawRankedList(f, {
    rows: rows.map((s) => ({ name: s.name, v: s.count })),
    top: my0 + mh + 18 * u,
    rowFmt: (v) => fmtCompact(v),
    color: CRITICAL,
  });

  if (cfg.source) drawSource(f, cfg.source);
}

export interface ChoroplethCfg {
  label: string;
  value: number;
  fmt: (v: number) => string;
  /** Value per ISO3 country; countries without data stay neutral. */
  valueByIso?: Record<string, number>;
  world?: { id: string; rings: number[][][] }[];
  /** Optional lon/lat window for a regional map (e.g. Europe); the drawing
      is clipped to the map area, countries outside simply fall off. */
  bounds?: { lonMin: number; lonMax: number; latMin: number; latMax: number };
  rows: { name: string; v: number }[];
  rowFmt: (v: number) => string;
  /** In-card source footer; omit when the source is shown separately. */
  source?: string;
}

/**
 * World choropleth: every country shaded by its value (sqrt ramp against a
 * high percentile so outliers don't wash out the rest), top-5 list below.
 */
export function choroplethMap(f: Frame, cfg: ChoroplethCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label);
  const pad = 36 * u;

  const mx0 = pad;
  const mw = w - 2 * pad;
  const b = cfg.bounds ?? { lonMin: -180, lonMax: 180, latMin: -60, latMax: 85 };
  const my0 = top + 4 * u;
  // Reserve enough height below the map for the ranked list, so the map never
  // grows so tall (regional windows are near-square) that the rows get squeezed
  // and the bars overlap the labels of the row beneath.
  const listGap = 18 * u;
  const rowMin = 42 * u;
  const mapMax = h - 46 * u - my0 - listGap - cfg.rows.length * rowMin;
  // Height follows the window's aspect, capped so the row list always fits.
  const mh = Math.min((mw * (b.latMax - b.latMin)) / (b.lonMax - b.lonMin), mapMax);
  const px = (lon: number) => mx0 + ((lon - b.lonMin) / (b.lonMax - b.lonMin)) * mw;
  const py = (lat: number) => my0 + ((b.latMax - lat) / (b.latMax - b.latMin)) * mh;

  const values = Object.values(cfg.valueByIso ?? {}).toSorted((a, b2) => a - b2);
  const ref = values.length ? values[Math.floor(values.length * 0.95)] : 1;
  const p = easeOut(t / 1.1);

  if (cfg.world) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx0, my0, mw, mh);
    ctx.clip();
    // Thin dark seam between every country so neighbours with the same shade
    // (e.g. France and Italy, both maxed out) stay readable as two countries
    // instead of merging into one red block.
    ctx.strokeStyle = 'rgba(5,7,12,0.65)';
    ctx.lineWidth = 1 * u;
    ctx.lineJoin = 'round';
    for (const country of cfg.world) {
      const v = cfg.valueByIso?.[country.id];
      // On the near-black surface a bright red (255,74,64) reads brighter the
      // more opaque it is, so higher value = more vivid red = more eye-catching
      // (the label says "kräftiger rot = mehr"). The low end still starts at a
      // visible 0.22 so faint-data countries stay legibly red instead of sinking
      // into the no-data grey, and climbs to a punchy 0.98 so the worst cases
      // clearly stand out. No-data countries render as a flat neutral grey.
      ctx.fillStyle =
        v === undefined
          ? 'rgba(214,222,236,0.05)'
          : `rgba(255,74,64,${(0.22 + 0.76 * Math.min(1, v / ref) * p).toFixed(2)})`;
      for (const ring of country.rings) {
        ctx.beginPath();
        ring.forEach(([lon, lat], i) => {
          if (i === 0) ctx.moveTo(px(lon), py(lat));
          else ctx.lineTo(px(lon), py(lat));
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawRankedList(f, {
    rows: cfg.rows,
    top: my0 + mh + 18 * u,
    rowFmt: cfg.rowFmt,
    color: CRITICAL,
  });

  if (cfg.source) drawSource(f, cfg.source);
}

// ---------------------------------------------------------------------------
// Temperature map: signed values need their own diverging ramp, so the
// sequential shading of choroplethMap doesn't fit. Like the other map ramps
// (nuke red, choropleth red) the stops are chart-local, not series colors:
// temperature color is semantic (frost blue -> mild green -> hot dark red),
// tuned for the dark surface.

const TEMP_STOPS: [number, string][] = [
  [-30, '#3a6fd0'],
  [-10, '#4f9bd6'],
  [0, '#2fa17c'],
  [10, '#4f9d3f'],
  [18, '#9aa32f'],
  [25, '#d08a25'],
  [32, '#c94f1d'],
  [38, '#a01910'],
  [46, '#570803'],
];

const channel = (a: number, b: number, f2: number) => Math.round(a + (b - a) * f2);
const rgb = (hex: string) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Piecewise-linear RGB along TEMP_STOPS, clamped at the ends. */
function tempColor(v: number): string {
  if (v <= TEMP_STOPS[0][0]) return TEMP_STOPS[0][1];
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [v1, c1] = TEMP_STOPS[i - 1];
    const [v2, c2] = TEMP_STOPS[i];
    if (v <= v2) {
      const f2 = (v - v1) / (v2 - v1);
      const [r1, g1, b1] = rgb(c1);
      const [r2, g2, b2] = rgb(c2);
      return `rgb(${channel(r1, r2, f2)},${channel(g1, g2, f2)},${channel(b1, b2, f2)})`;
    }
  }
  return TEMP_STOPS[TEMP_STOPS.length - 1][1];
}

export interface TempMapCfg {
  label: string;
  /** Current 2-m temperature (°C) per ISO3 country. */
  tempByIso: Record<string, number>;
  world?: { id: string; rings: number[][][] }[];
  /** Hottest countries right now. */
  rows: { name: string; v: number }[];
  rowFmt: (v: number) => string;
  source: string;
}

/**
 * World map shaded by the current temperature per country, with a gradient
 * legend under the map and the hottest countries listed below.
 */
export function tempMap(f: Frame, cfg: TempMapCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label);
  const pad = 36 * u;

  const mx0 = pad;
  const mw = w - 2 * pad;
  const my0 = top + 4 * u;
  const legendH = 34 * u;
  const captionH = 22 * u;
  const listGap = 12 * u;
  const rowMin = 42 * u;
  const mapMax = h - 46 * u - my0 - legendH - captionH - listGap - cfg.rows.length * rowMin;
  const mh = Math.min((mw * 145) / 360, mapMax);
  const px = (lon: number) => mx0 + ((lon + 180) / 360) * mw;
  const py = (lat: number) => my0 + ((85 - Math.min(85, Math.max(-60, lat))) / 145) * mh;
  const p = easeOut(t / 1.1);

  if (cfg.world) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx0, my0, mw, mh);
    ctx.clip();
    // Same thin seam as the choropleth, so neighbours in the same climate
    // zone stay readable as separate countries.
    ctx.strokeStyle = 'rgba(5,7,12,0.65)';
    ctx.lineWidth = 1 * u;
    ctx.lineJoin = 'round';
    for (const country of cfg.world) {
      const v = cfg.tempByIso[country.id];
      ctx.fillStyle = v === undefined ? 'rgba(214,222,236,0.05)' : tempColor(v);
      ctx.globalAlpha = v === undefined ? 1 : 0.25 + 0.75 * p;
      for (const ring of country.rings) {
        ctx.beginPath();
        ring.forEach(([lon, lat], i) => {
          if (i === 0) ctx.moveTo(px(lon), py(lat));
          else ctx.lineTo(px(lon), py(lat));
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Gradient legend: the ramp from -20° to +45° with labeled ticks.
  const lgY = my0 + mh + 10 * u;
  const lgLo = -20;
  const lgHi = 45;
  const grad = ctx.createLinearGradient(mx0, 0, mx0 + mw, 0);
  for (let v = lgLo; v <= lgHi; v += 5) {
    grad.addColorStop((v - lgLo) / (lgHi - lgLo), tempColor(v));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(mx0, lgY, mw, 8 * u);
  ctx.fillStyle = INK_SECONDARY;
  ctx.font = `400 ${12 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  for (const v of [-10, 0, 10, 20, 30, 40]) {
    ctx.fillText(`${v}°`, mx0 + ((v - lgLo) / (lgHi - lgLo)) * mw, lgY + 22 * u);
  }
  ctx.textAlign = 'left';

  // Ranked hottest-now list, with its own small caption.
  const capY = lgY + legendH;
  ctx.fillStyle = MUTED;
  ctx.font = `600 ${12 * u}px ${FONT}`;
  ctx.fillText(tr('Heißeste Länder · jetzt').toUpperCase(), pad, capY + 10 * u);
  drawRankedList(f, {
    rows: cfg.rows,
    top: capY + captionH + listGap - 12 * u,
    rowFmt: cfg.rowFmt,
    color: CRITICAL,
  });

  if (cfg.source) drawSource(f, cfg.source);
}
