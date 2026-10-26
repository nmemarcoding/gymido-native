import { CommonActions } from '@react-navigation/native';

import { navigationRef } from '../../navigation/navigationRef';
import { routes } from '../../navigation/routes';
import { SCREEN_FOR_PATH, ShellTab, TAB_ROOTS, getScreenTab } from './shellNavigation';

let entryCount = 0;

// Opens a shell screen by its web path. A tab root pops that tab's stack back
// to it, so a tab press always lands on a fresh root (app-shell spec §6.3).
// A pushed screen (Workout, the trainer hub) switches to its own tab and sits
// on that tab's root, never on another stack (5-tab nav, 23 Oct): opened from
// Plans, Workout still shows as Today = [Home, Workout], so Back → Home.
export function openShellPath(path, params) {
  if (!navigationRef.isReady()) {
    return;
  }
  const screen = SCREEN_FOR_PATH[path];
  // App-shell §3.1: anything else → /404 (replace).
  if (!screen) {
    navigationRef.navigate(routes.NotFound);
    return;
  }
  const tab = getScreenTab(screen);
  const root = TAB_ROOTS[tab];
  // A new `entry` on every tab press or link to a tab root, so the root can
  // tell a fresh entry from a pop back to it (exercises §E1.1a, T-12 F3).
  entryCount += 1;
  const nested = screen === root ? { screen: root, params: { ...params, entry: entryCount } } : { screen, params, initial: false };
  navigationRef.navigate(routes.AppShell, { screen: tab, params: nested });
}

// The start/activate/accept hand-off (S2 §4.8, M3, G2; 5-tab nav): drop the
// current screen from its stack (the web `replace`), then show Workout in the
// Today stack with the message. When it was the stack's only screen (S2
// opened alone from Home), the stack falls back to its tab root: a reset to
// no routes is rejected by the router and would leave the screen in place.
export function handOffToWorkout(navigation, route, message) {
  const state = navigation.getState();
  const remaining = state.routes.filter((item) => item.key !== route.key);
  openShellPath('/workout', { message });
  const reset = remaining.length
    ? CommonActions.reset({ ...state, routes: remaining, index: remaining.length - 1 })
    : CommonActions.reset({ index: 0, routes: [{ name: TAB_ROOTS[getScreenTab(route.name)] }] });
  navigation.dispatch({ ...reset, target: state.key });
}

// Home's "View plan" (RN-SPEC-home §H1.3): the Plans tab with its stack set to
// [S2] alone. Navigating into an unmounted stack already gives [S2]; into a
// mounted one it pushes, so trim that stack back to S2.
export function openPlanDetailAlone(planId) {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate(routes.AppShell, {
    screen: ShellTab.Plans,
    params: { screen: routes.PlanDetail, params: { planId: String(planId) } },
  });
  const shell = navigationRef.getRootState()?.routes?.find((route) => route.name === routes.AppShell);
  const plans = shell?.state?.routes?.find((route) => route.name === ShellTab.Plans)?.state;
  if (plans?.key && plans.routes.length > 1) {
    const top = plans.routes[plans.routes.length - 1];
    navigationRef.dispatch({
      ...CommonActions.reset({ index: 0, routes: [{ key: top.key, name: top.name, params: top.params }] }),
      target: plans.key,
    });
  }
}
