import { test, expect } from '@playwright/test';
import { bootWithLocale, expectHtmlLang } from './helpers';

// Desktop language switch lives in the gallery toolbar's SPRACHE dropdown (a
// GlassSelect: trigger button + listbox options). `html[lang]` reflects the
// live locale (see applyLocale), and the toolbar chrome itself translates —
// the gallery repaints in place rather than remounting.

const TARGETS = [
  { locale: 'en', option: 'EN', probe: 'Category' },
  { locale: 'fr', option: 'FR', probe: 'Catégorie' },
  { locale: 'it', option: 'IT', probe: 'Categoria' },
] as const;

test.describe('desktop language switcher', () => {
  test('offers every shipped locale', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await page.getByRole('button', { name: 'Sprache' }).click();
    for (const label of ['DE', 'EN', 'FR', 'IT']) {
      await expect(page.getByRole('option', { name: label })).toBeVisible();
    }
  });

  for (const { locale, option, probe } of TARGETS) {
    test(`switches to ${locale} from the toolbar`, async ({ page }) => {
      await bootWithLocale(page, 'de');
      await expectHtmlLang(page, 'de');

      await page.getByRole('button', { name: 'Sprache' }).click();
      await page.getByRole('option', { name: option }).click();

      await expectHtmlLang(page, locale);
      // The chrome follows the locale, not just the cards.
      await expect(page.getByText(probe)).toBeVisible();
    });
  }
});
