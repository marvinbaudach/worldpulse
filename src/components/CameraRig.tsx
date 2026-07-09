import { useFrame, useThree } from '@react-three/fiber';
import { Fog, MathUtils } from 'three';

interface CameraRigProps {
  /** Ring radius; the viewing distance keeps a fixed gap in front of it. */
  radius: number;
  /** Gap between the ring front and the camera on wide screens. */
  gap?: number;
  /** Fog near/far tuned for the wide-screen distance; scaled with pull-back. */
  fogNear: number;
  fogFar: number;
  /** Subtle mouse parallax; off for touch, where there is no hover pointer. */
  parallax?: boolean;
  /** User zoom (1 = default framing). Higher pulls the camera in, and it
      scales the gap rather than the whole distance, so even a wide ring keeps
      the camera safely in front of its front row. */
  zoom?: number;
}

// Distance is tuned for a landscape screen. Narrower (portrait) screens pull
// the camera back so the whole ring stays in frame instead of being cropped.
const REF_ASPECT = 16 / 9;
const MAX_PULLBACK = 1.7;

// Default gap between the ring front and the camera. 6.5 puts the front panel
// at comfortable reading size (~2/3 of the frame height at 16:9) while the
// aspect pull-back still keeps the ring's widest points just inside the frame
// on 16:10 / 3:2 / 4:3 screens.
export const CAMERA_GAP = 6.5;

/**
 * Owns the camera framing: keeps the ring fit to any aspect ratio, adds an
 * optional mouse parallax, and scales the fog with the viewing distance so the
 * depth cue stays consistent when the camera pulls back on tall screens.
 */
export function CameraRig({
  radius,
  gap = CAMERA_GAP,
  fogNear,
  fogFar,
  parallax = true,
  zoom = 1,
}: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  useFrame((state) => {
    const aspect = size.width / size.height;
    const pullback = MathUtils.clamp(REF_ASPECT / aspect, 1, MAX_PULLBACK);
    const dist = (radius + gap / zoom) * pullback;

    const px = parallax ? state.pointer.x * 1.4 : 0;
    const py = parallax ? state.pointer.y * 0.9 : 0;
    camera.position.x = MathUtils.lerp(camera.position.x, px, 0.05);
    camera.position.y = MathUtils.lerp(camera.position.y, py, 0.05);
    camera.position.z = MathUtils.lerp(camera.position.z, dist, 0.1);
    camera.lookAt(0, 0, 0);

    // Fog is camera-relative, so it has to grow with the pull-back distance or
    // the ring would sink into the background on portrait screens.
    if (scene.fog instanceof Fog) {
      scene.fog.near = fogNear * pullback;
      scene.fog.far = fogFar * pullback;
    }
  });

  return null;
}
