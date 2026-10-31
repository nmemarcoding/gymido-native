import { Keyboard, ScrollView, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import SessionRuntime from './SessionRuntime';
import { endSessionState } from './workoutSessionStore';


jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 12, right: 8 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock, Rect: Mock, Defs: Mock, LinearGradient: Mock, Stop: Mock };
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
jest.mock('../../exercises/api/exercisesApi', () => ({ getExercise: jest.fn(() => Promise.resolve({ id: 7, description: 'Lie back.' })) }));
jest.mock('./restAlertPlatform', () => ({ __esModule: true, default: require('./restAlerts').NO_PLATFORM }));
// Jest's own window (750 wide), with a text scale the tests can change.
let mockFontScale = 1;
let mockWidth = 750;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1334, scale: 2, fontScale: mockFontScale }),
}));
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
function render() {
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
        setActionError={jest.fn()}
        successMessage=""
        setSuccessMessage={jest.fn()}
        reloadError={false}
        retrying={false}
        onRetry={jest.fn()}
        onCompleted={jest.fn()}
      />
    );
  });
  mounted = tree;
  return tree;
}
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];

beforeEach(() => {
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  mockFontScale = 1;
  mockWidth = 750;
  endSessionState();
  jest.restoreAllMocks();
});

// T-170 step 4: the live-workout large-text rule. Phone: stacked = width < 304 x fontScale
// (the page scrolls, the chrome is two stacked rows + the plan); tablet: stacked = fontScale > 1.3
// (the chrome leaves its floating overlay and flows above the content).
describe('SessionRuntime text scale branch', () => {
  it.each([
    [390, 1, false],
    [390, 1.15, false],
    [390, 1.28, false],
    [390, 1.29, true],
    [390, 1.3, true],
    [390, 1.31, true],
    [390, 2, true],
    [360, 1.18, false],
    [360, 1.19, true],
  ])('phone width %s, fontScale %s: stacked = %s', (width, scale, stacked) => {
    mockWidth = width;
    mockFontScale = scale;
    const tree = render();
    const page = tree.root.findAll((node) => node.type === ScrollView && node.props.onScroll)[0];
    expect(page.props.scrollEnabled).toBe(stacked);
    const chrome = host(tree, 'session-chrome');
    // Stacked: [3 rows, rail]; fit: [1 row, rail].
    expect(chrome.props.children[0].props.children).toHaveLength(stacked ? 3 : 5);
    expect(StyleSheet.flatten(chrome.props.style).position).toBeUndefined();
  });

  it.each([
    [834, 1, false],
    [834, 1.15, false],
    [834, 1.3, false],
    [834, 1.31, true],
    [834, 2, true],
  ])('tablet width %s, fontScale %s: stacked = %s', (width, scale, stacked) => {
    mockWidth = width;
    mockFontScale = scale;
    const tree = render();
    const chrome = host(tree, 'session-chrome');
    // Not stacked: the chrome floats over the stage (absolute); stacked: in flow, 3 rows.
    expect(StyleSheet.flatten(chrome.props.style).position).toBe(stacked ? undefined : 'absolute');
  });
});
