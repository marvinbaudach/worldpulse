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
`;

// Fill the available area rather than locking the panel's 4:5 shape: on a tall
// phone that left big empty bands top and bottom. The chart renderers adapt to
// whatever aspect the card takes; width is capped so it stays sane on tablets.
const Card = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(94vw, 560px, 72vh);
  height: 96%;
  border-radius: 18px;
  overflow: hidden;
  touch-action: none;
  will-change: transform, opacity;
  transform: translate(-50%, -50%);
`;

const CENTER = 'translate(-50%, -50%)';
// Cards underneath sit at the same full size (just hidden by z-index / opacity)
// so a card that rises to the top appears already settled — no grow-in.
const BEHIND = CENTER;
const THROW_MS = 300;
const SPRING = 'transform 220ms ease, opacity 220ms ease';

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
    // Reveal the neighbour the swipe is heading toward, hide the other.
    if (nextRef.current) nextRef.current.style.opacity = d.dx < 0 ? '1' : '0';
    if (prevRef.current) prevRef.current.style.opacity = d.dx > 0 ? '1' : '0';
    setCur(`${CENTER} translateX(${d.dx}px) rotate(${d.dx * 0.04}deg)`, 'none');
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
    const goNext = left && index < dashboards.length - 1;
    const goPrev = right && index > 0;
    if (goNext || goPrev) {
      animating.current = true;
      const off = goNext ? -1 : 1;
      setCur(
        `${CENTER} translateX(${off * 140}%) rotate(${off * 18}deg)`,
        `transform ${THROW_MS}ms ease, opacity ${THROW_MS}ms ease`,
        '0',
      );
      window.setTimeout(() => {
        animating.current = false;
        setIndex((i) => i + (goNext ? 1 : -1));
      }, THROW_MS);
    } else {
      // Not far enough: spring back to center.
      setCur(CENTER, SPRING);
    }
  };

  const prev = index > 0 ? dashboards[index - 1] : null;
  const cur = dashboards[index];
  const next = index < dashboards.length - 1 ? dashboards[index + 1] : null;
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
        <CardCanvas dashboard={cur} animate />
      </Card>
    </Stack>
  );
}
