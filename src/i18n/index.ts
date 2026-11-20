// Lightweight i18n: the source language is German (all copy in the code stays
// German), and `t()` maps a German string to the visitor's browser language.
// Dictionaries are keyed by the exact German source string, so cards and
// components never deal with translation keys. Unknown strings fall through
// unchanged, so a missing entry can never blank out a panel.

export type Locale = 'de' | 'en' | 'fr' | 'it';

type Dict = Record<string, string>;

// Each non-German dictionary is its own chunk, imported on demand, so a visitor
// downloads only the locale they actually view (German downloads none of them).
// `t()` runs synchronously every frame, so the active dict is loaded up front:
// the app awaits `ensureLocaleReady()` before the first render (see App.tsx),
// and `setLocale()` loads the target before it switches. The per-locale type
// guarantee (FR/IT cover every EN key) lives in fr.ts/it.ts's own annotations.
function importDict(locale: Exclude<Locale, 'de'>): Promise<Dict> {
  switch (locale) {
    case 'en':
      return import('./en').then((m) => m.EN);
    case 'fr':
      return import('./fr').then((m) => m.FR);
    case 'it':
      return import('./it').then((m) => m.IT);
  }
}

const dictCache = new Map<Locale, Dict>();
let activeDict: Dict | null = null; // loaded dict for the current LOCALE; null for German
let switchToken = 0;

/** Resolve (and memoise) the dictionary for a locale; null for German. */
async function ensureCached(locale: Locale): Promise<Dict | null> {
  if (locale === 'de') return null;
  const hit = dictCache.get(locale);
  if (hit) return hit;
  const dict = await importDict(locale);
  dictCache.set(locale, dict);
  return dict;
}

/** Load the current locale's dictionary and make it active. Await this before
    the first render so `t()` resolves synchronously from then on. Resolves
    immediately for German and for an already-loaded locale, and degrades to the
    German source text if the chunk fails to load (it never rejects). */
export async function ensureLocaleReady(): Promise<void> {
  try {
    activeDict = await ensureCached(LOCALE);
  } catch {
    activeDict = null; // chunk failed → fall back to the German source text
  }
}

export const LOCALES: Locale[] = ['de', 'en', 'fr', 'it'];
const STORE_KEY = 'worldpulse-locale';

function isLocale(v: unknown): v is Locale {
  return LOCALES.includes(v as Locale);
}

/** A manual pick (stored) wins; otherwise the first supported browser
    language; English for everyone else. */
function detectLocale(): Locale {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
  if (isLocale(stored)) return stored;
  const prefs = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const lang of prefs) {
    const primary = lang?.slice(0, 2).toLowerCase();
    if (isLocale(primary)) return primary;
  }
  return 'en';
}

export let LOCALE: Locale = detectLocale();

// --- Coverage instrumentation (test-only) --------------------------------
// The coverage guard (i18n.coverage.test.ts) installs a recorder to learn
// which German strings the render path actually hands to `t()`, then asserts
// each is covered by the dictionaries. It is null in production, so the only
// cost is a single null-check on `t()`'s *miss* paths — a translated hit
// returns before ever reaching it. Not public API; hence the `__` prefix.
type MissRecorder = (source: string, unresolved: readonly string[]) => void;
let missRecorder: MissRecorder | null = null;

/** Test hook: observe every string `t()` cannot fully resolve in the active
    locale. `unresolved` is the list of ' · '-segments (or the whole string)
    that had no dictionary entry. Pass `null` to detach. */
export function __setMissRecorder(fn: MissRecorder | null): void {
  missRecorder = fn;
}

const TAGLINE: Record<Locale, string> = {
  de: 'Live-Dashboards',
  en: 'Live dashboards',
  fr: 'Tableaux de bord en direct',
  it: 'Dashboard in tempo reale',
};

function applyLocale(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = LOCALE;
  document.title = `Worldpulse · ${TAGLINE[LOCALE]}`;
}
applyLocale();

type LocaleListener = (l: Locale) => void;
const listeners = new Set<LocaleListener>();

/** Subscribe to runtime locale switches; returns the unsubscribe. */
export function onLocaleChange(fn: LocaleListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Switch the locale at runtime: loads the target dictionary first (so the
    first post-switch render already has it), then persists the pick, retitles
    the page and notifies subscribers (the app redraws every panel texture in
    the new language). Returns a promise callers may ignore. A token guards
    against a slow load clobbering a newer choice on rapid switches. */
export async function setLocale(next: Locale): Promise<void> {
  if (next === LOCALE) return ensureLocaleReady();
  const token = ++switchToken;
  let dict: Dict | null;
  try {
    dict = await ensureCached(next);
  } catch {
    return; // chunk failed to load — keep the current, working locale
  }
  if (token !== switchToken) return; // superseded by a later switch
  LOCALE = next;
  activeDict = dict;
  localStorage.setItem(STORE_KEY, next);
  applyLocale();
  listeners.forEach((fn) => fn(next));
}

/** Shared lookup behind `t()` and `tQuiet()`. `report` decides whether a miss
    is handed to the test recorder. */
function translate(s: string, report: boolean): string {
  if (LOCALE === 'de' || !s) return s;
  const dict = activeDict;
  if (!dict) return s;
  const hit = dict[s];
  if (hit) return hit;
  if (s.includes(' · ')) {
    const segs = s.split(' · ');
    if (report && missRecorder) missRecorder(s, segs.filter((seg) => !dict[seg]));
    return segs.map((seg) => dict[seg] ?? seg).join(' · ');
  }
  if (report && missRecorder) missRecorder(s, [s]);
  return s;
}

/**
 * Translate a German UI string into the active locale. Falls back to
 * translating the ' · '-separated segments individually, so composed labels
 * like `Militärausgaben · 2025` still resolve their static parts while the
 * dynamic parts (years, numbers) pass through untouched.
 */
export function t(s: string): string {
  return translate(s, true);
}

/** `t()` for lookups that are not rendered copy (the gallery search matches
    against translated titles on every keystroke). Resolves identically but
    never feeds the miss recorder, so such probes cannot flood the report. */
export function tQuiet(s: string): string {
  return translate(s, false);
}

/** Locale-aware integer with thousands separators (12183 → "12.183"/"12,183"). */
export function localeInt(v: number): string {
  return Math.round(v).toLocaleString(LOCALE);
}

/** Locale-aware fixed-decimal number (1.5 → "1.50"/"1,50"), the drop-in for
    `toFixed` in panel formatters. Without `digits`, trailing zeros are dropped
    like plain template interpolation would. */
export function localeNum(v: number, digits?: number): string {
  return v.toLocaleString(
    LOCALE,
    digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  );
}

/** Locale-aware percentage: decimal comma where the locale wants one, and a
    no-break space before the sign for de/fr (13.4 → "13,4 %" / "13.4%"). */
export function localePct(v: number, digits = 0): string {
  const gap = LOCALE === 'de' || LOCALE === 'fr' ? ' ' : '';
  return `${localeNum(v, digits)}${gap}%`;
}

/** Like `localeNum` but drops a redundant trailing-zero decimal while capping
    precision at `maxDigits` (84 -> "84", 84.7 -> "84,7", 5.63 -> "5,6"). Use
    where whole values shouldn't render a pointless ",0" but real decimals stay. */
export function localeNumTrim(v: number, maxDigits = 1): string {
  return v.toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: maxDigits });
}

/** `localePct` that drops a redundant trailing-zero decimal (34 -> "34 %",
    13.4 -> "13,4 %"), capped at `maxDigits`. */
export function localePctTrim(v: number, maxDigits = 1): string {
  const gap = LOCALE === 'de' || LOCALE === 'fr' ? ' ' : '';
  return `${localeNumTrim(v, maxDigits)}${gap}%`;
}
