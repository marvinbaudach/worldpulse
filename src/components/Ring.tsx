import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CarouselItem } from './CarouselItem';
import type { HeroStart } from './HeroCard';
import type { RingMotion } from './cameraMotion';
import { DEFAULT_RADIUS, PANEL_H, PANEL_W, layoutSlots, type LayoutMode } from '../layouts';
import { useCarouselRotation } from '../hooks/useCarouselRotation';
import type { Dashboard } from '../dashboards';

// How many ring panels are admitted per frame while the set mounts in.
const MOUNT_BATCH = 3;

// Resting tilt of the formation (radians). The matching downshift below uses
// sin(INITIAL_TILT) so the tilt-lifted front row lands exactly at y = 0 —
// the camera's height — putting the front panels at eye level for reading.
const INITIAL_TILT = 0.11;

interface RingProps {
  onSelect: (id: string, start: HeroStart) => void;
  selectedId: string | null;
  /** Card currently flying back after an arrow-key switch — its ring panel
      stays hidden until the outgoing hero lands. */
  outgoingId: string | null;
  paused: () => boolean;
  layout: LayoutMode;
  dashboards: Dashboard[];
  /** True while the theme switches away — the set plays its exit moves. */
  exiting: boolean;
  /** Choreography of the current theme switch (see CarouselItem's `move`). */
  move: number;
  radius: number;
  poses: RefObject<Map<string, HeroStart>>;
  /** False while the user paused the auto-spin (Space). */
  spinning: boolean;
  /** Sink the ring publishes its live spin into for the camera guidance. */
  motion: RefObject<RingMotion>;
}

export function Ring({
  onSelect,
  selectedId,
  outgoingId,
  paused,
  layout,
  dashboards,
  exiting,
  move,
  radius,
  poses,
  spinning,
  motion,
}: RingProps) {
  // Collapsing panels must not absorb clicks — the card would unmount from
  // under its own hero mid-flight.
  const interactive = selectedId === null && !exiting;
  // Boot plays the uniform center-out supernova; from the first theme switch
  // on, panels pick individual exit/entrance moves (see CarouselItem).
  const firstSet = useRef(true);
  const [varied, setVaried] = useState(false);
  useEffect(() => {
    if (firstSet.current) {
      firstSet.current = false;
      return;
    }
    setVaried(true);
  }, [dashboards]);
  // Every panel's first mount rasterises a 512px canvas texture; admitting
  // the whole pool in one commit stalls the main thread for hundreds of ms —
  // exactly while the loader's converge/iris animation plays. Admit a few
  // panels per frame instead; the entrance stagger hides the spread.
  const [mountBudget, setMountBudget] = useState(MOUNT_BATCH);
  // A theme switch swaps the whole set at once; re-arm the budget so the new
  // panels' texture rasterisation spreads over frames again, exactly like on
  // boot — otherwise 20 first-mount canvas draws land in a single commit.
  useEffect(() => setMountBudget(MOUNT_BATCH), [dashboards]);
  useEffect(() => {
    if (mountBudget >= dashboards.length) return;
    const since = performance.now();
    const raf = requestAnimationFrame((now) => {
      // Scale the batch with the actual frame time, so a throttled or slow
      // frame rate still fills the ring within a bounded wall-clock time.
      const frames = Math.max(1, Math.min(6, Math.round((now - since) / 16)));
      setMountBudget((b) => b + MOUNT_BATCH * frames);
    });
    return () => cancelAnimationFrame(raf);
  }, [mountBudget, dashboards.length]);
  const { groupRef, tiltRef, wasDrag, spinTo } = useCarouselRotation({
    // Space toggles the idle spin; drag, wheel and inertia stay alive.
    autoSpin: spinning ? -0.03 : 0,
    paused,
    // The visual lift of the front row is sin(tilt) * radius, so the start
    // tilt shrinks on big rings — otherwise a 30-panel ring opens with the
    // front row shoved to the top of the frame.
    initialTilt: -INITIAL_TILT * Math.min(1, DEFAULT_RADIUS / radius),
    motion,
  });
  // Memoized so the slot objects keep their identity across unrelated
  // re-renders — CarouselItem detects a formation switch by slot identity.
  const slots = useMemo(
    () => layoutSlots(layout, dashboards.length, radius, PANEL_H),
    [layout, dashboards.length, radius],
  );

  // Supernova burst: a small random jitter per panel instead of the old
  // orderly per-index spiral — all panels erupt from the center almost at
  // once, like debris, while the ring's assemble swirl adds the vortex.
  const entranceJitter = useMemo(
    () => dashboards.map(() => Math.random() * 0.22),
    [dashboards],
  );

  // While a hero is open, keep the ring centred on it: an arrow-key switch
  // changes selectedId, and the ring eases the incoming panel's slot to the
  // front (visible turning behind the hero, and centred again on close).
  useEffect(() => {
    if (selectedId === null) {
      spinTo(null);
      return;
    }
    const i = dashboards.findIndex((d) => d.id === selectedId);
    if (i < 0) return;
    const s = slots[i];
    spinTo(Math.atan2(s.x, s.z));
  }, [selectedId, dashboards, slots, spinTo]);

  return (
    // Outer group tilts the formation (driven by vertical drag) so the far
    // side and the panels' back sides come into view. Inner group spins on Y.
    // The whole ring is shifted down so the tilt-lifted front row centres in
    // frame — done on the ring, not the camera, so the camera stays head-on
    // (no "from below" pitch) and the separately-mounted hero card stays
    // centred. The tilt rotates about the ring's own origin, then this offset
    // translates the tilted ring as a whole; sin(INITIAL_TILT) cancels the
    // tilt's lift exactly, so the front row sits at camera height.
    <group ref={tiltRef} position={[0, -Math.sin(INITIAL_TILT) * radius, 0]}>
      <group ref={groupRef}>
        {dashboards.slice(0, mountBudget).map((dashboard, i) => (
          <CarouselItem
            key={dashboard.id}
            dashboard={dashboard}
            slot={slots[i]}
            index={i}
            radius={radius}
            width={PANEL_W}
            height={PANEL_H}
            hidden={dashboard.id === selectedId || dashboard.id === outgoingId}
            onSelect={onSelect}
            wasDrag={wasDrag}
            entranceDelay={entranceJitter[i]}
            exiting={exiting}
            varied={varied}
            move={move}
            interactive={interactive}
            poses={poses}
          />
        ))}
      </group>
    </group>
  );
}
