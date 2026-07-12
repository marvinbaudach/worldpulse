// The gallery's determinate load affordance: a hairline progress bar pinned to
// the top edge while the thumbnail grid paints in. Honest signal — the fill
// tracks painted thumbnails over the *current* list (see Gallery) and the bar
// fades out once everything visible-to-be is in.

import styled from 'styled-components';
import { AUBERGINE } from './galleryChrome';

const Track = styled.div<{ $hidden: boolean }>`
  position: fixed;
  inset: 0 0 auto;
  height: 2px;
  z-index: 20;
  opacity: ${(p) => (p.$hidden ? 0 : 1)};
  transition: opacity 400ms ease 200ms;
  pointer-events: none;
`;

// The fill scales, it does not resize: `width` is layout-bound and would
// re-layout on every tick, while scaleX stays on the compositor.
const Fill = styled.div<{ $pct: number }>`
  height: 100%;
  width: 100%;
  transform: scaleX(${(p) => p.$pct / 100});
  transform-origin: left;
  background: linear-gradient(90deg, ${AUBERGINE.bloom}, ${AUBERGINE.ember});
  transition: transform 240ms ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <Track $hidden={pct >= 100} aria-hidden>
      <Fill $pct={pct} />
    </Track>
  );
}
