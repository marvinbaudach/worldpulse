import { CanvasTexture } from 'three';

// Shared, lazily-built canvas texture for the focus glow: a singleton every
// ring panel reuses, so the whole ring costs one upload regardless of card
// count. Built lazily (not at module load) so importing this file from a
// non-browser context — e.g. a test harness rasterising cards — never touches
// `document`. (Panel backs render the card's own chart, UV-flipped, straight
// from the dashboard texture — see CarouselItem/HeroCard — so no back texture
// lives here anymore.)

/** Soft radial falloff, white core to transparent edge. Tinted and additively
    blended behind the front-most card so it lights a halo around the focus. */
function makeGlowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new CanvasTexture(canvas);

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

let glowTex: CanvasTexture | null = null;

export function getGlowTexture(): CanvasTexture {
  if (!glowTex) glowTex = makeGlowTexture();
  return glowTex;
}
