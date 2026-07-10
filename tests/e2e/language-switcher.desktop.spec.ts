import { test, expect } from '@playwright/test';
import { bootWithLocale, expectHtmlLang, openSettings } from './helpers';

// Desktop settings panel (HotkeyPanel) language switch. Regression cover for the
// bug where only DE/EN were selectable while FR/IT stayed dead: the collapsible
// SPRACHE fold clipped its lower rows, so the full-screen scene canvas swallowed
// the FR/IT clicks. A real browser is required — the failure is pure CSS
// stacking, invisible to jsdom, and it reproduced in Firefox but not Chromium.

// Native language names are never translated, so these labels are stable in any
// starting locale. `html[lang]` reflects the live locale (see applyLocale).
const TARGETS = [
  { locale: 'en', label: /English/ },
  { locale: 'fr', label: /Français/ },
  { locale: 'it', label: /Italiano/ },
] as const;

test.describe('desktop language switcher', () => {
  test('offers every shipped locale', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await openSettings(page);

    // The SPRACHE fold is open by default; all four options must be present.
    for (const label of [/Deutsch/, /English/, /Français/, /Italiano/]) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
  });

  for (const { locale, label } of TARGETS) {
    test(`switches to ${locale} from the panel`, async ({ page }) => {
      await bootWithLocale(page, 'de');
      await expectHtmlLang(page, 'de');

      await openSettings(page);
      // A miss here (canvas covering a clipped FR/IT row) fails the click with
      // "element intercepts pointer events" — exactly the reported bug.
      await page.getByRole('button', { name: label }).click();

      await expectHtmlLang(page, locale);
    });
  }
});
