import { navigationRef } from '../../navigation/navigationRef';
import { routes } from '../../navigation/routes';
import { SCREEN_FOR_PATH, TAB_ROOTS, getScreenTab } from './shellNavigation';

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
