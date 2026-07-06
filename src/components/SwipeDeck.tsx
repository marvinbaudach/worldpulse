import { useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { CardCanvas } from './CardCanvas';
import type { Dashboard } from '../dashboards';

// Tinder-style throw: the top card follows the finger with a little rotation,
// and past a threshold it flies off while the neighbour underneath takes its
// place. Only a 3-card window mounts (prev / current / next), so the deck is
// far lighter than rendering every card at once.
const Stack = styled.div`
  position: relative;
  flex: 1;
  overflow: hidden;
  perspective: 1400px; /* gives the throw a real sense of depth */
`;

// Fill the available area rather than locking the panel's 4:5 shape: on a tall
// phone that left big empty bands top and bottom. The chart renderers adapt to
// whatever aspect the card takes; width is capped so it stays sane on tablets.
const Card = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(94vw, 560px, 72vh);
  /* Cap by the actual stack area (not just the viewport) so the card never
     overruns the header and gets clipped; the subtracted margin is the gap. */
  height: min(85vh, calc(100% - 32px));
  border-radius: 18px;
  overflow: hidden;
  touch-action: none;
  will-change: transform, opacity;
  transform: translate(-50%, -50%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
`;

const CENTER = 'translate(-50%, -50%)';
// Underneath cards sit slightly shrunk so the deck reads as a stack; the one
// the swipe heads toward scales up to full as the top card flies off.
const REST_SCALE = 0.92;
const BEHIND = `translate(-50%, -50%) scale(${REST_SCALE})`;
const THROW_MS = 360;
const SPRING = 'transform 240ms ease, opacity 240ms ease';
// The incoming card rises with a soft overshoot for the extra bit of life.
const RISE = 'transform 360ms cubic-bezier(0.22, 1.2, 0.36, 1), opacity 240ms ease';

interface SwipeDeckProps {
  dashboards: Dashboard[];
  onIndex: (i: number) => void;
}

export function SwipeDeck({ dashboards, onIndex }: SwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const curRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, dx: 0, w: 1, t0: 0 });
  const animating = useRef(false);
  // Only the first card plays the chart fly-in; once you swipe, the cards you
  // land on are already settled (they were drawn behind), so a replay would
  // just flash the finished chart and then restart it.
  const intro = useRef(true);

  // After every index change, snap the three roles back to their resting look
  // (imperative styles from the drag/throw would otherwise stick).
  useLayoutEffect(() => {
    // Snap every role to its resting look with no transition — otherwise the
    // just-thrown card (now the neighbour) would visibly glide back in.
    for (const [ref, opacity] of [
      [curRef, '1'],
      [nextRef, '1'],
      [prevRef, '0'],
    ] as const) {
      if (ref.current) {
        ref.current.style.transition = 'none';
        ref.current.style.transform = ref === curRef ? CENTER : BEHIND;
        ref.current.style.opacity = opacity;
      }
    }
    onIndex(index);
  }, [index, onIndex]);

  const setCur = (transform: string, transition: string, opacity = '1') => {
    const el = curRef.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform = transform;
    el.style.opacity = opacity;
  };

  const onDown = (e: React.PointerEvent) => {
    if (animating.current) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      dx: 0,
      w: e.currentTarget.clientWidth || 1,
      t0: performance.now(),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setCur(CENTER, 'none');
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    d.dx = e.clientX - d.startX;
    // The neighbour the swipe heads toward rises (scales up) as you drag, so it
    // is already at full size the moment the top card clears it.
    const prog = Math.min(1, Math.abs(d.dx) / (d.w * 0.5));
    const rising = `translate(-50%, -50%) scale(${REST_SCALE + (1 - REST_SCALE) * prog})`;
    const toward = d.dx < 0 ? nextRef.current : d.dx > 0 ? prevRef.current : null;
    for (const r of [nextRef.current, prevRef.current]) {
      if (!r) continue;
      r.style.transition = 'none';
      r.style.opacity = r === toward ? '1' : '0';
      r.style.transform = r === toward ? rising : BEHIND;
    }
    // Follow the finger, tilt in Z and lean away in 3D for depth.
    setCur(`${CENTER} translateX(${d.dx}px) rotate(${d.dx * 0.05}deg) rotateY(${d.dx * 0.05}deg)`, 'none');
  };

  const onUp = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    // A small nudge is enough — either a short distance OR a quick flick.
    const dist = Math.min(60, d.w * 0.16);
    const speed = Math.abs(d.dx) / Math.max(performance.now() - d.t0, 1); // px/ms
    const flick = speed > 0.4 && Math.abs(d.dx) > 12;
    const left = d.dx < 0 && (-d.dx > dist || flick);
    const right = d.dx > 0 && (d.dx > dist || flick);
    const n = dashboards.length;
    const wrap = n >= 3;
    const goNext = left && (wrap || index < n - 1);
    const goPrev = right && (wrap || index > 0);
    if (goNext || goPrev) {
      animating.current = true;
      intro.current = false; // no chart replay on the card we land on
      navigator.vibrate?.(12); // short haptic tick (Android; iOS has no API)
      const off = goNext ? -1 : 1;
      const el = curRef.current;
      const rise = goNext ? nextRef.current : prevRef.current;
      // Pin the current (drag) state with no transition first — on a fast flick
      // move/up can land in one frame with nothing painted between, and the
      // browser then jumps straight to the end (the effect looks skipped).
      if (el) {
        el.style.transition = 'none';
        el.style.transform = `${CENTER} translateX(${d.dx}px) rotate(${d.dx * 0.05}deg) rotateY(${d.dx * 0.05}deg)`;
        void el.offsetWidth; // force a reflow so the throw actually animates
        // Hurl it off: slides out, arcs up, spins in Z and Y and shrinks as it
        // fades — an accelerating ease-in so it really flies.
        el.style.transition = `transform ${THROW_MS}ms cubic-bezier(0.5, 0, 0.9, 0.4), opacity ${THROW_MS}ms ease-in`;
        el.style.transform = `${CENTER} translateX(${off * 165}%) translateY(-9%) rotate(${off * 20}deg) rotateY(${off * 38}deg) scale(0.85)`;
        el.style.opacity = '0';
      }
      // The revealed neighbour rises to the front with a soft overshoot.
      if (rise) {
        rise.style.transition = RISE;
        rise.style.transform = CENTER;
        rise.style.opacity = '1';
      }
      window.setTimeout(() => {
        animating.current = false;
        setIndex((i) => (i + (goNext ? 1 : -1) + n) % n);
      }, THROW_MS);
    } else {
      // Not far enough: everything springs back to rest.
      setCur(CENTER, SPRING);
      for (const r of [nextRef.current, prevRef.current]) {
        if (r) {
          r.style.transition = SPRING;
          r.style.transform = BEHIND;
        }
      }
      if (nextRef.current) nextRef.current.style.opacity = '1';
      if (prevRef.current) prevRef.current.style.opacity = '0';
    }
  };

  // Endless deck: with 3+ cards the neighbours wrap around, so swiping past the
  // last card lands on the first and vice versa. Needs 3+ so prev/cur/next stay
  // three distinct cards (their ids are the React keys that carry the painted
  // canvas across the role handoff); with 2 or fewer it falls back to clamped.
  const n = dashboards.length;
  const wrap = n >= 3;
  const cur = dashboards[index];
  const prev = wrap ? dashboards[(index - 1 + n) % n] : index > 0 ? dashboards[index - 1] : null;
  const next = wrap ? dashboards[(index + 1) % n] : index < n - 1 ? dashboards[index + 1] : null;
  if (!cur) return <Stack />;

  return (
    <Stack>
      {prev && (
        <Card key={prev.id} ref={prevRef} style={{ zIndex: 2, opacity: 0, transform: BEHIND }}>
          <CardCanvas dashboard={prev} animate={false} />
        </Card>
      )}
      {next && (
        <Card key={next.id} ref={nextRef} style={{ zIndex: 1, transform: BEHIND }}>
          <CardCanvas dashboard={next} animate={false} />
        </Card>
      )}
      <Card
        key={cur.id}
        ref={curRef}
        style={{ zIndex: 3 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <CardCanvas dashboard={cur} animate={intro.current} />
      </Card>
    </Stack>
  );
}
