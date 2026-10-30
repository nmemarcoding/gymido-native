import { AuthStatus, useAuthStore } from '../auth/authStore';

// RN-SPEC-exercises §E1.1a (T-12 F3, 25 Oct 2026): the complete list per
// applied search ('' = none), in memory for the app session. Only a list
// with every page loaded is stored, never page 1 alone. At most the last 10
// searches (LRU: a read or a store makes a search the newest). A Map keeps
// insertion order, so the first key is the least recently used.
export const MAX_CACHED_SEARCHES = 10;
// T-42 (dated 29 Oct 2026, web 2.1.9): arriving at the list within 5 minutes
// of saving it sends no request; freshness counts from the save.
export const FRESH_MS = 5 * 60 * 1000;
// search → { items, savedAt }.
const lists = new Map();
// T-42: GET /equipment-types and /muscle-groups, same freshness.
const lookups = new Map();

// No search is stored as ''.
const keyOf = (search) => search ?? '';

export function getCachedList(search) {
  const key = keyOf(search);
  if (!lists.has(key)) {
    return null;
  }
  const entry = lists.get(key);
  lists.delete(key);
  lists.set(key, entry);
  return entry.items;
}

export function isCachedListFresh(search, now = Date.now()) {
  const entry = lists.get(keyOf(search));
  return Boolean(entry) && now - entry.savedAt < FRESH_MS;
}

export function setCachedList(search, items, now = Date.now()) {
  const key = keyOf(search);
  lists.delete(key);
  lists.set(key, { items, savedAt: now });
  if (lists.size > MAX_CACHED_SEARCHES) {
    lists.delete(lists.keys().next().value);
  }
}

// A lookup saved less than FRESH_MS ago, else null.
export function getFreshLookup(name, now = Date.now()) {
  const entry = lookups.get(name);
  return entry && now - entry.savedAt < FRESH_MS ? entry.value : null;
}

export function setCachedLookup(name, value, now = Date.now()) {
  lookups.set(name, { value, savedAt: now });
}

export function clearExerciseListCache() {
  lists.clear();
  lookups.clear();
}

// The web drops it with the page on logout; native clears it itself on any
// sign-out or sign-in, so an account switch never sees the last one's list.
useAuthStore.subscribe((state, previous) => {
  if ((previous.status === AuthStatus.signedIn) !== (state.status === AuthStatus.signedIn)) {
    clearExerciseListCache();
  }
});
