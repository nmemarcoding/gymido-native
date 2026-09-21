import { CommonActions } from '@react-navigation/native';

import { routes } from '../routes';

let resetCounter = 0;

// The web's Library tab always links to /plans, so pressing it, from any tab or
// while already on it, lands on a single fresh S1 (RN-SPEC-plans §9).
// `tabNavigation` is the tab navigator. Actions only bubble up, so the Library
// stack is replaced through the tab state (a new S1 key forces a fresh mount),
// then the tab is focused, which records the tab-history entry. The stack is
// replaced first so its old top screen never refocuses (and reloads).
export function openLibraryRoot(tabNavigation) {
  const tabState = tabNavigation.getState();
  const libraryRoute = tabState.routes.find((route) => route.name === routes.LibraryTab);
  if (libraryRoute?.state) {
    resetCounter += 1;
    tabNavigation.dispatch({
      ...CommonActions.reset({
        ...tabState,
        routes: tabState.routes.map((route) =>
          route.key === libraryRoute.key
            ? {
                ...route,
                state: {
                  index: 0,
                  routes: [{ name: routes.PlansList, key: `${routes.PlansList}-reset-${resetCounter}` }],
                },
              }
            : route
        ),
      }),
      target: tabState.key,
    });
  }
  tabNavigation.navigate(routes.LibraryTab);
}

// The web navigates to /workout with `replace: true` after an activation
// (RN-SPEC-plans §4.8). Switch to Workout first so nothing in the Library stack
// refocuses, then drop this screen from the stack.
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
