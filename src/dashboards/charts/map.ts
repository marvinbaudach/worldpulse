// Choropleth-style world maps: the nuclear-arsenal map with radar pings, the
// value choropleth and the signed temperature map, each with a ranked top-N
// list below.

import { localeInt, t as tr } from '../../i18n';
import { drawHeader, drawSurface, easeOut, fmtCompact, roundRect, stagger, type Frame } from '../draw';
import { CRITICAL, FONT, GRID, INK, INK_SECONDARY, MUTED, SURFACE_DEEP } from '../theme';
import { drawRankedList, drawSource, ellipsize, withAlpha, withFlag } from './shared';

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
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label);
  const pad = 36 * u;

  const mx0 = pad;
  const mw = w - 2 * pad;
  const my0 = top + 4 * u;
  // Reserve room for the top-5 list, so a wide, short (landscape) card can't let
  // the 2:1 map grow tall enough to push the rows off the bottom. Mirrors the
  // clamp in choroplethMap/tempMap.
  const listGap = 18 * u;
  const rowMin = 42 * u;
  const mapMax = h - 46 * u - my0 - listGap - 5 * rowMin;
  const mh = Math.min(mw / 2, mapMax);
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

// ---------------------------------------------------------------------------
// Nahost-Karte: a regional map centered on Gaza / the West Bank with a hotspot
// ping, a live Gaza-casualty hero block with a daily-killed sparkline, and one
// bundled context chip (Iran→Israel missiles). Live vs. bundled is spelled out
// on the card — only the casualty block is live (Tech for Palestine); the chip
// is a dated reference figure.

export interface MideastCfg {
  label: string;
  /** Live (or bundled-fallback) Gaza / West-Bank casualties. */
  killed: number;
  children: number;
  injured: number;
  westBankKilled: number;
  /** Provider's as-of date, ISO yyyy-mm-dd. */
  lastUpdate: string;
  /** Recent daily killed (oldest→newest) for the sparkline. */
  daily: number[];
  /** True when the figures came from the live feed, not the bundled snapshot. */
  isLive: boolean;
  /** Bundled, dated missile-exchange context. */
  missiles: number;
  missilesRoute: string;
  missilesPeriod: string;
  /** Country outlines, clipped to the region. */
  world?: { id: string; rings: number[][][] }[];
  source: string;
}

const MIDEAST_REGION = { lonMin: 32, lonMax: 40, latMin: 28.5, latMax: 34.5 };
const GAZA_PT = { lon: 34.45, lat: 31.5 };

/** ISO yyyy-mm-dd → dd.mm.yyyy for the German status stamp. */
function deDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

export function mideastMap(f: Frame, cfg: MideastCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label);
  const pad = 36 * u;
  const mx0 = pad;
  const mw = w - 2 * pad;
  const footer = 40 * u;
  const reveal = easeOut(t / 1.1);

  // --- Regional map -------------------------------------------------------
  const b = MIDEAST_REGION;
  const mapTop = top + 4 * u;
  const avail = h - mapTop - footer;
  const mapH = Math.min((mw * (b.latMax - b.latMin)) / (b.lonMax - b.lonMin), avail * 0.34);
  const px = (lon: number) => mx0 + ((lon - b.lonMin) / (b.lonMax - b.lonMin)) * mw;
  const py = (lat: number) => mapTop + ((b.latMax - lat) / (b.latMax - b.latMin)) * mapH;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mx0, mapTop, mw, mapH);
  ctx.clip();
  ctx.strokeStyle = 'rgba(5,7,12,0.65)';
  ctx.lineWidth = 1 * u;
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(214,222,236,0.06)';
  for (const country of cfg.world ?? []) {
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

  // Hotspot ping: an expanding ring plus a core dot and a direct label.
  const marker = (lon: number, lat: number, color: string, label: string, i: number) => {
    const x = px(lon);
    const y = py(lat);
    const phase = (t * 0.55 + i * 0.4) % 1;
    ctx.globalAlpha = reveal * (1 - phase) * 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8 * u;
    ctx.beginPath();
    ctx.arc(x, y, 3 * u + phase * 22 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = reveal;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 ${12 * u}px ${FONT}`;
    const flip = x + 12 * u + ctx.measureText(label).width > mx0 + mw;
    ctx.fillStyle = INK;
    ctx.textAlign = flip ? 'right' : 'left';
    ctx.fillText(label, x + (flip ? -12 * u : 12 * u), y + 4 * u);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  };
  marker(GAZA_PT.lon, GAZA_PT.lat, CRITICAL, tr('Gaza'), 0);

  // --- Live casualty hero -------------------------------------------------
  const statsTop = mapTop + mapH + 18 * u;
  const statsAvail = h - footer - statsTop;
  const heroH = statsAvail * 0.52;

  // Status line: a pulsing red dot + "LIVE" when the feed is up, otherwise a
  // plain dated stamp. Either way it names exactly what the figures cover.
  const stamp = deDate(cfg.lastUpdate);
  const dotPad = cfg.isLive ? 16 * u : 0;
  if (cfg.isLive) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = CRITICAL;
    ctx.beginPath();
    ctx.arc(pad + 4 * u, statsTop + 8 * u, 4 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = cfg.isLive ? CRITICAL : MUTED;
  ctx.font = `700 ${12 * u}px ${FONT}`;
  const status = `${cfg.isLive ? 'LIVE · ' : ''}${tr('Gaza & Westjordanland')} · ${tr('Stand')} ${stamp}`;
  ctx.fillText(ellipsize(ctx, status.toUpperCase(), mw - dotPad), pad + dotPad, statsTop + 12 * u);

  // Headline: cumulative Gaza killed, big.
  const killed = Math.round(cfg.killed * reveal);
  const numY = statsTop + 60 * u;
  ctx.fillStyle = INK;
  ctx.font = `800 ${52 * u}px ${FONT}`;
  ctx.fillText(localeInt(killed), pad, numY);
  const numW = ctx.measureText(localeInt(killed)).width;
  ctx.fillStyle = INK_SECONDARY;
  ctx.font = `500 ${15 * u}px ${FONT}`;
  ctx.fillText(tr('Getötete · Gaza'), pad, numY + 22 * u);

  // Secondary figures stacked to the right of the headline number.
  const sx = pad + numW + 24 * u;
  ctx.fillStyle = INK_SECONDARY;
  ctx.font = `600 ${17 * u}px ${FONT}`;
  ctx.fillText(`${localeInt(cfg.children)} ${tr('Kinder')}`, sx, numY - 18 * u);
  ctx.fillText(`${localeInt(cfg.injured)} ${tr('Verletzte')}`, sx, numY + 4 * u);
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${14 * u}px ${FONT}`;
  ctx.fillText(`${localeInt(cfg.westBankKilled)} ${tr('Westjordanland')}`, sx, numY + 25 * u);

  // Daily-killed sparkline along the bottom of the hero block.
  const data = cfg.daily.length ? cfg.daily : [0];
  const dmax = Math.max(...data, 1);
  const sparkH = 22 * u;
  const sparkTop = statsTop + heroH - sparkH - 4 * u;
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${12 * u}px ${FONT}`;
  ctx.fillText(tr('Getötete pro Tag · 30 Tage'), pad, sparkTop - 6 * u);
  ctx.strokeStyle = withAlpha(CRITICAL, 0.9);
  ctx.lineWidth = 2 * u;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad + (mw * i) / Math.max(1, data.length - 1);
    const yy = sparkTop + sparkH - (v / dmax) * sparkH;
    if (i === 0) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  });
  ctx.stroke();

  // --- One bundled context chip ------------------------------------------
  const chipsTop = statsTop + heroH + 14 * u;
  const chipsH = h - footer - chipsTop;
  const chipW = mw;
  const chip = (
    cx: number,
    eyebrow: string,
    value: string,
    sub: string,
    stampLine: string,
    accent: string,
  ) => {
    ctx.fillStyle = SURFACE_DEEP;
    roundRect(ctx, cx, chipsTop, chipW, chipsH, 14 * u);
    ctx.fill();
    ctx.fillStyle = accent;
    roundRect(ctx, cx, chipsTop, chipW, 3 * u, 1.5 * u);
    ctx.fill();
    const ix = cx + 16 * u;
    const iw = chipW - 32 * u;
    // Eyebrow / value / sub are centered as a group above the pinned stamp, so
    // the chip doesn't read top-heavy on a tall panel.
    const mid = chipsTop + chipsH * 0.46;
    ctx.textAlign = 'left';
    ctx.fillStyle = MUTED;
    ctx.font = `700 ${11.5 * u}px ${FONT}`;
    ctx.fillText(ellipsize(ctx, eyebrow.toUpperCase(), iw), ix, mid - 30 * u);
    // Value shrinks to fit rather than ellipsizing — the whole figure matters.
    ctx.fillStyle = INK;
    let vs = 26;
    ctx.font = `800 ${vs * u}px ${FONT}`;
    while (vs > 17 && ctx.measureText(value).width > iw) {
      vs -= 1;
      ctx.font = `800 ${vs * u}px ${FONT}`;
    }
    ctx.fillText(value, ix, mid);
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${14 * u}px ${FONT}`;
    ctx.fillText(ellipsize(ctx, sub, iw), ix, mid + 24 * u);
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${12 * u}px ${FONT}`;
    ctx.fillText(ellipsize(ctx, stampLine, iw), ix, chipsTop + chipsH - 16 * u);
  };
  chip(
    pad,
    `${tr('Raketen')} · ${cfg.missilesRoute}`,
    `≈${localeInt(cfg.missiles)}`,
    tr(cfg.missilesPeriod),
    `${tr('Stand')} ${tr(cfg.missilesPeriod)} · FPRI/WSJ`,
    CRITICAL,
  );

  drawSource(f, cfg.source);
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
  /** Ramp color as a #rrggbb hex (use a theme series color); defaults to the
      map-local alert red. Use a calmer hue when a high value is good news
      (e.g. vaccination coverage), so the shading doesn't read as a warning. */
  ramp?: string;
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
      // Negative values (e.g. below-baseline excess mortality) clamp to the
      // faint base alpha — an alpha below zero would invalidate the fillStyle
      // and silently reuse the previous country's color.
      ctx.fillStyle =
        v === undefined
          ? 'rgba(214,222,236,0.05)'
          : withAlpha(cfg.ramp ?? '#ff4a40', 0.22 + 0.76 * Math.min(1, Math.max(0, v / ref)) * p);
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
    // The list mirrors the map's ramp so bars and shading read as one scale.
    color: cfg.ramp ?? CRITICAL,
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

/**
 * Ranked hottest-country list showing each country's *daily temperature range*:
 * a track on a shared °C axis, a warm segment spanning today's low→high, and a
 * bright marker at the current reading — so the list reads as "how far the temp
 * swings today", not just a zero-based bar. Rows without min/max collapse to a
 * single marker at the current value.
 */
function drawTempRangeList(
  f: Frame,
  opts: {
    rows: { name: string; v: number; min?: number; max?: number }[];
    /** Y where the list starts (below the caption). */
    top: number;
    /** Y where the list ends (the shared axis is drawn just below this). */
    bottom: number;
    rowFmt: (v: number) => string;
  },
): void {
  const { ctx, u, t, w } = f;
  const pad = 36 * u;
  const { rows, top, bottom, rowFmt } = opts;
  const rowH = (bottom - top) / Math.max(1, rows.length);
  // One shared °C axis across every row, so segment lengths compare directly.
  const lo = Math.floor(Math.min(...rows.map((r) => r.min ?? r.v)) - 1);
  const hi = Math.ceil(Math.max(...rows.map((r) => r.max ?? r.v)) + 1);
  const span = Math.max(1, hi - lo);
  const trackW = w - 2 * pad;
  const xAt = (v: number) => pad + ((v - lo) / span) * trackW;
  const groupH = 26 * u;

  rows.forEach((s, i) => {
    const p = Math.max(0, stagger(t, i + 4, 0.06));
    const y = top + rowH * i + Math.max(0, (rowH - groupH) / 2);
    const min = s.min ?? s.v;
    const max = s.max ?? s.v;
    ctx.globalAlpha = p;
    // Name (left) + current reading (right).
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${16 * u}px ${FONT}`;
    ctx.fillText(withFlag(s.name), pad, y + 13 * u);
    ctx.fillStyle = INK;
    ctx.font = `600 ${16 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(rowFmt(s.v), w - pad, y + 13 * u);
    ctx.textAlign = 'left';
    // Baseline track.
    const trackY = y + 20 * u;
    ctx.fillStyle = GRID;
    roundRect(ctx, pad, trackY, trackW, 7 * u, 3.5 * u);
    ctx.fill();
    // Range segment low→high, cool-to-hot gradient, growing in with the stagger.
    const xMin = xAt(min);
    const xMax = xAt(max);
    const grad = ctx.createLinearGradient(xMin, 0, Math.max(xMax, xMin + 1), 0);
    grad.addColorStop(0, tempColor(min));
    grad.addColorStop(1, tempColor(max));
    ctx.fillStyle = grad;
    roundRect(ctx, xMin, trackY, Math.max((xMax - xMin) * p, 3 * u), 7 * u, 3.5 * u);
    ctx.fill();
    // "Now" marker at the current reading, once the segment has mostly drawn.
    if (p >= 0.6) {
      const cx = xAt(s.v);
      const cy = trackY + 3.5 * u;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx, cy, 4 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tempColor(s.v);
      ctx.beginPath();
      ctx.arc(cx, cy, 2.4 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  // Shared °C axis under the list, so each segment reads on a common thermometer.
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${11 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  const step = span <= 12 ? 2 : 5;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    ctx.fillText(`${v}°`, xAt(v), bottom + 14 * u);
  }
  ctx.textAlign = 'left';
}

export interface TempMapCfg {
  label: string;
  /** Current 2-m temperature (°C) per ISO3 country. */
  tempByIso: Record<string, number>;
  world?: { id: string; rings: number[][][] }[];
  /** Hottest countries right now, each with today's low/high for the range. */
  rows: { name: string; v: number; min?: number; max?: number }[];
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
  // Room under the list for the shared °C axis of the range track.
  const axisH = 22 * u;
  const mapMax =
    h - 46 * u - my0 - legendH - captionH - listGap - axisH - cfg.rows.length * rowMin;
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
  ctx.fillText(tr('Heißeste Länder').toUpperCase(), pad, capY + 10 * u);
  drawTempRangeList(f, {
    rows: cfg.rows,
    top: capY + captionH + listGap - 12 * u,
    bottom: h - 46 * u - axisH,
    rowFmt: cfg.rowFmt,
  });

  if (cfg.source) drawSource(f, cfg.source);
}
