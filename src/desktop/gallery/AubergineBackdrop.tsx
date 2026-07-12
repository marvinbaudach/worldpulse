// The desktop gallery's backdrop: an Ubuntu-aubergine gradient mesh that
// drifts slowly, with a per-category accent bloom in the top-right. Pure CSS —
// no WebGL ships to the desktop chunk.
//
// Compositor discipline: the gradients are painted ONCE onto an oversized
// fixed layer and the drift animates `transform` (translate3d), never
// `background-position` — a background-position animation would re-rasterize
// the full-viewport multi-layer gradient every frame. The accent mood change
// is a real cross-fade via mount-time `opacity` keyframes (a transition on a
// custom property inside a gradient would snap — not animatable without
// @property): the incoming bloom fades in while the outgoing layer, kept
// mounted for the fade's duration, fades out.

import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { AUBERGINE } from './galleryChrome';

// Oversize the drifting layers past every viewport edge so the translate
// drift never exposes a blank border.
const BLEED = '-20%';
const FADE_MS = 600;

const Viewport = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: ${AUBERGINE.ground2}; /* paints the frame before the layers mount */
`;

const Drift = styled.div`
  position: absolute;
  inset: ${BLEED};
  background:
    radial-gradient(60% 80% at 18% 12%, ${AUBERGINE.bloom}, transparent 55%),
    radial-gradient(55% 70% at 88% 22%, ${AUBERGINE.plum}, transparent 60%),
    radial-gradient(70% 90% at 72% 100%, ${AUBERGINE.deep}, transparent 60%),
    linear-gradient(150deg, ${AUBERGINE.ground0}, ${AUBERGINE.ground1} 55%, ${AUBERGINE.ground2});
  animation: aubergine-drift 28s ease-in-out infinite alternate;
  will-change: transform;
  @keyframes aubergine-drift {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(6%, 3%, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// One accent bloom per accent value, riding the same drift so the mood tint
// moves with the aubergine base. Fades run as mount-time keyframes (`forwards`
// pins the end state), so they replay reliably when a layer (re)mounts.
const AccentBloom = styled.div<{ $accent: string; $out: boolean }>`
  position: absolute;
  inset: ${BLEED};
  background: radial-gradient(
    50% 65% at 84% 16%,
    color-mix(in oklab, ${(p) => p.$accent} 40%, transparent),
    transparent 60%
  );
  animation:
    ${(p) => (p.$out ? 'bloom-out' : 'bloom-in')} ${FADE_MS}ms ease forwards,
    aubergine-drift 28s ease-in-out infinite alternate;
  will-change: transform, opacity;
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
`;

export function AubergineBackdrop({ accent }: { accent: string }) {
  // The previously shown accent, kept mounted (fading out) for FADE_MS after a
  // category switch so the mood cross-fades instead of snapping.
  const [prev, setPrev] = useState(accent);
  useEffect(() => {
    if (prev === accent) return;
    const id = window.setTimeout(() => setPrev(accent), FADE_MS + 50);
    return () => window.clearTimeout(id);
  }, [prev, accent]);

  return (
    <Viewport aria-hidden>
      <Drift />
      {prev !== accent && <AccentBloom key={prev} $accent={prev} $out />}
      <AccentBloom key={accent} $accent={accent} $out={false} />
    </Viewport>
  );
}
