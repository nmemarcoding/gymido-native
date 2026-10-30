import { CommonActions } from '@react-navigation/native';

import { navigationRef } from '../../navigation/navigationRef';
import { routes } from '../../navigation/routes';
import { handOffToToday, handOffToWorkout, openShellPath } from './shellLinks';
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

// T-91 §3: End plan replaces Plan detail with the Today root.
describe('handOffToToday', () => {
  it('drops Plan detail from the Plans stack and opens the Today root (Home)', () => {
    navigationRef.navigate.mockClear();
    const navigation = stack([
      { key: 'lib', name: routes.PlansLibrary },
      { key: 's2', name: routes.PlanDetail },
    ]);
    handOffToToday(navigation, { key: 's2', name: routes.PlanDetail });
    const [name, params] = navigationRef.navigate.mock.calls[0];
    expect([name, params.screen, params.params.screen]).toEqual([routes.AppShell, ShellTab.Today, routes.Home]);
    const action = navigation.dispatch.mock.calls[0][0];
    expect(action.target).toBe('plans-stack');
    expect(action.payload.routes.map((route) => route.key)).toEqual(['lib']);
  });

  it('alone in its stack (S2 from Today): the Plans stack falls back to its root', () => {
    const navigation = stack([{ key: 's2', name: routes.PlanDetail }]);
    handOffToToday(navigation, { key: 's2', name: routes.PlanDetail });
    expect(navigation.dispatch).toHaveBeenCalledWith({
      ...CommonActions.reset({ index: 0, routes: [{ name: routes.PlansLibrary }] }),
      target: 'plans-stack',
    });
  });
});

describe('openShellPath', () => {
  it('gives every entry to a tab root a new `entry`, and pushed screens none (T-12 F3)', () => {
    navigationRef.navigate.mockClear();
    openShellPath('/exercises');
    openShellPath('/exercises');
    const [first, second] = navigationRef.navigate.mock.calls.map((call) => call[1].params);
    expect(first.screen).toBe(routes.Exercises);
    expect(second.params.entry).toBeGreaterThan(first.params.entry);
    openShellPath('/workout', { message: 'Hi' });
    expect(navigationRef.navigate.mock.calls[2][1].params).toEqual({ screen: routes.Workout, params: { message: 'Hi' }, initial: false });
  });
});
