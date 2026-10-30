// v2 Phase 4 §1 (UX H Plan detail #9 / Tablet: Plan detail #89): every
// state and action of S2 on phone and tablet, approved #9 "This week",
// N2 Retry, N3 hero photo, and §9 large text at 1 / 2 / 3.1.
let mockWindow = { width: 390, height: 844, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ scale: 3, ...mockWindow }),
}));
const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}), canGoBack: jest.fn(() => true), goBack: jest.fn() };
let mockRoute = { key: 'PlanDetail-1', name: 'PlanDetail', params: { planId: '5' } };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock('../../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children, testID, glow }) => (
    <View testID={testID} glow={glow}>
      {children}
    </View>
  );
});
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn() }));
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../../shared/components/toastStore', () => ({ ...jest.requireActual('../../../shared/components/toastStore'), ToastTone: { success: 'success', error: 'error' }, addToast: jest.fn() }));
jest.mock('../../myPlans/api/myPlansApi', () => ({ copyToMyPlans: jest.fn() }));
jest.mock('../api/libraryApi', () => ({
  getPlan: jest.fn(),
  listPlanDays: jest.fn(),
  listDayExercises: jest.fn(),
  getCurrentPlan: jest.fn(),
  getCurrentWeek: jest.fn(),
  cancelEnrollment: jest.fn(),
  enrollInPlan: jest.fn(),
  createSchedule: jest.fn(),
  replaceSchedule: jest.fn(),
}));

import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { InlineError } from '../../../shared/components/FeedbackBox';
import Loader from '../../../shared/components/Loader';
import PillButton from '../../../shared/components/PillButton';
import StatusPill from '../../../shared/components/StatusPill';
import GradientFill from '../../../shared/components/GradientFill';
import { colors, gradients, radii, textScale } from '../../../shared/theme/tokens';
import { handOffToWorkout, openShellPath } from '../../shell/shellLinks';
import {
  cancelEnrollment,
  createSchedule,
  enrollInPlan,
  getCurrentPlan,
  getCurrentWeek,
  getPlan,
  listDayExercises,
  listPlanDays,
  replaceSchedule,
} from '../api/libraryApi';
import PlanDetailScreen, { PLAN_DETAIL_GLOW } from './PlanDetailScreen';

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map(textOf);
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const button = (tree, id) => tree.root.findAllByType(PillButton).find((node) => node.props.testID === id);
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const pending = () => new Promise(() => {});

const ex = (id, name, extra = {}) => ({
  id,
  exercise_id: id * 10,
  exercise: { id: id * 10, name, primary_muscle_group: { name: 'Chest', code: 'chest' } },
  target_set_summary: { set_count: 3, target_reps_min: 8, target_reps_max: 10 },
  ...extra,
});
const PLAN = { id: 5, name: 'Upper / Lower Split', description: 'Four days a week.', category: { name: 'Strength' }, difficulty_level: { name: 'Intermediate' } };
const DAYS = [
  { id: 51, day_number: 1, title: 'Upper A' },
  { id: 52, day_number: 2, title: 'Lower A' },
  { id: 53, day_number: 3, title: 'Upper B' },
];
const EXERCISES = {
  51: [ex(1, 'Bench Press'), ex(2, 'Lat Pulldown'), ex(3, 'Overhead Press'), ex(4, 'Dumbbell Row'), ex(5, 'Curl')],
  52: [ex(6, 'Squat', { notes: '  Go deep ' })],
  53: [],
};
const weekday = (id, name) => ({ id, name });
const CURRENT = {
  enrollment: { id: 90, workout_plan_id: 5, plan: { id: 5, name: 'Upper / Lower Split' } },
  schedule: [
    { weekday: weekday(1, 'Monday'), plan_day: DAYS[0] },
    { weekday: weekday(2, 'Tuesday'), plan_day: DAYS[1] },
    { weekday: weekday(4, 'Thursday'), plan_day: DAYS[2] },
  ],
};
const OTHER = { enrollment: { id: 77, workout_plan_id: 9, plan: { id: 9, name: 'Other' } }, schedule: [] };
const WEEK = [
  { weekday: weekday(1, 'Monday'), is_workout_day: true, plan_day: DAYS[1], date: '2026-10-26', status: 'done' },
  { weekday: weekday(2, 'Tuesday'), is_workout_day: true, plan_day: DAYS[2], date: '2026-10-27', status: 'missed' },
  { weekday: weekday(3, 'Wednesday'), is_workout_day: false, date: '2026-10-28', status: 'rest' },
  { weekday: weekday(4, 'Thursday'), is_workout_day: true, plan_day: DAYS[0], date: '2026-10-29', status: 'today' },
  { weekday: weekday(5, 'Friday'), is_workout_day: true, plan_day: DAYS[1], date: '2026-10-30', status: 'upcoming' },
];

function setup({ current = CURRENT, week = WEEK } = {}) {
  getPlan.mockResolvedValue({ plan: PLAN });
  listPlanDays.mockResolvedValue(DAYS);
  listDayExercises.mockImplementation((planId, dayId) => Promise.resolve(EXERCISES[dayId]));
  getCurrentPlan.mockResolvedValue(current);
  getCurrentWeek.mockResolvedValue(week);
}

async function render() {
  let tree;
  await act(async () => {
    tree = create(<PlanDetailScreen />);
  });
  return tree;
}

// T-81: the This week slot states depend on the local date (slotState), so
// only Date is faked: Thursday 29 Oct 2026 (the WEEK's "today"); promises and
// timers stay real.
const REAL_TIMERS = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'];
afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 29, 10, 0, 0), doNotFake: REAL_TIMERS });
  jest.clearAllMocks();
  mockWindow = { width: 390, height: 844, fontScale: 1 };
  mockRoute = { key: 'PlanDetail-1', name: 'PlanDetail', params: { planId: '5' } };
  setup();
});

describe('Plan detail states', () => {
  it('loading: "Loading plan"', async () => {
    getPlan.mockReturnValue(pending());
    const tree = await render();
    expect(tree.root.findByType(Loader).props.label).toBe('Loading plan');
  });

  it('error (N2): "Plan unavailable" with the back link and a Retry that re-runs the load', async () => {
    listPlanDays.mockResolvedValueOnce({ items: 'broken' });
    const tree = await render();
    expect(tree.root.findByType(InlineError).props.title).toBe('Plan unavailable');
    expect(pressable(tree, 'plan-detail-back')).toBeDefined();
    await act(async () => pressable(tree, 'plan-detail-retry').props.onPress());
    expect(listPlanDays).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType(InlineError)).toHaveLength(0);
    expect(texts(tree)).toContain('Workout days');
  });

  // Audit b1 X4 (RN-SPEC-plans §4.2 dated 27 Oct 2026): plan null AND GET /plans/{id} rejected with anything but
  // a 404 → the error state, never the hollow page of zeros; Retry re-runs the whole load.
  it.each([
    ['a 500', { response: { status: 500, data: {} }, message: 'Request failed with status code 500' }],
    ['no response', { message: 'Network Error' }],
  ])('X4: GET /plans/{id} fails with %s and no matching enrollment → "Plan unavailable" + Retry (no hollow page)', async (_name, failure) => {
    getPlan.mockRejectedValueOnce(failure);
    getCurrentPlan.mockResolvedValue(null);
    const tree = await render();
    expect(tree.root.findByType(InlineError).props.title).toBe('Plan unavailable');
    expect(texts(tree)).not.toContain('Workout days');
    expect(pressable(tree, 'plan-detail-back')).toBeDefined();
    await act(async () => pressable(tree, 'plan-detail-retry').props.onPress());
    expect(getPlan).toHaveBeenCalledTimes(2);
    expect(listPlanDays).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType(InlineError)).toHaveLength(0);
    expect(texts(tree)).toContain('Workout days');
  });

  it('X4: a 500 on GET /plans/{id} with a matching enrollment still shows the plan (the fallback); a 404 keeps ⚠8', async () => {
    getPlan.mockRejectedValue({ response: { status: 500, data: {} } });
    getCurrentPlan.mockResolvedValue(CURRENT);
    let tree = await render();
    expect(tree.root.findAllByType(InlineError)).toHaveLength(0);
    expect(texts(tree)).toContain('Upper / Lower Split');
    getPlan.mockRejectedValue({ response: { status: 404 } });
    getCurrentPlan.mockResolvedValue(null);
    tree = await render();
    expect(tree.root.findAllByType(InlineError)).toHaveLength(0);
  });

  it('the phone page glow is the board radial (glow-gold-ambient)', async () => {
    const tree = await render();
    expect(host(tree, 'plan-detail-screen').props.glow).toBe(PLAN_DETAIL_GLOW);
    expect(PLAN_DETAIL_GLOW.colors).toEqual(['rgba(255, 194, 26, 0.18)', 'rgba(255, 194, 26, 0)']);
  });

  it('a failed week read only hides "This week"', async () => {
    getCurrentWeek.mockRejectedValue(new Error('boom'));
    const tree = await render();
    expect(host(tree, 'plan-this-week')).toBeUndefined();
    expect(texts(tree)).toContain('Workout days');
  });

  it('a week without statuses (BE #9 not live) shows no "This week" and the schedule CTA is the gold one', async () => {
    getCurrentWeek.mockResolvedValue(WEEK.map(({ status, ...rest }) => rest));
    const tree = await render();
    expect(host(tree, 'plan-this-week')).toBeUndefined();
    expect(button(tree, 'plan-activate').props.variant).toBe('primary');
  });
});

describe('Plan detail (phone), the current plan', () => {
  it('back pill → Plans; the teal "Current plan" pill; summary, stats and the × / week pill', async () => {
    const tree = await render();
    await act(async () => pressable(tree, 'plan-detail-back').props.onPress());
    // DECLARED (T-65, PHONE-NAV spec §3 / §5): was push('PlansLibrary'). The pill goes back in history (else replaces to Plans).
    expect(mockNavigation.goBack).toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalledWith('PlansLibrary');
    const pill = tree.root.findAllByType(StatusPill).find((node) => node.props.testID === 'plan-detail-current');
    // DECLARED (T-91 UX, PM OK 29 Oct): teal at every width, as web. Was: 'gold'.
    expect([pill.props.label, pill.props.tone]).toEqual(['Current plan', 'active']);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Strength', 'Upper / Lower Split', 'Four days a week.', '3', 'Days', '6', 'Exercises', 'Intermediate', 'Level', '3× / week']));
    expect(flat(host(tree, 'plan-stat-days'))).toEqual(expect.objectContaining({ borderRadius: radii.lg, backgroundColor: colors.surface }));
  });

  it('"This week": Today (gold card, Start announced "Start Upper A" → Workout), missed + upcoming, one done summary', async () => {
    const tree = await render();
    const today = host(tree, 'plan-week-today');
    expect(flat(today)).toEqual(expect.objectContaining({ borderColor: colors.goldStrong, borderRadius: radii.xl }));
    const start = pressable(tree, 'plan-week-start');
    expect(start.props.accessibilityLabel).toBe('Start Upper A');
    await act(async () => start.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/workout');
    expect(texts(tree)).toEqual(expect.arrayContaining(['THU', '29', 'TUE', 'FRI', '30', 'Today', '5 exercises · Chest', 'Missed', 'Done Mon']));
    expect(texts(tree)).toContain('Lower A');
    expect(host(tree, 'plan-week-missed-pill')).toBeDefined();
    expect(host(tree, 'plan-week-done').props.accessibilityLabel).toBe('Lower A, Done Mon');
  });

  it('the strip: 4 cells, the 4th dimmed with "+2"; a cell opens Exercise detail', async () => {
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Bench Press · 3×8-10', '+2']));
    const cell = pressable(tree, 'plan-week-exercise-1');
    expect(cell.props.accessibilityLabel).toBe('Open Bench Press');
    await act(async () => cell.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('ExerciseDetail', { exerciseId: '10' });
    expect(pressable(tree, 'plan-week-exercise-5')).toBeUndefined();
  });

  it('with Today Start on the page the "Update schedule" CTA is glass (one gold action)', async () => {
    const tree = await render();
    const cta = button(tree, 'plan-activate');
    expect([cta.props.title, cta.props.variant]).toEqual(['Update schedule', 'secondary']);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Schedule', 'Your training days', 'Selected: Mon, Tue, Thu']));
  });

  it('Update schedule PUTs the schedule and hands off to Workout', async () => {
    replaceSchedule.mockResolvedValue({});
    const tree = await render();
    await act(async () => button(tree, 'plan-activate').props.onPress());
    expect(replaceSchedule).toHaveBeenCalledWith(90, [
      { workout_plan_day_id: 51, weekday_id: 1 },
      { workout_plan_day_id: 52, weekday_id: 2 },
      { workout_plan_day_id: 53, weekday_id: 4 },
    ]);
    expect(handOffToWorkout).toHaveBeenCalledWith(mockNavigation, mockRoute, 'Upper / Lower Split schedule updated.');
  });

  it('too few days: "Select 3 workout days to continue." as the activation error toast', async () => {
    const tree = await render();
    await act(async () => pressable(tree, 'plan-weekday-1').props.onPress());
    await act(async () => button(tree, 'plan-activate').props.onPress());
    expect(texts(tree)).toEqual(expect.arrayContaining(['Plan activation failed', 'Select 3\u00a0workout days to continue.']));
    expect(replaceSchedule).not.toHaveBeenCalled();
  });
});

describe('Plan detail "This week", T-81 (PM ruling 3: per-slot cards; slotState)', () => {
  const ids = (tree) =>
    tree.root
      .findAll((node) => typeof node.type === 'string' && /^plan-week-(today$|missed-\d|upcoming-|done$|notStarted-\d+-\d+$)/.test(node.props.testID ?? ''))
      .map((node) => node.props.testID);

  it('started Wed: Tue (a past slot before started_on) is Not started — no Missed pill, after Done, the caption, SR "Tue: not started"', async () => {
    setup({ current: { ...CURRENT, enrollment: { ...CURRENT.enrollment, started_on: '2026-10-28' } } });
    const tree = await render();
    expect(ids(tree)).toEqual(['plan-week-today', 'plan-week-upcoming-5-52', 'plan-week-done', 'plan-week-notStarted-2-53']);
    expect(host(tree, 'plan-week-missed-pill')).toBeUndefined();
    expect(texts(tree)).not.toContain('Missed');
    const card = host(tree, 'plan-week-notStarted-2-53');
    expect(card.props.accessibilityLabel).toBe('Tue: not started, Upper B');
    // DECLARED (UX T-81 B2 / ruling 3): was backgroundColor colors.fillSkeleton (0.07); now the
    // white 0.06 (colors.sheenCard), plus the muted tile text, text-secondary title and "Not started" meta.
    const tile = host(tree, 'plan-week-notStarted-tile-2-53');
    expect(flat(tile)).toEqual(expect.objectContaining({ backgroundColor: colors.sheenCard }));
    expect(tile.findAll((node) => node.type === 'Text').map((node) => [textOf(node), flat(node).color])).toEqual([
      ['TUE', colors.textMuted],
      ['27', colors.textMuted],
    ]);
    expect(textOf(host(tree, 'plan-week-notStarted-title-2-53'))).toBe('Upper B');
    expect(flat(host(tree, 'plan-week-notStarted-title-2-53')).color).toBe(colors.textSecondary);
    const meta = host(tree, 'plan-week-notStarted-meta-2-53');
    expect(textOf(meta)).toBe('Not started');
    expect(flat(meta)).toEqual(expect.objectContaining({ fontSize: 13, color: colors.textMuted }));
    // No photos on the Not-started card.
    expect(card.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('plan-week-thumb-'))).toHaveLength(0);
    expect(textOf(host(tree, 'plan-week-caption'))).toBe('Your plan started Wednesday.');
    // Done stays the slot status: Mon (before the start) is still Done.
    expect(host(tree, 'plan-week-done').props.accessibilityLabel).toBe('Lower A, Done Mon');
  });

  it('a training slot the server returns as "rest" before started_on gets a Not started card; started_on is date-only', async () => {
    const week = WEEK.map((item) => (item.weekday.id === 2 ? { ...item, status: 'rest' } : item));
    setup({ current: { ...CURRENT, enrollment: { ...CURRENT.enrollment, started_on: '2026-10-28T23:30:00Z' } }, week });
    const tree = await render();
    expect(host(tree, 'plan-week-notStarted-2-53')).toBeDefined();
    expect(textOf(host(tree, 'plan-week-caption'))).toBe('Your plan started Wednesday.');
  });

  it('no started_on: no Not started card and no caption (missed stays missed)', async () => {
    const tree = await render();
    expect(ids(tree)).toEqual(['plan-week-missed-2-53', 'plan-week-today', 'plan-week-upcoming-5-52', 'plan-week-done']);
    expect(host(tree, 'plan-week-caption')).toBeUndefined();
  });

  it('a past "upcoming" slot reads as Missed by the local date (slotState), not the stale server status', async () => {
    jest.setSystemTime(new Date(2026, 9, 31, 9, 0, 0));
    const tree = await render();
    expect(host(tree, 'plan-week-missed-5-52')).toBeDefined();
    expect(host(tree, 'plan-week-upcoming-5-52')).toBeUndefined();
  });
});

describe('Plan detail (phone), not the current plan', () => {
  beforeEach(() => setup({ current: OTHER, week: WEEK }));

  it('no pill, no "This week"; "Start this plan" / "Pick 3 workout days"; the gold "Start workout plan"', async () => {
    const tree = await render();
    expect(host(tree, 'plan-detail-current')).toBeUndefined();
    expect(host(tree, 'plan-this-week')).toBeUndefined();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Start this plan', 'Pick 3\u00a0workout days']));
    const cta = button(tree, 'plan-activate');
    expect([cta.props.title, cta.props.variant, cta.props.disabled]).toEqual(['Start workout plan', 'primary', false]);
  });

  it('Start workout plan: cancel the current plan, enrol, POST the schedule, then Workout', async () => {
    cancelEnrollment.mockResolvedValue({});
    enrollInPlan.mockResolvedValue({ enrollment: { id: 123 } });
    createSchedule.mockResolvedValue({});
    const tree = await render();
    await act(async () => button(tree, 'plan-activate').props.onPress());
    expect(cancelEnrollment).toHaveBeenCalledWith(77);
    expect(enrollInPlan).toHaveBeenCalledWith(expect.objectContaining({ workout_plan_id: 5 }));
    expect(createSchedule).toHaveBeenCalledWith(123, expect.any(Array));
    expect(handOffToWorkout).toHaveBeenCalledWith(mockNavigation, mockRoute, 'Upper / Lower Split activated.');
  });

  it('review LOW: a double tap on Start workout plan runs ONE activation', async () => {
    cancelEnrollment.mockReturnValue(pending());
    const tree = await render();
    const onPress = button(tree, 'plan-activate').props.onPress;
    await act(async () => {
      onPress();
      onPress();
    });
    expect(cancelEnrollment).toHaveBeenCalledTimes(1);
  });

  it('activating: the CTA is loading (spinner, disabled)', async () => {
    cancelEnrollment.mockReturnValue(pending());
    const tree = await render();
    await act(async () => {
      button(tree, 'plan-activate').props.onPress();
    });
    const cta = button(tree, 'plan-activate');
    expect([cta.props.loading, cta.props.disabled]).toEqual([true, true]);
  });

  it('a 409 on cancel = the trainer-lock banner + the server message; the CTA disables', async () => {
    cancelEnrollment.mockRejectedValue({ response: { status: 409, data: { message: 'Managed by your trainer' } } });
    const tree = await render();
    await act(async () => button(tree, 'plan-activate').props.onPress());
    expect(host(tree, 'plan-trainer-lock')).toBeDefined();
    expect(flat(host(tree, 'plan-trainer-lock'))).toEqual(expect.objectContaining({ borderColor: colors.goldLine, backgroundColor: colors.goldTint }));
    expect(texts(tree)).toEqual(expect.arrayContaining(['This plan is managed by your trainer', 'Managed by your trainer']));
    expect(button(tree, 'plan-activate').props.disabled).toBe(true);
    const link = tree.root.find((node) => node.props.testID === 'plan-trainer-lock-link' && typeof node.type === 'string');
    await act(async () => link.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/my-trainer');
  });

  it('the copy card shows for a public plan, and hides when GET /plans/{id} failed', async () => {
    let tree = await render();
    expect(host(tree, 'copy-to-my-plans')).toBeDefined();
    getPlan.mockRejectedValue({ response: { status: 404 } });
    getCurrentPlan.mockResolvedValue(CURRENT);
    tree = await render();
    expect(host(tree, 'copy-to-my-plans')).toBeUndefined();
    expect(texts(tree)).toContain('Upper / Lower Split');
  });
});

describe('Plan detail Workout days', () => {
  it('the first day opens on load; one open at a time; rows open Exercise detail', async () => {
    const tree = await render();
    expect(pressable(tree, 'plan-day-toggle-51').props.accessibilityState).toEqual({ expanded: true });
    const row = pressable(tree, 'plan-exercise-1');
    expect(row.props.accessibilityLabel).toBe('Exercise 1: Bench Press, Chest, 3 sets × 8-10 reps');
    await act(async () => row.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('ExerciseDetail', { exerciseId: '10' });
    await act(async () => pressable(tree, 'plan-day-toggle-52').props.onPress());
    expect(pressable(tree, 'plan-day-toggle-51').props.accessibilityState).toEqual({ expanded: false });
    expect(texts(tree)).toContain('Go deep');
    await act(async () => pressable(tree, 'plan-day-toggle-52').props.onPress());
    expect(pressable(tree, 'plan-day-toggle-52').props.accessibilityState).toEqual({ expanded: false });
  });

  it('a day with no exercises shows the code copy', async () => {
    const tree = await render();
    await act(async () => pressable(tree, 'plan-day-toggle-53').props.onPress());
    expect(texts(tree)).toContain('No exercises were returned for Upper B.');
  });

  it('phone row: radius 20, fill-subtle; open badge gold', async () => {
    const tree = await render();
    expect(flat(pressable(tree, 'plan-exercise-1'))).toEqual(expect.objectContaining({ borderRadius: radii.lg, backgroundColor: colors.fillWell }));
    expect(texts(tree)).toContain('5 exercises · ~55 min');
  });
});

describe('Tablet: Plan detail', () => {
  beforeEach(() => {
    mockWindow = { width: 834, height: 1194, fontScale: 1 };
  });

  it('teal "Current plan", the hero (radius 36, min 340), the This week grid and the two columns; no page glow', async () => {
    const tree = await render();
    const pill = tree.root.findAllByType(StatusPill).find((node) => node.props.testID === 'plan-detail-current');
    expect(pill.props.tone).toBe('active');
    expect(flat(host(tree, 'plan-hero'))).toEqual(expect.objectContaining({ borderRadius: radii.xxxxl, minHeight: 340 }));
    expect(host(tree, 'plan-this-week-grid')).toBeDefined();
    expect(flat(host(tree, 'plan-detail-columns'))).toEqual(expect.objectContaining({ flexDirection: 'row', flexWrap: 'wrap' }));
    expect(host(tree, 'plan-detail-screen').props.glow).toBe(false);
  });

  it('N3: the hero draws the plan thumbnail when it is an image, else only gradient-card', async () => {
    getPlan.mockResolvedValue({ plan: { ...PLAN, thumbnail: { url: 'https://example.com/a.jpg', media_type: 'image' } } });
    let tree = await render();
    expect(host(tree, 'plan-hero').findAll((node) => node.type === 'Image')).toHaveLength(1);
    getPlan.mockResolvedValue({ plan: { ...PLAN, thumbnail: { url: 'https://example.com/a.mp4', media_type: 'video' } } });
    tree = await render();
    expect(host(tree, 'plan-hero').findAll((node) => node.type === 'Image')).toHaveLength(0);
  });

  it('exercise cards (150 photos with the order badge) in the open day', async () => {
    const tree = await render();
    expect(host(tree, 'plan-exercise-grid')).toBeDefined();
    const card = pressable(tree, 'plan-exercise-2');
    expect(card.props.accessibilityLabel).toBe('Exercise 2: Lat Pulldown, Chest, 3 sets × 8-10 reps');
    expect(flat(card)).toEqual(expect.objectContaining({ borderRadius: radii.xl, backgroundColor: colors.fillWell }));
  });

  it('review LOW: with the Today card on the page the tablet "Update schedule" CTA is glass', async () => {
    const tree = await render();
    expect(host(tree, 'plan-week-today')).toBeDefined();
    const cta = button(tree, 'plan-activate');
    expect([cta.props.title, cta.props.variant]).toEqual(['Update schedule', 'secondary']);
  });

  it('review LOW: a hero photo whose every candidate fails leaves only gradient-card (no Image, no empty frame)', async () => {
    getPlan.mockResolvedValue({ plan: { ...PLAN, thumbnail: { url: 'https://example.com/a.jpg', media_type: 'image' } } });
    const tree = await render();
    const image = () => host(tree, 'plan-hero').findAll((node) => node.type === 'Image');
    expect(image()).toHaveLength(1);
    await act(async () => image()[0].props.onError({ nativeEvent: { error: 'HTTP 404' } }));
    expect(image()).toHaveLength(0);
    expect(host(tree, 'plan-hero').findAllByType(GradientFill)[0].props).toMatchObject({ angle: gradients.card.angle, colors: gradients.card.colors });
  });

  it('a non-current plan: the schedule CTA is gold', async () => {
    setup({ current: OTHER });
    const tree = await render();
    expect(button(tree, 'plan-activate').props.variant).toBe('primary');
  });
});

describe('Plan detail large text (§9)', () => {
  it.each([
    [1, 'plan-stats', 'plan-stats-stacked'],
    [2, 'plan-stats-stacked', 'plan-stats'],
    [3.1, 'plan-stats-stacked', 'plan-stats'],
  ])('fontScale %s: %s shown; the name keeps the display cap and shrink-to-fit', async (fontScale, shown, hidden) => {
    mockWindow = { width: 390, height: 844, fontScale };
    const tree = await render();
    expect(host(tree, shown)).toBeDefined();
    expect(host(tree, hidden)).toBeUndefined();
    const title = tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'Upper / Lower Split')[0];
    expect(title.props).toEqual(expect.objectContaining({ maxFontSizeMultiplier: textScale.display, adjustsFontSizeToFit: true, minimumFontScale: 0.7 }));
    const cta = tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'Update schedule')[0];
    expect(cta.props.numberOfLines).toBeUndefined();
  });
});

// UX NATIVE-P4 N2 (a352a2d): stat values wrap at words only; one word that
// doesn't fit shrinks (minimumFontScale 0.75), never breaks inside the word.
describe('Plan detail stat tiles: no mid-word break (UX N2)', () => {
  const valueText = (tree, key, value) =>
    host(tree, `plan-stat-${key}`).findAll((node) => node.type === 'Text' && textOf(node) === value)[0];

  it.each([
    ['phone', { width: 390, height: 844, fontScale: 1 }],
    ['iPad', { width: 834, height: 1194, fontScale: 1 }],
    ['Android tablet', { width: 1280, height: 800, fontScale: 1 }],
  ])('%s: the one-word "Intermediate" is one line and shrinks to fit (never splits)', async (_, size) => {
    mockWindow = size;
    const tree = await render();
    expect(valueText(tree, 'level', 'Intermediate').props).toMatchObject({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.75,
      textBreakStrategy: 'simple',
    });
  });

  it('a two-word value may wrap to 2 lines (at the word boundary), still shrink-to-fit 0.75', async () => {
    getPlan.mockResolvedValue({ plan: { ...PLAN, difficulty_level: { name: 'Very Advanced' } } });
    const tree = await render();
    expect(valueText(tree, 'level', 'Very Advanced').props).toMatchObject({ numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.75 });
  });

  it('the number tiles stay one line, shrink 0.75', async () => {
    const tree = await render();
    expect(valueText(tree, 'days', '3').props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.75 });
    expect(valueText(tree, 'exercises', '6').props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.75 });
  });
});

// T-65 "phone bottom nav on main pages only" (PHONE-NAV spec §3 / §5, 27 Oct
// 2026): Plan detail "‹ Plans" (the kit BackPill). Back in history when there is a previous entry, else REPLACE
// this screen with the parent (no push, no loop).
describe('T-65 back control (Plan detail)', () => {
  const saved = { ...mockNavigation };
  afterEach(() => {
    Object.keys(mockNavigation).forEach((key) => delete mockNavigation[key]);
    Object.assign(mockNavigation, saved);
  });
  const press = (tree) => tree.root.findAll((node) => node.props.testID === 'plan-detail-back' && typeof node.props.onPress === 'function')[0];

  it('"Plans": with history it goes back; with none it replaces to PlansLibrary', async () => {
    Object.assign(mockNavigation, { canGoBack: jest.fn(() => true), goBack: jest.fn(), replace: jest.fn(), getState: jest.fn(() => ({ routeNames: ['PlansLibrary', 'PlanDetail'] })) });
    const tree = await render();
    expect(press(tree).props.accessibilityLabel ?? press(tree).props.label).toBe('Plans');
    await act(async () => press(tree).props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    mockNavigation.canGoBack.mockReturnValue(false);
    await act(async () => press(tree).props.onPress());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).toHaveBeenCalledWith('PlansLibrary');
    expect(mockNavigation.push).not.toHaveBeenCalledWith('PlansLibrary');
  });
});
