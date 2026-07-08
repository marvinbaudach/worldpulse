// Lightweight i18n: the source language is German (all copy in the code stays
// German), and `t()` maps a German string to the visitor's browser language.
// Dictionaries are keyed by the exact German source string, so cards and
// components never deal with translation keys. Unknown strings fall through
// unchanged, so a missing entry can never blank out a panel.

import { EN } from './en';
import { FR } from './fr';
import { IT } from './it';

export type Locale = 'de' | 'en' | 'fr' | 'it';

const DICTS: Partial<Record<Locale, Record<string, string>>> = {
  en: EN,
  fr: FR,
  it: IT,
};

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

const TAGLINE: Record<Locale, string> = {
  de: '3D-Datenkarussell',
  en: '3D data carousel',
  fr: 'Carrousel de données 3D',
  it: 'Carosello di dati 3D',
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

/** Switch the locale at runtime: persists the pick, retitles the page and
    notifies subscribers (the app remounts the canvas views so every panel
    texture redraws in the new language). */
export function setLocale(next: Locale): void {
  if (next === LOCALE) return;
  LOCALE = next;
  localStorage.setItem(STORE_KEY, next);
  applyLocale();
  listeners.forEach((fn) => fn(next));
}

/**
 * Translate a German UI string into the active locale. Falls back to
 * translating the ' · '-separated segments individually, so composed labels
 * like `Militärausgaben · 2025` still resolve their static parts while the
 * dynamic parts (years, numbers) pass through untouched.
 */
export function t(s: string): string {
  if (LOCALE === 'de' || !s) return s;
  const dict = DICTS[LOCALE];
  if (!dict) return s;
  const hit = dict[s];
  if (hit) return hit;
  if (s.includes(' · ')) {
    return s
      .split(' · ')
      .map((seg) => dict[seg] ?? seg)
      .join(' · ');
  }
  return s;
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
