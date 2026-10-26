import { AuthStatus, useAuthStore } from '../auth/authStore';

// RN-SPEC-exercises §E1.1a (T-12 F3, 25 Oct 2026): the complete list per
// applied search ('' = none), in memory for the app session. Only a list
// with every page loaded is stored, never page 1 alone.
const lists = new Map();

export function getCachedList(search) {
  return lists.get(search) ?? null;
}

export function setCachedList(search, items) {
  lists.set(search, items);
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
