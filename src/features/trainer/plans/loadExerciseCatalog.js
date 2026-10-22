import { listExercisesPage } from './api/plansApi';

// Spec §A7.1: page through /exercises 100 at a time. Any failure stops the
// loop and keeps what was gathered so far, with no error shown (⚠T5-1).
export async function loadExerciseCatalog(fetchPage = listExercisesPage) {
  const catalog = [];
  for (let page = 1; ; page += 1) {
    let result;
    try {
      result = await fetchPage(page);
    } catch {
      return catalog;
    }
    catalog.push(...result.items);
    const lastPage = result.totalPages ? page >= result.totalPages : result.items.length < 100;
    if (lastPage) {
      return catalog;
    }
  }
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
