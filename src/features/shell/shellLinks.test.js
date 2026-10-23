import { CommonActions } from '@react-navigation/native';

import { navigationRef } from '../../navigation/navigationRef';
import { routes } from '../../navigation/routes';
import { handOffToWorkout } from './shellLinks';
import { ShellTab } from './shellNavigation';

jest.mock('../../navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true, navigate: jest.fn() },
}));

function stack(routeList) {
  return {
    getState: () => ({ key: 'plans-stack', index: routeList.length - 1, routes: routeList, stale: false }),
    dispatch: jest.fn(),
  };
}

describe('handOffToWorkout', () => {
  it('drops the current screen from its stack and opens Workout with the message', () => {
    const navigation = stack([
      { key: 'lib', name: routes.PlansLibrary },
      { key: 's2', name: routes.PlanDetail },
    ]);
    handOffToWorkout(navigation, { key: 's2', name: routes.PlanDetail }, 'Strength activated.');
    expect(navigationRef.navigate).toHaveBeenCalledWith(routes.AppShell, expect.objectContaining({ screen: ShellTab.Today }));
    const action = navigation.dispatch.mock.calls[0][0];
    expect(action.target).toBe('plans-stack');
    expect(action.payload.routes.map((route) => route.key)).toEqual(['lib']);
    expect(action.payload.index).toBe(0);
  });

  it('falls back to the tab root when the screen was alone in its stack (S2 from Home)', () => {
    const navigation = stack([{ key: 's2', name: routes.PlanDetail }]);
    handOffToWorkout(navigation, { key: 's2', name: routes.PlanDetail }, 'Strength activated.');
    expect(navigation.dispatch).toHaveBeenCalledWith({
      ...CommonActions.reset({ index: 0, routes: [{ name: routes.PlansLibrary }] }),
      target: 'plans-stack',
    });
  });
});
