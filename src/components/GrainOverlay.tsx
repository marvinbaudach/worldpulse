// A static film-grain layer over the canvas. Replaces the postprocessing
// `Noise` pass, which ran a fullscreen shader every frame at the full render
// resolution — pure fill cost on a scene that is already fill-rate bound. A
// tiled SVG turbulence texture blended over the canvas gives the same dressing
// for zero per-frame GPU work (the browser rasterises the tile once and the
// compositor reuses it). The tradeoff: the grain no longer animates frame to
// frame, but at this opacity the shimmer was never the point — the texture is.

// feTurbulence at a high base frequency, desaturated to neutral grey and made
// seamlessly tileable (stitchTiles). Kept small (160px) so it costs one tiny
// upload and repeats across the viewport.
const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

/**
 * Full-viewport grain, blended over the WebGL canvas. `hidden` drops it while a
 * hero owns the screen — matching the old `dressed` gate on the Noise pass, so
 * the enlarged card reads clean.
 */
export function GrainOverlay({ hidden }: { hidden: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        backgroundImage: `url("${GRAIN_SVG}")`,
        backgroundRepeat: 'repeat',
        mixBlendMode: 'overlay',
        opacity: hidden ? 0 : 0.1,
        transition: 'opacity 300ms ease',
      }}
    />
  );
}
