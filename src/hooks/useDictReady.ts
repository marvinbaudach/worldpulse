import { useEffect, useState } from 'react';
import { LOCALE, ensureLocaleReady } from '../i18n';

/**
 * True once the active locale's dictionary chunk is loaded, so the first
 * canvas paint is already translated. German ships no dictionary and is ready
 * synchronously — that seed encodes a real invariant, which is exactly why
 * both app shells (mobile + desktop) share this hook instead of forking it.
 * A failed chunk degrades to German rather than hanging (ensureLocaleReady
 * resolves either way).
 */
export function useDictReady(): boolean {
  const [ready, setReady] = useState(LOCALE === 'de');

  useEffect(() => {
    let alive = true;
    void (async () => {
      await ensureLocaleReady();
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return ready;
}
