import { Animated, PanResponder } from 'react-native';
import { act, create } from 'react-test-renderer';

import { StyleSheet } from 'react-native';

import { colors } from '../../../shared/theme/tokens';
import { ExerciseSheet, SessionExerciseList, WorkoutExerciseNav, isOpenSheetSwipe, shouldDismissSheet } from './ExerciseNavigation';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Path: Mock, Circle: Mock };
});
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);

describe('exercise nav gestures (§19.8, §19.7)', () => {
  it('opens the sheet on a swipe up past 45 that is more vertical than horizontal', () => {
    expect(isOpenSheetSwipe({ dy: -46, dx: 10 })).toBe(true);
    expect(isOpenSheetSwipe({ dy: -45, dx: 0 })).toBe(false);
    expect(isOpenSheetSwipe({ dy: -60, dx: 70 })).toBe(false);
  });

  it('dismisses a dragged sheet when far or fast enough, else springs back', () => {
    expect(shouldDismissSheet({ dy: 121, vy: 0 })).toBe(true);
    expect(shouldDismissSheet({ dy: 30, vy: 1.3 })).toBe(true);
    expect(shouldDismissSheet({ dy: 60, vy: 0.2 })).toBe(false);
  });

  it('an interrupted header drag settles: closes past the threshold, else springs back (#34)', () => {
    const configs = [];
    const real = PanResponder.create;
    jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      return real(config);
    });
    const timing = jest.spyOn(Animated, 'timing');
    const onClose = jest.fn();
    let tree;
    act(() => {
      tree = create(
        <ExerciseSheet open exercises={[]} muscleGroups={[]} activeMuscle="all" onMuscle={() => {}} currentIndex={0} onSelect={() => {}} onClose={onClose} />
      );
    });
    const header = configs.find((config) => config.onPanResponderTerminate);
    expect(header).toBeDefined();
    timing.mockClear();
    header.onPanResponderTerminate({}, { dy: 40, vy: 0 });
    expect(onClose).not.toHaveBeenCalled();
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0 }));
    header.onPanResponderTerminate({}, { dy: 200, vy: 0 });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Re-rendering with a new onClose keeps the same responder but calls the latest callback.
    const nextClose = jest.fn();
    const created = configs.length;
    act(() => {
      tree.update(
        <ExerciseSheet open exercises={[]} muscleGroups={[]} activeMuscle="all" onMuscle={() => {}} currentIndex={0} onSelect={() => {}} onClose={nextClose} />
      );
    });
    expect(configs.length).toBe(created);
    header.onPanResponderRelease({}, { dy: 200, vy: 0 });
    expect(nextClose).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    jest.restoreAllMocks();
  });
});

const EXERCISES = [
  { id: 1, exercise_name_snapshot: 'Push-up', sets: [{ id: 11, is_completed: true }, { id: 12, is_completed: true }] },
  { id: 2, exercise_name_snapshot: 'Bench', sets: [{ id: 21, is_completed: true }, { id: 22, is_completed: false }] },
  { id: 3, exercise_name_snapshot: 'Row', sets: [{ id: 31, is_completed: false }] },
];
const mount = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
};
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && node.props.accessibilityRole === 'button')[0];

describe('WorkoutExerciseNav (v2 F1 browsing)', () => {
  it('phone: "Exercise i of n", All (n), labelled segment buttons with 44 hit areas; the viewed one ringed', () => {
    const onView = jest.fn();
    const onOpenSheet = jest.fn();
    const tree = mount(<WorkoutExerciseNav exercises={EXERCISES} viewingIndex={2} onView={onView} onOpenSheet={onOpenSheet} />);
    const segment = pressable(tree, 'exercise-nav-segment-1');
    expect(segment.props.accessibilityLabel).toBe('Exercise 2: 1 of 2 sets done');
    expect(segment.props.hitSlop).toEqual({ top: 11, bottom: 11 });
    expect(pressable(tree, 'exercise-nav-segment-2').props.accessibilityState).toEqual({ selected: true });
    act(() => segment.props.onPress());
    expect(onView).toHaveBeenCalledWith(1);
    act(() => pressable(tree, 'exercise-nav-all').props.onPress());
    expect(onOpenSheet).toHaveBeenCalled();
    const viewedBar = pressable(tree, 'exercise-nav-segment-2').props.children;
    expect(StyleSheet.flatten(viewedBar.props.style)).toMatchObject({ height: 10, outlineColor: colors.goldStrong });
    const partial = pressable(tree, 'exercise-nav-segment-1').props.children.props.children;
    expect(StyleSheet.flatten(partial.props.style).width).toBe('50%');
    act(() => tree.unmount());
  });

  it('tablet: one pill; done gold, partial gold 0.60, viewed white, empty 0.12', () => {
    const exercises = [...EXERCISES, { id: 4, sets: [{ id: 41, is_completed: false }] }];
    const tree = mount(<WorkoutExerciseNav tablet exercises={exercises} viewingIndex={2} onView={() => {}} onOpenSheet={() => {}} />);
    const fill = (index) => StyleSheet.flatten(pressable(tree, `exercise-nav-segment-${index}`).props.children.props.style).backgroundColor;
    expect([fill(0), fill(1), fill(2), fill(3)]).toEqual([colors.gold, colors.goldStrong, colors.textPrimary, colors.hairlineButton]);
    act(() => tree.unmount());
  });
});

describe('SessionExerciseList (Tablet: Workout inline list)', () => {
  it('rows: done "2/2", the active exercise "Now", others "0/1"; names spoken with counts; press views', () => {
    const onSelect = jest.fn();
    const tree = mount(<SessionExerciseList title="Upper A" exercises={EXERCISES} currentIndex={1} viewingIndex={2} onSelect={onSelect} />);
    const texts = tree.root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).join(''));
    expect(texts).toEqual(expect.arrayContaining(['Upper A', '2/2', 'Now', '0/1']));
    const row = pressable(tree, 'session-exercise-row-1');
    expect(row.props.accessibilityLabel).toBe('Bench, 1 of 2 sets');
    expect(pressable(tree, 'session-exercise-row-2').props.accessibilityState).toEqual({ selected: true });
    act(() => row.props.onPress());
    expect(onSelect).toHaveBeenCalledWith(1);
    act(() => tree.unmount());
  });
});
