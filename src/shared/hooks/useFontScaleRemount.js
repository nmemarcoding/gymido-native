import { useEffect, useState } from 'react';
import { Keyboard, Platform, TextInput, useWindowDimensions } from 'react-native';

// QA T59-CRASH (ad2ba83): the new fontScale reaches JS before RN re-applies
// the font multiplier to the surface (its next layout pass). Remounting at
// once built the new tree at the OLD multiplier (a title stayed cut, T59-N1)
// and could tear down a focused input mid-update (Fabric: "Unable to find
// viewState for tag"). So: blur + dismiss the keyboard first, then remount
// once that layout pass has run.
export const REMOUNT_DELAY_MS = 250;

// T-59 (QA BUG-N3): with fontScale in MainActivity's configChanges
// (plugins/withFontScaleConfigChange.js) Android keeps the activity on a
// system font-size change, but React Native 0.86 only commits the new font
// multiplier: no text node is marked dirty, so mounted screens keep their
// old measured boxes and the larger text clips. A new key remounts the
// navigation tree at the new scale, and the root state read just before
// seeds it, so the user stays on the same screen (a half-typed form resets).
export function useFontScaleRemount(navigationRef, os = Platform.OS) {
  const { fontScale } = useWindowDimensions();
  const [mounted, setMounted] = useState({ fontScale, initialState: undefined });

  useEffect(() => {
    if (os !== 'android' || fontScale === mounted.fontScale) {
      return undefined;
    }
    TextInput.State.currentlyFocusedInput?.()?.blur?.();
    Keyboard.dismiss();
    // The route is read when the remount runs, so a change undone within the
    // delay never remounts (this effect re-runs and clears the timer).
    const timer = setTimeout(() => {
      const initialState = navigationRef.isReady() ? seedState(navigationRef.getRootState()) : undefined;
      setMounted({ fontScale, initialState });
    }, REMOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [fontScale, mounted.fontScale, navigationRef, os]);

  return { key: `font-scale-${mounted.fontScale}`, initialState: mounted.initialState };
}

// The params React Navigation reads as "open this nested screen".
const NESTED_NAVIGATION_PARAMS = ['screen', 'params', 'initial', 'state', 'path', 'merge', 'pop'];

// A navigator that already has its own state would replay the link that first
// opened it (a landing, a cross-tab path) on remount and reset its stack: the
// new container has not marked it consumed. So its route sets those params to
// undefined; deleting them is not enough, because rehydration merges the
// screen's initialParams (RootNavigator's landing) back in underneath.
// Unopened tabs keep theirs for the first visit.
const CLEARED_NESTED_PARAMS = Object.fromEntries(NESTED_NAVIGATION_PARAMS.map((key) => [key, undefined]));

export function seedState(state) {
  return {
    ...state,
    routes: state.routes.map((route) => {
      if (!route.state) {
        return route;
      }
      return {
        ...route,
        params: { ...route.params, ...CLEARED_NESTED_PARAMS },
        state: seedState(route.state),
      };
    }),
  };
}
