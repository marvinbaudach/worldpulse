import { CanvasTexture } from 'three';

// Shared, lazily-built canvas textures for the panel back face and the focus
// glow. Both are singletons: every ring panel reuses the same texture, so the
// whole ring costs two uploads regardless of card count. Built lazily (not at
// module load) so importing this file from a non-browser context — e.g. a test
// harness rasterising cards — never touches `document`.

/** Near-black panel back with a rounded silhouette, a soft vertical gradient
    and a hairline rim — so a card seen from behind reads as a deliberate dark
    slab instead of the mirrored front it used to show through DoubleSide. */
function makeBackTexture(): CanvasTexture {
  const w = 256;
  const h = 320; // 4:5, matching the panel geometry
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new CanvasTexture(canvas);

  const r = 16;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, r);
  ctx.clip();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0b0e14');
  grad.addColorStop(1, '#05070b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(3, 3, w - 6, h - 6, r);
  ctx.stroke();

  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

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

let backTex: CanvasTexture | null = null;
let glowTex: CanvasTexture | null = null;

export function getBackTexture(): CanvasTexture {
  if (!backTex) backTex = makeBackTexture();
  return backTex;
}

export function getGlowTexture(): CanvasTexture {
  if (!glowTex) glowTex = makeGlowTexture();
  return glowTex;
}
