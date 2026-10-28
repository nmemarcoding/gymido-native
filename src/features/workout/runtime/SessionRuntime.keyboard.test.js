import { Dimensions, Keyboard, Platform, ScrollView } from 'react-native';
import { act, create } from 'react-test-renderer';

import SessionRuntime from './SessionRuntime';
import { endSessionState } from './workoutSessionStore';

// UX native final audit 27 Oct 2026, final batch (the batch g / k bug class):
// on an edge-to-edge Android window the session's scroll grows by what the
// keyboard COVERS (useKeyboardOverlap), not the raw height, which leaves out
// the nav bar under the IME. The REAL hook with a mocked keyboard frame:
// Android phone, 48 nav bar, window 915 tall, IME top at 915 − 336 − 48 = 531
// (overlap 384) while RN reports height 336.

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
const mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
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
jest.mock('../../exercises/api/exercisesApi', () => ({ getExercise: jest.fn(() => Promise.resolve({ id: 7, description: 'Lie back.' })) }));
jest.mock('./restAlertPlatform', () => ({ __esModule: true, default: require('./restAlerts').NO_PLATFORM }));
let mockReducedMotion = true;
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
let mockWindow = { width: 412, height: 915, scale: 2.625, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockWindow }));
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
const WINDOW = mockWindow;
const FRAME = { height: 336, screenY: 915 - 336 - 48 };

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

const pagePadding = (tree) => tree.root.findAllByType(ScrollView)[0].props.contentContainerStyle.paddingBottom;

const realOS = Platform.OS;
let listeners;
beforeEach(() => {
  Platform.OS = 'android';
  listeners = {};
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, cb) => {
    listeners[name] = cb;
    return { remove: () => delete listeners[name] };
  });
  jest.spyOn(Dimensions, 'get').mockImplementation(() => WINDOW);
  jest.spyOn(Dimensions, 'addEventListener').mockImplementation(() => ({ remove: () => {} }));
});
afterEach(() => {
  Platform.OS = realOS;
  act(() => mounted?.unmount());
  mounted = null;
  endSessionState();
  jest.restoreAllMocks();
});

describe('SessionRuntime, Android keyboard (useKeyboardOverlap)', () => {
  it('keyboard up: the scroll grows by the 384 the keyboard covers (not the raw 336), so its end clears the keyboard top', () => {
    const tree = render();
    const rest = pagePadding(tree);
    act(() => listeners.keyboardDidShow({ endCoordinates: FRAME }));
    const keyboardPart = pagePadding(tree) - rest;
    expect(keyboardPart).toBe(WINDOW.height - FRAME.screenY);
    expect(keyboardPart).toBe(384);
    expect(WINDOW.height - keyboardPart).toBeLessThanOrEqual(FRAME.screenY);
    act(() => listeners.keyboardDidHide());
    expect(pagePadding(tree)).toBe(rest);
  });
});
