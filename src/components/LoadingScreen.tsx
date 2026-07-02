import { useEffect, useState } from 'react';
import './LoadingScreen.css';

interface LoadingScreenProps {
  progress: number; // 0..1
  done: boolean;
  onExited: () => void;
}

const CIRCUMFERENCE = 2 * Math.PI * 46; // r = 46 (progress ring)

// Three tilted orbit rings, each with a single orbiting glow node.
const ORBITS = [
  { className: 'orbit--a', color: '#6fe3c4', duration: '2.6s' },
  { className: 'orbit--b', color: '#6aa6ff', duration: '3.4s' },
  { className: 'orbit--c', color: '#b98cff', duration: '4.2s' },
];

export function LoadingScreen({ progress, done, onExited }: LoadingScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const pct = Math.round(progress * 100);

  // Gentle fade-out once all images have loaded.
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setLeaving(true), 500);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <div
      className={`loading-screen${leaving ? ' loading-screen--leaving' : ''}`}
      onTransitionEnd={() => leaving && onExited()}
      aria-hidden={leaving}
    >
      <div className="loading-aurora" />

      <div className="loader3d">
        {/* 3D gyroscope: tumbling group of tilted orbits */}
        <div className="gyro">
          {ORBITS.map((o) => (
            <div
              key={o.className}
              className={`orbit ${o.className}`}
              style={{ ['--dur' as string]: o.duration }}
            >
              <svg className="orbit__ring" viewBox="0 0 120 120">
                <circle
                  className="orbit__path"
                  cx="60"
                  cy="60"
                  r="54"
                  style={{ stroke: o.color }}
                />
                <circle
                  className="orbit__node"
                  cx="60"
                  cy="6"
                  r="4.5"
                  style={{ fill: o.color }}
                />
              </svg>
            </div>
          ))}
        </div>

        {/* Progress ring + percentage in the center */}
        <div className="loader3d__core">
          <svg className="loader3d__progress" viewBox="0 0 120 120">
            <circle className="loader3d__track" cx="60" cy="60" r="46" />
            <circle
              className="loader3d__fill"
              cx="60"
              cy="60"
              r="46"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          </svg>
          <div className="loader3d__pct">
            <span className="loader3d__num">{pct}</span>
            <span className="loader3d__sign">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
