import { Keyboard, PanResponder, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { abandonWorkout } from '../api/workoutApi';
import SessionRuntime from './SessionRuntime';

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

  it('a discard clears the previous action error first (#45, O9)', async () => {
    const { tree, setActionError } = render({ actionError: 'Network Error' });
    act(() => byId(tree, 'discard-workout').props.onPress());
    setActionError.mockClear();
    await act(async () => byId(tree, 'discard-confirm').props.onPress());
    expect(setActionError).toHaveBeenCalledWith('');
    expect(setActionError.mock.invocationCallOrder[0]).toBeLessThan(abandonWorkout.mock.invocationCallOrder[0]);
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
