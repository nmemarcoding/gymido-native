// Logic of the Exercises screen (RN-SPEC-exercises §E1–§E2). Pure, so Jest
// can cover it without rendering.

import { getRemoteImageSources } from '../../shared/images/remoteImageSources';

export const OTHER_GROUP = 'Other';
export const PER_PAGE = 100;

// §E1.2: `data.items` (not an array → []) and `pagination.total_pages`
// (missing, 0 or NaN → 1).
export function pageItems(data) {
  return Array.isArray(data?.items) ? data.items : [];
}

export function pageCount(data) {
  return Number(data?.pagination?.total_pages ?? 1) || 1;
}

// §E1.2: pages 2…N in parallel, joined in page order; any failure rejects.
export async function loadRestPages({ fetchPage, search = '', totalPages }) {
  const pages = [];
  for (let page = 2; page <= totalPages; page += 1) {
    pages.push(fetchPage(page, search));
  }
  const rest = await Promise.all(pages);
  return [].concat(...rest.map(pageItems));
}

// §E1.2 as changed by F1 (23 Oct 2026): page 1 first, handed to
// `onFirstPage` so it shows at once; then pages 2…N. A page-1 failure
// rejects. Step 4 (T-16, 25 Oct 2026): a failure on pages 2…N keeps page 1
// and resolves with `partial` ({ firstItems, totalPages, error, search })
// for a Retry of those pages only, for that search.
export async function loadExerciseCatalog({ fetchPage, search = '', onFirstPage }) {
  const first = await fetchPage(1, search);
  const firstItems = pageItems(first);
  const totalPages = pageCount(first);
  if (totalPages <= 1) {
    return { items: firstItems, partial: null };
  }
  onFirstPage?.(firstItems);
  try {
    const rest = await loadRestPages({ fetchPage, search, totalPages });
    return { items: firstItems.concat(rest), partial: null };
  } catch (error) {
    return { items: firstItems, partial: { firstItems, totalPages, error, search } };
  }
}

// §E1.3: the group key falls back to "Other", the card label to "Exercise"
// (⚠E-7).
export function groupKey(exercise) {
  return exercise?.primary_muscle_group?.name || OTHER_GROUP;
}

export function cardMuscleLabel(exercise) {
  return exercise?.primary_muscle_group?.name || 'Exercise';
}

// §E1.3: categories use the default sort (UTF-16), groups `localeCompare`
// (⚠E-9); inside a group the server order is kept. A filter missing from
// `items` gives no groups (⚠E-6).
export function deriveCatalog(items, categoryFilter = '') {
  const list = Array.isArray(items) ? items : [];
  const counts = new Map();
  for (const exercise of list) {
    const key = groupKey(exercise);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const categories = [...counts.keys()].sort();
  const categoryCounts = Object.fromEntries(counts);
  const filtered = categoryFilter ? list.filter((exercise) => groupKey(exercise) === categoryFilter) : list;
  const grouped = new Map();
  for (const exercise of filtered) {
    const key = groupKey(exercise);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(exercise);
  }
  const groups = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, exercises]) => ({ key, exercises }));
  return { categories, categoryCounts, filtered, groups };
}

// `categoryCounts[cat] || 0` (the retired §E2 sheet's counts).
export function countFor(categoryCounts, category) {
  return (Object.prototype.hasOwnProperty.call(categoryCounts ?? {}, category) && categoryCounts[category]) || 0;
}

// §E1.4 grid: 2 columns on phones, 3 at ≥ 640, 4 at ≥ 1024 (window width).
// T-62: beside the ≥ 1024 filter panel, 2 at 1024–1279 and 3 at ≥ 1280.
export function gridColumns(width, { panel = false } = {}) {
  if (panel) {
    return width >= 1280 ? 3 : 2;
  }
  if (width >= 1024) {
    return 4;
  }
  return width >= 640 ? 3 : 2;
}

// Flattens the groups into list rows for a virtualised list: a header per
// group, then rows of `columns` cards.
export function gridRows(groups, columns) {
  const rows = [];
  groups.forEach((group, groupIndex) => {
    rows.push({ type: 'group', key: `group:${group.key}`, title: group.key, count: group.exercises.length, first: groupIndex === 0 });
    for (let start = 0; start < group.exercises.length; start += columns) {
      rows.push({
        type: 'row',
        key: `row:${group.key}:${start}`,
        cards: group.exercises.slice(start, start + columns),
        firstInGroup: start === 0,
      });
    }
  });
  return rows;
}

// v2 Phase 3 ND-3: the grid AS DRAWN, flat (no group headers); the v1 order
// is kept (groups by localeCompare, the server order inside each group).
export function flatGridRows(groups, columns) {
  const cards = groups.flatMap((group) => group.exercises);
  const rows = [];
  for (let start = 0; start < cards.length; start += columns) {
    rows.push({ type: 'row', key: `row:${start}`, cards: cards.slice(start, start + columns), firstInGroup: start === 0 });
  }
  return rows;
}

// §E1.4 search submit (⚠E-5) and ⚠E-10's per-focus stack of applied
// searches. An unchanged search returns the same state object (no reload).
export const INITIAL_SEARCH = Object.freeze({ applied: '', history: Object.freeze([]) });

export function submitSearch(state, text) {
  const next = String(text ?? '').trim();
  if (next === state.applied) {
    return state;
  }
  return { applied: next, history: [...state.history, state.applied] };
}

// Android back: restore the previous applied search; null when the stack is
// empty (back then behaves normally).
export function popSearch(state) {
  if (!state.history.length) {
    return null;
  }
  return { applied: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
}

// F4: a grid card tries Drive's w400 thumbnail first, then the shared chain
// (27 Oct dated chain). Non-Drive URLs are unchanged.
export function cardThumbnailSources(url) {
  return getRemoteImageSources(url, { width: 400 });
}

// §E1.2 step 4: the transport error text, else "Please try again." (no
// server message, no retry: ⚠E-4).
export function catalogErrorMessage(error) {
  return (typeof error?.message === 'string' && error.message) || 'Please try again.';
}
