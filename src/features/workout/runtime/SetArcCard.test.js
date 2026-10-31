import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors } from '../../../shared/theme/tokens';
import SetArcCard, { arcLabel, arcSegments } from './SetArcCard';

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Mock = ({ children, ...props }) => <View {...props}>{children}</View>;
  return { __esModule: true, default: Mock, Path: (props) => <View {...props} />, Rect: (props) => <View {...props} /> };
});
jest.mock('../../../shared/components/Select', () => {
  const { View } = require('react-native');
  return (props) => <View {...props} />;
});
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockFontScale }),
}));

// T-146 (ruling §2, FINAL boards 4/5; FE Q1 default).
const set = (id, number, done = false, extra = {}) => ({ id, set_number: number, is_completed: done, target_reps_min: 8, target_reps_max: 12, ...extra });
const exerciseWith = (count, done) => ({
  id: 1,
  exercise_name_snapshot: 'Leg Press',
  sets: Array.from({ length: count }, (_, index) => set(10 + index, index + 1, index < done, index < done ? { actual_weight_value: 270, actual_reps: 12 } : {})),
});

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  mockFontScale = 1;
});

function render(props) {
  let tree;
  act(() => {
    tree = create(
      <SetArcCard
        pendingSetIds={new Set()}
        onWeightChange={() => {}}
        onUnitChange={() => {}}
        onRepsChange={() => {}}
        onStep={() => {}}
        onSelectDone={() => {}}
        onUndo={() => {}}
        {...props}
      />
    );
  });
  mounted.push(tree);
  return tree;
}
const all = (tree, id) => tree.root.findAll((node) => node.props.testID === id);
const one = (tree, id) => all(tree, id)[0];
const allMatching = (tree, pattern) => tree.root.findAll((node) => typeof node.props.testID === 'string' && pattern.test(node.props.testID) && typeof node.type === 'string');
const text = (node) => [].concat(node.props.children).map((child) => (typeof child === 'string' ? child : child?.props ? text(child) : '')).join('');

describe('arcSegments', () => {
  it('splits the upper half-circle into one segment per set, 4° gaps (3° above 6 sets)', () => {
    const four = arcSegments(4, 140, 163, 172);
    expect(four).toHaveLength(4);
    // The first segment starts at 180° + 2° (left end), the last ends at 360° − 2° (right end).
    expect(four[0].d.startsWith(`M ${(163 - 140 * Math.cos((2 * Math.PI) / 180)).toFixed(1)}`)).toBe(true);
    expect(four[0].mid.y).toBeLessThan(172);
    const eight = arcSegments(8, 140, 163, 172);
    expect(eight).toHaveLength(8);
    const firstStart = (segments) => Number(segments[0].d.split(' ')[1]);
    expect(firstStart(eight)).toBeCloseTo(163 - 140 * Math.cos((1.5 * Math.PI) / 180), 1);
    expect(arcSegments(0, 140, 163, 172)).toEqual([]);
  });

  it('arcLabel: "{n} sets left", "Last set" at 1, "All sets done" at 0', () => {
    expect(arcLabel(3)).toBe('3 sets left');
    expect(arcLabel(1)).toBe('Last set');
    expect(arcLabel(0)).toBe('All sets done');
  });
});

describe('SetArcCard', () => {
  it.each([
    [4, 1],
    [8, 3],
  ])('%i sets, %i done: done gold, the now outline, the rest to do; done segments are 44 buttons, to-do ones are not', (count, done) => {
    const exercise = exerciseWith(count, done);
    const now = exercise.sets[done];
    const tree = render({ exercise, set: now, action: null });
    expect(allMatching(tree, /^set-segment-done-/)).toHaveLength(done);
    expect(allMatching(tree, /^set-segment-todo-/)).toHaveLength(count - done - 1);
    const outline = one(tree, `set-segment-now-${now.id}`);
    expect(outline.props.stroke).toBe(colors.gold);
    allMatching(tree, /^set-segment-done-/).forEach((segment) => expect(segment.props.stroke).toBe(colors.gold));
    allMatching(tree, /^set-segment-todo-/).forEach((segment) => expect(segment.props.stroke).toBe(colors.setSegmentTrack));
    const buttons = tree.root.findAll((node) => /^set-segment-\d+$/.test(node.props.testID ?? '') && node.props.onPress);
    expect(buttons).toHaveLength(done);
    buttons.forEach((button) => expect(StyleSheet.flatten(button.props.style)).toMatchObject({ width: 44, height: 44 }));
    expect(one(tree, 'set-arc').props.accessibilityLabel).toBe(`${count - done} sets left`);
    expect(text(one(tree, 'set-arc-count'))).toBe(`${count - done} sets left`);
  });

  it('the exercise\'s last set reads "Last set" in gold', () => {
    const exercise = exerciseWith(4, 3);
    const tree = render({ exercise, set: exercise.sets[3] });
    const count = tree.root.findAll((node) => node.props.testID === 'set-arc-count' && typeof node.type !== 'string')[0];
    expect(text(count)).toBe('Last set');
    expect(StyleSheet.flatten(count.props.style).color).toBe(colors.gold);
  });

  it('the 32 row: "Last time" before the first set, then the previous set\'s pill', () => {
    const fresh = exerciseWith(4, 0);
    let tree = render({ exercise: fresh, set: fresh.sets[0], lastTime: 'Last time 270 × 12' });
    expect(text(one(tree, 'set-last-time-10'))).toBe('Last time 270 × 12');
    const exercise = exerciseWith(4, 2);
    tree = render({ exercise, set: exercise.sets[2], lastTime: 'Last time 270 × 12' });
    expect(all(tree, 'set-last-time-12')).toHaveLength(0);
    const pill = tree.root.findAll((node) => node.props.testID === 'set-previous-11' && node.props.onPress)[0];
    expect(pill.props.accessibilityLabel).toBe('Set 2 done, 270 by 12. Tap to edit');
  });

  it('tapping the pill or a done segment selects that set (Q1); while editing the row holds Undo set k + Cancel', () => {
    const onSelectDone = jest.fn();
    const onUndo = jest.fn();
    const exercise = exerciseWith(4, 2);
    let tree = render({ exercise, set: exercise.sets[2], onSelectDone, onUndo });
    act(() => tree.root.findAll((node) => node.props.testID === 'set-previous-11' && node.props.onPress)[0].props.onPress());
    act(() => tree.root.findAll((node) => node.props.testID === 'set-segment-10' && node.props.onPress)[0].props.onPress());
    expect(onSelectDone.mock.calls.map(([item]) => item.id)).toEqual([11, 10]);
    expect(all(tree, 'set-undo-11')).toHaveLength(0);
    // Editing set 1: the steppers load it, its segment is the outline, Undo shows.
    tree = render({ exercise, set: exercise.sets[2], editing: exercise.sets[0], onSelectDone, onUndo });
    expect(one(tree, 'set-weight-10')).toBeDefined();
    expect(all(tree, 'set-weight-12')).toHaveLength(0);
    expect(one(tree, 'set-segment-now-10')).toBeDefined();
    const undo = tree.root.findAll((node) => node.props.testID === 'set-undo-10' && node.props.onPress)[0];
    expect(undo.props.accessibilityLabel).toBe('Undo set 1');
    act(() => undo.props.onPress());
    expect(onUndo.mock.calls[0][0].id).toBe(10);
    const onCancel = jest.fn();
    tree = render({ exercise, set: exercise.sets[2], editing: exercise.sets[0], onSelectDone, onUndo, onCancel });
    expect(all(tree, 'set-previous-11')).toHaveLength(0);
    act(() => tree.root.findAll((node) => node.props.testID === 'set-cancel-10' && node.props.onPress)[0].props.onPress());
    expect(onCancel.mock.calls[0][0].id).toBe(10);
  });

  it('every set done: all gold, "Done" in gold, "All sets done", no steppers', () => {
    const exercise = exerciseWith(4, 4);
    const tree = render({ exercise, set: null });
    expect(allMatching(tree, /^set-segment-done-/)).toHaveLength(4);
    const count = tree.root.findAll((node) => node.props.testID === 'set-arc-count' && typeof node.type !== 'string')[0];
    expect(text(count)).toBe('Done');
    expect(StyleSheet.flatten(count.props.style).color).toBe(colors.gold);
    expect(one(tree, 'set-arc').props.accessibilityLabel).toBe('All sets done');
    expect(all(tree, 'set-weight-13')).toHaveLength(0);
  });

  it('no glow on the now segment (T-86): one outline + its inner surface stroke only', () => {
    const exercise = exerciseWith(4, 1);
    const tree = render({ exercise, set: exercise.sets[1] });
    const paths = tree.root.findAll((node) => typeof node.type === 'string' && typeof node.props.d === 'string');
    const nowPaths = paths.filter((node) => node.props.d === one(tree, 'set-segment-now-11').props.d);
    expect(nowPaths.map((node) => node.props.stroke)).toEqual([colors.gold, colors.surface]);
    nowPaths.forEach((node) => expect(node.props.strokeOpacity).toBeUndefined());
  });

  // DECLARED S5 (T-146 rev 39, PM-approved): the steppers are 116 (was 128).
  // DECLARED (T-155 v2, owner: the compact card is the default: 108).
  it('large text: the Weight / Reps cells stack; a 108 minimum, never a fixed height', () => {
    mockFontScale = 2;
    const exercise = exerciseWith(4, 1);
    const tree = render({ exercise, set: exercise.sets[1] });
    const cell = tree.root.findAll((node) => node.props.testID === 'set-cell-weight' && typeof node.type === 'string')[0];
    const style = StyleSheet.flatten(cell.props.style);
    expect(style.minHeight).toBe(108);
    expect(style.height).toBeUndefined();
    expect(style.alignSelf).toBe('stretch');
  });

  // T-155 shots (iOS): the unit pill made the Weight label taller than the Reps one, so the two values sat apart.
  // DECLARED (T-161 spec §3.3): the slot and the unit select are 24 (were 28).
  it('the Weight and Reps labels share one 24 slot; the unit select is 24 with no vertical padding', () => {
    const exercise = exerciseWith(4, 1);
    const tree = render({ exercise, set: exercise.sets[1] });
    for (const id of ['set-cell-weight', 'set-cell-reps']) {
      const cell = tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
      expect(StyleSheet.flatten(cell.children[0].props.style)).toMatchObject({ minHeight: 24, justifyContent: 'center' });
    }
    const unit = tree.root.findAll((node) => node.props.testID === `set-unit-${exercise.sets[1].id}` && node.props.boxStyle)[0];
    expect(StyleSheet.flatten(unit.props.boxStyle)).toMatchObject({ minHeight: 24, borderRadius: 8, paddingVertical: 0, paddingHorizontal: 6 });
  });

  // T-146 rev 40: the phone browse card is read-only.
  it('browsing: no now outline, "Locked" in the Did it slot, the reps/Last time line, no steppers; done segments still edit', () => {
    const onSelectDone = jest.fn();
    const fresh = exerciseWith(4, 0);
    let tree = render({ exercise: fresh, set: null, browsing: true, browseLine: '8–12 reps · Last time 270 × 12', action: null });
    expect(text(tree.root.findAll((node) => node.props.testID === 'set-arc-count' && typeof node.type !== 'string')[0])).toBe('4 sets');
    expect(one(tree, 'set-locked')).toBeDefined();
    expect(text(one(tree, 'set-browse-line'))).toBe('8–12 reps · Last time 270 × 12');
    expect(all(tree, 'set-weight-10')).toHaveLength(0);
    expect(allMatching(tree, /^set-segment-now-/)).toHaveLength(0);
    expect(one(tree, 'set-arc').props.accessibilityLabel).toBe('Leg Press: 0 of 4 sets done, locked');
    const partly = exerciseWith(4, 2);
    tree = render({ exercise: partly, set: null, browsing: true, browseLine: '', onSelectDone });
    expect(text(tree.root.findAll((node) => node.props.testID === 'set-arc-count' && typeof node.type !== 'string')[0])).toBe('2 sets left');
    expect(all(tree, 'set-previous-row')).toHaveLength(0);
    act(() => tree.root.findAll((node) => node.props.testID === 'set-segment-10' && node.props.onPress)[0].props.onPress());
    expect(onSelectDone.mock.calls[0][0].id).toBe(10);
  });

  it('rev 39: the 32 row collapses when there is nothing to show (set 1, no history)', () => {
    const fresh = exerciseWith(4, 0);
    const tree = render({ exercise: fresh, set: fresh.sets[0], lastTime: null });
    expect(all(tree, 'set-previous-row')).toHaveLength(0);
  });
});

// T-170 (LIVE-WORKOUT-SPEC v2.3.1 §0.1): the arc count is Fit display text (1.3,
// was CAP_BODY 2.0, N6); the history / Undo / Cancel pills are un-marked (2.0).
describe('T-170 set card caps', () => {
  it('the arc count caps at 1.3; the history pill at 2.0', () => {
    const exercise = exerciseWith(4, 1);
    const tree = render({ exercise, set: exercise.sets[1] });
    const count = tree.root.findAll((node) => node.props.testID === 'set-arc-count' && typeof node.type === 'string')[0];
    expect(count.props.maxFontSizeMultiplier).toBe(1.3);
    const pill = tree.root.findAll((node) => node.type === 'Text' && /^Set 1\b/.test([].concat(node.props.children).join('')))[0];
    expect(pill.props.maxFontSizeMultiplier).toBe(2);
  });
});
