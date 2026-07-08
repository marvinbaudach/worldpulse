import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { CardCanvas } from './CardCanvas';
import { useReducedMotion } from '../hooks/useReducedMotion';
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
  /* Bright rim + wide soft glow: the canvas surface is nearly as dark as the
     page background, so the edge needs to carry the separation. */
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    0 0 40px rgba(120, 160, 255, 0.08),
    0 24px 60px rgba(0, 0, 0, 0.55);
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
  /** Fired when the user pulls the deck down far enough (pull-to-refresh). */
  onRefresh?: () => void;
}

export function SwipeDeck({ dashboards, onIndex, onRefresh }: SwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const curRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, dx: 0, startY: 0, dy: 0, w: 1, t0: 0, detent: false });
  const animating = useRef(false);
  const reducedMotion = useReducedMotion();

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

  // Hurl the current card off and rise the neighbour, then advance the index
  // after the throw. Shared by the swipe commit and the keyboard nav, so both
  // animate identically. Callers bounds-check first; a caller may pin the card
  // to a drag position beforehand — the reflow here makes that state animate.
  const throwCard = (goNext: boolean) => {
    animating.current = true;
    const off = goNext ? -1 : 1;
    const el = curRef.current;
    const rise = goNext ? nextRef.current : prevRef.current;
    if (el) {
      void el.offsetWidth; // force a reflow so a just-pinned drag state animates
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
    const n = dashboards.length;
    window.setTimeout(() => {
      animating.current = false;
      setIndex((i) => (i + (goNext ? 1 : -1) + n) % n);
    }, THROW_MS);
  };

  // Keyboard/programmatic step, with the same wrap/clamp rule as a swipe.
  const go = (goNext: boolean) => {
    if (animating.current) return;
    const n = dashboards.length;
    const wrap = n >= 3;
    if (goNext ? !(wrap || index < n - 1) : !(wrap || index > 0)) return;
    navigator.vibrate?.(8);
    throwCard(goNext);
  };

  // Arrow keys page the deck too, so it is navigable without a touchscreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        go(true);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        go(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Re-bind on index/length change so the handler sees the current bounds;
    // `go`/`throwCard` are intentionally omitted (SwipeDeck remounts per filter,
    // so `dashboards` identity is stable within a mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, dashboards.length]);

  const onDown = (e: React.PointerEvent) => {
    if (animating.current) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      dx: 0,
      startY: e.clientY,
      dy: 0,
      w: e.currentTarget.clientWidth || 1,
      t0: performance.now(),
      detent: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setCur(CENTER, 'none');
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    d.dx = e.clientX - d.startX;
    d.dy = e.clientY - d.startY;
    // Mostly-vertical downward drag = pull-to-refresh: the card follows the
    // finger down with resistance instead of arming the horizontal throw.
    if (d.dy > 0 && d.dy > Math.abs(d.dx) * 1.5) {
      setCur(`${CENTER} translateY(${Math.min(70, d.dy * 0.3)}px)`, 'none');
      return;
    }
    // Detent: a soft tick the instant the drag passes the commit distance, so
    // the card feels like it "catches" a notch under the thumb. Re-arms if you
    // pull back below it, so the notch can be felt again on the next pass.
    const committed = Math.abs(d.dx) > Math.min(60, d.w * 0.16);
    if (committed && !d.detent) {
      d.detent = true;
      navigator.vibrate?.(8); // light notch (Android; iOS has no API)
    } else if (!committed && d.detent) {
      d.detent = false;
    }
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
    // Committed pull: trigger the refresh and spring the card back.
    if (d.dy > 110 && d.dy > Math.abs(d.dx) * 1.5) {
      navigator.vibrate?.(8);
      onRefresh?.();
      setCur(CENTER, SPRING);
      return;
    }
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
      // A quick flick can commit without the drag ever reaching the detent
      // distance — give it the same soft tick so the throw still confirms.
      if (!d.detent) navigator.vibrate?.(8);
      // Pin the current (drag) state with no transition first — on a fast flick
      // move/up can land in one frame with nothing painted between, and the
      // browser then jumps straight to the end (the effect looks skipped).
      // throwCard's reflow then makes this pinned state animate into the throw.
      const el = curRef.current;
      if (el) {
        el.style.transition = 'none';
        el.style.transform = `${CENTER} translateX(${d.dx}px) rotate(${d.dx * 0.05}deg) rotateY(${d.dx * 0.05}deg)`;
      }
      throwCard(goNext);
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
        {/* This <Card> keeps its React identity (key={cur.id}) as the deck
            advances — the neighbour that becomes current re-renders into this
            same slot rather than mounting fresh. So `animate` flipping
            false -> true here is what replays CardCanvas's fly-in on landing. */}
        <CardCanvas dashboard={cur} animate={!reducedMotion} />
      </Card>
    </Stack>
  );
}
