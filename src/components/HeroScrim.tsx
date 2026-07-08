import { useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import type { MeshBasicMaterial } from 'three';

// Peak opacity of the scrim that dims the whole scene behind an open hero, so
// the enlarged card reads as the sole focus. Matches the background color so
// the ring, aurora and dust sink into the backdrop rather than tinting it.
const SCRIM_OPACITY = 0.62;

/**
 * A full-frame dark plane parked just behind the hero (in front of the entire
 * ring): while a hero is open it fades in to sink everything else into the
 * backdrop, and fades back out on close in step with the card's fly-back. The
 * plane is far larger than the frustum at its depth, so it always fills frame.
 */
export function HeroScrim({ active, z }: { active: boolean; z: number }): ReactElement {
  const matRef = useRef<MeshBasicMaterial>(null);
  useFrame((_, delta) => {
    const m = matRef.current;
    if (!m) return;
    m.opacity = MathUtils.damp(m.opacity, active ? SCRIM_OPACITY : 0, 6, delta);
    m.visible = m.opacity > 0.001;
  });
  return (
    <mesh position={[0, 0, z]} raycast={() => null}>
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial
        ref={matRef}
        color="#05070c"
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
