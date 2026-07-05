import { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { LIVE_FEEDS } from '../data/sources';

interface LoadingScreenProps {
  done: boolean;
  onExited: () => void;
}

// The boot sequence "connects to" exactly the feeds the panels really load —
// the list lives next to the fetchers (data/sources.ts), so it can't drift.
// Feeds from the same provider are collapsed into one row ("3 datasets"),
// so no source ever appears to be listed twice.
interface FeedGroup {
  code: string;
  source: string;
  city: string;
  label: string;
  /** How many of the real feeds this row stands for. */
  count: number;
}

const GROUPS: FeedGroup[] = (() => {
  const byProvider = new Map<string, { feed: (typeof LIVE_FEEDS)[number]; items: string[] }>();
  for (const feed of LIVE_FEEDS) {
    const key = `${feed.source}|${feed.city}`;
    const entry = byProvider.get(key);
    if (entry) entry.items.push(feed.item);
    else byProvider.set(key, { feed, items: [feed.item] });
  }
  return [...byProvider.values()].map(({ feed, items }) => ({
    code: feed.code,
    source: feed.source,
    city: feed.city,
    label: items.length > 1 ? `${items.length} datasets` : items[0],
    count: items.length,
  }));
})();

// Feeds covered once the first n groups are connected (for the "x/y FEEDS"
// status line, which keeps counting the real feeds).
const CUMULATIVE = GROUPS.map((_, i) =>
  GROUPS.slice(0, i + 1).reduce((sum, g) => sum + g.count, 0),
);
const TOTAL_FEEDS = LIVE_FEEDS.length;

// Distinct uplink stations on the route strip (one dot per station code),
// in first-appearance order.
const STATIONS = [...new Set(GROUPS.map((g) => g.code))];

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace";

// The background lights breathe slowly, so the illumination drifts.
const breathe = keyframes`
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.12); }
`;
// Quick "locked in" pulse once the boot completes.
const completePulse = keyframes`
  0% { transform: scale(1); }
  45% { transform: scale(1.07); }
  100% { transform: scale(1); }
`;
// Progress fill sweeping in during boot.
const grow = keyframes`
  from { width: 4%; }
  to { width: 88%; }
`;
// Expanding ping ring around a station dot when its feed connects.
const ping = keyframes`
  from { transform: scale(0.4); opacity: 0.9; }
  to { transform: scale(2.6); opacity: 0; }
`;

// Exit: an iris that collapses into the exact point the carousel panels
// bloom out of — the loader hands the center of the screen to the scene.
const Screen = styled.div<{ $leaving: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #05070c;
  clip-path: ${(p) => (p.$leaving ? 'circle(0% at 50% 50%)' : 'circle(141% at 50% 50%)')};
  pointer-events: ${(p) => (p.$leaving ? 'none' : 'auto')};
  transition: clip-path 0.9s cubic-bezier(0.7, 0, 0.84, 0);
  overflow: hidden;
`;

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

const Column = styled.div<{ $leaving: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  transform: ${(p) => (p.$leaving ? 'scale(0.82)' : 'scale(1)')};
  transition: transform 0.9s cubic-bezier(0.7, 0, 0.84, 0);
`;

const Wordmark = styled.div<{ $done: boolean }>`
  color: #f4f7fb;
  font-size: 2.1rem;
  font-weight: 700;
  letter-spacing: 0.5em;
  margin-left: 0.5em; /* optically recenter the tracked-out text */
  ${(p) =>
    p.$done &&
    css`
      animation: ${completePulse} 0.55s ease;
    `}
`;

const Sub = styled.div`
  color: #898781;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.4em;
  margin-left: 0.4em;
`;

// --- Uplink route strip: one dot per station, lighting up as feeds land. ---

const Route = styled.div`
  position: relative;
  display: flex;
  justify-content: space-between;
  width: 300px;
  margin-top: 6px;
`;

const RouteLine = styled.div`
  position: absolute;
  left: 10px;
  right: 10px;
  top: 4px;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
`;

const Station = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  width: 20px;
`;

const Dot = styled.div<{ $on: boolean }>`
  position: relative;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? '#3987e5' : 'rgba(255,255,255,0.18)')};
  box-shadow: ${(p) => (p.$on ? '0 0 10px rgba(57,135,229,0.9)' : 'none')};
  transition: background 0.2s ease, box-shadow 0.2s ease;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1px solid rgba(57, 135, 229, 0.8);
    ${(p) =>
      p.$on &&
      css`
        animation: ${ping} 0.9s ease-out;
      `}
    opacity: 0;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
`;

const StationCode = styled.div<{ $on: boolean }>`
  font-family: ${MONO};
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  color: ${(p) => (p.$on ? '#8fb8ec' : '#3a4552')};
  transition: color 0.2s ease;
`;

// --- Feed table: every source flips from pending to connected. -------------

const Feed = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: min(400px, 92vw);
  font-family: ${MONO};
  font-size: 0.66rem;
  letter-spacing: 0.06em;
`;

const Row = styled.div<{ $on: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: ${(p) => (p.$on ? '#aab8c5' : '#3a4552')};
  transition: color 0.45s ease;
`;

const Source = styled.span`
  flex: 0 0 92px;
  color: inherit;
`;

const City = styled.span`
  flex: 0 0 100px;
  color: inherit;
  opacity: 0.75;
`;

const Item = styled.span`
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0.6;
`;

const Stat = styled.span<{ $on: boolean }>`
  flex: 0 0 auto;
  color: ${(p) => (p.$on ? '#4da06f' : '#2c3542')};
  transition: color 0.45s ease;
`;

const BarTrack = styled.div`
  width: min(400px, 92vw);
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
`;

const BarFill = styled.div<{ $done: boolean }>`
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #3987e5, #9085e9);
  animation: ${grow} 1.5s cubic-bezier(0.2, 0.6, 0.3, 1) forwards;
  ${(p) =>
    p.$done &&
    css`
      animation: none;
      width: 100%;
      transition: width 0.35s ease;
    `}
`;

const Status = styled.div`
  display: flex;
  justify-content: space-between;
  width: min(400px, 92vw);
  color: #52616e;
  font-family: ${MONO};
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.18em;
`;

export function LoadingScreen({ done, onExited }: LoadingScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const [pct, setPct] = useState(0);
  const pctRef = useRef(0);
  // How many provider groups have "connected" so far; done snaps them all on.
  const [connectedCount, setConnectedCount] = useState(0);

  // Stagger the group connections across the boot beat — spread over a fixed
  // window (with a little jitter so it reads as real handshakes, not a
  // metronome), so the choreography still fits if feeds are added or removed.
  useEffect(() => {
    const step = 1250 / GROUPS.length;
    const timers = GROUPS.map((_, i) =>
      window.setTimeout(
        () => setConnectedCount((c) => Math.max(c, i + 1)),
        120 + i * step + Math.random() * Math.min(90, step * 0.5),
      ),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const connected = done ? GROUPS.length : connectedCount;
  // The status line keeps counting the real feeds behind the grouped rows.
  const connectedFeeds = connected > 0 ? CUMULATIVE[connected - 1] : 0;

  // Eased percentage: climbs toward 92 while booting, snaps to 100 on done.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const target = done ? 100 : 92;
      pctRef.current += (target - pctRef.current) * (done ? 0.2 : 0.045);
      const next = Math.round(pctRef.current);
      setPct((prev) => (prev === next ? prev : next));
      if (pctRef.current < 99.6) raf = requestAnimationFrame(tick);
      else setPct(100);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done]);

  // Brief hold at 100% (lets the completion pulse read), then iris out.
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setLeaving(true), 420);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <Screen
      $leaving={leaving}
      onTransitionEnd={(e) => {
        if (leaving && e.target === e.currentTarget) onExited();
      }}
      aria-hidden={leaving}
    >
      <Glow $x="30%" $y="32%" $color="rgba(57, 135, 229, 0.28)" $delay="0s" />
      <Glow $x="72%" $y="64%" $color="rgba(144, 133, 233, 0.22)" $delay="-3s" />
      <Glow $x="55%" $y="45%" $color="rgba(25, 158, 112, 0.14)" $delay="-6s" />

      <Column $leaving={leaving}>
        <Wordmark $done={done}>PULSE</Wordmark>
        <Sub>GLOBALE DATENQUELLEN WERDEN GELADEN</Sub>

        <Route aria-hidden>
          <RouteLine />
          {STATIONS.map((code) => {
            const on = GROUPS.some((g, i) => g.code === code && i < connected);
            return (
              <Station key={code}>
                <Dot $on={on} />
                <StationCode $on={on}>{code}</StationCode>
              </Station>
            );
          })}
        </Route>

        <Feed aria-hidden>
          {GROUPS.map((group, i) => {
            const on = i < connected;
            return (
              <Row key={`${group.source}-${group.city}`} $on={on}>
                <Source>{group.source}</Source>
                <City>{group.city}</City>
                <Item>{group.label}</Item>
                <Stat $on={on}>{on ? '✓' : '·'}</Stat>
              </Row>
            );
          })}
        </Feed>

        <BarTrack>
          <BarFill $done={done} />
        </BarTrack>
        <Status>
          <span>
            {done ? TOTAL_FEEDS : connectedFeeds}/{TOTAL_FEEDS} QUELLEN
          </span>
          <span>{pct}%</span>
        </Status>
      </Column>
    </Screen>
  );
}
