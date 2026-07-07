// Theme-filter state that survives a reload AND a shared link: the active tag
// lives in the URL query (`?filter=deutschland`) so a copied address restores
// the exact view, and mirrors into localStorage so a returning visitor without
// a param keeps their last filter. A link's param always wins over storage.

import { useEffect, useState } from 'react';
import { TAGS } from '../dashboards';

const TAG_KEY = 'worldpulse-tag';
const PARAM = 'filter';
const VALID = new Set(TAGS.map((t) => t.id));

/** Coerce a raw param/stored value to a known tag id, or null for the "ALLE" pool. */
function coerce(raw: string | null): string | null {
  return raw && VALID.has(raw) ? raw : null;
}

/**
 * `[tag, setTag]` where `tag` (null = full pool) is kept in sync with the URL
 * and localStorage. Init precedence: an explicit `?filter=` param, then the
 * last stored filter, then `defaultTag`.
 */
export function useTagFilter(defaultTag: string | null): [string | null, (t: string | null) => void] {
  const [tag, setTag] = useState<string | null>(() => {
    const param = new URLSearchParams(window.location.search).get(PARAM);
    // A present param is an explicit share — honor it (coerced to null if bogus)
    // rather than falling through to a stored filter.
    if (param !== null) return coerce(param);
    const stored = localStorage.getItem(TAG_KEY);
    if (stored !== null) return stored === 'all' ? null : stored;
    return defaultTag;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tag) url.searchParams.set(PARAM, tag);
    else url.searchParams.delete(PARAM);
    // replaceState, not push: filter changes shouldn't stack up in Back history.
    window.history.replaceState(null, '', url);
    localStorage.setItem(TAG_KEY, tag ?? 'all');
  }, [tag]);

  return [tag, setTag];
}
