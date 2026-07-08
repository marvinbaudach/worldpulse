// Helpers shared across the chart renderers: color math, the standard plot
// rectangle, axis labels, the source footer and the ranked top-N list that
// sits below the map panels.

import { roundRect, stagger, type Frame } from '../draw';
import { FONT, GRID, INK, INK_SECONDARY, MUTED } from '../theme';
import { t as tr } from '../../i18n';

/** Hex color (#rrggbb) at the given opacity. */
export function withAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/** Blend a hex color (#rrggbb) toward white by amount (0..1). */
export function lighten(hex: string, amt: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const m = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/**
 * Shared horizontal ramp spanning the full track: dark and muted at the
 * baseline, full color at the midpoint, brightened at the far end. Every bar
 * is clipped to its own length, so where a bar's tip lands on this shared
 * ramp encodes its magnitude — longer bars end on hotter, brighter tones,
 * which makes the lengths directly comparable at a glance. The brightened
 * tip leaves headroom so even bars packed in a narrow high band still
 * separate by color instead of reading as one flat block.
 */
export function barGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  hex: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, withAlpha(hex, 0.32));
  g.addColorStop(0.5, hex);
  g.addColorStop(1, lighten(hex, 0.5));
  return g;
}

export const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** The standard plot rectangle: horizontal padding, `top` to a fixed footer. */
export function plotRect(f: Frame, top: number) {
  const pad = 36 * f.u;
  return { x0: pad, x1: f.w - pad, y0: top, y1: f.h - 64 * f.u };
}

/** Evenly spaced x-axis labels along the baseline. */
export function xAxisLabels(f: Frame, labels: string[], x0: number, x1: number, y: number): void {
  const { ctx, u } = f;
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${14 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    ctx.fillText(tr(l), x0 + ((x1 - x0) * i) / (labels.length - 1), y + 24 * u);
  });
  ctx.textAlign = 'left';
}

/** Muted source/attribution line pinned to the panel's bottom-left. */
export function drawSource(f: Frame, source: string): void {
  if (f.compact) return; // mobile shows the source behind the info button
  const { ctx, u, h } = f;
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${13 * u}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(tr(source), 36 * u, h - 22 * u);
}

/**
 * Ranked top-N list below the map panels: name left, value right, a track
 * with a magnitude-ramped bar under each. Shared by the nuke and choropleth
 * maps.
 */
// Flag emoji per country, keyed by the German names the panels use plus the
// English World Bank names the live military/homicide feeds return. Ranked
// row labels get their flag appended automatically (drawRankedList, hBarChart)
// so every country list carries one without hand-editing each panel.
const COUNTRY_FLAGS: Record<string, string> = {
  USA: '🇺🇸', China: '🇨🇳', Russland: '🇷🇺', Deutschland: '🇩🇪', Indien: '🇮🇳',
  Japan: '🇯🇵', Schweiz: '🇨🇭', Frankreich: '🇫🇷', Italien: '🇮🇹', Spanien: '🇪🇸',
  Griechenland: '🇬🇷', Großbritannien: '🇬🇧', Schweden: '🇸🇪', Österreich: '🇦🇹',
  Belgien: '🇧🇪', Dänemark: '🇩🇰', Irland: '🇮🇪', Niederlande: '🇳🇱', Portugal: '🇵🇹',
  Norwegen: '🇳🇴', Nordkorea: '🇰🇵', Südkorea: '🇰🇷', Pakistan: '🇵🇰', Iran: '🇮🇷',
  Vietnam: '🇻🇳', Ägypten: '🇪🇬', 'El Salvador': '🇸🇻', Kuba: '🇨🇺', Ruanda: '🇷🇼',
  Türkei: '🇹🇷', Brasilien: '🇧🇷', Nauru: '🇳🇷', Kuwait: '🇰🇼', Mexiko: '🇲🇽',
  Monaco: '🇲🇨', Singapur: '🇸🇬', Nigeria: '🇳🇬', Tschad: '🇹🇩', Lesotho: '🇱🇸',
  Jamaika: '🇯🇲', Südafrika: '🇿🇦', Honduras: '🇭🇳', Südsudan: '🇸🇸', Somalia: '🇸🇴',
  Venezuela: '🇻🇪', Syrien: '🇸🇾', Libyen: '🇱🇾', Argentinien: '🇦🇷', Sudan: '🇸🇩',
  Ecuador: '🇪🇨', Serbien: '🇷🇸', Paraguay: '🇵🇾', Ukraine: '🇺🇦', Irak: '🇮🇶',
  Afghanistan: '🇦🇫', Jemen: '🇾🇪', Gaza: '🇵🇸', Estland: '🇪🇪', 'Saudi-Arabien': '🇸🇦',
  Israel: '🇮🇱', Polen: '🇵🇱', Australien: '🇦🇺',
  'United States': '🇺🇸', 'Russian Federation': '🇷🇺', Germany: '🇩🇪', India: '🇮🇳',
  'Saudi Arabia': '🇸🇦', 'United Kingdom': '🇬🇧', France: '🇫🇷', 'Korea, Rep.': '🇰🇷',
  Italy: '🇮🇹', Australia: '🇦🇺', Poland: '🇵🇱', Jamaica: '🇯🇲', 'South Africa': '🇿🇦',
  Brazil: '🇧🇷', Mexico: '🇲🇽',
  Madagaskar: '🇲🇬', Malawi: '🇲🇼', 'Zentralafr. Republik': '🇨🇫', Burundi: '🇧🇮',
  Mosambik: '🇲🇿', 'DR Kongo': '🇨🇩', Sambia: '🇿🇲',
};

const HAS_FLAG = /\p{Regional_Indicator}/u;

/** Country name with its flag appended, when we know one and it carries none
    yet. Trailing descriptors ("· seit 2011", "(Stadt)") are ignored for the
    lookup, so "Syrien · seit 2011" still resolves to the Syrian flag. */
export function withFlag(name: string): string {
  // The flag is looked up on the German (or World Bank English) source name
  // before translation, then appended to the translated label.
  if (HAS_FLAG.test(name)) return tr(name);
  const key = name.replace(/\s*[·(].*$/u, '').trim();
  const flag = COUNTRY_FLAGS[key];
  return flag ? `${tr(name)} ${flag}` : tr(name);
}

export function drawRankedList(
  f: Frame,
  opts: {
    rows: { name: string; v: number }[];
    /** Y where the list starts (just below the map). */
    top: number;
    rowFmt: (v: number) => string;
    color: string;
  },
): void {
  const { ctx, u, t, w, h } = f;
  const pad = 36 * u;
  const { rows, top, rowFmt, color } = opts;
  const rowH = (h - 46 * u - top) / Math.max(1, rows.length);
  const barMax = Math.max(...rows.map((r) => r.v), 1);
  const grad = barGradient(ctx, pad, w - pad, color);
  // Label sits right above its bar (small fixed gap); the ~26u pair is
  // centered in the row slot so the slack pools between groups and each
  // label reads as tied to its own bar, not the row above.
  const groupH = 26 * u;
  rows.forEach((s, i) => {
    const p = Math.max(0, stagger(t, i + 4, 0.06));
    const y = top + rowH * i + Math.max(0, (rowH - groupH) / 2);
    ctx.globalAlpha = p;
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 ${16 * u}px ${FONT}`;
    ctx.fillText(withFlag(s.name), pad, y + 13 * u);
    ctx.fillStyle = INK;
    ctx.font = `600 ${16 * u}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(rowFmt(s.v * p), w - pad, y + 13 * u);
    ctx.textAlign = 'left';
    ctx.fillStyle = GRID;
    roundRect(ctx, pad, y + 19 * u, w - 2 * pad, 7 * u, 3.5 * u);
    ctx.fill();
    ctx.fillStyle = grad;
    roundRect(ctx, pad, y + 19 * u, Math.max((w - 2 * pad) * (s.v / barMax) * p, 7 * u), 7 * u, 3.5 * u);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}
