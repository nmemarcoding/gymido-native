import { Keyboard, PanResponder, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { abandonWorkout, completeWorkout, updateSessionSet } from '../api/workoutApi';
import { ExerciseSheet } from './ExerciseNavigation';
import { SessionChrome } from './RuntimeParts';
import { CompleteWorkoutButton, RestTimerWidget } from './RuntimeOverlays';
import SessionRuntime, { ENDED_ELSEWHERE, exerciseImageMap } from './SessionRuntime';
import * as restPresentation from './restPresentation';

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
  jest.restoreAllMocks();
});

describe('SessionRuntime', () => {
  // DECLARED change (Batch 2 item 2, web WorkoutPage.jsx:688-690 / :771-785): a browsed exercise's pending rows are
  // LOCKED; only the ACTIVE exercise has the live editor. Was: "unlocks the first pending set of the VIEWED exercise,
  // even a later one (#15)" with set-action-21 enabled.
  it('only the ACTIVE exercise has a live set; a browsed exercise\'s pending rows are locked (#15, Batch 2)', () => {
    const { tree } = render();
    expect(byId(tree, 'set-action-12').props.disabled).toBe(false);
    // v2 F1 (ND3): the live state has no bottom nav; jump through All (n).
    act(() => tree.root.findByType(ExerciseSheet).props.onSelect(1));
    expect(byId(tree, 'set-action-21').props.disabled).toBe(true);
    expect(byId(tree, 'set-action-21').props.accessibilityLabel).toBe('Set 1');
    expect(byId(tree, 'set-action-22').props.disabled).toBe(true);
    expect(byId(tree, 'set-weight-21')).toBeUndefined();
    expect(byId(tree, 'set-reps-21')).toBeUndefined();
    expect(text(tree, 'Did it')).toHaveLength(0);
  });

  // Review "untested": undo from a done chip through SessionRuntime, and a "Did it" double tap at runtime level.
  it('live: the done chip is Undo and PATCHes is_completed false', async () => {
    updateSessionSet.mockClear();
    const { tree } = render();
    const undo = byId(tree, 'set-action-11');
    expect(undo.props.accessibilityLabel).toBe('Undo');
    await act(async () => undo.props.onPress());
    expect(updateSessionSet).toHaveBeenCalledTimes(1);
    expect(updateSessionSet).toHaveBeenCalledWith(1, 1, 11, expect.objectContaining({ is_completed: false }));
  });

  it('"Did it" double tap sends ONE PATCH (the in-flight guard)', async () => {
    updateSessionSet.mockClear();
    let resolve;
    updateSessionSet.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    const { tree } = render();
    const didIt = byId(tree, 'set-action-12');
    await act(async () => {
      didIt.props.onPress();
      didIt.props.onPress();
    });
    expect(updateSessionSet).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });

  it('browsing: a done row of the browsed exercise can still be undone (Batch 2 item 2)', async () => {
    const session = {
      ...SESSION,
      exercises: [SESSION.exercises[0], { id: 2, exercise_name_snapshot: 'Press', sets: [set(21, true), set(22)] }],
    };
    const { tree } = render({ session });
    act(() => tree.root.findByType(ExerciseSheet).props.onSelect(1));
    expect(host(tree, 'browsing-bar')).toBeDefined();
    const undo = byId(tree, 'set-action-21');
    expect(undo.props.accessibilityLabel).toBe('Undo');
    expect(undo.props.disabled).toBe(false);
    expect(byId(tree, 'set-action-22').props.disabled).toBe(true);
    await act(async () => undo.props.onPress());
    expect(updateSessionSet).toHaveBeenCalledWith(1, 2, 21, expect.objectContaining({ is_completed: false }));
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
    act(() => tree.root.findByType(ExerciseSheet).props.onSelect(0));
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
    // The exercise nav shows while browsing (v2 F1 ND3).
    act(() => tree.root.findByType(ExerciseSheet).props.onSelect(1));
    const created = spy.mock.calls.length;
    act(() => byId(tree, 'exercise-nav-segment-1').props.onPress());
    act(() => tree.update(<SessionRuntime {...tree.root.findByType(SessionRuntime).props} />));
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

describe('live text-size change (QA F1)', () => {
  it('rebuilds the session view on a new text scale and keeps the session state', () => {
    const { tree } = render();
    const props = tree.root.findByType(SessionRuntime).props;
    act(() => tree.root.findByType(SessionChrome).props.onAll());
    expect(tree.root.findByType(ExerciseSheet).props.open).toBe(true);
    const column = host(tree, 'session-column');
    act(() => tree.update(<SessionRuntime {...props} />));
    expect(host(tree, 'session-column')).toBe(column);
    mockFontScale = 2;
    act(() => tree.update(<SessionRuntime {...props} />));
    mockFontScale = 1;
    expect(host(tree, 'session-column')).not.toBe(column);
    // The open sheet is session state: still open after the rebuild.
    expect(tree.root.findByType(ExerciseSheet).props.open).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// v2 Phase 3 §3 Workout (UX F1).

const text = (tree, value) => tree.root.findAll((node) => node.type === 'Text' && [].concat(node.props.children).join('') === value);
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style) ?? {};
const sheet = (tree) => tree.root.findByType(ExerciseSheet);

describe('v2 F1 live and browsing states (ND3)', () => {
  it('live: one chrome (Exit · plan + n/m · timer m:ss · All), segments, the set card and the dock; no nav, bar or stats', () => {
    // Clock pinned (this test only): started_at and "now" are the same
    // instant, so the timer reads 0:00 deterministically (was a 0:01 flake).
    const NOW = new Date('2026-10-27T09:00:00.000Z');
    jest.useFakeTimers({ now: NOW, doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    try {
      liveChromeChecks(render({ session: { ...SESSION, started_at: NOW.toISOString() } }).tree);
    } finally {
      jest.useRealTimers();
    }
  });
  function liveChromeChecks(tree) {
    expect(host(tree, 'session-chrome')).toBeDefined();
    expect(text(tree, 'Exit')).toHaveLength(1);
    expect(text(tree, 'Plan')).toHaveLength(1);
    expect(text(tree, '1/4 sets done')).toHaveLength(1);
    expect(text(tree, 'All (2)')).toHaveLength(1);
    expect(byId(tree, 'session-timer').props.accessibilityRole).toBe('timer');
    expect(text(tree, '0:00')).toHaveLength(1);
    expect(host(tree, 'exercise-segments')).toBeDefined();
    expect(byId(tree, 'set-action-12').props.accessibilityLabel).toBe('Did it');
    expect(byId(tree, 'up-next').props.accessibilityLabel).toBe('Up next: Press');
    expect(host(tree, 'exercise-nav')).toBeUndefined();
    expect(host(tree, 'browsing-bar')).toBeUndefined();
    expect(host(tree, 'session-stats')).toBeUndefined();
    // Exactly one number input per live set (web tests pin it): weight + reps
    // for the ONE editor, none for the other sets.
    expect(byId(tree, 'set-weight-12')).toBeDefined();
    expect(byId(tree, 'set-weight-11')).toBeUndefined();
    expect(byId(tree, 'set-reps-12')).toBeDefined();
  }

  it('Exit always opens the Discard dialog (code wins)', () => {
    const { tree } = render();
    act(() => byId(tree, 'session-exit').props.onPress());
    expect(byId(tree, 'discard-dialog')).toBeDefined();
    expect(tree.root.findAll((node) => node.props.testID === 'discard-dialog')[0]).toBeDefined();
  });

  it('browsing: the bar, the rail, Time/Volume/Reps and the bottom nav; pending rows locked, no Did it; Resume returns', () => {
    const { tree } = render();
    act(() => sheet(tree).props.onSelect(1));
    expect(host(tree, 'browsing-bar')).toBeDefined();
    expect(host(tree, 'session-rail')).toBeDefined();
    expect(host(tree, 'session-stats')).toBeDefined();
    expect(host(tree, 'exercise-nav')).toBeDefined();
    expect(byId(tree, 'up-next')).toBeUndefined();
    expect(text(tree, 'Exercise 2 of 2')).not.toHaveLength(0);
    // DECLARED change (Batch 2 item 2): was "The browsed exercise's first set stays actionable (v1 #15)" with
    // accessibilityLabel 'Did it'; now the browsed exercise's pending rows are locked and "Did it" goes.
    expect(byId(tree, 'set-action-21').props.accessibilityLabel).toBe('Set 1');
    expect(byId(tree, 'set-action-21').props.disabled).toBe(true);
    expect(text(tree, 'Did it')).toHaveLength(0);
    // Batch 2 item 3: the gold rail stays (in the session header); the per-exercise segments go while browsing.
    expect(host(tree, 'exercise-segments')).toBeUndefined();
    act(() => byId(tree, 'browsing-resume').props.onPress());
    expect(host(tree, 'browsing-bar')).toBeUndefined();
    expect(byId(tree, 'set-action-12')).toBeDefined();
  });

  // Batch 2 item 3 (web SessionChrome.jsx:27, :84-90; WorkoutPage.jsx:901-915).
  it('the gold progress rail sits in the session header in every state and width; segments only live with 2+ exercises', () => {
    const inChrome = (tree) => host(tree, 'session-chrome').findAll((node) => node.props.testID === 'session-rail' && typeof node.type === 'string');
    [750, 1024].forEach((width) => {
      mockWidth = width;
      const { tree } = render();
      expect(inChrome(tree)).toHaveLength(1);
      expect(tree.root.findAll((node) => node.props.testID === 'session-rail' && typeof node.type === 'string')).toHaveLength(1);
      expect(StyleSheet.flatten(host(tree, 'session-rail').findAll((node) => typeof node.type === 'string')[1].props.style).width).toBe('25%');
      expect(host(tree, 'exercise-segments')).toBeDefined();
      act(() => sheet(tree).props.onSelect(1));
      expect(inChrome(tree)).toHaveLength(1);
      expect(host(tree, 'exercise-segments')).toBeUndefined();
      act(() => mounted.unmount());
      mounted = null;
    });
    mockWidth = 750;
    const { tree } = render({ session: { ...SESSION, exercises: [SESSION.exercises[0]] } });
    expect(inChrome(tree)).toHaveLength(1);
    expect(host(tree, 'exercise-segments')).toBeUndefined();
  });

  it('Up next views the next incomplete exercise', () => {
    const { tree } = render();
    act(() => byId(tree, 'up-next').props.onPress());
    expect(host(tree, 'browsing-bar')).toBeDefined();
  });
});

describe('v2 F1 steppers (ND1 / ND2) and the real reps (U3)', () => {
  const NO_TARGET = {
    ...SESSION,
    exercises: [
      { ...SESSION.exercises[0], sets: [set(11, true), { ...set(12), target_reps_min: 8, target_reps_max: 10 }, set(13)] },
      SESSION.exercises[1],
    ],
  };

  it('weight: empty + gives one step (lb 5, kg 2.5), − at one step clears, typing with a comma still works', () => {
    const { tree } = render({ session: NO_TARGET });
    act(() => byId(tree, 'set-weight-plus-12').props.onPress());
    expect(byId(tree, 'set-weight-12').props.value).toBe('5');
    act(() => byId(tree, 'set-weight-minus-12').props.onPress());
    expect(byId(tree, 'set-weight-12').props.value).toBe('');
    act(() => byId(tree, 'set-unit-12').props.onChange('kg'));
    act(() => byId(tree, 'set-weight-plus-12').props.onPress());
    expect(byId(tree, 'set-weight-12').props.value).toBe('2.5');
    act(() => byId(tree, 'set-weight-12').props.onChangeText('82,5'));
    act(() => byId(tree, 'set-weight-plus-12').props.onPress());
    expect(byId(tree, 'set-weight-12').props.value).toBe('85');
  });

  it('a stepped weight propagates to the later sets like typing (§20.3)', async () => {
    const { tree } = render({ session: NO_TARGET });
    act(() => byId(tree, 'set-weight-plus-12').props.onPress());
    act(() => byId(tree, 'set-weight-plus-12').props.onPress());
    await act(async () => byId(tree, 'set-action-12').props.onPress());
    expect(updateSessionSet).toHaveBeenLastCalledWith(1, 1, 12, expect.objectContaining({ actual_weight_value: 10, actual_weight_unit: 'lb' }));
  });

  it('reps: prefilled with the top of the target, digits only (1–99), ±1, and the REAL value is sent', async () => {
    updateSessionSet.mockClear();
    const { tree } = render({ session: NO_TARGET });
    expect(byId(tree, 'set-reps-12').props.value).toBe('10');
    expect(text(tree, 'Reps · target 8–10')).toHaveLength(1);
    act(() => byId(tree, 'set-reps-12').props.onChangeText('1a2'));
    expect(byId(tree, 'set-reps-12').props.value).toBe('12');
    act(() => byId(tree, 'set-reps-plus-12').props.onPress());
    expect(byId(tree, 'set-reps-12').props.value).toBe('13');
    await act(async () => byId(tree, 'set-action-12').props.onPress());
    expect(updateSessionSet).toHaveBeenLastCalledWith(1, 1, 12, expect.objectContaining({ actual_reps: 13 }));
  });

  it('batch 3 (b): + on a blank reps field gives target max + 1, − gives max − 1', () => {
    const { tree } = render({ session: NO_TARGET });
    act(() => byId(tree, 'set-reps-12').props.onChangeText(''));
    act(() => byId(tree, 'set-reps-plus-12').props.onPress());
    expect(byId(tree, 'set-reps-12').props.value).toBe('11');
    act(() => byId(tree, 'set-reps-12').props.onChangeText(''));
    act(() => byId(tree, 'set-reps-minus-12').props.onPress());
    expect(byId(tree, 'set-reps-12').props.value).toBe('9');
  });

  it('batch 3 (c): only the weight − that clears the field announces "Weight cleared"; typing it empty is silent', () => {
    const { AccessibilityInfo } = require('react-native');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const { tree } = render({ session: NO_TARGET });
    act(() => byId(tree, 'set-weight-plus-12').props.onPress());
    announce.mockClear();
    act(() => byId(tree, 'set-weight-minus-12').props.onPress());
    expect(byId(tree, 'set-weight-12').props.value).toBe('');
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Weight cleared');
    announce.mockClear();
    act(() => byId(tree, 'set-weight-minus-12').props.onPress());
    expect(announce).not.toHaveBeenCalled();
    act(() => byId(tree, 'set-weight-12').props.onChangeText('20'));
    act(() => byId(tree, 'set-weight-12').props.onChangeText(''));
    expect(announce).not.toHaveBeenCalled();
    act(() => byId(tree, 'set-weight-12').props.onChangeText('20'));
    act(() => byId(tree, 'set-weight-minus-12').props.onPress());
    expect(announce).toHaveBeenCalledWith('15 lb');
    expect(announce).not.toHaveBeenCalledWith('Weight cleared');
    announce.mockRestore();
  });

  it('a blank reps field logs the target as v1', async () => {
    updateSessionSet.mockClear();
    const { tree } = render({ session: NO_TARGET });
    act(() => byId(tree, 'set-reps-12').props.onChangeText(''));
    await act(async () => byId(tree, 'set-action-12').props.onPress());
    expect(updateSessionSet).toHaveBeenLastCalledWith(1, 1, 12, expect.objectContaining({ actual_reps: 10 }));
  });

  it('validation stays on "Did it": the error shows, blocks the PATCH and clears on the next edit', async () => {
    updateSessionSet.mockClear();
    const { tree } = render();
    act(() => byId(tree, 'set-weight-12').props.onChangeText('abc'));
    await act(async () => byId(tree, 'set-action-12').props.onPress());
    expect(updateSessionSet).not.toHaveBeenCalled();
    expect(host(tree, 'weight-error-12').props.children).toBe('Weight must be greater than 0.');
    act(() => byId(tree, 'set-weight-plus-12').props.onPress());
    expect(host(tree, 'weight-error-12')).toBeUndefined();
  });

  it('the rest locks "Did it" (0.5, the rest hint) until it ends', async () => {
    const RESTING = { ...SESSION, exercises: [{ ...SESSION.exercises[0], sets: [set(11, true), { ...set(12), rest_seconds_planned: 60 }] }, SESSION.exercises[1]] };
    const { tree } = render({ session: RESTING });
    await act(async () => byId(tree, 'set-action-12').props.onPress());
    const action = byId(tree, 'set-action-12');
    expect(action.props.disabled).toBe(true);
    expect(action.props.accessibilityHint).toBe('Rest timer running — wait or skip it first');
  });
});

// Review M6 (TalkBack half): the full-screen Rest is modal on Android too: while it is expanded, everything behind
// it (header + the session column) is hidden from screen readers; the minimised disc hides nothing.
describe('expanded Rest is modal for screen readers (M6)', () => {
  const RESTING = { ...SESSION, exercises: [{ ...SESSION.exercises[0], sets: [set(11, true), { ...set(12), rest_seconds_planned: 60 }] }, SESSION.exercises[1]] };
  const hiddenBehind = (tree) => {
    const column = host(tree, 'session-column');
    return { important: column.props.importantForAccessibility, hidden: column.props.accessibilityElementsHidden };
  };

  it.each([750, 1024])('at %s wide: hidden behind the expanded Rest, visible again when minimised', async (width) => {
    mockWidth = width;
    const { tree } = render({ session: RESTING, header: <></> });
    expect(hiddenBehind(tree)).toEqual({ important: 'auto', hidden: false });
    await act(async () => byId(tree, 'set-action-12').props.onPress());
    expect(tree.root.findByType(RestTimerWidget).props.minimized).toBe(false);
    expect(hiddenBehind(tree)).toEqual({ important: 'no-hide-descendants', hidden: true });
    const header = tree.root.findAll((node) => node.props.testID === 'session-header' && typeof node.type === 'string')[0];
    expect(header.props).toMatchObject({ importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true });
    act(() => tree.root.findByType(RestTimerWidget).props.onMinimize());
    expect(hiddenBehind(tree)).toEqual({ important: 'auto', hidden: false });
    mockWidth = 750;
  });
});

describe('v2 F1 "Last time" (U3, per set number, no fallback)', () => {
  const LAST = {
    ...SESSION,
    exercises: [
      {
        ...SESSION.exercises[0],
        previous_sets: [{ set_number: 2, weight_value: 100, weight_unit: 'kg', reps: 8 }],
        sets: [set(11, true), { ...set(12), actual_weight_unit: null, target_weight_unit: 'lb' }],
      },
      { ...SESSION.exercises[1], previous_sets: [{ set_number: 2, weight_value: 50, weight_unit: 'kg', reps: 5 }] },
    ],
  };

  it('shows the same set number converted to the current unit (lb whole), and prefills reps from it', () => {
    const { tree } = render({ session: LAST });
    expect(host(tree, 'set-last-time-12').props.children).toBe('Last time 220 × 8');
    expect(byId(tree, 'set-reps-12').props.value).toBe('8');
    act(() => byId(tree, 'set-unit-12').props.onChange('kg'));
    expect(host(tree, 'set-last-time-12').props.children).toBe('Last time 100 × 8');
  });

  it('a set number with no previous set has no line and no prefill from another set', () => {
    // DECLARED fixture change (Batch 2 item 2): exercise 1 is all done so exercise 2 is the ACTIVE one (a browsed
    // exercise has no editor any more). Assertions unchanged.
    const session = { ...LAST, exercises: [{ ...LAST.exercises[0], sets: [set(11, true), set(12, true)] }, LAST.exercises[1]] };
    const { tree } = render({ session });
    act(() => sheet(tree).props.onSelect(1));
    expect(host(tree, 'browsing-bar')).toBeUndefined();
    // Set 21 is set number 1: exercise 2 only has a previous set number 2.
    expect(host(tree, 'set-last-time-21')).toBeUndefined();
    expect(byId(tree, 'set-reps-21').props.value).toBe('8');
  });

  it('an empty weight steps from the Last time weight', () => {
    const { tree } = render({ session: LAST });
    act(() => byId(tree, 'set-weight-12').props.onChangeText(''));
    act(() => byId(tree, 'set-weight-plus-12').props.onPress());
    expect(byId(tree, 'set-weight-12').props.value).toBe('225');
  });
});

describe('v2 F1 volume rule (PM, 27 Oct): kg sum in the member unit', () => {
  const { useProfileStore } = require('../../profile/profileStore');
  const MIXED = {
    ...SESSION,
    exercises: [
      {
        ...SESSION.exercises[0],
        sets: [
          { ...set(11, true), actual_reps: 10, actual_weight_value: 100, actual_weight_unit: 'kg' },
          { ...set(13, true), actual_reps: 10, actual_weight_value: 100, actual_weight_unit: 'lb' },
          set(12),
        ],
      },
      SESSION.exercises[1],
    ],
  };
  afterEach(() => useProfileStore.setState({ profile: null }));

  it('browsing stats: Volume in the member\'s kg (1,454 kg), Reps 20', () => {
    useProfileStore.setState({ profile: { current_weight_unit: 'kg' } });
    const { tree } = render({ session: MIXED });
    act(() => sheet(tree).props.onSelect(1));
    expect(text(tree, '1,454 kg')).toHaveLength(1);
    expect(text(tree, '20')).toHaveLength(1);
  });

  it('the completion snapshot carries the same volume and its unit', async () => {
    useProfileStore.setState({ profile: { goal_weight_unit: 'lb' } });
    const onCompleted = jest.fn();
    const { tree } = render({ session: MIXED, onCompleted });
    await act(async () => byId(tree, 'complete-workout').props.onPress());
    const snapshot = onCompleted.mock.calls[0][0];
    expect(snapshot.volumeUnit).toBe('lb');
    expect(Math.round(snapshot.totalVolume)).toBe(3205);
  });
});

describe('v2 F1 Complete / Discard (ND4)', () => {
  it('"Complete workout" is glass while a live set is left, primary when none is', () => {
    const { tree } = render();
    expect(tree.root.findByType(CompleteWorkoutButton).props.primary).toBe(false);
    act(() => mounted.unmount());
    const allDone = { ...SESSION, exercises: [{ ...SESSION.exercises[0], sets: [set(11, true)] }] };
    const done = render({ session: allDone }).tree;
    expect(done.root.findByType(CompleteWorkoutButton).props.primary).toBe(true);
    expect(text(done, 'Discard workout')).toHaveLength(1);
  });
});

describe('v2 F1 How to (#5 / ND7)', () => {
  const { getExercise } = require('../../exercises/api/exercisesApi');
  const LIB = { ...SESSION, exercises: [{ ...SESSION.exercises[0], exercise: { id: 7, thumbnail: { url: 'https://example.com/a.gif' } } }, SESSION.exercises[1]] };

  it('opens the sheet over the workout and closes back to the same set; the session is untouched', async () => {
    getExercise.mockClear();
    const { tree } = render({ session: LIB });
    await act(async () => {});
    expect(getExercise).toHaveBeenCalledWith(7);
    await act(async () => byId(tree, 'how-to-open').props.onPress());
    expect(byId(tree, 'how-to-sheet').props.isOpen).toBe(true);
    expect(text(tree, 'Lie back.')).toHaveLength(1);
    act(() => byId(tree, 'how-to-close').props.onPress());
    expect(byId(tree, 'how-to-sheet').props.isOpen).toBe(false);
    expect(byId(tree, 'set-action-12').props.accessibilityLabel).toBe('Did it');
  });

  it('hides the pill when the library has neither text nor image', async () => {
    getExercise.mockResolvedValueOnce({ id: 8 });
    const bare = { ...SESSION, exercises: [{ ...SESSION.exercises[0], exercise: { id: 8 } }, SESSION.exercises[1]] };
    const { tree } = render({ session: bare });
    await act(async () => {});
    expect(byId(tree, 'how-to-open')).toBeUndefined();
  });
});

describe('v2 F1 tablet (≥ 768)', () => {
  afterEach(() => {
    mockWidth = 750;
  });

  it('live: the stage column, the logger with the inline exercise list and the dock; no Up next', () => {
    mockWidth = 1024;
    const { tree } = render();
    expect(host(tree, 'session-exercise-list')).toBeDefined();
    expect(byId(tree, 'up-next')).toBeUndefined();
    expect(byId(tree, 'set-action-12').props.accessibilityLabel).toBe('Did it');
    const column = StyleSheet.flatten(host(tree, 'session-column').props.style);
    expect(column.maxWidth).toBeUndefined();
    act(() => byId(tree, 'session-exercise-row-1').props.onPress());
    expect(host(tree, 'browsing-bar')).toBeDefined();
    expect(host(tree, 'exercise-nav')).toBeDefined();
  });
});

describe('v2 F1 large text (UX §9; QA AX5 chrome)', () => {
  afterEach(() => {
    mockFontScale = 1;
  });

  it.each([1, 2, 3.1])('at %sx the chrome stays usable: one row up to 1.3×, two rows (in flow) above it', (scale) => {
    mockFontScale = scale;
    const { tree } = render();
    const chrome = host(tree, 'session-chrome');
    const style = StyleSheet.flatten(chrome.props.style);
    if (scale > 1.3) {
      expect(style.position).toBeUndefined();
      // Row 1 holds Exit, the timer and All; the plan pill has its own row.
      // DECLARED path change (Batch 2 item 3): the chrome's first child is the rows, the second the gold rail.
      expect(chrome.props.children).toHaveLength(2);
      expect(chrome.props.children[0].props.children).toHaveLength(2);
    } else {
      expect(style.position).toBe('absolute');
    }
    // The plan name follows the title rule (word wrap, shrink a long word).
    const name = text(tree, 'Plan')[0];
    expect(name.props.adjustsFontSizeToFit).toBe(true);
    expect(name.props.textBreakStrategy).toBe('simple');
    // "Did it" never truncates.
    const didIt = text(tree, 'Did it')[0];
    expect(didIt.props.numberOfLines).toBeUndefined();
    expect(flat(byId(tree, 'set-action-12')).minHeight).toBe(64);
  });
});

describe('3c hand-off (lead, 27 Oct)', () => {
  it('passes restNextPreview(session, nextSetKey, drafts) to the rest widget as `next`', () => {
    const spy = jest.spyOn(restPresentation, 'restNextPreview').mockReturnValue({ label: 'Next: set 2' });
    const { tree } = render();
    expect(spy).toHaveBeenLastCalledWith(SESSION, undefined, expect.any(Object));
    expect(tree.root.findByType(RestTimerWidget).props.next).toEqual({ label: 'Next: set 2' });
  });

  it('the completion snapshot carries personalRecords, volumeUnit and exerciseImages', async () => {
    const records = [{ exercise_id: 3, previous_value: 100 }];
    completeWorkout.mockResolvedValueOnce({ new_personal_records: records });
    const onCompleted = jest.fn();
    const session = { ...SESSION, exercises: [{ ...SESSION.exercises[0], exercise: { id: 3, thumbnail: { url: 'https://example.com/a.gif' } } }, SESSION.exercises[1]] };
    const { tree } = render({ session, onCompleted });
    await act(async () => byId(tree, 'complete-workout').props.onPress());
    expect(onCompleted.mock.calls[0][0]).toMatchObject({ personalRecords: records, volumeUnit: 'kg', exerciseImages: { 3: 'https://example.com/a.gif' } });
  });

  it('builds the image map from library ids with a photo only', () => {
    expect(exerciseImageMap({ exercises: [{ exercise: { id: 1, thumbnail: { url: 'u' } } }, { exercise: { id: 2 } }, {}] })).toEqual({ 1: 'u' });
    expect(exerciseImageMap(null)).toEqual({});
  });
});
