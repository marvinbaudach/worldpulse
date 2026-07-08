import { forwardRef } from 'react';
import styled, { keyframes } from 'styled-components';

// CSS counterpart of the desktop aurora: the mobile path has no WebGL, so the
// "room changes mood" read comes from two big radial-gradient blobs drifting
// via transform (compositor-only, no per-frame JS). The tint follows the
// active theme's accent; the color crossfade rides the gradient transition.
const driftA = keyframes`
  0% { transform: translate(-14%, -10%) scale(1); }
  50% { transform: translate(8%, 4%) scale(1.18); }
  100% { transform: translate(-14%, -10%) scale(1); }
`;

const driftB = keyframes`
  0% { transform: translate(10%, 12%) scale(1.1); }
  50% { transform: translate(-6%, -4%) scale(0.95); }
  100% { transform: translate(10%, 12%) scale(1.1); }
`;

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: -1; /* under the deck's static children, above the stage bg */
  overflow: hidden;
  pointer-events: none;
`;

const Blob = styled.div<{ $c: string }>`
  position: absolute;
  width: 90vmax;
  height: 90vmax;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, ${(p) => p.$c}, transparent 62%);
  opacity: 0.14;
  will-change: transform;
  transition: background 1.2s ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`;

const BlobA = styled(Blob)`
  top: -30vmax;
  left: -25vmax;
  animation: ${driftA} 28s ease-in-out infinite;
`;

const BlobB = styled(Blob)`
  right: -30vmax;
  bottom: -35vmax;
  opacity: 0.1;
  animation: ${driftB} 36s ease-in-out infinite;
`;

interface MobileBackgroundProps {
  /** Active theme accent (TAGS[].accent). */
  accent: string;
}

/** Slow, theme-tinted glow behind the mobile deck. The ref wraps the whole
    layer so the gyro parallax (Task 7) can shift it against the cards. */
export const MobileBackground = forwardRef<HTMLDivElement, MobileBackgroundProps>(
  function MobileBackground({ accent }, ref) {
    return (
      <Layer ref={ref}>
        <BlobA $c={accent} />
        <BlobB $c={accent} />
      </Layer>
    );
  },
);
