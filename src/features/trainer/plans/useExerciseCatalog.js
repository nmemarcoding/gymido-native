import { useCallback, useEffect, useRef, useState } from 'react';

import { listExercisesPage } from './api/plansApi';

// v2 Phase 2 §D4 (APPROVED, PM): the builder's exercise picker shows
// "Exercise catalog unavailable" + Retry when the catalog load fails, for the
// member AND trainer builders. v1's loadExerciseCatalog (⚠T5-1) swallows the
// failure; this loader pages the same way (100 a page, same stop rule) but
// reports it, keeping whatever was gathered before the failing page.
export const CATALOG_ERROR_FALLBACK = 'Unable to load exercise catalog.';

// The request's message (API `message`, else the transport text), else the fallback.
export function catalogErrorMessage(error) {
  const data = error?.response?.data;
  if (typeof data?.message === 'string' && data.message.trim().length > 0) {
    return data.message;
  }
  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }
  return CATALOG_ERROR_FALLBACK;
}

export async function fetchExerciseCatalog(fetchPage = listExercisesPage) {
  const items = [];
  for (let page = 1; ; page += 1) {
    let result;
    try {
      result = await fetchPage(page);
    } catch (error) {
      return { items, error: catalogErrorMessage(error) };
    }
    items.push(...result.items);
    const lastPage = result.totalPages ? page >= result.totalPages : result.items.length < 100;
    if (lastPage) {
      return { items, error: null };
    }
  }
}

// Lifecycle pairing (§D4 invariant): `error` is set exactly while the LAST
// request failed and none is in flight; any new request (`retry`, or a new
// mount when the builder reopens) clears it until that request settles. The
// list gathered so far stays during a retry (the picker shows its loading
// line above it).
export function useExerciseCatalog(fetchPage = listExercisesPage) {
  const [state, setState] = useState({ catalog: [], loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    fetchExerciseCatalog(fetchRef.current).then(({ items, error }) => {
      if (alive) {
        setState({ catalog: items, loading: false, error });
      }
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
