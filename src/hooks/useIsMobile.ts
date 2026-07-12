import { useEffect, useState } from 'react';
import { readViewOverride } from './viewOverride';

// Small phones or any touch device: the scene trims its heavy post-processing
// and pixel ratio here to stay smooth on mobile GPUs. Exported for one-shot
// media checks outside React (e.g. the loader's canvas choreography).
export const MOBILE_QUERY = '(max-width: 820px), (pointer: coarse)';
const QUERY = MOBILE_QUERY;

/** One-shot "is this the mobile experience?" — media query plus the `?view=`
    preview override. Non-React consumers (the loader's canvas choreography)
    must use this instead of matching MOBILE_QUERY raw, or a `?view=mobile`
    desktop preview would mix desktop effects into the mobile path. */
export function isMobileView(): boolean {
  const override = readViewOverride();
  if (override) return override === 'mobile';
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

/** True on touch phones / small screens (or forced via `?view=`). */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(isMobileView);

  useEffect(() => {
    if (readViewOverride()) return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
