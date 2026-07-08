// iOS gates deviceorientation behind a user-gesture permission prompt;
// everywhere else the event just fires. The user's choice persists so the
// opt-in entry shows only until answered.
import { useEffect, useState } from 'react';

type DOEWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const MOTION_KEY = 'worldpulse-motion';

function motionPermissionNeeded(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as DOEWithPermission).requestPermission === 'function'
  );
}

export type MotionPermission = 'granted' | 'ask' | 'denied';

export function useMotionPermission(): { motion: MotionPermission; askMotion: () => Promise<void> } {
  // Non-iOS grants implicitly.
  const [motion, setMotion] = useState<MotionPermission>(() => {
    if (!motionPermissionNeeded()) return 'granted';
    const stored = localStorage.getItem(MOTION_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : 'ask';
  });

  const askMotion = async () => {
    try {
      const res = await (DeviceOrientationEvent as DOEWithPermission).requestPermission?.();
      const next = res === 'granted' ? 'granted' : 'denied';
      localStorage.setItem(MOTION_KEY, next);
      setMotion(next);
    } catch {
      localStorage.setItem(MOTION_KEY, 'denied');
      setMotion('denied');
    }
  };

  // A previously granted iOS permission still needs a per-session
  // requestPermission() call, but it resolves silently — piggyback on the
  // first tap anywhere.
  useEffect(() => {
    if (!motionPermissionNeeded() || motion !== 'granted') return;
    const arm = () => void askMotion();
    window.addEventListener('pointerdown', arm, { once: true });
    return () => window.removeEventListener('pointerdown', arm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { motion, askMotion };
}
