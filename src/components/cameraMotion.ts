/**
 * Live ring motion published by `useCarouselRotation` every frame and read by
 * `CameraRig` to drive the cinematic banking and speed/settle dolly. It travels
 * through a ref (mutated in place in `useFrame`) so the camera can follow the
 * spin without a single per-frame React re-render.
 */
export interface RingMotion {
  /** Applied Y rotation of the ring group (radians, unbounded). */
  rotation: number;
  /** Signed angular velocity of the spin (radians/second). */
  velocity: number;
  /** True while the user is actively dragging the ring. */
  dragging: boolean;
}
