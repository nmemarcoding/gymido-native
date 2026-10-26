import { AuthStatus, useAuthStore } from '../auth/authStore';

// RN-SPEC-exercises §E1.1a (T-12 F3, 25 Oct 2026): the complete list per
// applied search ('' = none), in memory for the app session. Only a list
// with every page loaded is stored, never page 1 alone. At most the last 10
// searches (LRU: a read or a store makes a search the newest). A Map keeps
// insertion order, so the first key is the least recently used.
export const MAX_CACHED_SEARCHES = 10;
const lists = new Map();

export function getCachedList(search) {
  if (!lists.has(search)) {
    return null;
  }
  const items = lists.get(search);
  lists.delete(search);
  lists.set(search, items);
  return items;
}

export function setCachedList(search, items) {
  lists.delete(search);
  lists.set(search, items);
  if (lists.size > MAX_CACHED_SEARCHES) {
    lists.delete(lists.keys().next().value);
  }
}

export function clearExerciseListCache() {
  lists.clear();
}

// The web drops it with the page on logout; native clears it itself on any
// sign-out or sign-in, so an account switch never sees the last one's list.
useAuthStore.subscribe((state, previous) => {
  if ((previous.status === AuthStatus.signedIn) !== (state.status === AuthStatus.signedIn)) {
    clearExerciseListCache();
  }
});
