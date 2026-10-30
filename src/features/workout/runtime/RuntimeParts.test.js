import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import {
  BrowsingBar,
  DidItButton,
  DiscardWorkoutAction,
  ExerciseSegments,
  ExerciseStage,
  HowToButton,
  PHONE_VALUE_BOX,
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
import { NO_PHOTO_TILE as NO_PHOTO_TILE_LIVE } from './LiveStage';
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
    // T-132 (PM OK 29 Oct; web 2.1.15 SC:119-121): the phone plan name is one line that cuts off (ellipsis) and never
    // shrinks; the tablet (scale 2 here) keeps the title rule. Was: every scale adjustsFontSizeToFit true,
    // minimumFontScale 0.7.
    if (scale === 2) {
      expect(name.props).toMatchObject({ textBreakStrategy: 'simple', adjustsFontSizeToFit: true, minimumFontScale: 0.7, maxFontSizeMultiplier: 1.6 });
    } else {
      // DECLARED D3 (T-146 rev 25/26, PM-approved): never "…": 14 on one line, then one step smaller down to 12,
      // then 2 lines at 12/16 (measured). Was: numberOfLines 1 + ellipsizeMode 'tail'.
      expect(name.props).toMatchObject({ textBreakStrategy: 'simple', maxFontSizeMultiplier: 1.6 });
      expect(name.props.ellipsizeMode).toBeUndefined();
      expect(name.props.adjustsFontSizeToFit).toBeUndefined();
      expect(StyleSheet.flatten(name.props.style)).toMatchObject({ fontSize: 14, lineHeight: 18 });
      act(() => name.props.onTextLayout({ nativeEvent: { lines: [{}, {}] } }));
      act(() => name.props.onTextLayout({ nativeEvent: { lines: [{}, {}] } }));
      const twelve = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Upper / Lower Split')[0];
      expect(StyleSheet.flatten(twelve.props.style)).toMatchObject({ fontSize: 12, lineHeight: 16 });
      expect(twelve.props.numberOfLines).toBeUndefined();
      act(() => twelve.props.onTextLayout({ nativeEvent: { lines: [{}, {}] } }));
      const wrapped = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Upper / Lower Split')[0];
      expect(wrapped.props.numberOfLines).toBe(2);
      expect(StyleSheet.flatten(wrapped.props.style).fontSize).toBe(12);
    }
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
  // T-132 B2 (PM OK 29 Oct; web 2.1.15 ES:79-80): the phone live photo has NO solid block behind the caption, only the
  // 170 bottom fade to the ground; the T-110 scrim stays on the tablet stages (checked here on the tablet split).
  // Was: the phone live stage drew the scrim (32 band + the 0.86 solid block that grows with the caption).
  // DECLARED S2 (T-146 rev 39, PM-approved): nothing on the phone photo, so no fade either (was the 170 bottom fade).
  it('phone live: no scrim and no fade on the photo; the tablet keeps the T-110 scrim', () => {
    const phone = render(<ExerciseStage exercise={EXERCISE} index={0} count={2} isActive variant="live" />);
    expect(host(phone, 'exercise-stage-scrim')).toBeUndefined();
    expect(phone.root.findAll((node) => typeof node.type === 'string' && flat(node).height === 170 && flat(node).bottom === 0)).toHaveLength(0);
    const tree = render(<ExerciseStage exercise={EXERCISE} index={0} count={2} isActive variant="split" tablet />);
    expect(flat(host(tree, 'exercise-stage-scrim')).height).toBe(32);
    act(() => host(tree, 'exercise-stage-caption').props.onLayout({ nativeEvent: { layout: { height: 220 } } }));
    expect(flat(host(tree, 'exercise-stage-scrim')).height).toBe(252);
    expect(flat(host(tree, 'exercise-stage-scrim-solid'))).toMatchObject({ height: 220, backgroundColor: colors.groundTranslucent });
    expect(host(tree, 'exercise-stage-scrim').props.pointerEvents).toBe('none');
  });

  // T-132 B1 (PM OK 29 Oct; web 2.1.15 phone): the live photo carries the ring top-left and How to top-right, and its
  // bottom the eyebrow "Current exercise · n sets · reps · rest", the name and the muscle chip. Was: the eyebrow
  // 'Current exercise · Chest · 4/15 sets done', no chip, no ring, How to above the caption, minHeight 330.
  // DECLARED S1 (T-146 rev 39, PM-approved; was E10's 200 photo with How to + the caption ON it): the full photo (contain,
  // ≤ 240; 16:9 = 219 at 390 until loaded) with nothing on it; below it "Rest 90s · Chest" + How to on one row, then the
  // name. No ring chip, no muscle chip.
  it('live: the contain photo (≤ 240) with nothing on it; "Rest 90s · Chest" + How to on the row below; then the name', () => {
    const tree = render(<ExerciseStage exercise={EXERCISE} index={0} count={5} isActive howTo={<HowToButton onPress={jest.fn()} onPage />} />);
    const photo = host(tree, 'exercise-stage');
    expect(photo.findAll((node) => node.props.testID === 'remote-image')[0].props.resizeMode).toBe('contain');
    expect(photo.findAll((node) => node.type === 'Text')).toHaveLength(0);
    expect(photo.findAll((node) => node.props.testID === 'how-to-open')).toHaveLength(0);
    expect(flat(photo).height).toBe(Math.round(390 / (16 / 9)));
    const content = host(tree, 'exercise-stage-content');
    expect(content.findAll((node) => node.props.testID === 'how-to-open' && typeof node.type === 'string')).toHaveLength(1);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Rest 90s · Chest', 'Barbell Bench Press', 'How to']));
    expect(texts(tree)).not.toContain('1/3');
    expect(host(tree, 'stage-muscle-chip')).toBeUndefined();
    const name = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Barbell Bench Press')[0];
    expect(name.props.accessibilityRole).toBe('header');
    expect(name.props.maxFontSizeMultiplier).toBe(1.3);
    // The on-page How to: a 36 secondary pill with a 44 hit.
    expect(host(tree, 'how-to-open').findAll((node) => typeof node.type === 'string' && flat(node).minHeight === 36)).toHaveLength(1);
    expect(byId(tree, 'how-to-open').props.hitSlop).toBe(4);
  });

  // DECLARED B1 (T-146 rev 40, PM-approved): the phone browse stage is the rev 39 stage; "Exercise i of n" is the bottom
  // navigator's, the muscle folds into the line, no ring (was: "Exercise 4 of 5", the chip and the 64 ring).
  it('browsing (phone): the rev 39 stage; no "Exercise i of n", no muscle chip, no ring', () => {
    const tree = render(<ExerciseStage exercise={EXERCISE} index={3} count={5} isActive={false} variant="browse" />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Rest 90s · Chest', 'Barbell Bench Press']));
    expect(texts(tree)).not.toContain('Exercise 4 of 5');
    expect(host(tree, 'stage-muscle-chip')).toBeUndefined();
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === '1 of 3 sets done')).toHaveLength(0);
  });

  it('no photo: the hero initials tile; tablet split: the tablet eyebrow and display name', () => {
    const bare = { ...EXERCISE, exercise: { id: 7 } };
    const tree = render(<ExerciseStage exercise={bare} index={0} count={5} isActive variant="split" tablet />);
    expect(host(tree, 'stage-image-initials')).toBeDefined();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Current exercise · 3 sets · 8–10 reps · rest 90s']));
  });

  // DECLARED S3 (T-146 rev 39, PM-approved; was the 180 minimum stage with a top row): no photo → the 80 initials tile,
  // then the same text block under it (row + name); How to sits in the row.
  it('phone, no photo: the 80 tile, then "Rest · muscle" + How to and the name below it', () => {
    const bare = { ...EXERCISE, exercise: { id: 7, primary_muscle_group: { name: 'Chest', code: 'CHEST' } } };
    const tree = render(<ExerciseStage exercise={bare} index={0} count={5} isActive howTo={<HowToButton onPress={jest.fn()} onPage />} />);
    expect(flat(host(tree, 'stage-image-initials'))).toMatchObject({ width: NO_PHOTO_TILE_LIVE, height: NO_PHOTO_TILE_LIVE });
    expect(NO_PHOTO_TILE_LIVE).toBe(80);
    expect(host(tree, 'exercise-stage-content').findAll((node) => node.props.testID === 'how-to-open' && typeof node.type === 'string')).toHaveLength(1);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Rest 90s · Chest', 'Barbell Bench Press']));
  });

  // T-132 (web 2.1.15 ES:145-152; FE Q4): on phones the notes are a card UNDER the photo, not on it; blank → none.
  it('phone: the notes card sits under the photo (not in the stage); blank notes draw no card', () => {
    const tree = render(<ExerciseStage exercise={{ ...EXERCISE, notes: ' Slow down \nPause ' }} index={0} count={1} isActive />);
    const card = host(tree, 'exercise-notes');
    expect(flat(card)).toMatchObject({ marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 });
    expect(host(tree, 'exercise-stage').findAll((node) => node.props.testID === 'exercise-notes')).toHaveLength(0);
    expect(texts(tree)).toContain('Slow down \nPause');
    expect(host(render(<ExerciseStage exercise={{ ...EXERCISE, notes: '  ' }} index={0} count={1} isActive />), 'exercise-notes')).toBeUndefined();
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

  // T-132 V16 (web 2.1.15 SE:23-25, 141; FE Q7): the phone value is centred in a 58 box (no iOS line height), so it
  // sits evenly between the label and the steppers; the box grows with the 1.3 display cap. The tablet is unchanged.
  it('phone: weight and reps values sit centred in the 58 value box (placeholder and typed alike); the cell is label → value → steppers', () => {
    const tree = render(<SetEditor {...base} draft={{ actualWeightUnit: 'lb' }} />);
    [byId(tree, 'set-weight-12'), byId(tree, 'set-reps-12')].forEach((input) => {
      const style = flat(input);
      expect(style).toMatchObject({ minHeight: PHONE_VALUE_BOX, textAlignVertical: 'center', includeFontPadding: false, paddingVertical: 0, fontSize: 44, textAlign: 'center' });
      expect(style.lineHeight).toBeUndefined();
    });
    expect(PHONE_VALUE_BOX).toBe(58);
    expect(byId(tree, 'set-weight-12').props.value).toBe('');
    let cell = host(tree, 'set-weight-12').parent;
    while (cell && !(typeof cell.type === 'string' && flat(cell).padding === 12)) {
      cell = cell.parent;
    }
    expect(flat(cell)).toMatchObject({ gap: 8, padding: 12, borderRadius: 20 });
    const [column, steppers] = cell.children;
    expect(column.findAll((node) => node.props.testID === 'set-weight-12').length).toBeGreaterThan(0);
    expect(steppers.findAll((node) => node.props.testID === 'set-weight-plus-12').length).toBeGreaterThan(0);
  });

  it.each([
    [2, Math.round(58 * 1.3)],
    [1.2, Math.round(58 * 1.2)],
  ])('phone at %sx: the value box grows with the text, capped at the 1.3 display scale', (scale, box) => {
    mockFontScale = scale;
    const tree = render(<SetEditor {...base} />);
    expect(flat(byId(tree, 'set-reps-12')).minHeight).toBe(box);
  });

  it('tablet: the value keeps its 48 / 50 style and no box', () => {
    const tree = render(<SetEditor {...base} tablet />);
    const style = flat(byId(tree, 'set-weight-12'));
    expect(style).toMatchObject({ fontSize: 48, lineHeight: 50 });
    expect(style.minHeight).toBeUndefined();
    expect(style.textAlignVertical).toBeUndefined();
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
  // DECLARED E9 (T-146 board 4, PM-approved; FE Q3: still a button): the h64 card, 48 thumb, "Up next · {name}".
  it('Up next: the 64 card "Up next · {name}" with its 48 thumb, still a button', () => {
    const onPress = jest.fn();
    const tree = render(<UpNextLink exercise={EXERCISE} onPress={onPress} />);
    const link = byId(tree, 'up-next');
    expect(link.props).toMatchObject({ accessibilityLabel: 'Up next: Barbell Bench Press', accessibilityRole: 'button' });
    expect(StyleSheet.flatten(host(tree, 'up-next').props.style).minHeight).toBe(64);
    expect(byId(tree, 'up-next-thumb').props.size).toBe(48);
    expect(texts(tree)).toContain('Up next · ');
    const line = tree.root.findAll((node) => node.type === 'Text' && [].concat(node.props.children).includes('Barbell Bench Press'))[0];
    expect(line.props.numberOfLines).toBe(1);
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
