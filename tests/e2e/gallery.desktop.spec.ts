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

    // Thumbnails arrive (tiles are buttons labelled "<title> · öffnen").
    await expect(page.getByRole('button', { name: /öffnen/ }).first()).toBeVisible();
  });

  test('search narrows the set and reveals the count as filter feedback', async ({ page }) => {
    await bootWithLocale(page, 'de');
    const count = page.getByText(/\d+ Karten/);
    // Unfiltered, the count would only restate the pool size — it stays hidden.
    await expect(page.getByPlaceholder('Suche…')).toBeVisible();
    await expect(count).toHaveCount(0);

    await page.getByPlaceholder('Suche…').fill('cpu');
    await expect(count).toBeVisible();
    // The CPU cards exist, so the filtered set is non-empty (tiles are named by
    // their card title).
    await expect(page.getByRole('button', { name: /Schnellste CPU-Kerne 2026/ })).toBeVisible();
  });

  test('category filter narrows the set and shows the count', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await page.getByRole('button', { name: 'Kategorie filtern', exact: true }).click();
    await page.getByRole('option', { name: /tech/ }).click();

    await expect(page.getByText(/\d+ Karten/)).toBeVisible();
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

  test('lightbox takes focus, keeps Tab inside and hands focus back on close', async ({ page }) => {
    await bootWithLocale(page, 'de');
    const tile = page.getByRole('button', { name: /öffnen/ }).first();
    await tile.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Karten-Detailansicht' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schließen' })).toBeFocused();

    // More Tab presses than the dialog has stops: focus must never leave it.
    const tabInside = async (): Promise<void> => {
      await page.keyboard.press('Tab');
      await expect(dialog.locator(':focus')).toHaveCount(1);
    };
    await tabInside();
    await tabInside();
    await tabInside();
    await tabInside();
    await tabInside();
    await tabInside();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(tile).toBeFocused();
  });
});
