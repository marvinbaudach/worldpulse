import { test, expect } from '@playwright/test';
import { bootWithLocale, expectHtmlLang, openActions } from './helpers';

// Mobile action menu (DeckActionMenu) language switch. The mobile switcher is a
// plain flex row of DE/EN/FR/IT codes; this guards that every locale stays
// reachable and actually switches on the touch surface too.

const TARGETS = [
  { locale: 'en', code: 'EN' },
  { locale: 'fr', code: 'FR' },
  { locale: 'it', code: 'IT' },
] as const;

test.describe('mobile language switcher', () => {
  test('offers every shipped locale', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await openActions(page);

    const group = page.getByRole('group', { name: /Sprache/i });
    for (const code of ['DE', 'EN', 'FR', 'IT']) {
      await expect(group.getByRole('button', { name: code, exact: true })).toBeVisible();
    }
  });

  for (const { locale, code } of TARGETS) {
    test(`switches to ${locale} from the action menu`, async ({ page }) => {
      await bootWithLocale(page, 'de');
      await expectHtmlLang(page, 'de');

      await openActions(page);
      await page.getByRole('group', { name: /Sprache/i }).getByRole('button', { name: code, exact: true }).click();

      // The switch remounts the deck (App key={locale}) and closes the menu.
      await expectHtmlLang(page, locale);
    });
  }
});
