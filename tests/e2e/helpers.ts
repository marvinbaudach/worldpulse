import { type Locator, type Page, expect } from '@playwright/test';

// Shared boot + overlay helpers for the E2E specs. Every test starts from the
// same deterministic state: locale pinned in localStorage before the first
// paint, so the UI copy under test never depends on the runner's browser
// language.

/** localStorage key the app reads its persisted locale from (see i18n). */
export const LOCALE_KEY = 'worldpulse-locale';

/**
 * Pin the locale, then load the app. Booting in German is the default because
 * the German source copy is what the app authors write against, so a switch
 * under test is always de -> X and the (translated) chrome reads in German.
 */
export async function bootWithLocale(page: Page, locale = 'de'): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [LOCALE_KEY, locale] as const,
  );
  await page.goto('/');
}

/**
 * Open the desktop settings panel (HotkeyPanel). The ⚙ toggle only exists once
 * the ~2.4s loader clears and the WebGL ring has booted, so this click carries
 * the boot wait — the locator auto-waits for the button to become actionable.
 */
export async function openSettings(page: Page): Promise<void> {
  await settingsToggle(page).click();
}

/** The ⚙ settings toggle — `aria-expanded` reflects the panel's open state. */
export function settingsToggle(page: Page): Locator {
  return page.getByRole('button', { name: /Einstellungen/ });
}

/** Open the mobile "⋯" action menu (DeckActionMenu). */
export async function openActions(page: Page): Promise<void> {
  await actionsToggle(page).click();
}

/** The mobile "⋯" action toggle — `aria-expanded` reflects the menu state. */
export function actionsToggle(page: Page): Locator {
  return page.getByRole('button', { name: /Aktionen/ });
}

/** Assert the live locale the app exposes on `<html lang>` (see applyLocale). */
export async function expectHtmlLang(page: Page, locale: string): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}
