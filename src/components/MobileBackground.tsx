import type { Ref } from 'react';
import styled, { createGlobalStyle, keyframes } from 'styled-components';

// CSS counterpart of the desktop aurora: the mobile path has no WebGL, so the
// "room changes mood" read comes from two big radial-gradient blobs drifting
// via transform (compositor-only, no per-frame JS). The tint is a registered
// CSS custom property (@property with a <color> syntax), so the browser can
// interpolate the color itself and the gradient crossfades on theme switch;
// engines without @property fall back to an instant snap, which is fine.
const AccentProperty = createGlobalStyle`
  @property --wp-accent {
    syntax: '<color>';
    inherits: true;
    initial-value: #3987e5;
  }
`;

// Four-waypoint orbits (not A→B→A pendulums) so the glow visibly wanders
// instead of just breathing; travel spans roughly a viewport half.
const driftA = keyframes`
  0% { transform: translate(-20%, -14%) scale(2); }
  33% { transform: translate(26%, 10%) scale(2.4); }
  66% { transform: translate(4%, 34%) scale(2.15); }
  100% { transform: translate(-20%, -14%) scale(2); }
`;

const driftB = keyframes`
  0% { transform: translate(18%, 20%) scale(2.2); }
  33% { transform: translate(-24%, 2%) scale(1.85); }
  66% { transform: translate(-4%, -26%) scale(2.3); }
  100% { transform: translate(18%, 20%) scale(2.2); }
`;

const driftC = keyframes`
  0% { transform: translate(-30%, 24%) scale(1.9); }
  50% { transform: translate(30%, -20%) scale(2.35); }
  100% { transform: translate(-30%, 24%) scale(1.9); }
`;

const Layer = styled.div<{ $accent: string }>`
  position: fixed;
  inset: 0;
  z-index: -1; /* under the deck's static children, above the stage bg */
  overflow: hidden;
  pointer-events: none;
  /* The accent value lives here so both blobs inherit it. */
  --wp-accent: ${(p) => p.$accent};
`;

const Blob = styled.div`
  position: absolute;
  width: 45vmax;
  height: 45vmax;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, var(--wp-accent), transparent 62%);
  opacity: 0.14;
  will-change: transform;
  /* Base scale matches the keyframes' range, so the reduced-motion resting
     pose (animation off, base transform applies) keeps the full-size glow. */
  transform: scale(2);
  transition: --wp-accent 1.2s ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`;

// Negative delays start each blob mid-orbit so the trio never moves in sync.
const BlobA = styled(Blob)`
  top: -15vmax;
  left: -12vmax;
  opacity: 0.17;
  animation: ${driftA} 16s ease-in-out -4s infinite;
`;

const BlobB = styled(Blob)`
  right: -15vmax;
  bottom: -18vmax;
  opacity: 0.12;
  animation: ${driftB} 22s ease-in-out -9s infinite;
`;

// A third, dimmer blob crossing the middle: the two corner glows alone read
// as static ambience — the traveler is what makes the room feel alive.
const BlobC = styled(Blob)`
  top: 30%;
  left: 28%;
  width: 34vmax;
  height: 34vmax;
  opacity: 0.09;
  animation: ${driftC} 19s ease-in-out -13s infinite;
`;

interface MobileBackgroundProps {
  /** Active theme accent (TAGS[].accent). */
  accent: string;
  ref?: Ref<HTMLDivElement>;
}

/** Slow, theme-tinted glow behind the mobile deck. The ref wraps the whole
    layer so the gyro parallax (Task 7) can shift it against the cards. */
export function MobileBackground({ accent, ref }: MobileBackgroundProps) {
  return (
    <Layer ref={ref} $accent={accent}>
      <AccentProperty />
      <BlobA />
      <BlobB />
      <BlobC />
    </Layer>
  );
}
