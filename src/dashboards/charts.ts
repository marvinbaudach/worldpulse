// The dashboard renderers. Each draws a complete panel (surface,
// header, chart) into a Frame; `t` replays the intro and drives the live
// motion afterwards, so hovering a panel feels like it wakes up.

import {
  drawGrid,
  drawGridLabels,
  drawHeader,
  drawLegend,
  drawSurface,
  drawTracked,
  easeOut,
  fmtCompact,
  linePath,
  makeSeries,
  roundRect,
  stagger,
  type Frame,
} from './draw';
import { CRITICAL, FONT, GOOD, GRID, INK, INK_SECONDARY, MUTED, SERIES } from './theme';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function plotRect(f: Frame, top: number) {
  const pad = 36 * f.u;
  return { x0: pad, x1: f.w - pad, y0: top, y1: f.h - 64 * f.u };
}

function xAxisLabels(f: Frame, labels: string[], x0: number, x1: number, y: number): void {
  const { ctx, u } = f;
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${14 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    ctx.fillText(l, x0 + ((x1 - x0) * i) / (labels.length - 1), y + 24 * u);
  });
  ctx.textAlign = 'left';
}

export interface LineCfg {
  label: string;
  value: number;
  unit: string;
  delta: number | null;
  fmt?: (v: number) => string;
  seed: number;
  /** `data` (normalized 0..1) wins over the seeded fallback series. */
  series: { name: string; color: string; data?: number[] }[];
  ticks: string[];
  xLabels?: string[];
}

/** Two-series line chart with draw-in, endpoint pulse and direct labels. */
export function lineChart(f: Frame, cfg: LineCfg): void {
  const { ctx, u, t } = f;
  drawSurface(f);
  const fmt = cfg.fmt ?? ((v: number) => fmtCompact(v, cfg.unit));
  const top = drawHeader(f, cfg.label, cfg.value, fmt, cfg.delta);
  const r = plotRect(f, top + 26 * u);
  drawGrid(f, r.y0, r.y1, cfg.ticks.length);
  drawLegend(f, r.y0 - 10 * u, cfg.series);

  const p = easeOut(t / 1.4);
  cfg.series.forEach((s, si) => {
    const data = s.data ?? makeSeries(cfg.seed + si * 97, 14, si === 0 ? 0.6 : 0.25);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5 * u;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const end = linePath(ctx, data, r.x0, r.x1, r.y0 + 14 * u, r.y1 - 6 * u, p);
    ctx.stroke();
    // Endpoint marker; the front series gets a soft live pulse.
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 4.5 * u, 0, Math.PI * 2);
    ctx.fill();
    if (si === 0 && p >= 1) {
      const pulse = (t * 0.9) % 1;
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = (1 - pulse) * 0.5;
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.arc(end.x, end.y, (5 + pulse * 14) * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });
  drawGridLabels(f, r.y0, r.y1, cfg.ticks);
  xAxisLabels(f, cfg.xLabels ?? ['Q1', 'Q2', 'Q3', 'Q4'], r.x0, r.x1, r.y1);
}

export interface AreaCfg {
  label: string;
  value: number;
  delta: number | null;
  fmt?: (v: number) => string;
  seed: number;
  color: string;
  ticks: string[];
  data?: number[];
  xLabels?: string[];
}

/** Single-series area chart with a gradient fill sweeping in. */
export function areaChart(f: Frame, cfg: AreaCfg): void {
  const { ctx, u, t } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label, cfg.value, cfg.fmt ?? ((v) => fmtCompact(v)), cfg.delta);
  const r = plotRect(f, top + 26 * u);
  drawGrid(f, r.y0, r.y1, cfg.ticks.length);

  const data = cfg.data ?? makeSeries(cfg.seed, 18, 0.7);
  const p = easeOut(t / 1.4);
  const grad = ctx.createLinearGradient(0, r.y0, 0, r.y1);
  grad.addColorStop(0, `${cfg.color}59`);
  grad.addColorStop(1, `${cfg.color}00`);

  const end = linePath(ctx, data, r.x0, r.x1, r.y0 + 14 * u, r.y1 - 6 * u, p);
  ctx.save();
  ctx.lineTo(end.x, r.y1);
  ctx.lineTo(r.x0, r.y1);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2.5 * u;
  ctx.lineJoin = 'round';
  linePath(ctx, data, r.x0, r.x1, r.y0 + 14 * u, r.y1 - 6 * u, p);
  ctx.stroke();
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 4.5 * u, 0, Math.PI * 2);
  ctx.fill();
  drawGridLabels(f, r.y0, r.y1, cfg.ticks);
  xAxisLabels(f, cfg.xLabels ?? ['Mon', 'Wed', 'Fri', 'Sun'], r.x0, r.x1, r.y1);
}

export interface BarCfg {
  label: string;
  value: number;
  delta: number | null;
  fmt?: (v: number) => string;
  seed: number;
  color: string;
  ticks: string[];
  data?: number[];
  labels?: string[];
  /** Raw value of the tallest bar, for its direct label. */
  peak?: number;
}

/** Monthly vertical bars growing from the baseline, max bar direct-labeled. */
export function barChart(f: Frame, cfg: BarCfg): void {
  const { ctx, u, t } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label, cfg.value, cfg.fmt ?? ((v) => fmtCompact(v)), cfg.delta);
  const r = plotRect(f, top + 26 * u);
  drawGrid(f, r.y0, r.y1, cfg.ticks.length);

  const data = cfg.data ?? makeSeries(cfg.seed, 12, 0.5);
  const labels = cfg.labels ?? MONTHS;
  const maxI = data.indexOf(Math.max(...data));
  const slot = (r.x1 - r.x0) / data.length;
  const bw = slot - 2 * u - 6 * u;
  data.forEach((v, i) => {
    const p = stagger(t, i, 0.045);
    const bh = (r.y1 - r.y0 - 20 * u) * v * p;
    const x = r.x0 + slot * i + (slot - bw) / 2;
    ctx.fillStyle = cfg.color;
    roundRect(ctx, x, r.y1 - bh, bw, bh, 4 * u);
    ctx.fill();
    if (i === maxI && p >= 1) {
      ctx.fillStyle = INK;
      ctx.font = `600 ${14 * u}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(fmtCompact(cfg.peak ?? cfg.value * v), x + bw / 2, r.y1 - bh - 8 * u);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = MUTED;
    ctx.font = `400 ${13 * u}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(labels[i] ?? '', x + bw / 2, r.y1 + 22 * u);
    ctx.textAlign = 'left';
  });
  drawGridLabels(f, r.y0, r.y1, cfg.ticks);
}

export interface HBarCfg {
  label: string;
  value: number;
  delta: number | null;
  color: string;
  unit?: string;
  rows: { name: string; v: number }[];
}

/** Horizontal top-N bars sliding in, every row direct-labeled. */
export function hBarChart(f: Frame, cfg: HBarCfg): void {
  const { ctx, u, t, w } = f;
  drawSurface(f);
  const unit = cfg.unit ?? '€';
  const top = drawHeader(f, cfg.label, cfg.value, (v) => fmtCompact(v, unit), cfg.delta);
  const pad = 36 * u;
  const rowH = (f.h - 60 * u - (top + 10 * u)) / cfg.rows.length;
  const max = Math.max(...cfg.rows.map((d) => d.v));

  cfg.rows.forEach((d, i) => {
    const p = stagger(t, i, 0.08);
    const y = top + 10 * u + rowH * i;
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${17 * u}px ${FONT}`;
    ctx.fillText(d.name, pad, y + 22 * u);
    ctx.fillStyle = INK;
    ctx.font = `600 ${17 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(fmtCompact(d.v * p, unit), w - pad, y + 22 * u);
    ctx.textAlign = 'left';

    const bw = (w - 2 * pad) * (d.v / max) * p;
    ctx.fillStyle = GRID;
    roundRect(ctx, pad, y + 34 * u, w - 2 * pad, 10 * u, 5 * u);
    ctx.fill();
    ctx.fillStyle = cfg.color;
    roundRect(ctx, pad, y + 34 * u, Math.max(bw, 10 * u), 10 * u, 5 * u);
    ctx.fill();
  });
}

export interface DebtClockCfg {
  label: string;
  /** Latest official total, its record time and the recent growth rate. */
  latest: number;
  latestMs: number;
  ratePerMs: number;
  yoyPct: number;
  /** Monthly totals (normalized) for the trend area below the clock. */
  series: number[];
  ticks: string[];
  color: string;
  isLive: boolean;
}

/**
 * Debt clock: a wall-clock-extrapolated running total counting up between
 * official daily records, with the 12-month trend as an area chart below.
 */
export function debtClock(f: Frame, cfg: DebtClockCfg): void {
  const { ctx, u, t, w } = f;
  drawSurface(f);
  const pad = 36 * u;
  const p = easeOut(t / 0.9);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `600 ${17 * u}px ${FONT}`;
  drawTracked(ctx, cfg.label.toUpperCase(), pad, pad + 16 * u, 2.4 * u);

  // The running figure, auto-fitted so all 17 digits stay inside the panel.
  const now = cfg.latest + Math.max(0, Date.now() - cfg.latestMs) * cfg.ratePerMs;
  const text = `$${Math.round(now * p).toLocaleString('en-US')}`;
  let size = 44 * u;
  ctx.font = `700 ${size}px ${FONT}`;
  const maxW = w - 2 * pad;
  const tw = ctx.measureText(text).width;
  if (tw > maxW) {
    size *= maxW / tw;
    ctx.font = `700 ${size}px ${FONT}`;
  }
  ctx.fillStyle = INK;
  ctx.fillText(text, pad, pad + 74 * u);

  // Rising debt is the alarming direction: the YoY chip stays critical-red.
  const chipText = `▲ ${cfg.yoyPct.toFixed(1)}% YoY`;
  ctx.font = `600 ${19 * u}px ${FONT}`;
  const cw = ctx.measureText(chipText).width;
  const cy = pad + 106 * u;
  ctx.fillStyle = 'rgba(208,59,59,0.14)';
  roundRect(ctx, pad - 6 * u, cy - 20 * u, cw + 20 * u, 30 * u, 15 * u);
  ctx.fill();
  ctx.fillStyle = CRITICAL;
  ctx.fillText(chipText, pad + 4 * u, cy + 2 * u);

  const perSec = cfg.ratePerMs * 1000;
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${17 * u}px ${FONT}`;
  ctx.fillText(
    `${perSec >= 0 ? '+' : '−'}$${Math.abs(Math.round(perSec)).toLocaleString('en-US')} / second`,
    pad + cw + 32 * u,
    cy + 2 * u,
  );

  // Live pulse dot, matching the ticker panels' vocabulary.
  ctx.fillStyle = cfg.isLive ? GOOD : MUTED;
  ctx.beginPath();
  ctx.arc(w - pad - 44 * u, pad + 10 * u, 4.5 * u * (0.8 + 0.2 * Math.sin(t * 4)), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK_SECONDARY;
  ctx.font = `600 ${15 * u}px ${FONT}`;
  ctx.fillText(cfg.isLive ? 'LIVE' : 'SYNC', w - pad - 32 * u, pad + 15 * u);

  // 12-month trend as a gradient area.
  const r = plotRect(f, pad + 158 * u);
  drawGrid(f, r.y0, r.y1, cfg.ticks.length);
  const grad = ctx.createLinearGradient(0, r.y0, 0, r.y1);
  grad.addColorStop(0, `${cfg.color}59`);
  grad.addColorStop(1, `${cfg.color}00`);
  const end = linePath(ctx, cfg.series, r.x0, r.x1, r.y0 + 14 * u, r.y1 - 6 * u, p);
  ctx.save();
  ctx.lineTo(end.x, r.y1);
  ctx.lineTo(r.x0, r.y1);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2.5 * u;
  ctx.lineJoin = 'round';
  linePath(ctx, cfg.series, r.x0, r.x1, r.y0 + 14 * u, r.y1 - 6 * u, p);
  ctx.stroke();
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 4.5 * u, 0, Math.PI * 2);
  ctx.fill();
  drawGridLabels(f, r.y0, r.y1, cfg.ticks);
  xAxisLabels(f, ['-12mo', '-8mo', '-4mo', 'now'], r.x0, r.x1, r.y1);
}

export interface ForecastCfg {
  label: string;
  current: number;
  /** Seven days, today first, with WMO weather codes. */
  days: { day: string; code: number; min: number; max: number }[];
}

type IconKind = 'sun' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'thunder';

function iconFor(code: number): IconKind {
  if (code === 0) return 'sun';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'rain';
}

/** Small hand-drawn weather glyphs in the charts' color vocabulary. */
function drawWeatherIcon(
  ctx: CanvasRenderingContext2D,
  kind: IconKind,
  cx: number,
  cy: number,
  s: number,
): void {
  const [, , yellow] = SERIES;
  const sun = (x: number, y: number, r: number) => {
    ctx.strokeStyle = yellow;
    ctx.fillStyle = yellow;
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45);
      ctx.lineTo(x + Math.cos(a) * r * 1.95, y + Math.sin(a) * r * 1.95);
      ctx.stroke();
    }
  };
  const cloud = (x: number, y: number, k: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - 0.42 * k, y + 0.1 * k, 0.34 * k, Math.PI * 0.4, Math.PI * 1.6);
    ctx.arc(x - 0.06 * k, y - 0.22 * k, 0.42 * k, Math.PI * 0.9, Math.PI * 1.98);
    ctx.arc(x + 0.44 * k, y + 0.06 * k, 0.36 * k, Math.PI * 1.3, Math.PI * 0.55);
    ctx.closePath();
    ctx.fill();
  };

  switch (kind) {
    case 'sun':
      sun(cx, cy, s * 0.52);
      break;
    case 'partly':
      sun(cx + s * 0.34, cy - s * 0.34, s * 0.36);
      cloud(cx - s * 0.08, cy + s * 0.18, s * 0.96, 'rgba(214,222,236,0.92)');
      break;
    case 'cloud':
      cloud(cx, cy, s * 1.06, 'rgba(214,222,236,0.92)');
      break;
    case 'fog':
      cloud(cx, cy - s * 0.22, s * 0.9, 'rgba(214,222,236,0.65)');
      ctx.strokeStyle = 'rgba(214,222,236,0.8)';
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5 + i * s * 0.12, cy + s * 0.34 + i * s * 0.26);
        ctx.lineTo(cx + s * 0.5 - i * s * 0.12, cy + s * 0.34 + i * s * 0.26);
        ctx.stroke();
      }
      break;
    case 'rain':
      cloud(cx, cy - s * 0.22, s * 0.9, 'rgba(214,222,236,0.92)');
      ctx.strokeStyle = SERIES[1];
      ctx.lineWidth = s * 0.13;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * s * 0.34 + s * 0.06, cy + s * 0.3);
        ctx.lineTo(cx + i * s * 0.34 - s * 0.08, cy + s * 0.62);
        ctx.stroke();
      }
      break;
    case 'snow':
      cloud(cx, cy - s * 0.22, s * 0.9, 'rgba(214,222,236,0.92)');
      ctx.fillStyle = '#eef3fb';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(cx + i * s * 0.34, cy + s * 0.46 + Math.abs(i) * s * 0.08, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'thunder':
      cloud(cx, cy - s * 0.26, s * 0.9, 'rgba(214,222,236,0.92)');
      ctx.fillStyle = yellow;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.1, cy - s * 0.05);
      ctx.lineTo(cx - s * 0.22, cy + s * 0.38);
      ctx.lineTo(cx - s * 0.02, cy + s * 0.38);
      ctx.lineTo(cx - s * 0.14, cy + s * 0.72);
      ctx.lineTo(cx + s * 0.26, cy + s * 0.24);
      ctx.lineTo(cx + s * 0.04, cy + s * 0.24);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

/**
 * 7-day forecast: one row per day with a weather glyph and the min–max span
 * drawn as a bar on a scale shared across the week (iOS-weather style).
 */
export function weatherForecast(f: Frame, cfg: ForecastCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label, cfg.current, (v) => `${v.toFixed(1)}°C`, null);
  const pad = 36 * u;

  const lo = Math.min(...cfg.days.map((d) => d.min));
  const hi = Math.max(...cfg.days.map((d) => d.max));
  const span = Math.max(1, hi - lo);

  const rowH = (h - 50 * u - top) / cfg.days.length;
  // Columns: day label | icon | min° | range bar | max°
  const barX0 = pad + 172 * u;
  const barX1 = w - pad - 44 * u;

  cfg.days.forEach((d, i) => {
    const p = stagger(t, i, 0.07);
    if (p <= 0) return;
    const y = top + rowH * i + rowH / 2;
    ctx.globalAlpha = p;

    ctx.fillStyle = i === 0 ? INK : INK_SECONDARY;
    ctx.font = `${i === 0 ? 600 : 500} ${17 * u}px ${FONT}`;
    ctx.fillText(d.day, pad, y + 6 * u);

    drawWeatherIcon(ctx, iconFor(d.code), pad + 92 * u, y, 17 * u);

    ctx.fillStyle = MUTED;
    ctx.font = `500 ${16 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(d.min)}°`, barX0 - 10 * u, y + 6 * u);
    ctx.textAlign = 'left';

    // Track plus the day's min–max span, growing with the stagger.
    ctx.fillStyle = GRID;
    roundRect(ctx, barX0, y - 4 * u, barX1 - barX0, 8 * u, 4 * u);
    ctx.fill();
    const x0 = barX0 + (barX1 - barX0) * ((d.min - lo) / span);
    const x1 = barX0 + (barX1 - barX0) * ((d.max - lo) / span);
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, SERIES[0]);
    grad.addColorStop(1, SERIES[2]);
    ctx.fillStyle = grad;
    roundRect(ctx, x0, y - 4 * u, Math.max((x1 - x0) * p, 8 * u), 8 * u, 4 * u);
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.font = `600 ${16 * u}px ${FONT}`;
    ctx.fillText(`${Math.round(d.max)}°`, barX1 + 10 * u, y + 6 * u);
    ctx.globalAlpha = 1;
  });
}

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
  const top = drawHeader(f, cfg.label, cfg.total, (v) => fmtCompact(v), null);
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
  const ly0 = my0 + mh + 18 * u;
  const rowH = (h - 46 * u - ly0) / rows.length;
  const barMax = Math.max(...rows.map((r) => r.count));
  rows.forEach((s, i) => {
    const p = stagger(t, i + 4, 0.06);
    const y = ly0 + rowH * i;
    ctx.globalAlpha = Math.max(0, p);
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${16 * u}px ${FONT}`;
    ctx.fillText(s.name, pad, y + 15 * u);
    ctx.fillStyle = INK;
    ctx.font = `600 ${16 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(fmtCompact(s.count * Math.max(0, p)), w - pad, y + 15 * u);
    ctx.textAlign = 'left';
    ctx.fillStyle = GRID;
    roundRect(ctx, pad, y + 24 * u, w - 2 * pad, 7 * u, 3.5 * u);
    ctx.fill();
    ctx.fillStyle = CRITICAL;
    roundRect(ctx, pad, y + 24 * u, Math.max((w - 2 * pad) * (s.count / barMax) * Math.max(0, p), 7 * u), 7 * u, 3.5 * u);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  ctx.fillStyle = MUTED;
  ctx.font = `400 ${13 * u}px ${FONT}`;
  ctx.fillText(cfg.source, pad, h - 22 * u);
}

export interface ChoroplethCfg {
  label: string;
  value: number;
  fmt: (v: number) => string;
  /** Value per ISO3 country; countries without data stay neutral. */
  valueByIso?: Record<string, number>;
  world?: { id: string; rings: number[][][] }[];
  rows: { name: string; v: number }[];
  rowFmt: (v: number) => string;
  source: string;
}

/**
 * World choropleth: every country shaded by its value (sqrt ramp against a
 * high percentile so outliers don't wash out the rest), top-5 list below.
 */
export function choroplethMap(f: Frame, cfg: ChoroplethCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label, cfg.value, cfg.fmt, null);
  const pad = 36 * u;

  const mx0 = pad;
  const mw = w - 2 * pad;
  const mh = mw / 2;
  const my0 = top + 4 * u;
  const px = (lon: number) => mx0 + ((lon + 180) / 360) * mw;
  const py = (lat: number) => my0 + ((85 - Math.min(85, Math.max(-60, lat))) / 145) * mh;

  const values = Object.values(cfg.valueByIso ?? {}).toSorted((a, b) => a - b);
  const ref = values.length ? values[Math.floor(values.length * 0.95)] : 1;
  const p = easeOut(t / 1.1);

  if (cfg.world) {
    for (const country of cfg.world) {
      const v = cfg.valueByIso?.[country.id];
      ctx.fillStyle =
        v === undefined
          ? 'rgba(214,222,236,0.06)'
          : `rgba(208,59,59,${(0.1 + 0.62 * Math.sqrt(Math.min(1, v / ref)) * p).toFixed(2)})`;
      for (const ring of country.rings) {
        ctx.beginPath();
        ring.forEach(([lon, lat], i) => {
          if (i === 0) ctx.moveTo(px(lon), py(lat));
          else ctx.lineTo(px(lon), py(lat));
        });
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  const rows = cfg.rows;
  const ly0 = my0 + mh + 18 * u;
  const rowH = (h - 46 * u - ly0) / Math.max(1, rows.length);
  const barMax = Math.max(...rows.map((r) => r.v), 1);
  rows.forEach((s, i) => {
    const rp = stagger(t, i + 4, 0.06);
    const y = ly0 + rowH * i;
    ctx.globalAlpha = Math.max(0, rp);
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${16 * u}px ${FONT}`;
    ctx.fillText(s.name, pad, y + 15 * u);
    ctx.fillStyle = INK;
    ctx.font = `600 ${16 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(cfg.rowFmt(s.v * Math.max(0, rp)), w - pad, y + 15 * u);
    ctx.textAlign = 'left';
    ctx.fillStyle = GRID;
    roundRect(ctx, pad, y + 24 * u, w - 2 * pad, 7 * u, 3.5 * u);
    ctx.fill();
    ctx.fillStyle = CRITICAL;
    roundRect(ctx, pad, y + 24 * u, Math.max((w - 2 * pad) * (s.v / barMax) * Math.max(0, rp), 7 * u), 7 * u, 3.5 * u);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  ctx.fillStyle = MUTED;
  ctx.font = `400 ${13 * u}px ${FONT}`;
  ctx.fillText(cfg.source, pad, h - 22 * u);
}
