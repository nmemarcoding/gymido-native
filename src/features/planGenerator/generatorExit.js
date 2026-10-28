import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { routes } from '../../navigation/routes';
import { generatorRoutes } from './generatorRoutes';

// G1 (final pass 5f53f3d, PM 28 Oct 2026): the preview's "Back to your
// answers" pushes a FRESH questionnaire (review M1) ABOVE the preview, so a
// plain back from it lands on the preview again, whose back opens another
// questionnaire: on phone (no tab bar) the two loop with no exit. Such a
// questionnaire's exits leave the generator instead: the Plans stack is RESET
// to Plans alone, so back from Plans never returns to the generator.

// The routes under the focused one in this stack (none without a state).
function routesBelow(navigation) {
  const state = navigation?.getState?.();
  const list = state?.routes ?? [];
  const index = typeof state?.index === 'number' ? state.index : list.length - 1;
  return list.slice(0, Math.max(index, 0));
}

const hasPreview = (list) => list.some((route) => route.name === generatorRoutes.PlanGeneratorPreview);

// A questionnaire opened from a preview (anywhere below it).
export function sitsAbovePreview(navigation) {
  return hasPreview(routesBelow(navigation));
}

// The preview's top back leaves too (UX, 28 Oct) when there is no screen
// below, or the questionnaire below sits above an earlier preview (back there
// would loop); otherwise it stays "Back to your answers" (a push).
export function previewBackLeaves(navigation) {
  if (navigation?.canGoBack?.() === false) {
    return true;
  }
  const state = navigation?.getState?.();
  const below = routesBelow(navigation);
  if (state && below.length === 0) {
    return true;
  }
  const under = below[below.length - 1];
  return under?.name === generatorRoutes.PlanGenerator && hasPreview(below.slice(0, -1));
}

export function leaveToPlans(navigation) {
  navigation.reset({ index: 0, routes: [{ name: routes.PlansLibrary }] });
}

// While `active`, the Android hardware / gesture back leaves the same way
// (only while this screen is focused).
export function useLeaveOnBack(navigation, active) {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.isFocused && !navigation.isFocused()) {
        return false;
      }
      leaveToPlans(navigation);
      return true;
    });
    return () => subscription.remove();
  }, [navigation, active]);
}
