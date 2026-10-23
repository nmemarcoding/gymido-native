import { BackHandler } from 'react-native';
import { act, create } from 'react-test-renderer';

import { loadWorkoutPage } from '../loadWorkoutPage';
import WorkoutScreen from './WorkoutScreen';

const mockNavigation = { dispatch: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) };
let mockPreventRemove = { enabled: false, callback: null };

jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => ({ key: 'Workout-1', name: 'Workout', params: {} }),
    useIsFocused: () => true,
    useFocusEffect: (effect) => useEffect(effect, [effect]),
    usePreventRemove: (enabled, callback) => {
      mockPreventRemove = { enabled, callback };
    },
    CommonActions: { navigate: (name) => ({ type: 'NAVIGATE', payload: { name } }) },
    createNavigationContainerRef: () => ({ isReady: () => false }),
  };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()), removeItem: jest.fn(() => Promise.resolve()) }));
jest.mock('../../plans/components/ScheduleSetupCard', () => () => null);
jest.mock('../loadWorkoutPage', () => ({ loadWorkoutPage: jest.fn() }));
jest.mock('../../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children }) => <View testID="hub">{children}</View>;
});
jest.mock('../../shell/AppHeader', () => () => null);
jest.mock('../components/WorkoutStates', () => ({ WorkoutEmptyState: () => null, WorkoutErrorState: () => null }));
jest.mock('../components/WorkoutSkeleton', () => () => null);
let mockRuntime = null;
jest.mock('../runtime/SessionRuntime', () => (props) => {
  mockRuntime = props;
  const { View } = require('react-native');
  return <View testID="runtime" />;
});
// Counts popup mounts: the same instance must survive the session → hub switch.
let mockPopupMounts = 0;
jest.mock('../runtime/RuntimeOverlays', () => {
  const { useEffect } = require('react');
  const { View } = require('react-native');
  return {
    CompletionPopup: ({ popup }) => {
      useEffect(() => {
        mockPopupMounts += 1;
      }, []);
      return popup ? <View testID="completion-popup" /> : null;
    },
  };
});
jest.mock('../../../shared/components/ConfirmDialog', () => {
  const { View } = require('react-native');
  return (props) => (props.isOpen ? <View testID={props.testID} dialog={props} /> : null);
});

const withSession = { ok: true, data: { session: { id: 9, exercises: [] }, currentPlan: null, todayStatus: null, planDays: [], completedThisWeekDayIds: [], exerciseStatsMap: {} } };
const noSession = { ok: true, data: { ...withSession.data, session: null } };

async function render() {
  let tree;
  await act(async () => {
    tree = create(<WorkoutScreen />);
  });
  return tree;
}
const find = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');

beforeEach(() => {
  mockPopupMounts = 0;
  mockNavigation.dispatch.mockClear();
});

describe('WorkoutScreen', () => {
  it('shows no header row (no bell) in a phone-width active session (owner directive, 23 Oct)', async () => {
    loadWorkoutPage.mockResolvedValue(withSession);
    const tree = await render();
    expect(find(tree, 'runtime')).toHaveLength(1);
    expect(mockRuntime.header).toBeNull();
    act(() => tree.unmount());
  });

  it('keeps the compact header row from md (tablets)', async () => {
    const dimensions = require('react-native/Libraries/Utilities/useWindowDimensions');
    const spy = jest.spyOn(dimensions, 'default').mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });
    try {
      loadWorkoutPage.mockResolvedValue(withSession);
      const tree = await render();
      expect(mockRuntime.header).not.toBeNull();
      act(() => tree.unmount());
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps ONE completion popup mounted across the session → hub switch (#42, §23.2)', async () => {
    loadWorkoutPage.mockResolvedValue(withSession);
    const tree = await render();
    const mountsBefore = mockPopupMounts;
    loadWorkoutPage.mockResolvedValue(noSession);
    expect(find(tree, 'runtime')).toHaveLength(1);
    // handleComplete's order: the popup first, then the reload that clears the session.
    await act(async () => {
      mockRuntime.onCompleted({ planName: 'Plan', completedSets: 1, totalSets: 1, durationSeconds: 1, totalVolume: 0 });
      await mockRuntime.reload();
    });
    expect(find(tree, 'runtime')).toHaveLength(0);
    expect(find(tree, 'hub')).toHaveLength(1);
    expect(find(tree, 'completion-popup')).toHaveLength(1);
    expect(mockPopupMounts).toBe(mountsBefore);
    act(() => tree.unmount());
  });

  it('asks "Leave workout?" on Back while a session is active; Stay keeps it, Leave replays the pop (owner ruling 23 Oct)', async () => {
    loadWorkoutPage.mockResolvedValue(withSession);
    const tree = await render();
    expect(mockPreventRemove.enabled).toBe(true);
    const pop = { type: 'POP' };
    act(() => mockPreventRemove.callback({ data: { action: pop } }));
    const dialog = () => find(tree, 'leave-workout-dialog')[0]?.props.dialog;
    expect(dialog()).toMatchObject({
      title: 'Leave workout?',
      description: 'Your workout stays saved. You can pick it up from Today.',
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
      tone: 'primary',
      cancelTestID: 'leave-workout-stay',
      confirmTestID: 'leave-workout-leave',
    });
    act(() => dialog().onClose());
    expect(dialog()).toBeUndefined();
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    act(() => mockPreventRemove.callback({ data: { action: pop } }));
    act(() => dialog().onConfirm());
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(pop);
    act(() => tree.unmount());
  });

  it('Android Back at the root of the stack asks too, and Leave goes Home', async () => {
    const listeners = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, handler) => {
      listeners.push(handler);
      return { remove: jest.fn() };
    });
    loadWorkoutPage.mockResolvedValue(withSession);
    const tree = await render();
    mockNavigation.canGoBack.mockReturnValueOnce(true);
    expect(listeners.at(-1)()).toBe(false);
    mockNavigation.canGoBack.mockReturnValueOnce(false);
    let handled;
    act(() => {
      handled = listeners.at(-1)();
    });
    expect(handled).toBe(true);
    act(() => find(tree, 'leave-workout-dialog')[0].props.dialog.onConfirm());
    expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'NAVIGATE', payload: { name: 'Home' } });
    act(() => tree.unmount());
    jest.restoreAllMocks();
  });

  it('never intercepts without a session', async () => {
    loadWorkoutPage.mockResolvedValue(noSession);
    const tree = await render();
    expect(mockPreventRemove.enabled).toBe(false);
    act(() => tree.unmount());
  });
});
