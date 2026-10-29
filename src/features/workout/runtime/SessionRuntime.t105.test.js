import { Keyboard, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { completeWorkout } from '../api/workoutApi';
import { SessionChrome } from './RuntimeParts';
import { resetFinishEarlyMemory } from './finishEarly';
import { FinishEarlyDialog } from './RuntimeOverlays';
import SessionRuntime from './SessionRuntime';
import { endSessionState } from './workoutSessionStore';
import { colors } from '../../../shared/theme/tokens';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
// P3-2: the bottom inset is variable so the dock/scroll-room tests can set a safe area (default 0, as before).
let mockInsetBottom = 0;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: mockInsetBottom, left: 12, right: 8 }) }));
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
  // T-59 follow-up: the live session's state outlives the screen; no test inherits another's.
  endSessionState();
  jest.restoreAllMocks();
});


// T-105 (owner B, D1–D3; UX ruling §2/§4 + look verdict 9bdb33c8; RN-SPEC-workout dated 29 Oct 2026; web
// WorkoutPage.t105.test.jsx). SESSION: 4 sets, 1 done → 3 left. The message picker is fixed by mocking
// Math.random (0 → the first message that is not the last one shown).
const dialog = (tree) => tree.root.findByType(FinishEarlyDialog);
const textOf = (node) => [].concat(node.props.children).join('');
const press = (tree, id) => act(async () => byId(tree, id).props.onPress());

describe('T-105 Finish early', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    resetFinishEarlyMemory();
    completeWorkout.mockClear();
  });

  it('Complete sits in the header (SessionChrome), and is gone from the end of the column; Discard stays there', async () => {
    const { tree } = render();
    await act(async () => {});
    // One drawn Complete (host views), inside the header.
    const completes = tree.root.findAll((node) => node.props.testID === 'complete-workout' && typeof node.type === 'string');
    expect(completes).toHaveLength(1);
    expect(tree.root.findAllByType(SessionChrome)).toHaveLength(1);
    const chrome = tree.root.findByType(SessionChrome);
    expect(chrome.findAll((node) => node.props.testID === 'complete-workout').length).toBeGreaterThan(0);
    expect(byId(tree, 'discard-workout')).toBeDefined();
  });

  it('with 3 sets left: "Finish early?" opens with "3 sets"; nothing is completed', async () => {
    const { tree } = render();
    await press(tree, 'complete-workout');
    expect(dialog(tree).props.open).toBe(true);
    expect(dialog(tree).props.message.text).toBe('Leaving already? 3 sets to go. Future you will thank you.');
    expect(textOf(host(tree, 'finish-early-message'))).toBe('Leaving already? 3 sets to go. Future you will thank you. 💪');
    // The emoji is decorative: screen readers hear the text only.
    expect(host(tree, 'finish-early-message').props.accessibilityLabel).toBe('Leaving already? 3 sets to go. Future you will thank you.');
    expect(completeWorkout).not.toHaveBeenCalled();
  });

  it('n = 1 → "1 set", read when it opens (after logging sets)', async () => {
    const ONE_LEFT = { ...SESSION, exercises: [{ ...SESSION.exercises[0], sets: [set(11, true), set(12, true)] }, { ...SESSION.exercises[1], sets: [set(21, true), set(22)] }] };
    const { tree } = render({ session: ONE_LEFT });
    Math.random.mockReturnValue(0.1); // index 1: "Only {sets} left. Finish strong."
    await press(tree, 'complete-workout');
    expect(dialog(tree).props.message.text).toBe('Only 1 set left. Finish strong.');
  });

  it('no sets left → no dialog: Complete completes as before', async () => {
    const ALL_DONE = { ...SESSION, exercises: [{ ...SESSION.exercises[0], sets: [set(11, true)] }] };
    const { tree } = render({ session: ALL_DONE });
    // Auto-complete on the last set is unchanged (⚠W13): this session starts complete, so let that run first.
    await act(async () => {});
    completeWorkout.mockClear();
    await press(tree, 'complete-workout');
    expect(dialog(tree).props.open).toBe(false);
  });

  it('Keep going closes it and changes nothing (no request, the same set still live)', async () => {
    const { tree } = render();
    await press(tree, 'complete-workout');
    await act(async () => dialog(tree).props.onKeep());
    expect(dialog(tree).props.open).toBe(false);
    expect(completeWorkout).not.toHaveBeenCalled();
    expect(byId(tree, 'set-action-12').props.accessibilityLabel).toBe('Did it');
  });

  it('Android Back = Keep going (the sheet\'s onRequestClose), and the scrim does nothing', async () => {
    const { tree } = render();
    await press(tree, 'complete-workout');
    const sheet = tree.root.findAll((node) => node.props.testID === 'finish-early-dialog' && node.props.onRequestClose)[0];
    expect(sheet.props.onScrim ?? null).toBeNull();
    await act(async () => sheet.props.onRequestClose());
    expect(dialog(tree).props.open).toBe(false);
    expect(completeWorkout).not.toHaveBeenCalled();
  });

  it('Finish anyway runs exactly the existing complete flow (one POST, the summary)', async () => {
    const onCompleted = jest.fn();
    const { tree } = render({ onCompleted });
    await press(tree, 'complete-workout');
    await act(async () => dialog(tree).props.onFinish());
    expect(dialog(tree).props.open).toBe(false);
    expect(completeWorkout).toHaveBeenCalledTimes(1);
    expect(completeWorkout).toHaveBeenCalledWith(1);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('no immediate repeat: the next open never shows the same message', async () => {
    const { tree } = render();
    await press(tree, 'complete-workout');
    const first = dialog(tree).props.message.text;
    await act(async () => dialog(tree).props.onKeep());
    await press(tree, 'complete-workout');
    expect(dialog(tree).props.message.text).not.toBe(first);
  });
});

describe('T-105 Finish early dialog (look, Discard\'s twin)', () => {
  const MESSAGE = { text: 'Only 2 sets left. Finish strong.', emoji: null, label: 'Only 2 sets left. Finish strong.' };
  const order = (tree) => tree.root.findAll((node) => ['finish-early-keep', 'finish-early-finish'].includes(node.props.testID) && node.props.title).map((node) => node.props.testID);

  it.each([
    [390, ['finish-early-keep', 'finish-early-finish']],
    [834, ['finish-early-finish', 'finish-early-keep']],
  ])('at %s: gold "Keep going" + glass "Finish anyway" in the drawn order; the gold flag tile; "Finish early?"', (width, expected) => {
    mockWidth = width;
    let tree;
    act(() => {
      tree = create(<FinishEarlyDialog open message={MESSAGE} onKeep={() => {}} onFinish={() => {}} />);
    });
    mounted = tree;
    expect(order(tree)).toEqual(expected);
    const keep = tree.root.findAll((node) => node.props.testID === 'finish-early-keep' && node.props.title)[0];
    const finish = tree.root.findAll((node) => node.props.testID === 'finish-early-finish' && node.props.title)[0];
    expect(keep.props).toMatchObject({ title: 'Keep going', variant: 'primary' });
    expect(finish.props).toMatchObject({ title: 'Finish anyway', variant: 'secondary' });
    expect(StyleSheet.flatten(host(tree, 'finish-early-dialog-tile').props.style).backgroundColor).toBe(colors.goldTint);
    expect(tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'Finish early?')).toHaveLength(1);
    expect(host(tree, 'finish-early-dialog').props.accessibilityLabel).toBe('Finish early? Only 2 sets left. Finish strong.');
    mockWidth = 750;
  });
});
