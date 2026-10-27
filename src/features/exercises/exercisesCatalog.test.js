import {
  INITIAL_SEARCH,
  cardMuscleLabel,
  cardThumbnailSources,
  catalogErrorMessage,
  countFor,
  deriveCatalog,
  gridColumns,
  gridRows,
  groupKey,
  loadExerciseCatalog,
  loadRestPages,
  pageCount,
  pageItems,
  popSearch,
  submitSearch,
} from './exercisesCatalog';

const ex = (id, muscle) => ({ id, name: `Ex ${id}`, primary_muscle_group: muscle ? { name: muscle } : null });
const page = (items, totalPages) => ({ items, pagination: { total_pages: totalPages } });

describe('catalog load (§E1.2, F1)', () => {
  it('reads items and total pages defensively', () => {
    expect(pageItems({ items: 'x' })).toEqual([]);
    expect(pageItems(undefined)).toEqual([]);
    expect(pageCount({ pagination: { total_pages: '3' } })).toBe(3);
    expect(pageCount({ pagination: { total_pages: 0 } })).toBe(1);
    expect(pageCount({ pagination: { total_pages: 'abc' } })).toBe(1);
    expect(pageCount({})).toBe(1);
  });

  it('fetches one page when there is only one, without a first-page callback', async () => {
    const fetchPage = jest.fn().mockResolvedValue(page([ex(1)], 1));
    const onFirstPage = jest.fn();
    await expect(loadExerciseCatalog({ fetchPage, search: 'row', onFirstPage })).resolves.toEqual({ items: [ex(1)], partial: null });
    expect(fetchPage.mock.calls).toEqual([[1, 'row']]);
    expect(onFirstPage).not.toHaveBeenCalled();
  });

  it('shows page 1 first, then fetches 2…N in parallel and joins them in page order', async () => {
    const order = [];
    const resolvers = {};
    const fetchPage = jest.fn((n) => {
      order.push(n);
      if (n === 1) {
        return Promise.resolve(page([ex(1)], 3));
      }
      return new Promise((resolve) => {
        resolvers[n] = resolve;
      });
    });
    const onFirstPage = jest.fn();
    const result = loadExerciseCatalog({ fetchPage, onFirstPage });
    await new Promise((resolve) => setImmediate(resolve));
    expect(onFirstPage).toHaveBeenCalledWith([ex(1)]);
    expect(order).toEqual([1, 2, 3]);
    resolvers[3](page([ex(3)], 3));
    resolvers[2](page([ex(2)], 3));
    await expect(result).resolves.toEqual({ items: [ex(1), ex(2), ex(3)], partial: null });
    expect(fetchPage.mock.calls.map((call) => call[1])).toEqual(['', '', '']);
  });

  it('fails the whole load when page 1 fails', async () => {
    const failure = new Error('Request failed with status code 500');
    const fetchPage = jest.fn().mockRejectedValue(failure);
    await expect(loadExerciseCatalog({ fetchPage })).rejects.toBe(failure);
  });

  it('keeps page 1 when a later page fails (step 4, T-16)', async () => {
    const failure = new Error('Request failed with status code 500');
    const fetchPage = jest.fn((n) => (n === 2 ? Promise.reject(failure) : Promise.resolve(page([ex(n)], 3))));
    await expect(loadExerciseCatalog({ fetchPage, search: 'row' })).resolves.toEqual({
      items: [ex(1)],
      partial: { firstItems: [ex(1)], totalPages: 3, error: failure, search: 'row' },
    });
  });

  it('re-requests pages 2…N only, in parallel and in page order', async () => {
    const fetchPage = jest.fn((n) => Promise.resolve(page([ex(n)], 3)));
    await expect(loadRestPages({ fetchPage, search: 'row', totalPages: 3 })).resolves.toEqual([ex(2), ex(3)]);
    expect(fetchPage.mock.calls).toEqual([
      [2, 'row'],
      [3, 'row'],
    ]);
  });

  it('uses the transport error text, else "Please try again."', () => {
    expect(catalogErrorMessage(new Error('Request failed with status code 500'))).toBe('Request failed with status code 500');
    expect(catalogErrorMessage({})).toBe('Please try again.');
    expect(catalogErrorMessage(null)).toBe('Please try again.');
  });
});

describe('derived lists (§E1.3)', () => {
  it('files missing muscles under "Other" while the card says "Exercise" (⚠E-7)', () => {
    expect(groupKey(ex(1))).toBe('Other');
    expect(cardMuscleLabel(ex(1))).toBe('Exercise');
    expect(groupKey(ex(1, 'Chest'))).toBe('Chest');
    expect(cardMuscleLabel(ex(1, 'Chest'))).toBe('Chest');
  });

  it('sorts categories by code unit and groups by localeCompare (⚠E-9)', () => {
    const items = [ex(1, 'back'), ex(2, 'Chest'), ex(3, 'Back'), ex(4, 'back'), ex(5)];
    const catalog = deriveCatalog(items, '');
    expect(catalog.categories).toEqual(['Back', 'Chest', 'Other', 'back']);
    expect(catalog.categoryCounts).toEqual({ back: 2, Chest: 1, Back: 1, Other: 1 });
    expect(catalog.groups.map((group) => group.key)).toEqual(['back', 'Back', 'Chest', 'Other']);
    expect(catalog.groups[0].exercises.map((item) => item.id)).toEqual([1, 4]);
  });

  it('filters by the group key, and a missing filter gives no groups (⚠E-6)', () => {
    const items = [ex(1, 'Chest'), ex(2, 'Legs'), ex(3, 'Chest')];
    expect(deriveCatalog(items, 'Chest').groups).toEqual([{ key: 'Chest', exercises: [items[0], items[2]] }]);
    const blank = deriveCatalog(items, 'Arms');
    expect(blank.groups).toEqual([]);
    expect(blank.categories).toEqual(['Chest', 'Legs']);
    expect(countFor(blank.categoryCounts, 'Arms')).toBe(0);
    expect(countFor(blank.categoryCounts, 'Chest')).toBe(2);
    expect(countFor(blank.categoryCounts, 'constructor')).toBe(0);
  });
});

describe('grid (§E1.4)', () => {
  it('uses 2 / 3 / 4 columns by window width', () => {
    expect(gridColumns(390)).toBe(2);
    expect(gridColumns(639)).toBe(2);
    expect(gridColumns(640)).toBe(3);
    expect(gridColumns(1023)).toBe(3);
    expect(gridColumns(1024)).toBe(4);
  });

  it('flattens groups into headers and rows of cards', () => {
    const rows = gridRows(
      [
        { key: 'Back', exercises: [ex(1), ex(2), ex(3)] },
        { key: 'Chest', exercises: [ex(4)] },
      ],
      2
    );
    expect(rows.map((row) => [row.type, row.first ?? row.firstInGroup, row.count ?? row.cards.map((c) => c.id)])).toEqual([
      ['group', true, 3],
      ['row', true, [1, 2]],
      ['row', false, [3]],
      ['group', false, 1],
      ['row', true, [4]],
    ]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });
});

describe('search submit and back stack (⚠E-5, ⚠E-10)', () => {
  it('trims, and a same-value submit returns the same state (no reload)', () => {
    const first = submitSearch(INITIAL_SEARCH, '  squat ');
    expect(first).toEqual({ applied: 'squat', history: [''] });
    expect(submitSearch(first, 'squat  ')).toBe(first);
    expect(submitSearch(INITIAL_SEARCH, '   ')).toBe(INITIAL_SEARCH);
  });

  it('pops applied searches in reverse, then lets back through', () => {
    let state = submitSearch(INITIAL_SEARCH, 'squat');
    state = submitSearch(state, 'press');
    state = submitSearch(state, '');
    expect(state).toEqual({ applied: '', history: ['', 'squat', 'press'] });
    state = popSearch(state);
    expect(state).toEqual({ applied: 'press', history: ['', 'squat'] });
    state = popSearch(state);
    state = popSearch(state);
    expect(state).toEqual({ applied: '', history: [] });
    expect(popSearch(state)).toBeNull();
  });
});

describe('card thumbnails (F4)', () => {
  it('tries the w400 Drive thumbnail first, then the usual chain', () => {
    const sources = cardThumbnailSources('https://drive.google.com/file/d/abc123/view?usp=sharing');
    expect(sources[0]).toBe('https://drive.google.com/thumbnail?id=abc123&sz=w400');
    expect(sources[1]).toBe('https://drive.google.com/file/d/abc123/view?usp=sharing');
    expect(sources).toContain('https://drive.google.com/thumbnail?id=abc123&sz=w1600');
  });

  it('leaves non-Drive URLs unchanged', () => {
    expect(cardThumbnailSources('https://cdn.example.com/a.png')).toEqual(['https://cdn.example.com/a.png']);
    expect(cardThumbnailSources(null)).toEqual([]);
  });
});

describe('grid beside the T-62 filter panel (≥ 1024)', () => {
  it('2 columns at 1024–1279, 3 at ≥ 1280; no panel keeps 2 / 3 / 4', () => {
    const { gridColumns: columnsFor } = require('./exercisesCatalog');
    expect(columnsFor(1194, { panel: true })).toBe(2);
    expect(columnsFor(1279, { panel: true })).toBe(2);
    expect(columnsFor(1280, { panel: true })).toBe(3);
    expect(columnsFor(1366, { panel: true })).toBe(3);
    expect(columnsFor(1194)).toBe(4);
  });
});
