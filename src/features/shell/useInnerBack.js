import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';

import { SCREEN_FOR_PATH } from './shellNavigation';

// T-65 (PHONE-NAV spec §3 / §5): the inner page's back pill. Back in history
// when there is an in-app previous entry (the stack, else the tab history);
// otherwise the parent page `path`, REPLACING this screen (a deep link or a
// stack with nothing under it never gains an entry that loops back here).
// The parent is replaced in place when it lives in this stack, else opened
// by its path (another tab's root).
export function backOrReplace(navigation, path) {
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  const screen = SCREEN_FOR_PATH?.[path];
  const stack = navigation?.getState?.();
  if (screen && stack?.routeNames?.includes(screen)) {
    navigation.replace(screen);
    return;
  }
  // Loaded on use: shellLinks holds the app's navigation container ref, which
  // inner pages need only on this path (another tab's root).
  require('./shellLinks').openShellPath(path);
}

// T-65 (PHONE-NAV spec §3): the one back control of an inner page. Returns
// the pill's onPress (backOrReplace to `path`, the §3 target) and makes the
// Android hardware / gesture back do the same while this screen is focused:
// with a previous entry the default pop already is the pill's goBack, so it
// is left alone; with none (where Android would close the app) it replaces
// to the parent like the pill. `path` null = no back control (no handler).
export function useInnerBack(navigation, path) {
  const goBack = useCallback(() => backOrReplace(navigation, path), [navigation, path]);
  useEffect(() => {
    if (!path) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.isFocused && !navigation.isFocused()) {
        return false;
      }
      if (navigation?.canGoBack?.()) {
        return false;
      }
      backOrReplace(navigation, path);
      return true;
    });
    return () => subscription.remove();
  }, [navigation, path]);
  return goBack;
}
