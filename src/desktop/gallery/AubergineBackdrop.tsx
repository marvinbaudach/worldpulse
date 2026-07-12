// The desktop gallery's backdrop: an Ubuntu-aubergine lava lamp — compact
// colour blobs that visibly travel behind the card grid, with a per-category
// accent bloom in the top-right. Pure CSS — no WebGL ships to the desktop
// chunk. The base blobs stay strictly within the aubergine hue and differ
// only in brightness (deep → plum → bloom → lifted bloom); the one foreign
// hue allowed is the category accent, which carries the mood cross-fade.
//
// Two things make the lava-lamp read work (v1 failed both and looked static):
// - CONTRAST: the blobs are compact with a defined falloff. A viewport-sized
//   ultra-soft gradient can move all it wants — without a visible edge there
//   is nothing for the eye to track.
// - TRAVEL: each blob journeys a real fraction of the viewport (~20-30%) on
//   its own closed multi-waypoint path with its own period (22s/30s/36s/40s —
//   non-harmonic, so the constellation never visibly repeats). Relative
//   motion between blobs is what reads as liquid; gentle per-segment
//   ease-in-out keeps it calm rather than busy.
//
// Compositor discipline: each gradient is painted ONCE onto its oversized
// layer and the flow animates `transform` (translate3d/scale/rotate) and
// `opacity` only — never `background-position`, which would re-rasterize the
// full-viewport gradient every frame. The rotation matters visually: the
// gradients are elliptical, so rotating them morphs the blob's silhouette
// without any repaint. The accent mood change is a real cross-fade via
// mount-time `opacity` keyframes (a transition on a custom property inside a
// gradient would snap — not animatable without @property): the incoming
// bloom fades in while the outgoing layer, kept mounted for the fade's
// duration, fades out.

import { useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { AUBERGINE } from './galleryChrome';
import { onGalleryScroll } from './galleryScroll';

// Oversize the drifting layers well past every viewport edge: translate % is
// relative to the layer box, so the wide bleed is what buys the blobs their
// long journeys without ever exposing a layer border.
const BLEED = '-30%';
const FADE_MS = 600;

const Viewport = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: ${AUBERGINE.ground2}; /* paints the frame before the layers mount */
`;

// The near-black ground stays put; everything above it flows.
const Ground = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    150deg,
    ${AUBERGINE.ground0},
    ${AUBERGINE.ground1} 55%,
    ${AUBERGINE.ground2}
  );
`;

// Freeze all backdrop motion while the lightbox is open: the drifting layers
// are each far larger than the viewport, and recompositing all of them every
// frame costs half the frame budget (measured 2× frame time) — budget the
// card fly-in needs. Behind the lightbox's deep dim the freeze is
// imperceptible. Accent cross-fades can't be interrupted by this: the accent
// only changes via toolbar category picks, unreachable while the modal is
// open.
const pauseWhileLightboxOpen = css`
  body:has([aria-modal='true']) & {
    animation-play-state: paused;
  }
`;

// Shared skeleton for the free-floating colour blobs. Path keyframes live on
// the concrete blobs below — each needs its own uniquely named loop.
const Blob = styled.div`
  position: absolute;
  inset: ${BLEED};
  will-change: transform, opacity;
  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
  ${pauseWhileLightboxOpen}
`;

// Bright magenta blob — the lead voice. Starts upper-left, swings deep into
// the centre of the frame and back. Closed loop (last frame = first) so the
// motion never ping-pongs; per-segment ease-in-out gives it a breathing gait.
const BloomBlob = styled(Blob)`
  background: radial-gradient(
    42% 34% at 24% 22%,
    ${AUBERGINE.bloom},
    color-mix(in oklab, ${AUBERGINE.bloom} 45%, transparent) 45%,
    transparent 68%
  );
  animation: aubergine-bloom-flow 22s ease-in-out infinite;
  @keyframes aubergine-bloom-flow {
    0%,
    100% {
      transform: translate3d(-8%, -6%, 0) rotate(0deg) scale(1);
      opacity: 0.9;
    }
    25% {
      transform: translate3d(6%, 4%, 0) rotate(6deg) scale(1.18);
      opacity: 1;
    }
    50% {
      transform: translate3d(14%, -4%, 0) rotate(-4deg) scale(1.05);
      opacity: 0.8;
    }
    75% {
      transform: translate3d(2%, 9%, 0) rotate(5deg) scale(1.22);
      opacity: 1;
    }
  }
`;

// Plum blob, upper right — counter-phased against the magenta so the two
// approach, merge and part instead of travelling in formation.
const PlumBlob = styled(Blob)`
  background: radial-gradient(
    38% 32% at 74% 26%,
    ${AUBERGINE.plum},
    color-mix(in oklab, ${AUBERGINE.plum} 50%, transparent) 48%,
    transparent 70%
  );
  animation: aubergine-plum-flow 30s ease-in-out infinite;
  @keyframes aubergine-plum-flow {
    0%,
    100% {
      transform: translate3d(8%, 5%, 0) rotate(0deg) scale(1.08);
      opacity: 1;
    }
    25% {
      transform: translate3d(-7%, -5%, 0) rotate(-6deg) scale(0.94);
      opacity: 0.8;
    }
    50% {
      transform: translate3d(-14%, 7%, 0) rotate(4deg) scale(1.2);
      opacity: 1;
    }
    75% {
      transform: translate3d(4%, -8%, 0) rotate(-5deg) scale(1);
      opacity: 0.85;
    }
  }
`;

// Deep violet ground-swell along the bottom — the slowest, broadest layer:
// the lower half stays calmer while the upper blobs do the travelling.
const DeepBlob = styled(Blob)`
  background: radial-gradient(
    60% 48% at 60% 92%,
    ${AUBERGINE.deep},
    color-mix(in oklab, ${AUBERGINE.deep} 55%, transparent) 50%,
    transparent 72%
  );
  animation: aubergine-deep-flow 40s ease-in-out infinite;
  @keyframes aubergine-deep-flow {
    0%,
    100% {
      transform: translate3d(0%, 3%, 0) rotate(0deg) scale(1);
      opacity: 1;
    }
    33% {
      transform: translate3d(-11%, -3%, 0) rotate(4deg) scale(1.15);
      opacity: 0.85;
    }
    66% {
      transform: translate3d(9%, 0%, 0) rotate(-4deg) scale(1.06);
      opacity: 1;
    }
  }
`;

// A small bright-lila wisp on a long diagonal wander. The palette stays
// strictly in the aubergine family — this is the same magenta lifted towards
// white (a brightness step, not a new hue), so its lightness contrast against
// the darker blobs is what makes the flow unmistakable even in the thin gaps
// between cards.
const LIFTED_BLOOM = `color-mix(in oklab, ${AUBERGINE.bloom} 72%, white)`;

const BrightWisp = styled(Blob)`
  background: radial-gradient(
    22% 18% at 42% 58%,
    color-mix(in oklab, ${LIFTED_BLOOM} 32%, transparent),
    transparent 70%
  );
  animation: aubergine-wisp-flow 36s ease-in-out infinite;
  @keyframes aubergine-wisp-flow {
    0%,
    100% {
      transform: translate3d(-12%, 10%, 0) rotate(0deg) scale(1);
      opacity: 0.75;
    }
    30% {
      transform: translate3d(2%, -2%, 0) rotate(8deg) scale(1.25);
      opacity: 1;
    }
    55% {
      transform: translate3d(13%, -9%, 0) rotate(-6deg) scale(1.05);
      opacity: 0.7;
    }
    80% {
      transform: translate3d(0%, 4%, 0) rotate(4deg) scale(1.18);
      opacity: 0.95;
    }
  }
`;

// One accent bloom per accent value, flowing on its own closed loop so the
// mood tint takes part in the liquid motion. Fades run as mount-time
// keyframes (`forwards` pins the end state), so they replay reliably when a
// layer (re)mounts.
const AccentBloom = styled.div<{ $accent: string; $out: boolean }>`
  position: absolute;
  inset: ${BLEED};
  background: radial-gradient(
    36% 30% at 78% 18%,
    color-mix(in oklab, ${(p) => p.$accent} 42%, transparent),
    transparent 68%
  );
  animation:
    ${(p) => (p.$out ? 'bloom-out' : 'bloom-in')} ${FADE_MS}ms ease forwards,
    accent-flow 26s ease-in-out infinite;
  will-change: transform, opacity;
  @keyframes accent-flow {
    0%,
    100% {
      transform: translate3d(5%, -5%, 0) rotate(0deg) scale(1.06);
    }
    33% {
      transform: translate3d(-6%, 6%, 0) rotate(-5deg) scale(0.96);
    }
    66% {
      transform: translate3d(-10%, -2%, 0) rotate(4deg) scale(1.16);
    }
  }
  @keyframes bloom-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes bloom-out {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: ${(p) => (p.$out ? 0 : 1)};
  }
  ${pauseWhileLightboxOpen}
`;

// Scroll parallax: scrolling the gallery "stirs" the lava. Each layer follows
// a sine orbit over scroll depth (own amplitude/wavelength/phase, x and y
// wavelengths deliberately different), so the constellation reorganises at
// every scroll position and never runs off-screen no matter how deep the grid
// scrolls — a plain linear factor would have pushed the blobs out of frame
// after a few thousand px. Offsets are written to the individual `translate`
// property, which composes with the keyframe-animated `transform` instead of
// fighting it; both stay compositor-only.
const PARALLAX = [
  { amp: 26, wlx: 900, wly: 1300, phase: 0 }, // deep
  { amp: 42, wlx: 700, wly: 1100, phase: 2.1 }, // plum
  { amp: 60, wlx: 600, wly: 950, phase: 4.2 }, // bloom
  { amp: 80, wlx: 520, wly: 820, phase: 1.3 }, // wisp
  { amp: 36, wlx: 780, wly: 1200, phase: 3.4 }, // accent bloom(s)
] as const;
const ACCENT_LAYER = PARALLAX.length - 1;

function parallaxTranslate(y: number, c: (typeof PARALLAX)[number]): string {
  const dx = c.amp * Math.sin(y / c.wlx + c.phase);
  const dy = -c.amp * Math.cos(y / c.wly + c.phase);
  return `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
}

export function AubergineBackdrop({ accent }: { accent: string }) {
  // The previously shown accent, kept mounted (fading out) for FADE_MS after a
  // category switch so the mood cross-fades instead of snapping.
  const [prev, setPrev] = useState(accent);
  useEffect(() => {
    if (prev === accent) return;
    const id = window.setTimeout(() => setPrev(accent), FADE_MS + 50);
    return () => window.clearTimeout(id);
  }, [prev, accent]);

  // Layer elements, indexed to PARALLAX rows; both accent layers (during a
  // cross-fade) share the last row. Scroll writes go straight to the DOM,
  // coalesced to one write per frame — never through React state.
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const layerRef = (i: number) => (el: HTMLDivElement | null) => {
    layers.current[i] = el;
  };
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let y = 0;
    const apply = () => {
      raf = 0;
      layers.current.forEach((el, i) => {
        if (!el) return;
        el.style.translate = parallaxTranslate(y, PARALLAX[Math.min(i, ACCENT_LAYER)]);
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    refresh.current = schedule;
    const off = onGalleryScroll((next) => {
      y = next;
      schedule();
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, []);
  // Freshly (re)mounted accent layers carry no translate yet — reapply after
  // every accent change so they don't snap in at zero offset mid-scroll.
  useEffect(() => refresh.current(), [accent, prev]);

  return (
    <Viewport aria-hidden>
      <Ground />
      <DeepBlob ref={layerRef(0)} />
      <PlumBlob ref={layerRef(1)} />
      <BloomBlob ref={layerRef(2)} />
      <BrightWisp ref={layerRef(3)} />
      {prev !== accent && (
        <AccentBloom key={prev} ref={layerRef(ACCENT_LAYER + 1)} $accent={prev} $out />
      )}
      <AccentBloom key={accent} ref={layerRef(ACCENT_LAYER)} $accent={accent} $out={false} />
    </Viewport>
  );
}
