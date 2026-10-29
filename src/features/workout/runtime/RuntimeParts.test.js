import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import {
  BrowsingBar,
  DidItButton,
  DiscardWorkoutAction,
  ExerciseSegments,
  ExerciseStage,
  HowToButton,
  ReloadErrorBar,
  SessionChrome,
  SessionRail,
  SessionStats,
  SetEditor,
  StaleSessionBanner,
  UpNextLink,
  hitFor,
} from './RuntimeParts';
import { NBSP } from '../../../shared/format/counts';
import { colors } from '../../../shared/theme/tokens';

jest.mock('react-native-svg', () => {
  const Mock = ({ children }) => children ?? null;
  return { __esModule: true, default: Mock, Circle: Mock, Path: Mock, Rect: Mock, Defs: Mock, LinearGradient: Mock, Stop: Mock };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/components/GradientFill', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => {
  const { View } = require('react-native');
  return (props) => <View testID="remote-image" {...props} />;
});
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));

const trees = [];
afterEach(() => {
  mockFontScale = 1;
  act(() => trees.splice(0).forEach((tree) => tree.unmount()));
});

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  trees.push(tree);
  return tree;
}
// The control itself (a Pressable / PillButton), not a wrapper that only
// passes the testID through.
const byId = (tree, id) =>
  tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string' && (node.props.accessibilityRole !== undefined || node.props.title !== undefined || node.props.value !== undefined))[0] ??
  tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string')[0];
const filled = (tree, color) => tree.root.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.backgroundColor === color);
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).join(''));
const flat = (node, pressed = false) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed }) : node.props.style) ?? {};

const EXERCISE = {
  id: 1,
  exercise_name_snapshot: 'Barbell Bench Press',
  exercise: { id: 7, primary_muscle_group: { name: 'Chest', code: 'CHEST' }, thumbnail: { url: 'https://example.com/b.jpg' } },
  sets: [
    { id: 11, set_number: 1, is_completed: true, actual_weight_value: 135, actual_reps: 10, target_reps_min: 8, target_reps_max: 10, rest_seconds_planned: 90 },
    { id: 12, set_number: 2, is_completed: false, target_reps_min: 8, target_reps_max: 10, rest_seconds_planned: 90 },
    { id: 13, set_number: 3, is_completed: false, target_reps_min: 8, target_reps_max: 10, rest_seconds_planned: 90 },
  ],
};

describe('hit areas (F1 §0.6)', () => {
  it('pads drawn controls below 44 to a 44 hit area', () => {
    expect(hitFor(36)).toBe(4);
    expect(hitFor(40)).toBe(2);
    expect(hitFor(22)).toBe(11);
    expect(hitFor(48)).toBe(0);
  });
});

describe('SessionChrome (ND3)', () => {
  const props = { planName: 'Upper / Lower Split', completedSets: 4, totalSets: 15, exerciseCount: 5, elapsed: 1122, onExit: jest.fn(), onAll: jest.fn() };

  // DECLARED (T-105, PM OK 29 Oct): was '4/15 sets done' + the '18:42' pill on the phone; phones now show the subline
  // '4/15 sets' · '18:42' (no pill). The tablet keeps '4/15 sets done' + the pill (T-105 block below).
  it('shows Exit · plan + sets · m:ss · All (n), with 44 hit areas', () => {
    const tree = render(<SessionChrome {...props} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Exit', 'Upper / Lower Split', '4/15 sets', '18:42', 'All (5)']));
    expect(byId(tree, 'session-exit').props.hitSlop).toBe(2);
    expect(byId(tree, 'session-all').props.hitSlop).toBe(2);
    act(() => byId(tree, 'session-exit').props.onPress());
    act(() => byId(tree, 'session-all').props.onPress());
    expect(props.onExit).toHaveBeenCalled();
    expect(props.onAll).toHaveBeenCalled();
  });

  // DECLARED (T-105, PM OK 29 Oct): was "digits capped 1.2" on the phone header. The phone clock now sits in the
  // subline with the count's cap (1.6, found on the largest-text shot: it drew smaller than "0/17 sets"); the
  // tablet pill keeps 1.2. The timer role and the spoken label are unchanged.
  it('the timer is a timer whose spoken name moves at most every 30 s; digits capped 1.6 (phone subline) / 1.2 (tablet pill)', () => {
    for (const [tablet, cap] of [[false, 1.6], [true, 1.2]]) {
      const tree = render(<SessionChrome {...props} tablet={tablet} />);
      const timer = byId(tree, 'session-timer');
      expect(timer.props.accessibilityRole).toBe('timer');
      expect(timer.props.accessibilityLabel).toBe('Elapsed time 18 minutes 30 seconds');
      const digits = tree.root.findAll((node) => node.type === 'Text' && node.props.children === '18:42')[0];
      expect(digits.props.maxFontSizeMultiplier).toBe(cap);
      expect(StyleSheet.flatten(digits.props.style).fontVariant).toEqual(['tabular-nums']);
    }
  });

  it('pressed Exit shows the 4 % overlay (state rule)', () => {
    const tree = render(<SessionChrome {...props} />);
    const exit = byId(tree, 'session-exit');
    const pressed = render(exit.props.children({ pressed: true }));
    expect(filled(pressed, colors.pressOverlay).length).toBeGreaterThan(0);
  });

  it.each([1, 2, 3.1])('at %sx the plan name never breaks inside a word and the chrome reflows past 1.3×', (scale) => {
    mockFontScale = scale;
    const tree = render(<SessionChrome {...props} tablet={scale === 2} />);
    const name = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Upper / Lower Split')[0];
    expect(name.props).toMatchObject({ textBreakStrategy: 'simple', adjustsFontSizeToFit: true, minimumFontScale: 0.7, maxFontSizeMultiplier: 1.6 });
    // DECLARED path change (Batch 2 item 3): children = [rows, the gold rail].
    const [rows, rail] = host(tree, 'session-chrome').props.children;
    expect(rail.type).toBe(SessionRail);
    expect(rail.props).toMatchObject({ completedSets: props.completedSets, totalSets: props.totalSets, inChrome: true });
    // DECLARED (T-105, PM OK 29 Oct): was 2 rows past 1.3× (Exit · timer · All / the plan) and 4 children in one row;
    // now 3 rows (Exit · All / timer · Complete / the plan) and 5 children (+ Complete).
    if (scale > 1.3) {
      expect(rows.props.children).toHaveLength(3);
    } else {
      expect(rows.props.children).toHaveLength(5);
    }
  });
});


// T-105 (owner B, D1–D3; UX ruling §1 + look verdict 9bdb33c8; RN-SPEC-workout dated 29 Oct 2026).
describe('SessionChrome T-105: Complete in the header', () => {
  const props = { planName: 'Upper / Lower Split', completedSets: 4, totalSets: 15, exerciseCount: 5, elapsed: 1122, onExit: jest.fn(), onAll: jest.fn(), onComplete: jest.fn() };
  const timers = (tree) => tree.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityRole === 'timer');

  it('phone: "Complete" last in the row, 36 tall with a 44 hit, spoken "Complete workout"; tapping calls onComplete', () => {
    const tree = render(<SessionChrome {...props} />);
    const complete = byId(tree, 'complete-workout');
    expect(complete.props.accessibilityLabel).toBe('Complete workout');
    expect(complete.props.hitSlop).toBe(4);
    expect(texts(tree)).toContain('Complete');
    expect(texts(tree)).not.toContain('Complete workout');
    expect(flat(host(tree, 'complete-workout-glass'))).toMatchObject({ minHeight: 36, paddingHorizontal: 14, borderRadius: 999 });
    const [rows] = host(tree, 'session-chrome').props.children;
    expect(rows.props.children.at(-1).props.onPress).toBe(props.onComplete);
    act(() => complete.props.onPress());
    expect(props.onComplete).toHaveBeenCalled();
  });

  it('≥ 1024 the label is "Complete workout"', () => {
    const tree = render(<SessionChrome {...props} tablet wide />);
    expect(texts(tree)).toContain('Complete workout');
  });

  // Moved from RuntimeOverlays.test.js (DECLARED C): gold when no set is left, glass while one is, spinner while completing.
  it('tone: glass while sets are left, gold (+ glow) when none are; busy while completing; disabled while a save runs', () => {
    expect(host(render(<SessionChrome {...props} />), 'complete-workout-glass')).toBeDefined();
    const gold = render(<SessionChrome {...props} completePrimary />);
    expect(flat(host(gold, 'complete-workout-gold'))).toMatchObject({ backgroundColor: colors.gold });
    expect(flat(host(gold, 'complete-workout-gold')).boxShadow).toBeTruthy();
    const busy = render(<SessionChrome {...props} completing />);
    expect(byId(busy, 'complete-workout').props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(busy.root.findAll((node) => node.type?.name === 'Spinner').length).toBe(1);
    const saving = render(<SessionChrome {...props} completeDisabled />);
    expect(byId(saving, 'complete-workout').props.disabled).toBe(true);
  });

  it('phone: no timer pill; the subline "4/15 sets · 18:42" holds the ONE accessible timer (reviewer M1); SR "4/15 sets done"', () => {
    const tree = render(<SessionChrome {...props} />);
    const all = timers(tree);
    expect(all).toHaveLength(1);
    expect(all[0].props.testID).toBe('session-timer');
    expect(all[0].props.accessibilityElementsHidden).toBeFalsy();
    expect(all[0].props.accessibilityLabel).toBe('Elapsed time 18 minutes 30 seconds');
    expect(host(tree, 'session-subline')).toBeDefined();
    expect(host(tree, 'session-subline-count').props.accessibilityLabel).toBe('4/15 sets done');
    // UX T-105 LOW (DECLARED, was ' · '): non-breaking spaces round the dot, so iOS keeps the space before the clock.
    expect(texts(tree)).toEqual(expect.arrayContaining(['4/15 sets', `${NBSP}·${NBSP}`, '18:42']));
  });

  it('phone: when "4/15 sets" does not fit on one line, "sets" drops ("4/15 · 18:42"); SR unchanged', () => {
    const tree = render(<SessionChrome {...props} />);
    act(() => host(tree, 'session-subline-count').props.onTextLayout({ nativeEvent: { lines: [{}, {}] } }));
    expect(texts(tree)).toContain('4/15');
    expect(texts(tree)).not.toContain('4/15 sets');
    expect(host(tree, 'session-subline-count').props.accessibilityLabel).toBe('4/15 sets done');
    const fits = render(<SessionChrome {...props} />);
    act(() => host(fits, 'session-subline-count').props.onTextLayout({ nativeEvent: { lines: [{}] } }));
    expect(texts(fits)).toContain('4/15 sets');
  });

  it('tablet: the timer pill stays (the one timer) and the subline reads "4/15 sets done"', () => {
    const tree = render(<SessionChrome {...props} tablet />);
    expect(timers(tree)).toHaveLength(1);
    expect(host(tree, 'session-subline')).toBeUndefined();
    expect(texts(tree)).toEqual(expect.arrayContaining(['4/15 sets done', '18:42', 'Complete']));
  });

  it('large text: Exit · All / timer · Complete / the plan, all inside the sticky header', () => {
    mockFontScale = 2;
    const tree = render(<SessionChrome {...props} tablet />);
    const [rows] = host(tree, 'session-chrome').props.children;
    const [first, second, third] = rows.props.children;
    const ids = (row) => [].concat(row.props.children).map((child) => child?.props?.testID ?? child?.props?.label ?? null);
    expect(ids(first)).toEqual(['session-exit', null, 'session-all']);
    expect(ids(second)[0]).toBe('session-timer');
    expect(ids(second)[2]).toBe('Complete');
    expect(third.props.children.props.testID).toBe('session-plan');
  });
});

describe('ExerciseStage', () => {
  it('T-110 (UX): the ground behind the caption (≥ 0.85) grows with it, with a 32 band above; drawn from the first render', () => {
    const tree = render(<ExerciseStage exercise={EXERCISE} index={0} count={2} isActive variant="live" completedSets={4} totalSets={15} />);
    expect(flat(host(tree, 'exercise-stage-scrim')).height).toBe(32);
    act(() => host(tree, 'exercise-stage-caption').props.onLayout({ nativeEvent: { layout: { height: 220 } } }));
    expect(flat(host(tree, 'exercise-stage-scrim')).height).toBe(252);
    expect(flat(host(tree, 'exercise-stage-scrim-solid'))).toMatchObject({ height: 220, backgroundColor: colors.groundTranslucent });
    expect(host(tree, 'exercise-stage-scrim').props.pointerEvents).toBe('none');
  });

  it('live: the photo, "Current exercise · muscle · n/m sets done", the name as the header, How to', () => {
    const tree = render(
      <ExerciseStage exercise={EXERCISE} index={0} count={5} isActive completedSets={4} totalSets={15} howTo={<HowToButton onPress={jest.fn()} />} />
    );
    expect(host(tree, 'remote-image').props.url).toBe('https://example.com/b.jpg');
    expect(texts(tree)).toEqual(expect.arrayContaining(['Current exercise · Chest · 4/15 sets done', 'Barbell Bench Press', 'How to']));
    const name = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Barbell Bench Press')[0];
    expect(name.props.accessibilityRole).toBe('header');
    expect(name.props.maxFontSizeMultiplier).toBe(1.3);
    expect(byId(tree, 'how-to-open').props.hitSlop).toBe(4);
    expect(flat(host(tree, 'exercise-stage')).minHeight).toBe(330);
  });

  it('browsing: "Exercise i of n", the muscle chip and the 64 ring "done/total"', () => {
    const tree = render(<ExerciseStage exercise={EXERCISE} index={3} count={5} isActive={false} variant="browse" />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Exercise 4 of 5', 'Chest', '1/3']));
    expect(host(tree, 'stage-muscle-chip')).toBeDefined();
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === '1 of 3 sets done').length).toBeGreaterThan(0);
  });

  it('no photo: the hero initials tile; tablet split: the tablet eyebrow and display name', () => {
    const bare = { ...EXERCISE, exercise: { id: 7 } };
    const tree = render(<ExerciseStage exercise={bare} index={0} count={5} isActive variant="split" tablet />);
    expect(host(tree, 'stage-image-initials')).toBeDefined();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Current exercise · 3 sets · 8–10 reps · rest 90s']));
  });

  it('shows the exercise notes (v1 §19.2 kept)', () => {
    const tree = render(<ExerciseStage exercise={{ ...EXERCISE, notes: ' Slow down ' }} index={0} count={1} isActive />);
    expect(texts(tree)).toContain('Slow down');
  });
});

describe('progress marks', () => {
  it('segments: done gold full, partial to its share, empty 0; labelled "Exercise i of n"', () => {
    const exercises = [EXERCISE, { id: 2, sets: [{ id: 21, is_completed: false }] }, { id: 3, sets: [{ id: 31, is_completed: true }] }];
    const tree = render(<ExerciseSegments exercises={exercises} viewingIndex={0} />);
    const row = host(tree, 'exercise-segments');
    expect(row.props.accessibilityLabel).toBe('Exercise 1 of 3');
    const widths = row.props.children.map((segment) => StyleSheet.flatten(segment.props.children.props.style).width);
    expect(widths).toEqual(['33%', '0%', '100%']);
  });

  it('the rail fills to the sets done and is hidden from screen readers', () => {
    const tree = render(<SessionRail completedSets={4} totalSets={15} />);
    const rail = host(tree, 'session-rail');
    expect(rail.props.accessibilityElementsHidden).toBe(true);
    expect(StyleSheet.flatten(rail.props.children.props.style).width).toBe('27%');
  });
});

describe('SetEditor (single editor + strip)', () => {
  const base = {
    exercise: EXERCISE,
    set: EXERCISE.sets[1],
    draft: { actualWeightValue: '135', actualWeightUnit: 'lb' },
    reps: '10',
    lastTime: 'Last time 135 × 10',
    pendingSetIds: new Set(),
    onWeightChange: jest.fn(),
    onUnitChange: jest.fn(),
    onRepsChange: jest.fn(),
    onStep: jest.fn(),
    onToggleSet: jest.fn(),
  };

  it('header "Set 2 of 3 · rest 90s" + Last time; Weight + unit, Reps · target; steppers with names', () => {
    const tree = render(<SetEditor {...base} />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['of 3 · rest 90s', 'Last time 135 × 10', 'Weight', 'Reps · target 8–10']));
    expect(tree.root.findAll((node) => node.type === 'Text' && [].concat(node.props.children)[0] === 'Set 2 ')).toHaveLength(1);
    expect(byId(tree, 'set-weight-12').props).toMatchObject({ value: '135', accessibilityLabel: 'Weight for set 2', keyboardType: 'decimal-pad' });
    expect(byId(tree, 'set-reps-12').props).toMatchObject({ value: '10', accessibilityLabel: 'Reps for set 2', keyboardType: 'number-pad' });
    expect(byId(tree, 'set-unit-12').props.accessibilityLabel).toBe('Weight unit for set 2');
    for (const [id, label, field, direction] of [
      ['set-weight-minus-12', 'Decrease weight', 'weight', -1],
      ['set-weight-plus-12', 'Increase weight', 'weight', 1],
      ['set-reps-minus-12', 'Decrease reps', 'reps', -1],
      ['set-reps-plus-12', 'Increase reps', 'reps', 1],
    ]) {
      const stepper = byId(tree, id);
      expect(stepper.props.accessibilityLabel).toBe(label);
      expect(stepper.props.hitSlop).toBe(4);
      act(() => stepper.props.onPress());
      expect(base.onStep).toHaveBeenLastCalledWith(field, direction);
    }
  });

  it('no Last time → no line and no gap', () => {
    const tree = render(<SetEditor {...base} lastTime={null} />);
    expect(host(tree, 'set-last-time-12')).toBeUndefined();
  });

  it('strip: the done chip is "Undo" (set in the description), "now", locked chips disabled with the hint', () => {
    const tree = render(<SetEditor {...base} />);
    const undo = byId(tree, 'set-action-11');
    expect(undo.props).toMatchObject({ accessibilityLabel: 'Undo', accessibilityHint: 'Set 1 done, 135 × 10' });
    expect(texts(tree)).toEqual(expect.arrayContaining(['135 × 10 · Undo', 'Set 2 · now', 'Set 3']));
    act(() => undo.props.onPress());
    expect(base.onToggleSet).toHaveBeenCalledWith(EXERCISE.sets[0]);
    const locked = byId(tree, 'set-action-13');
    expect(locked.props).toMatchObject({ disabled: true, accessibilityHint: 'Finish the previous set first' });
    expect(StyleSheet.flatten(locked.props.style).backgroundColor).toBe(colors.fillWell);
    const lockedText = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Set 3')[0];
    expect(StyleSheet.flatten(lockedText.props.style).color).toBe(colors.textFaint);
  });

  it('a done chip in flight reads "Saving…" and is disabled', () => {
    const tree = render(<SetEditor {...base} pendingSetIds={new Set([11])} />);
    expect(byId(tree, 'set-action-11').props).toMatchObject({ accessibilityLabel: 'Saving…', disabled: true });
  });

  it('focus and error looks; the error is announced', () => {
    const tree = render(<SetEditor {...base} validationError="Weight must be greater than 0." />);
    const error = host(tree, 'weight-error-12');
    expect(error.props.accessibilityLiveRegion).toBe('assertive');
    expect(StyleSheet.flatten(byId(tree, 'set-weight-12').props.style).color).toBe(colors.dangerText);
    act(() => byId(tree, 'set-reps-12').props.onFocus());
    const focused = tree.root.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.borderColor === colors.gold);
    expect(focused.length).toBeGreaterThan(0);
    act(() => byId(tree, 'set-reps-12').props.onBlur());
  });

  it('highlight after rest: the 2 px gold ring', () => {
    const tree = render(<SetEditor {...base} highlighted />);
    expect(flat(host(tree, 'set-editor'))).toMatchObject({ outlineWidth: 2, outlineColor: colors.goldStrong });
  });

  it('every set done: only the strip', () => {
    const tree = render(<SetEditor {...base} set={null} />);
    expect(byId(tree, 'set-weight-12')).toBeUndefined();
    expect(host(tree, 'set-strip')).toBeDefined();
  });

  it.each([1, 2, 3.1])('at %sx the cells stack past 1.3× and inputs cap at the display scale', (scale) => {
    mockFontScale = scale;
    const tree = render(<SetEditor {...base} />);
    expect(byId(tree, 'set-weight-12').props.maxFontSizeMultiplier).toBe(1.3);
    const cells = tree.root.findAll((node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style)?.flexDirection === 'column' && StyleSheet.flatten(node.props.style)?.gap === 10);
    expect(cells.length > 0).toBe(scale > 1.3);
  });
});

describe('DidItButton', () => {
  const set = { id: 12 };

  // QA LOW swipe-press (the dock sits outside the scroll): a swipe that starts on "Did it" never logs the set.
  it('a 40 px swipe that starts on Did it does not fire; a tap still does', () => {
    const touch = (x, y) => ({
      persist() {},
      currentTarget: { measure: jest.fn() },
      nativeEvent: { pageX: x, pageY: y, locationX: x, locationY: y, timestamp: Date.now(), touches: [], changedTouches: [] },
    });
    const onPress = jest.fn();
    const tree = render(<DidItButton set={set} onPress={onPress} />);
    const host = tree.root.find((node) => typeof node.type === 'string' && typeof node.props.onResponderGrant === 'function');
    act(() => host.props.onResponderGrant(touch(100, 200)));
    act(() => host.props.onResponderMove(touch(100, 160)));
    act(() => host.props.onResponderRelease(touch(100, 160)));
    expect(onPress).not.toHaveBeenCalled();
    act(() => host.props.onResponderGrant(touch(100, 200)));
    act(() => host.props.onResponderRelease(touch(102, 204)));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('"Did it", 64 tall, gold with the large glow; pressed adds the ink overlay', () => {
    const onPress = jest.fn();
    const tree = render(<DidItButton set={set} onPress={onPress} />);
    const button = byId(tree, 'set-action-12');
    expect(button.props.accessibilityLabel).toBe('Did it');
    expect(flat(button)).toMatchObject({ minHeight: 64, backgroundColor: colors.gold });
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalled();
    const pressed = render(<>{button.props.children({ pressed: true })}</>);
    expect(filled(pressed, colors.pressOverlayInk)).toHaveLength(1);
  });

  // DECLARED change (UX verdict P3-2, faf7f85): disabled was a dimmed gold (was: expect(flat(button).opacity).toBe(0.5)).
  // Now the drawn look: glass 0.05 fill, 1px 0.08 border, faint text + check, no gold, no glow, no opacity.
  it('saving and locked: disabled = glass 0.05 + 1px 0.08 border + faint text (P3-2); locked carries the rest hint', () => {
    const saving = render(<DidItButton set={set} isPending />);
    expect(byId(saving, 'set-action-12').props).toMatchObject({ accessibilityLabel: 'Saving…', disabled: true });
    const locked = render(<DidItButton set={set} isLocked lockReason="Rest timer running — wait or skip it first" />);
    const button = byId(locked, 'set-action-12');
    expect(button.props.accessibilityHint).toBe('Rest timer running — wait or skip it first');
    for (const tree of [saving, locked]) {
      const style = flat(byId(tree, 'set-action-12'));
      // DECLARED (kit batch, reviewer LOW): the disabled border has its own alias
      // (was the borrowed colors.choiceBorder; same value).
      expect(style).toMatchObject({ backgroundColor: colors.fillChip, borderWidth: 1, borderColor: colors.glassDisabledBorder });
      expect(colors.fillChip).toBe('rgba(255, 255, 255, 0.05)');
      expect(colors.glassDisabledBorder).toBe('rgba(255, 255, 255, 0.08)');
      expect(style.opacity).toBeUndefined();
      expect(style.boxShadow).toBe('none');
      const label = tree.root.findAll((node) => node.type === 'Text')[0];
      expect(flat(label).color).toBe(colors.textFaint);
      // The check icon goes faint too (no on-gold ink on glass).
      const icon = tree.root.findAll((node) => typeof node.type !== 'string' && node.props.color !== undefined && node.props.size === 20)[0];
      expect(icon.props.color).toBe(colors.textFaint);
      // No press overlay while disabled.
      expect(filled(render(<>{byId(tree, 'set-action-12').props.children({ pressed: true })}</>), colors.pressOverlayInk)).toHaveLength(0);
    }
  });

  it('enabled keeps the gold look: on-gold text + check, no border (P3-2)', () => {
    const tree = render(<DidItButton set={set} />);
    const style = flat(byId(tree, 'set-action-12'));
    expect(style.borderWidth).toBeUndefined();
    expect(flat(tree.root.findAll((node) => node.type === 'Text')[0]).color).toBe(colors.onGold);
    const icon = tree.root.findAll((node) => typeof node.type !== 'string' && node.props.color !== undefined && node.props.size === 20)[0];
    expect(icon.props.color).toBe(colors.onGold);
  });
});

describe('the rest of the parts', () => {
  it('Up next: "Up next: {name}" with a 44 hit area', () => {
    const onPress = jest.fn();
    const tree = render(<UpNextLink exercise={EXERCISE} onPress={onPress} />);
    const link = byId(tree, 'up-next');
    expect(link.props).toMatchObject({ accessibilityLabel: 'Up next: Barbell Bench Press', hitSlop: 11 });
    act(() => link.props.onPress());
    expect(onPress).toHaveBeenCalled();
  });

  it('Browsing bar: the copy and Resume; past 1.3× it stacks with a full-width Resume', () => {
    const onResume = jest.fn();
    let tree = render(<BrowsingBar onResume={onResume} />);
    expect(texts(tree)).toContain('You’re browsing — active set is waiting'.replace('’', "'"));
    act(() => byId(tree, 'browsing-resume').props.onPress());
    expect(onResume).toHaveBeenCalled();
    mockFontScale = 3.1;
    tree = render(<BrowsingBar onResume={onResume} tablet />);
    expect(flat(host(tree, 'browsing-bar')).flexDirection).toBe('column');
    expect(byId(tree, 'browsing-resume').props.fullWidth).toBe(true);
  });

  it('Stats: Time / Volume / Reps; the 3 columns become rows past 1.3×; tablet tiles', () => {
    let tree = render(<SessionStats time="18m 42s" volume="1,350" volumeUnit="lb" reps="40" />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Time', '18m 42s', 'Volume', '1,350 lb', 'Reps', '40']));
    expect(flat(host(tree, 'session-stats')).flexDirection).toBe('row');
    tree = render(<SessionStats time="—" volume="—" volumeUnit="kg" reps="0" />);
    expect(texts(tree)).toContain('—');
    expect(texts(tree)).not.toContain('— kg');
    tree = render(<SessionStats time="1m" volume="10" volumeUnit="kg" reps="1" tablet />);
    expect(host(tree, 'session-stat-volume')).toBeDefined();
    mockFontScale = 2;
    tree = render(<SessionStats time="1m" volume="10" volumeUnit="kg" reps="1" tablet />);
    expect(flat(host(tree, 'session-stats')).flexDirection).toBe('column');
  });

  it('Discard workout: danger text, pressed danger-faint, "Exiting…" in flight', () => {
    const onPress = jest.fn();
    let tree = render(<DiscardWorkoutAction abandoning={false} onPress={onPress} />);
    const button = byId(tree, 'discard-workout');
    expect(flat(button, true).backgroundColor).toBe(colors.dangerFaint);
    expect(flat(button, false).backgroundColor).toBeUndefined();
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalled();
    tree = render(<DiscardWorkoutAction abandoning onPress={onPress} />);
    expect(texts(tree)).toContain('Exiting…');
    expect(byId(tree, 'discard-workout').props.disabled).toBe(true);
  });

  it('stale banner and reload error keep their copy; Retry → Retrying…', () => {
    let tree = render(<StaleSessionBanner title="Started Monday, Sep 21" />);
    expect(texts(tree)).toContain('Started Monday, Sep 21');
    const onRetry = jest.fn();
    tree = render(<ReloadErrorBar retrying={false} onRetry={onRetry} />);
    act(() => byId(tree, 'reload-error-retry').props.onPress());
    expect(onRetry).toHaveBeenCalled();
    tree = render(<ReloadErrorBar retrying onRetry={onRetry} />);
    expect(byId(tree, 'reload-error-retry').props).toMatchObject({ title: 'Retrying…', disabled: true });
  });
});
