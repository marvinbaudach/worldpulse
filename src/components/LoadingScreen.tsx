import { useEffect, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';

interface LoadingScreenProps {
  progress: number; // 0..1
  done: boolean;
  onExited: () => void;
}

const RING_R = 46; // progress ring radius
const RING_CIRCUM = 2 * Math.PI * RING_R;
const ORBIT_R = 54; // orbit ring radius
const ORBIT_CIRCUM = 2 * Math.PI * ORBIT_R;

// Three tilted orbit rings, each with a single orbiting glow node.
const ORBITS = [
  { key: 'a', color: '#6fe3c4', duration: '2.6s', transform: 'rotateX(72deg) rotateY(0deg)' },
  { key: 'b', color: '#6aa6ff', duration: '3.4s', transform: 'rotateX(-58deg) rotateY(58deg)' },
  { key: 'c', color: '#b98cff', duration: '4.2s', transform: 'rotateX(64deg) rotateY(-62deg)' },
];

const auroraSpin = keyframes`
  to { transform: rotate(360deg); }
`;
const gyroTumble = keyframes`
  0% { transform: rotateX(-18deg) rotateY(0deg); }
  50% { transform: rotateX(20deg) rotateY(180deg); }
  100% { transform: rotateX(-18deg) rotateY(360deg); }
`;
const orbitSpin = keyframes`
  to { transform: rotateZ(360deg); }
`;
// Quick "locked in" pulse once loading completes.
const completePulse = keyframes`
  0% { transform: scale(1); }
  45% { transform: scale(1.09); }
  100% { transform: scale(1); }
`;

const Screen = styled.div<{ $leaving: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 50%, #10151f 0%, #05070c 70%);
  opacity: ${(p) => (p.$leaving ? 0 : 1)};
  /* Implode toward the center where the carousel blooms out. */
  transform: ${(p) => (p.$leaving ? 'scale(0.2)' : 'scale(1)')};
  pointer-events: ${(p) => (p.$leaving ? 'none' : 'auto')};
  transition:
    opacity 0.85s cubic-bezier(0.7, 0, 0.84, 0),
    transform 0.85s cubic-bezier(0.7, 0, 0.84, 0);
  overflow: hidden;
`;

const Aurora = styled.div`
  position: absolute;
  width: 140vmax;
  height: 140vmax;
  background: conic-gradient(
    from 0deg,
    rgba(80, 200, 160, 0.12),
    rgba(90, 140, 255, 0.1),
    rgba(180, 120, 255, 0.12),
    rgba(80, 200, 160, 0.12)
  );
  filter: blur(80px);
  animation: ${auroraSpin} 22s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Loader = styled.div`
  position: relative;
  width: 260px;
  height: 260px;
  display: grid;
  place-items: center;
  perspective: 900px;
`;

// Wraps the orbit rings and builds up with progress: it grows and brightens as
// more images load, reaching full size and glow exactly at 100%.
const Build = styled.div<{ $p: number }>`
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transform: scale(${(p) => 0.5 + p.$p * 0.5});
  opacity: ${(p) => 0.3 + p.$p * 0.7};
  transition:
    transform 0.5s ease,
    opacity 0.5s ease;
`;

// Group of all orbits, slowly tumbling for a real 3D impression.
const Gyro = styled.div`
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  animation: ${gyroTumble} 14s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// Each orbit gets a fixed 3D orientation ...
const Orbit = styled.div<{ $transform: string }>`
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transform: ${(p) => p.$transform};
`;

// ... and rotates in its own plane (node travels around).
const OrbitRing = styled.svg<{ $duration: string }>`
  width: 100%;
  height: 100%;
  transform-origin: center;
  animation: ${orbitSpin} ${(p) => p.$duration} linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// The ring path draws itself in proportion to loading progress.
const OrbitPath = styled.circle`
  fill: none;
  stroke-width: 1.6;
  opacity: 0.4;
  transition: stroke-dashoffset 0.45s ease;
`;

const OrbitNode = styled.circle`
  filter: drop-shadow(0 0 6px currentColor);
  transition: opacity 0.45s ease;
`;

// Center: progress ring + percentage, stays flat toward the camera.
const Core = styled.div<{ $done: boolean }>`
  position: relative;
  width: 132px;
  height: 132px;
  display: grid;
  place-items: center;
  ${(p) =>
    p.$done &&
    css`
      animation: ${completePulse} 0.6s ease;
    `}
`;

const ProgressRing = styled.svg`
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
`;

const Track = styled.circle`
  fill: none;
  stroke: rgba(255, 255, 255, 0.06);
  stroke-width: 3;
`;

const Fill = styled.circle`
  fill: none;
  stroke: #eaf6f1;
  stroke-width: 3;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px rgba(111, 227, 196, 0.8));
  transition: stroke-dashoffset 0.35s ease;
`;

const Percent = styled.div`
  position: absolute;
  display: flex;
  align-items: baseline;
  color: #f4f7fb;
  font-variant-numeric: tabular-nums;
`;

const PercentNum = styled.span`
  font-size: 2.4rem;
  font-weight: 600;
  letter-spacing: -0.02em;
`;

const PercentSign = styled.span`
  font-size: 1rem;
  opacity: 0.6;
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
      <Aurora />

      <Loader>
        {/* 3D gyroscope: orbit rings that build up with progress */}
        <Build $p={progress}>
          <Gyro>
            {ORBITS.map((o) => (
              <Orbit key={o.key} $transform={o.transform}>
                <OrbitRing $duration={o.duration} viewBox="0 0 120 120">
                  <OrbitPath
                    cx="60"
                    cy="60"
                    r={ORBIT_R}
                    style={{
                      stroke: o.color,
                      strokeDasharray: ORBIT_CIRCUM,
                      strokeDashoffset: ORBIT_CIRCUM * (1 - progress),
                    }}
                  />
                  <OrbitNode
                    cx="60"
                    cy={60 - ORBIT_R}
                    r="4.5"
                    style={{ fill: o.color, opacity: progress }}
                  />
                </OrbitRing>
              </Orbit>
            ))}
          </Gyro>
        </Build>

        {/* Progress ring + percentage in the center */}
        <Core $done={done}>
          <ProgressRing viewBox="0 0 120 120">
            <Track cx="60" cy="60" r={RING_R} />
            <Fill
              cx="60"
              cy="60"
              r={RING_R}
              strokeDasharray={RING_CIRCUM}
              strokeDashoffset={RING_CIRCUM * (1 - progress)}
            />
          </ProgressRing>
          <Percent>
            <PercentNum>{pct}</PercentNum>
            <PercentSign>%</PercentSign>
          </Percent>
        </Core>
      </Loader>
    </Screen>
  );
}
