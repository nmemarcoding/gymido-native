import { act, create } from 'react-test-renderer';

import { CATALOG_ERROR_FALLBACK, catalogErrorMessage, fetchExerciseCatalog, useExerciseCatalog } from './useExerciseCatalog';

jest.mock('./api/plansApi', () => ({ listExercisesPage: jest.fn() }));

const page = (ids, totalPages) => ({ items: ids.map((id) => ({ id })), totalPages });

describe('catalogErrorMessage', () => {
  it('uses the API message, then the transport text, then the fallback', () => {
    expect(catalogErrorMessage({ response: { data: { message: 'Nope' } }, message: 'x' })).toBe('Nope');
    expect(catalogErrorMessage(new Error('Network Error'))).toBe('Network Error');
    expect(catalogErrorMessage(null)).toBe(CATALOG_ERROR_FALLBACK);
    expect(CATALOG_ERROR_FALLBACK).toBe('Unable to load exercise catalog.');
  });
});

describe('fetchExerciseCatalog', () => {
  it('pages to the last page', async () => {
    const fetchPage = jest.fn((n) => Promise.resolve(page([n], 2)));
    await expect(fetchExerciseCatalog(fetchPage)).resolves.toEqual({ items: [{ id: 1 }, { id: 2 }], error: null });
  });

  it('stops on a short page when there is no total', async () => {
    const fetchPage = jest.fn(() => Promise.resolve(page([1])));
    await expect(fetchExerciseCatalog(fetchPage)).resolves.toEqual({ items: [{ id: 1 }], error: null });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('reports a failure and keeps what was gathered', async () => {
    const fetchPage = jest.fn((n) => (n === 1 ? Promise.resolve(page([1], 3)) : Promise.reject(new Error('Boom'))));
    await expect(fetchExerciseCatalog(fetchPage)).resolves.toEqual({ items: [{ id: 1 }], error: 'Boom' });
  });
});

describe('useExerciseCatalog (§D4 lifecycle)', () => {
  let result;
  function Probe({ fetchPage }) {
    result = useExerciseCatalog(fetchPage);
    return null;
  }

  it('loading → error; retry clears the error while in flight; success shows the list', async () => {
    let fail = true;
    let release;
    const fetchPage = jest.fn(() =>
      fail ? Promise.reject(new Error('Down')) : new Promise((resolve) => { release = () => resolve(page([1, 2], 1)); })
    );
    let tree;
    await act(async () => {
      tree = create(<Probe fetchPage={fetchPage} />);
    });
    expect(result).toMatchObject({ loading: false, error: 'Down', catalog: [] });

    fail = false;
    act(() => result.retry());
    expect(result).toMatchObject({ loading: true, error: null });
    await act(async () => release());
    expect(result).toMatchObject({ loading: false, error: null, catalog: [{ id: 1 }, { id: 2 }] });
    act(() => tree.unmount());
  });

  it('fails again → the error again', async () => {
    const fetchPage = jest.fn(() => Promise.reject(new Error('Down')));
    let tree;
    await act(async () => {
      tree = create(<Probe fetchPage={fetchPage} />);
    });
    await act(async () => result.retry());
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ loading: false, error: 'Down' });
    act(() => tree.unmount());
  });
});
