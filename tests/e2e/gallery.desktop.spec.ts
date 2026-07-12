import { test, expect } from '@playwright/test';
import { bootWithLocale } from './helpers';

// The desktop experience IS the gallery since the split: no boot loader, no
// 3D carousel — the toolbar and the skeleton grid appear immediately and the
// thumbnails paint in staggered. These flows cover the product surface: boot,
// search, category filter, and the lightbox.

test.describe('desktop gallery', () => {
  test('boots straight into the gallery — toolbar up, thumbnails paint', async ({ page }) => {
    await bootWithLocale(page, 'de');

    // No loader gate: the search box is interactive well before the old
    // ~2.4s boot beat would have cleared.
    await expect(page.getByPlaceholder('Suche…')).toBeVisible({ timeout: 3000 });

    // Thumbnails arrive (tiles are buttons labelled "<id> · öffnen").
    await expect(page.getByRole('button', { name: /öffnen/ }).first()).toBeVisible();
  });

  test('search narrows the visible set', async ({ page }) => {
    await bootWithLocale(page, 'de');
    const count = page.getByText(/\d+ Karten/);
    await expect(count).toBeVisible();
    const before = await count.textContent();

    await page.getByPlaceholder('Suche…').fill('cpu');
    await expect(count).not.toHaveText(before ?? '', { timeout: 5000 });
    // The CPU cards exist, so the filtered set is non-empty.
    await expect(page.getByRole('button', { name: /cpu-single-core/ })).toBeVisible();
  });

  test('category filter narrows the set', async ({ page }) => {
    await bootWithLocale(page, 'de');
    const count = page.getByText(/\d+ Karten/);
    const before = await count.textContent();

    await page.getByRole('button', { name: 'Kategorie filtern' }).click();
    await page.getByRole('option', { name: /tech/ }).click();

    await expect(count).not.toHaveText(before ?? '');
  });

  test('lightbox opens from a tile and closes on Esc', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await page
      .getByRole('button', { name: /öffnen/ })
      .first()
      .click();

    const dialog = page.getByRole('dialog', { name: 'Karten-Detailansicht' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
