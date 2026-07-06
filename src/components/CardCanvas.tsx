import { useEffect, useRef } from 'react';
import { SETTLED_T, type Dashboard } from '../dashboards';

// The draw functions are written against a 512-wide reference layout (u =
// w / 512) and paint straight onto a 2D context — the same calls the ring's
// textures make, just into a plain canvas here. No Three.js on this path.
const REF_W = 512;
// Real-time seconds to play the fly-in for before locking the settled frame.
// Draw progress runs on `t`; the slowest element (the line, easeOut(t/1.4))
// finishes at t=1.4, so a ~2s window covers every panel's intro. After that we
// hold SETTLED_T — the same fully-settled time the ring renders — so endpoints
// (e.g. the temperature line's true final value) land where they should.
const INTRO_S = 2;

interface CardCanvasProps {
  dashboard: Dashboard;
  /** Only the card in view animates; the rest render settled (cheap, static). */
  animate: boolean;
}

/** One dashboard rendered into a 2D canvas for the mobile deck. */
export function CardCanvas({ dashboard, animate }: CardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const draw = (t: number) => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      dashboard.draw({ ctx, w, h, t, u: w / REF_W });
    };

    let raf = 0;
    if (animate) {
      let start = 0;
      const tick = (now: number) => {
        if (!start) start = now;
        const t = (now - start) / 1000;
        if (t < INTRO_S) {
          draw(t);
          raf = requestAnimationFrame(tick);
        } else {
          draw(SETTLED_T); // lock the fully-settled frame
        }
      };
      raf = requestAnimationFrame(tick);
    } else {
      draw(SETTLED_T);
    }

    const onResize = () => draw(SETTLED_T);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [dashboard, animate]);

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
