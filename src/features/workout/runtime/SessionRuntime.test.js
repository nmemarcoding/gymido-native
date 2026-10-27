import { Keyboard, PanResponder, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { abandonWorkout, completeWorkout, updateSessionSet } from '../api/workoutApi';
import { ExerciseSheet } from './ExerciseNavigation';
import { SessionChrome } from './RuntimeParts';
import SessionRuntime, { ENDED_ELSEWHERE } from './SessionRuntime';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 12, right: 8 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock, Defs: Mock, LinearGradient: Mock, Stop: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => {
  const { View } = require('react-native');
  return (props) => <View testID="remote-image" {...props} />;
});
jest.mock('../api/workoutApi', () => ({
  abandonWorkout: jest.fn(() => Promise.resolve()),
  completeWorkout: jest.fn(() => Promise.resolve()),
  updateSessionSet: jest.fn(() => Promise.resolve()),
}));
jest.mock('./restAlertPlatform', () => ({ __esModule: true, default: require('./restAlerts').NO_PLATFORM }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));

const set = (id, done = false) => ({ id, set_number: id % 10, is_completed: done, target_reps_min: 8, rest_seconds_planned: 0 });
const SESSION = {
  id: 1,
  started_at: new Date().toISOString(),
  exercises: [
    { id: 1, exercise_name_snapshot: 'Squat', sets: [set(11, true), set(12)], exercise: { thumbnail: { url: 'https://example.com/a.gif' } } },
    { id: 2, exercise_name_snapshot: 'Press', sets: [set(21), set(22)] },
  ],
};

let mounted = null;

function render(props = {}) {
  const setActionError = jest.fn();
  let tree;
  act(() => {
    tree = create(
      <SessionRuntime
        session={SESSION}
        planName="Plan"
        exerciseStatsMap={{}}
        reload={jest.fn(() => Promise.resolve())}
        reloadWithLoader={jest.fn(() => Promise.resolve())}
        writeOverlay={jest.fn()}
        actionError=""
        setActionError={setActionError}
        successMessage=""
        setSuccessMessage={jest.fn()}
        reloadError={false}
        retrying={false}
        onRetry={jest.fn()}
        onCompleted={jest.fn()}
        {...props}
      />
    );
  });
  mounted = tree;
  return { tree, setActionError };
}

const byId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string')[0];
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];

beforeEach(() => {
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  jest.restoreAllMocks();
});

describe('SessionRuntime', () => {
  it('unlocks the first pending set of the VIEWED exercise, even a later one (#15)', () => {
    const { tree } = render();
    expect(byId(tree, 'set-action-12').props.disabled).toBe(false);
    act(() => byId(tree, 'exercise-nav-segment-1').props.onPress());
    expect(byId(tree, 'set-action-21').props.disabled).toBe(false);
    expect(byId(tree, 'set-action-22').props.disabled).toBe(true);
  });

  it('closes the keyboard on "Did it" and on the runtime buttons (#17)', async () => {
    const { tree } = render();
    await act(async () => byId(tree, 'set-action-12').props.onPress());
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    act(() => byId(tree, 'discard-workout').props.onPress());
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(2);
  });

  it('completes a set with no weight, then shows the weight the server kept (T-16)', async () => {
    updateSessionSet.mockResolvedValueOnce({ workout_session_exercise_set: { id: 12, actual_weight_value: 70, actual_weight_unit: 'kg' } });
    const { tree } = render();
    act(() => byId(tree, 'set-weight-12').props.onChangeText('   '));
    await act(async () => byId(tree, 'set-action-12').props.onPress());
    expect(updateSessionSet).toHaveBeenCalledWith(1, 1, 12, expect.objectContaining({ actual_weight_value: null, actual_weight_unit: null, is_completed: true }));
    expect(host(tree, 'weight-error-12')).toBeUndefined();
    expect(byId(tree, 'set-weight-12').props.value).toBe('70');
  });

  it('a discard clears the previous action error first (#45, O9)', async () => {
    const { tree, setActionError } = render({ actionError: 'Network Error' });
    act(() => byId(tree, 'discard-workout').props.onPress());
    setActionError.mockClear();
    await act(async () => byId(tree, 'discard-confirm').props.onPress());
    expect(setActionError).toHaveBeenCalledWith('');
    expect(setActionError.mock.invocationCallOrder[0]).toBeLessThan(abandonWorkout.mock.invocationCallOrder[0]);
  });

  describe('a 409 after a server-side end (T-37, RN-SPEC-workout O9 25 Oct 2026)', () => {
    const conflict = { response: { status: 409, data: { message: 'Session is not active' } } };
    // Set 12 with a target weight, so "Did it" passes the weight check.
    const WEIGHTED = { ...SESSION, exercises: [{ ...SESSION.exercises[0], sets: [set(11, true), { ...set(12), target_weight_value: 50, target_weight_unit: 'kg' }] }, SESSION.exercises[1]] };

    it('"Did it": shows the ended-elsewhere message and reloads with the loader', async () => {
      updateSessionSet.mockRejectedValueOnce(conflict);
      const reload = jest.fn(() => Promise.resolve());
      const reloadWithLoader = jest.fn(() => Promise.resolve());
      const { tree, setActionError } = render({ session: WEIGHTED, reload, reloadWithLoader });
      await act(async () => byId(tree, 'set-action-12').props.onPress());
      expect(setActionError).toHaveBeenLastCalledWith(ENDED_ELSEWHERE);
      expect(reloadWithLoader).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
      // The set's pending state ended as usual.
      expect(byId(tree, 'set-action-12').props.disabled).toBe(false);
    });

    it('Complete: no summary popup, the same message and reload', async () => {
      completeWorkout.mockRejectedValueOnce(conflict);
      const onCompleted = jest.fn();
      const reloadWithLoader = jest.fn(() => Promise.resolve());
      const { tree, setActionError } = render({ onCompleted, reloadWithLoader });
      await act(async () => byId(tree, 'complete-workout').props.onPress());
      expect(onCompleted).not.toHaveBeenCalled();
      expect(setActionError).toHaveBeenLastCalledWith(ENDED_ELSEWHERE);
      expect(reloadWithLoader).toHaveBeenCalledTimes(1);
    });

    it("keeps Discard's 409 unchanged (the server message, no reload)", async () => {
      abandonWorkout.mockRejectedValueOnce(conflict);
      const reloadWithLoader = jest.fn(() => Promise.resolve());
      const { tree, setActionError } = render({ reloadWithLoader });
      act(() => byId(tree, 'discard-workout').props.onPress());
      await act(async () => byId(tree, 'discard-confirm').props.onPress());
      expect(setActionError).toHaveBeenLastCalledWith('Session is not active');
      expect(reloadWithLoader).not.toHaveBeenCalled();
    });

    it('keeps other errors on the runtime toast', async () => {
      updateSessionSet.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server error' } } });
      const reloadWithLoader = jest.fn(() => Promise.resolve());
      const { tree, setActionError } = render({ session: WEIGHTED, reloadWithLoader });
      await act(async () => byId(tree, 'set-action-12').props.onPress());
      expect(setActionError).toHaveBeenLastCalledWith('Server error');
      expect(reloadWithLoader).not.toHaveBeenCalled();
    });
  });

  it('shows "Last exercise — finish strong" only while viewing the active exercise (#29)', () => {
    const session = { ...SESSION, exercises: [{ ...SESSION.exercises[0], sets: [set(11, true)] }, SESSION.exercises[1]] };
    const { tree } = render({ session });
    const note = () => tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Last exercise — finish strong');
    expect(note()).toHaveLength(1);
    act(() => byId(tree, 'exercise-nav-segment-0').props.onPress());
    expect(note()).toHaveLength(0);
  });

  it('caps the runtime to the centred phone column with the side insets (#63, §19.6)', () => {
    const { tree } = render();
    const column = StyleSheet.flatten(host(tree, 'session-column').props.style);
    expect(column).toMatchObject({ maxWidth: 430, alignSelf: 'center' });
    const frame = StyleSheet.flatten(byId(tree, 'session-column').parent.props.style);
    expect(frame).toMatchObject({ paddingLeft: 12, paddingRight: 8 });
  });

  it('shows the stage image through RemoteImage, keyed per URL (#36)', () => {
    const { tree } = render();
    const image = byId(tree, 'remote-image');
    expect(image.props.url).toBe('https://example.com/a.gif');
  });

  it('creates the swipe and sheet-drag responders once, across re-renders (#33, #34)', () => {
    const spy = jest.spyOn(PanResponder, 'create');
    const { tree } = render();
    const created = spy.mock.calls.length;
    act(() => byId(tree, 'exercise-nav-segment-1').props.onPress());
    act(() => byId(tree, 'exercise-nav-segment-0').props.onPress());
    expect(spy.mock.calls.length).toBe(created);
  });
});

describe('All exercises sheet wiring (v2 Phase 2 C4)', () => {
  it('passes the plan name (else "Workout") and returns focus to the All (n) opener', () => {
    const { tree } = render();
    const sheet = tree.root.findByType(ExerciseSheet);
    expect(sheet.props.planName).toBe('Plan');
    const chrome = tree.root.findByType(SessionChrome);
    expect(chrome.props.allRef).toBeTruthy();
    expect(sheet.props.returnFocusRef).toBe(chrome.props.allRef);
    act(() => mounted.unmount());
    const untitled = render({ planName: '' }).tree;
    expect(untitled.root.findByType(ExerciseSheet).props.planName).toBe('Workout');
  });
});
