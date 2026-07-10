// A status timeline: a vertical spine of dated milestones with a headline
// status pill. Unlike the numeric renderers, this one draws a chronology —
// proposal, votes, court rulings, or a technology's milestones — so the deck
// can carry dossiers (Chatkontrolle, Weg zur AGI …) that have no clean series.
//
// Colour is semantic, not decorative: a restriction that is *in force* burns
// CRITICAL red, one that was *blocked or struck down* (a civil-liberties win)
// reads GOOD green, so the current state of play is legible at a glance.
// The past/now/forecast trio carries milestone chronologies: documented
// history, the "we are here" anchor, and projections — forecasts draw with a
// dashed spine and hollow dots so a prediction never reads as a measurement.

import { drawSurface, drawHeader, roundRect, stagger, type Frame } from '../draw';
import { BASELINE, CRITICAL, FONT, GOOD, INK_SECONDARY, SERIES } from '../theme';
import { drawSource, ellipsize, withAlpha } from './shared';
import { t as tr } from '../../i18n';

/** proposed → tabled · adopted → passed · inforce → active restriction ·
    blocked → stalled/withdrawn · court → judicial ruling ·
    past → documented history · now → "we are here" · forecast → projection. */
export type TimelineKind =
  | 'proposed'
  | 'adopted'
  | 'inforce'
  | 'blocked'
  | 'court'
  | 'past'
  | 'now'
  | 'forecast';

const KIND_COLOR: Record<TimelineKind, string> = {
  proposed: SERIES[0], // blue
  adopted: SERIES[2], // yellow
  inforce: CRITICAL, // red — the restriction is live
  blocked: GOOD, // green — stopped or struck down
  court: SERIES[1], // aqua — a court weighed in
  past: SERIES[0], // blue — it happened, it's documented
  now: SERIES[1], // aqua — the "we are here" anchor
  forecast: SERIES[2], // yellow — a prediction, rendered dashed/hollow
};

export interface StatusTimelineCfg {
  label: string;
  /** Headline pill under the header — the current state of the dossier. */
  status: { text: string; kind: TimelineKind };
  /** Milestones oldest-first (top) to newest (bottom). */
  milestones: { date: string; text: string; kind: TimelineKind }[];
  source: string;
}

/**
 * Vertical timeline: a status pill, then a spine of milestone dots with a bold
 * date and a one-line description each. The spine and the dots reveal with a
 * per-row stagger so a hover replays the chronology top-to-bottom.
 */
export function statusTimeline(f: Frame, cfg: StatusTimelineCfg): void {
  const { ctx, u, t, w, h } = f;
  drawSurface(f);
  const top = drawHeader(f, cfg.label);
  const pad = 36 * u;
  const x0 = pad;

  // Status pill: the one-glance verdict, tinted to the current kind.
  const pillColor = KIND_COLOR[cfg.status.kind];
  const pillText = tr(cfg.status.text).toUpperCase();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${13 * u}px ${FONT}`;
  const pillW = ctx.measureText(pillText).width + 22 * u;
  const pillY = top;
  ctx.fillStyle = withAlpha(pillColor, 0.18);
  roundRect(ctx, x0, pillY, pillW, 24 * u, 12 * u);
  ctx.fill();
  ctx.fillStyle = pillColor;
  ctx.beginPath();
  ctx.arc(x0 + 12 * u, pillY + 12 * u, 4 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(pillText, x0 + 22 * u, pillY + 16.5 * u);

  // Spine + milestone rows fill the space between the pill and the footer.
  const rowsTop = pillY + 44 * u;
  const bottom = h - (f.compact ? 26 * u : 58 * u);
  const n = cfg.milestones.length;

  // A single vertical spine leaves the right half of a wide (landscape) card
  // empty. Past a landscape aspect — and only with enough milestones to be
  // worth splitting — flow the chronology into two newspaper-style columns:
  // it fills the reclaimed width and each row gets ~double the vertical room.
  // Desktop panels (non-compact, portrait 4:5) and the portrait deck keep the
  // single column untouched.
  const twoCol = f.compact && w / h > 1.5 && n >= 6;
  const colGap = 30 * u;
  const colW = twoCol ? (w - 2 * pad - colGap) / 2 : w - 2 * pad;
  const perCol = twoCol ? Math.ceil(n / 2) : n;
  const rowH = (bottom - rowsTop) / Math.max(1, perCol);

  // Draw one spine's worth of milestones within [colX0, colX0 + colW]. The
  // stagger keys off the row index within the column, so both columns cascade
  // top-to-bottom together rather than the second waiting for the first.
  const drawColumn = (colX0: number, startIdx: number, count: number): void => {
    const spineX = colX0 + 7 * u;
    const textX = spineX + 22 * u;
    const maxTextW = colX0 + colW - textX;
    const dotY = (r: number) => rowsTop + rowH * (r + 0.5);

    // Faint full-height spine behind the dots.
    if (count > 1) {
      ctx.strokeStyle = BASELINE;
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(spineX, dotY(0));
      ctx.lineTo(spineX, dotY(count - 1));
      ctx.stroke();
    }

    for (let r = 0; r < count; r++) {
      const m = cfg.milestones[startIdx + r];
      const p = Math.max(0, stagger(t, r, 0.12));
      if (p <= 0) continue;
      ctx.globalAlpha = p;
      const color = KIND_COLOR[m.kind];
      const isForecast = m.kind === 'forecast';
      const y = dotY(r);

      // Coloured segment of the spine, drawn up to this dot as it reveals.
      // Into a forecast the spine turns dashed — measurement ends above it.
      if (r > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * u;
        if (isForecast) ctx.setLineDash([5 * u, 4 * u]);
        ctx.beginPath();
        ctx.moveTo(spineX, dotY(r - 1));
        ctx.lineTo(spineX, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Milestone dot with a soft halo; forecasts get a hollow ring instead
      // of a filled dot so a prediction never reads as a documented event.
      ctx.fillStyle = withAlpha(color, isForecast ? 0.12 : 0.22);
      ctx.beginPath();
      ctx.arc(spineX, y, 9 * u, 0, Math.PI * 2);
      ctx.fill();
      if (isForecast) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.arc(spineX, y, 4.5 * u, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(spineX, y, 5 * u, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bold date (in the kind colour) then the description on the same line.
      ctx.textAlign = 'left';
      ctx.font = `700 ${14 * u}px ${FONT}`;
      ctx.fillStyle = color;
      const date = tr(m.date);
      ctx.fillText(date, textX, y + 5 * u);
      const dateW = ctx.measureText(date).width + 12 * u;
      ctx.font = `500 ${14 * u}px ${FONT}`;
      ctx.fillStyle = INK_SECONDARY;
      ctx.fillText(ellipsize(ctx, tr(m.text), maxTextW - dateW), textX + dateW, y + 5 * u);
      ctx.globalAlpha = 1;
    }
  };

  if (twoCol) {
    drawColumn(pad, 0, perCol);
    drawColumn(pad + colW + colGap, perCol, n - perCol);
  } else {
    drawColumn(pad, 0, n);
  }

  drawSource(f, cfg.source);
}
