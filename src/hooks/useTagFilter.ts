// Theme-filter state that survives a reload AND a shared link: the active tag
// lives in the URL query (`?filter=deutschland`) so a copied address restores
// the exact view, and mirrors into localStorage so a returning visitor without
// a param keeps their last filter. A link's param always wins over storage.

import { useEffect, useState } from 'react';
import { TAGS } from '../dashboards';

const TAG_KEY = 'worldpulse-tag';
const PARAM = 'filter';
const VALID = new Set(TAGS.map((t) => t.id));

/**
 * `[tag, setTag]` where `tag` is always a known tag id — the unfiltered
 * "ALLE" pool no longer exists; the full pool is simply too many cards for
 * one stage. Init precedence: an explicit `?filter=` param, then the last
 * stored filter, then `defaultTag`. Unknown values (including the legacy
 * 'all' sentinel still sitting in returning visitors' storage) fall through
 * to `defaultTag`.
 */
export function useTagFilter(defaultTag: string): [string, (t: string) => void] {
  const [tag, setTag] = useState<string>(() => {
    const param = new URLSearchParams(window.location.search).get(PARAM);
    if (param !== null && VALID.has(param)) return param;
    const stored = localStorage.getItem(TAG_KEY);
    if (stored !== null && VALID.has(stored)) return stored;
    return defaultTag;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, tag);
    // replaceState, not push: filter changes shouldn't stack up in Back history.
    window.history.replaceState(null, '', url);
    localStorage.setItem(TAG_KEY, tag);
  }, [tag]);

  return [tag, setTag];
}
