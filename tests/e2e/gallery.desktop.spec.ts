import { test, expect } from '@playwright/test';
import { bootWithLocale, inOrder } from './helpers';

// The desktop experience IS the gallery: no boot loader — the toolbar and the
// skeleton grid appear immediately and the thumbnails paint in staggered.
// These flows cover the product surface: boot, search, category filter, and
// the lightbox.

test.describe('desktop gallery', () => {
  test('boots straight into the gallery — toolbar up, thumbnails paint', async ({ page }) => {
    await bootWithLocale(page, 'de');

    // No loader gate: the search box is interactive right away.
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
    await expect(dialog.getByRole('button', { name: 'Schließen', exact: true })).toBeFocused();

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

  test('focus lands on the reset button when the open card filters away to an empty list', async ({
    page,
  }) => {
    await bootWithLocale(page, 'de');
    await page
      .getByRole('button', { name: /öffnen/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Karten-Detailansicht' });
    await expect(dialog).toBeVisible();

    // fill() skips the hit-target check, so the search box behind the overlay
    // is still reachable; no card matches, so the lightbox closes on its own.
    await page.getByPlaceholder('Suche…').fill('qqqzzz');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter zurücksetzen' })).toBeFocused();
  });

  test('category and search combine: the query only narrows within the category', async ({ page }) => {
    await bootWithLocale(page, 'de');
    const count = page.getByText(/\d+ Karten/);
    const countOf = async (): Promise<number> =>
      Number(((await count.textContent()) ?? '').match(/(\d+) Karten/)?.[1]);

    await page.getByRole('button', { name: 'Kategorie filtern', exact: true }).click();
    await page.getByRole('option', { name: /tech/ }).click();
    await expect(count).toBeVisible();
    const techOnly = await countOf();

    // The CPU cards are tagged tech, so the combined set is a non-empty,
    // strictly smaller subset of the category.
    await page.getByPlaceholder('Suche…').fill('cpu');
    await expect(page.getByRole('button', { name: /Schnellste CPU-Kerne 2026/ })).toBeVisible();
    await expect.poll(countOf).toBeLessThan(techOnly);
    expect(await countOf()).toBeGreaterThan(0);

    // Same query under a category without CPU cards: the category wins and the
    // result is empty, instead of the search escaping the filter.
    await page.getByRole('button', { name: 'Kategorie filtern', exact: true }).click();
    await page.getByRole('option', { name: /krieg/ }).click();
    await expect(page.getByRole('button', { name: /öffnen/ })).toHaveCount(0);
    await expect(page.getByText('Keine Karten gefunden')).toBeVisible();
  });

  test('Shift+Tab wraps backwards inside the lightbox, Tab wraps forwards again', async ({
    page,
  }) => {
    await bootWithLocale(page, 'de');
    await page.getByRole('button', { name: /öffnen/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Karten-Detailansicht' });
    const close = dialog.getByRole('button', { name: 'Schließen', exact: true });
    const info = dialog.getByRole('region', { name: 'Kartendetails' });
    await expect(close).toBeFocused();

    // From the first stop, Shift+Tab goes to the last one (the info panel),
    // not out of the dialog.
    await page.keyboard.press('Shift+Tab');
    await expect(info).toBeFocused();
    await expect(dialog.locator(':focus')).toHaveCount(1);

    // And Tab from the last stop wraps to the first.
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
  });

  test('the scrollable info panel is reachable by keyboard', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await page.getByRole('button', { name: /öffnen/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Karten-Detailansicht' });
    const info = dialog.getByRole('region', { name: 'Kartendetails' });
    await expect(info).toHaveAttribute('tabindex', '0');

    // Close -> PNG -> prev -> next -> info panel.
    await inOrder(Array.from({ length: 4 }, () => () => page.keyboard.press('Tab')));
    await expect(info).toBeFocused();
  });

  test('after walking with the arrows, Esc returns focus to the tile of the card shown', async ({
    page,
  }) => {
    await bootWithLocale(page, 'de');
    const tiles = page.locator('[data-card-id]');
    await tiles.first().focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Karten-Detailansicht' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('.meta')).toContainText(/\b3 \/ \d+$/);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    // The third tile, not the one that opened the lightbox.
    await expect(tiles.nth(2)).toBeFocused();
  });

  test('a held Enter opens the lightbox once and does not close it again', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await page.locator('[data-card-id]').first().focus();
    const dialog = page.getByRole('dialog', { name: 'Karten-Detailansicht' });

    // keyboard.down() twice in a row reports the second keydown as a repeat,
    // like a held key does.
    await page.keyboard.down('Enter');
    await expect(dialog).toBeVisible();
    await inOrder(Array.from({ length: 5 }, () => () => page.keyboard.down('Enter')));
    await page.keyboard.up('Enter');

    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Schließen', exact: true })).toBeFocused();
  });

  test('the download button keeps focus while the PNG is being rendered', async ({ page }) => {
    await bootWithLocale(page, 'de');
    await page.getByRole('button', { name: /öffnen/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Karten-Detailansicht' });
    const png = dialog.getByRole('button', { name: 'Karte als PNG herunterladen' });
    await png.focus();

    const download = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    // aria-disabled, not disabled: a natively disabled button drops focus to
    // <body> mid-export, which would also let Esc/Tab misbehave.
    await expect(png).toBeFocused();
    await download;
    await expect(png).toBeFocused();
    await expect(png).toHaveAttribute('aria-disabled', 'false');
  });
});
