import type { Frame } from './draw';

/**
 * Structured background for the detail view (mobile info sheet, gallery
 * lightbox). German source strings, translated via t() at render time.
 * `kontext` is the short "what am I looking at" framing every card should
 * carry; the study-backed cards add pro/kontra/hinweise.
 */
export interface CardDetail {
  /** 1–2 sentences: what the card shows and why it matters. */
  kontext?: string;
  /** What the underlying data genuinely supports. */
  pro?: string[];
  /** What it does not show — limits, gaps, common over-readings. */
  kontra?: string[];
  /** The study authors' own caveats, kept in their spirit. */
  hinweise?: string[];
}

export interface Dashboard {
  id: string;
  title: string;
  /** True for panels that keep moving while idle — re-rendered on ticks. */
  live?: boolean;
  /** True for panels whose data is filled in by a live fetcher, so they need a
      re-render when a dataset lands. Purely bundled panels leave this off and
      skip the (otherwise per-feed, per-panel) redraw storm during boot. */
  dynamic?: boolean;
  /** Theme tags for the filter chips; assigned from TAGS_BY_ID. */
  tags?: string[];
  /** ISO timestamp of when the card was added; assigned from ADDED_BY_ID and
      used by the NEU chip to order the deck newest-first. */
  added?: string;
  /** Data source and key caveats, shown behind the mobile info button. */
  source?: string;
  /** Detail-view background (kontext, pro/kontra, author caveats); assigned
      from DETAILS_BY_ID so card definitions stay lean. */
  detail?: CardDetail;
  draw: (f: Frame) => void;
}

/**
 * Time fed into the one-shot idle render: far past every intro, so panels
 * show a settled chart until a hover replays the animation from 0.
 */
export const SETTLED_T = 9.7;

/**
 * Real-time seconds to play a card's fly-in before locking the settled frame.
 * Draw progress runs on `t`; the slowest element (the line, easeOut(t/1.4))
 * finishes at t=1.4, so a ~2s window covers every panel's intro. After that
 * hold SETTLED_T so endpoints (e.g. the temperature line's true final value)
 * land where they should.
 */
export const INTRO_S = 2;
