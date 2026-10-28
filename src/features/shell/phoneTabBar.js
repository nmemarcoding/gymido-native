import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { createContext, useContext, useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { usesRail } from '../../shared/hooks/useLayoutClass';
import { getScreenPath } from './shellNavigation';
import { showsPhoneTabBar } from './shellRules';

// T-65 (PHONE-NAV spec §1 / §4): ONE rule for "is the phone tab bar on this
// page". ShellOverlay draws the bar from it; ShellPage, PinnedDock and the
// toasts derive their bottom room from the same rule, so they can't disagree.
// Read through the contexts (not useRoute / useIsFocused, which throw outside
// a navigator): a component rendered outside a screen gets null / focused.
// The fallbacks stand in where a test mocks '@react-navigation/native' away.
const NO_CONTEXT = createContext(undefined);
const RouteContext = NavigationRouteContext ?? NO_CONTEXT;
const ScreenNavigationContext = NavigationContext ?? NO_CONTEXT;

// The web path of the screen this component renders in; null outside a navigator.
export function useRoutePath() {
  const route = useContext(RouteContext);
  return route ? getScreenPath(route.name, route.params) : null;
}

// Phones (< 768) only, on the allowlisted main pages. `path` (optional) wins
// over the route's own; with neither (outside a navigator) the old phone rule
// stands: the bar is assumed, so nothing can end under it.
export function usePhoneTabBar(path) {
  const { width } = useWindowDimensions();
  const routePath = useRoutePath();
  const resolved = path ?? routePath;
  if (usesRail(width)) {
    return false;
  }
  return resolved === null ? true : showsPhoneTabBar(resolved);
}

// Whether this component's screen is the focused one (true outside a navigator).
export function useScreenFocused() {
  const navigation = useContext(ScreenNavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused?.() ?? true);
  useEffect(() => {
    if (!navigation?.addListener) {
      return undefined;
    }
    // The first value comes from the initial state; the events keep it current.
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  return focused;
}
