import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setMissRecorder, setLocale, t } from '../../i18n';
import { buildEntries, filterSort, indexOfId, stepId, type FilterState } from './galleryData';

const entries = buildEntries();
const ALL: FilterState = { query: '', category: '', sort: 'id' };

afterEach(async () => {
  __setMissRecorder(null);
  await setLocale('de');
});

describe('filterSort search', () => {
  it('matches the translated title without feeding the miss report', async () => {
    await setLocale('en');
    // A card whose English title differs from its German one, found through the
    // real dictionary so a reworded title cannot break the test.
    const hit = entries.find((e) => t(e.card.title) !== e.card.title);
    if (!hit) throw new Error('no card with a translated title in the pool');
    const query = t(hit.card.title).toLowerCase();

    const recorder = vi.fn();
    __setMissRecorder(recorder);
    const found = filterSort(entries, { ...ALL, query });

    expect(found.map((e) => e.card.id)).toContain(hit.card.id);
    expect(recorder).not.toHaveBeenCalled();
  });

  it('still reports misses from rendered copy through t()', async () => {
    await setLocale('en');
    const recorder = vi.fn();
    __setMissRecorder(recorder);
    t('§ totally unknown string §');
    expect(recorder).toHaveBeenCalledTimes(1);
  });
});

describe('lightbox id helpers', () => {
  it('keeps pointing at the same card when the list reorders', () => {
    const list = filterSort(entries, ALL);
    const id = list[2].card.id;
    const reordered = list.toReversed();
    expect(indexOfId(list, id)).toBe(2);
    expect(indexOfId(reordered, id)).toBe(list.length - 3);
    expect(reordered[indexOfId(reordered, id)].card.id).toBe(id);
  });

  it('reports a card that left the list as missing', () => {
    const list = filterSort(entries, ALL);
    const id = list[0].card.id;
    expect(indexOfId(list.slice(1), id)).toBe(-1);
    expect(indexOfId(list, null)).toBe(-1);
  });

  it('steps to the neighbour by id and wraps at both ends', () => {
    const list = filterSort(entries, ALL);
    const last = list.length - 1;
    expect(stepId(list, list[1].card.id, 1)).toBe(list[2].card.id);
    expect(stepId(list, list[1].card.id, -1)).toBe(list[0].card.id);
    expect(stepId(list, list[last].card.id, 1)).toBe(list[0].card.id);
    expect(stepId(list, list[0].card.id, -1)).toBe(list[last].card.id);
    expect(stepId(list, 'not-in-list', 1)).toBeNull();
  });
});
