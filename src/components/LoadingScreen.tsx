import { useEffect, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';

interface LoadingScreenProps {
  progress: number; // 0..1
  done: boolean;
  onExited: () => void;
}

// Continuous, GPU-friendly spins. Decoupled from load progress so the motion
// stays perfectly smooth no matter how the percentage jumps.
const spin = keyframes`
  to { transform: rotate(360deg); }
`;
const spinReverse = keyframes`
  to { transform: rotate(-360deg); }
`;
// The background lights breathe slowly, so the illumination drifts in brightness.
const breathe = keyframes`
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.12); }
`;
// Quick "locked in" pulse once loading completes.
const completePulse = keyframes`
  0% { transform: scale(1); }
  45% { transform: scale(1.08); }
  100% { transform: scale(1); }
`;

const Screen = styled.div<{ $leaving: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #05070c;
  opacity: ${(p) => (p.$leaving ? 0 : 1)};
  /* Implode toward the center where the carousel blooms out. */
  transform: ${(p) => (p.$leaving ? 'scale(0.2)' : 'scale(1)')};
  pointer-events: ${(p) => (p.$leaving ? 'none' : 'auto')};
  transition:
    opacity 0.85s cubic-bezier(0.7, 0, 0.84, 0),
    transform 0.85s cubic-bezier(0.7, 0, 0.84, 0);
  overflow: hidden;
`;

// Soft, unevenly placed glows that gently breathe -> a background that is lit
// slightly differently across the screen instead of a flat colour.
const Glow = styled.div<{ $x: string; $y: string; $color: string; $delay: string }>`
  position: absolute;
  width: 80vmax;
  height: 80vmax;
  left: ${(p) => p.$x};
  top: ${(p) => p.$y};
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, ${(p) => p.$color} 0%, transparent 60%);
  filter: blur(40px);
  animation: ${breathe} 9s ease-in-out infinite;
  animation-delay: ${(p) => p.$delay};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Loader = styled.div`
  position: relative;
  width: 170px;
  height: 170px;
  display: grid;
  place-items: center;
`;

// A comet-tail gradient ring: a conic gradient masked into a thin ring, so the
// colour fades from transparent to a bright head. Spinning it reads as a clean,
// elegant rotating circle.
const CometRing = styled.div<{
  $size: number;
  $thickness: number;
  $duration: string;
  $gradient: string;
  $reverse?: boolean;
}>`
  position: absolute;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, ${(p) => p.$gradient});
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - ${(p) => p.$thickness}px),
    #000 calc(100% - ${(p) => p.$thickness}px)
  );
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - ${(p) => p.$thickness}px),
    #000 calc(100% - ${(p) => p.$thickness}px)
  );
  animation: ${(p) => (p.$reverse ? spinReverse : spin)} ${(p) => p.$duration}
    linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// Center: percentage, with a soft completion pulse.
const Core = styled.div<{ $done: boolean }>`
  position: relative;
  display: flex;
  align-items: baseline;
  color: #f4f7fb;
  font-variant-numeric: tabular-nums;
  ${(p) =>
    p.$done &&
    css`
      animation: ${completePulse} 0.6s ease;
    `}
`;

const PercentNum = styled.span`
  font-size: 2.3rem;
  font-weight: 600;
  letter-spacing: -0.02em;
`;

const PercentSign = styled.span`
  font-size: 0.95rem;
  opacity: 0.55;
  margin-left: 2px;
`;

export function LoadingScreen({ progress, done, onExited }: LoadingScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const pct = Math.round(progress * 100);

  // Brief hold at 100% (lets the completion pulse read), then implode.
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setLeaving(true), 320);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <Screen
      $leaving={leaving}
      onTransitionEnd={() => leaving && onExited()}
      aria-hidden={leaving}
    >
      <Glow $x="32%" $y="30%" $color="rgba(70, 150, 130, 0.35)" $delay="0s" />
      <Glow $x="72%" $y="66%" $color="rgba(80, 110, 200, 0.3)" $delay="-3s" />
      <Glow $x="55%" $y="45%" $color="rgba(150, 100, 210, 0.22)" $delay="-6s" />

      <Loader>
        <CometRing
          $size={168}
          $thickness={4}
          $duration="2.4s"
          $gradient="rgba(111, 227, 196, 0) 0deg, rgba(111, 227, 196, 0.1) 140deg, #6aa6ff 320deg, #eaf6f1 360deg"
        />
        <CometRing
          $size={120}
          $thickness={3}
          $duration="3.2s"
          $reverse
          $gradient="rgba(185, 140, 255, 0) 0deg, rgba(185, 140, 255, 0.12) 150deg, #b98cff 330deg, #eaf6f1 360deg"
        />
        <Core $done={done}>
          <PercentNum>{pct}</PercentNum>
          <PercentSign>%</PercentSign>
        </Core>
      </Loader>
    </Screen>
  );
}
