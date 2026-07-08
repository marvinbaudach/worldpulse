import { useEffect, useRef } from 'react';
import { SETTLED_T, type Dashboard } from '../dashboards';
import { onLiveUpdate } from '../data/store';

// The draw functions are written against a 512-wide reference layout (u =
// w / 512). Mobile cards render ~370 CSS px wide, which shrinks that design
// below comfortable reading size — so the deck uses a smaller reference
// width, boosting u (and with it every font, stroke and legend) ~22% across
// all cards at once. Tune this constant by eye in device emulation.
const MOBILE_REF_W = 420;
// Real-time seconds to play the fly-in for before locking the settled frame.
// Draw progress runs on `t`; the slowest element (the line, easeOut(t/1.4))
// finishes at t=1.4, so a ~2s window covers every panel's intro. After that we
// hold SETTLED_T — the same fully-settled time the ring renders — so endpoints
// (e.g. the temperature line's true final value) land where they should.
const INTRO_S = 2;

// Dominant saturated color of a drawn card, for tinting the background to
// the card's own palette. Sparse pixel stride keeps this ~1ms; grays and the
// dark surface are skipped so only chart ink (lines, bars, chips) votes.
function dominantColor(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx || !canvas.width) return null;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < d.length; i += 64) {
    const cr = d[i];
    const cg = d[i + 1];
    const cb = d[i + 2];
    const max = Math.max(cr, cg, cb);
    if (max - Math.min(cr, cg, cb) > 60 && max > 90) {
      r += cr;
      g += cg;
      b += cb;
      count++;
    }
  }
  if (count < 20) return null; // barely any ink (e.g. a t=0 skeleton)
  const hex = (v: number) => Math.round(v / count).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

interface CardCanvasProps {
  dashboard: Dashboard;
  /** Only the card in view animates; the rest render a single static frame. */
  animate: boolean;
  /** Static frame for non-animating cards: waiting neighbours hold the intro's
      start frame (t=0) so the finished chart is never spoiled before its
      fly-in plays on landing; under reduced motion they hold SETTLED_T. */
  restT?: number;
  /** Front card only: reports the drawn chart's dominant color once the card
      is fully settled, so the background can tint toward the card. */
  onColor?: (color: string | null) => void;
}

/** One dashboard rendered into a 2D canvas for the mobile deck. */
export function CardCanvas({ dashboard, animate, restT = SETTLED_T, onColor }: CardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const draw = (t: number) => {
      // Layout size, not getBoundingClientRect(): the intro can replay while
      // the card is mid-drag with rotate/rotateY transforms applied, and the
      // transformed bounding box changes every frame — reallocating the
      // backing store and jumping `u`. clientWidth/Height ignore transforms.
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      dashboard.draw({ ctx, w, h, t, u: w / MOBILE_REF_W, compact: true });
    };

    let raf = 0;
    let settled = !animate;
    if (animate) {
      let start = 0;
      const tick = (now: number) => {
        if (!start) start = now;
        const t = (now - start) / 1000;
        if (t < INTRO_S) {
          draw(t);
          raf = requestAnimationFrame(tick);
        } else {
          settled = true;
          draw(SETTLED_T); // lock the fully-settled frame
          onColor?.(dominantColor(canvas));
        }
      };
      raf = requestAnimationFrame(tick);
    } else {
      draw(restT);
      // Reduced-motion front card: settled immediately, report right away.
      if (restT === SETTLED_T) onColor?.(dominantColor(canvas));
    }

    // Live cards keep counting (the once-a-second tick) and dynamic cards
    // repaint when a dataset lands — the same triggers the WebGL ring uses.
    // Guarded on `settled` so an update never interrupts the intro replay;
    // waiting neighbours (restT 0) are excluded too — they hold their empty
    // start frame until they land and play the intro themselves.
    const settledUpdates = animate || restT === SETTLED_T;
    const offLive =
      (dashboard.live || dashboard.dynamic) && settledUpdates
        ? onLiveUpdate((kind) => {
            if (!settled) return;
            if (kind === 'tick' ? dashboard.live : dashboard.dynamic) draw(SETTLED_T);
          })
        : undefined;

    const onResize = () => draw(animate ? SETTLED_T : restT);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      offLive?.();
    };
  }, [dashboard, animate, restT, onColor]);

  // pan-x so a horizontal swipe still scrolls the pager: the global canvas
  // rule sets touch-action:none for the 3D drag, which would otherwise trap
  // the swipe on the card.
  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'pan-x' }}
    />
  );
}
