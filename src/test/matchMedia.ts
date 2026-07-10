// jsdom ships no `window.matchMedia`, so the media-query hooks
// (useReducedMotion, useIsMobile, useLoaderGlobe's reduced-motion guard) have
// nothing to read. This installs a controllable stand-in: an initial predicate
// decides which queries match at mount, and `emit()` flips a query later and
// fires `change` at every listener the hook registered — the same shape those
// hooks subscribe to. Call `restore()` in afterEach to undo the global.
import { vi } from 'vitest';

type Listener = (event: { matches: boolean; media: string }) => void;

interface Entry {
  matches: boolean;
  listeners: Set<Listener>;
}

export interface MatchMediaControl {
  /** The mock installed on `window.matchMedia` — assert calls on it if needed. */
  readonly fn: ReturnType<typeof vi.fn>;
  /** Flip a query's match state and notify its `change` listeners. */
  emit(query: string, matches: boolean): void;
  /** Restore the original (or absent) `window.matchMedia`. */
  restore(): void;
}

export function installMatchMedia(
  initialMatches: (query: string) => boolean = () => false,
): MatchMediaControl {
  const entries = new Map<string, Entry>();

  // One Entry per query string, shared across every MediaQueryList the hook
  // creates for that query (hooks often build one in the state initializer and
  // another in the effect) so `emit` reaches all of them.
  const entryFor = (query: string): Entry => {
    let entry = entries.get(query);
    if (!entry) {
      entry = { matches: initialMatches(query), listeners: new Set() };
      entries.set(query, entry);
    }
    return entry;
  };

  const build = (query: string): MediaQueryList => {
    const entry = entryFor(query);
    return {
      media: query,
      get matches() {
        return entry.matches;
      },
      onchange: null,
      addEventListener: (_type: string, cb: Listener) => entry.listeners.add(cb),
      removeEventListener: (_type: string, cb: Listener) => entry.listeners.delete(cb),
      // Legacy aliases some libraries still call.
      addListener: (cb: Listener) => entry.listeners.add(cb),
      removeListener: (cb: Listener) => entry.listeners.delete(cb),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  };

  const fn = vi.fn(build);
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    value: fn,
    configurable: true,
    writable: true,
  });

  return {
    fn,
    emit(query, matches) {
      const entry = entryFor(query);
      entry.matches = matches;
      for (const cb of entry.listeners) cb({ matches, media: query });
    },
    restore() {
      if (previous) Object.defineProperty(window, 'matchMedia', previous);
      else delete (window as unknown as Record<string, unknown>).matchMedia;
    },
  };
}
