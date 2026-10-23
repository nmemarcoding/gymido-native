import { CommonActions } from '@react-navigation/native';

import { navigationRef } from '../../navigation/navigationRef';
import { routes } from '../../navigation/routes';
import { SCREEN_FOR_PATH, ShellTab, TAB_ROOTS, getScreenTab } from './shellNavigation';

// Opens a shell screen by its web path. A tab root pops that tab's stack back
// to it, so a tab press always lands on a fresh root (app-shell spec §6.3).
// A pushed screen (Workout, the trainer hub) switches to its own tab and sits
// on that tab's root, never on another stack (5-tab nav, 23 Oct): opened from
// Plans, Workout still shows as Today = [Home, Workout], so Back → Home.
export function openShellPath(path, params) {
  const screen = SCREEN_FOR_PATH[path];
  if (!screen || !navigationRef.isReady()) {
    return;
  }
  const tab = getScreenTab(screen);
  const root = TAB_ROOTS[tab];
  const nested = screen === root ? { screen: root, params } : { screen, params, initial: false };
  navigationRef.navigate(routes.AppShell, { screen: tab, params: nested });
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
