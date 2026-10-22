import { navigationRef } from '../../navigation/navigationRef';
import { routes } from '../../navigation/routes';
import { TAB_FOR_PATH, TAB_ROOTS } from './shellNavigation';

// Opens a shell tab by its web path. Navigating to a stack's root screen pops
// that stack back to it, so a tab press always lands on a fresh root
// (app-shell spec §6.3).
export function openShellPath(path) {
  const tab = TAB_FOR_PATH[path];
  if (!tab || !navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate(routes.AppShell, { screen: tab, params: { screen: TAB_ROOTS[tab] } });
}
