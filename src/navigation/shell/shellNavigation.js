import { CommonActions } from '@react-navigation/native';

import { routes } from '../routes';

let resetCounter = 0;

// Walks up from any screen to the app-shell tab navigator.
export function findTabNavigation(navigation) {
  let current = navigation;
  while (current) {
    if (current.getState?.()?.routeNames?.includes(routes.HomeTab)) {
      return current;
    }
    current = current.getParent?.();
  }
  return null;
}

// Tab press (RN-SPEC-app-shell §6.3): go to the tab's path as a fresh screen.
// A tab that holds a stack is reset to its root with a new key (forcing a
// fresh mount) before it's focused. Actions only bubble up, so the reset goes
// through the tab state; the stack is replaced first so its old top screen
// never refocuses (and reloads) on the way out. Focusing records tab history.
export function openTab(tabNavigation, tabName) {
  const tabState = tabNavigation.getState();
  const tabRoute = tabState.routes.find((route) => route.name === tabName);
  const stackRoot = tabRoute?.state?.routeNames?.[0] ?? tabRoute?.state?.routes?.[0]?.name;
  if (tabRoute?.state && stackRoot) {
    resetCounter += 1;
    tabNavigation.dispatch({
      ...CommonActions.reset({
        ...tabState,
        routes: tabState.routes.map((route) =>
          route.key === tabRoute.key
            ? { ...route, state: { index: 0, routes: [{ name: stackRoot, key: `${stackRoot}-reset-${resetCounter}` }] } }
            : route
        ),
      }),
      target: tabState.key,
    });
  }
  tabNavigation.navigate(tabName);
}

// Kept for the Library-specific callers.
export function openLibraryRoot(tabNavigation) {
  openTab(tabNavigation, routes.LibraryTab);
}

// Web `navigate(path, { replace: true })` between shell routes: go to the
// target tab, then drop the current tab from the tab history so Back skips it.
export function replaceTab(tabNavigation, fromTabName, toTabName, params) {
  tabNavigation.navigate(toTabName, params);
  const state = tabNavigation.getState();
  const fromKey = state.routes.find((route) => route.name === fromTabName)?.key;
  if (!fromKey || !Array.isArray(state.history)) {
    return;
  }
  const history = state.history.filter((entry) => entry.key !== fromKey);
  if (history.length !== state.history.length) {
    tabNavigation.dispatch({ ...CommonActions.reset({ ...state, history }), target: state.key });
  }
}

// The web activation hand-off (RN-SPEC-plans §4.8): replace S2 with /workout.
// Switch to Workout first so nothing in the Library stack refocuses, then drop
// this screen from the stack.
export function replaceWithWorkout(stackNavigation, currentRouteKey, message) {
  const state = stackNavigation.getState();
  stackNavigation.navigate(routes.WorkoutTab, { message });
  const remaining = state.routes.filter((route) => route.key !== currentRouteKey);
  stackNavigation.dispatch({
    ...CommonActions.reset({
      index: Math.max(remaining.length - 1, 0),
      routes: remaining.length ? remaining : [{ name: routes.PlansList }],
    }),
    target: state.key,
  });
}
