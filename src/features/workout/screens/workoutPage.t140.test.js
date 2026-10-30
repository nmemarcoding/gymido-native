import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { colors } from '../../../shared/theme/tokens';
import { listDayExercises } from '../../plans/api/libraryApi';
import { useProfileStore } from '../../profile/profileStore';
import { getWorkout, startWorkout } from '../api/workoutApi';
import { loadWorkoutPage } from '../loadWorkoutPage';
import WorkoutScreen from './WorkoutScreen';

// T-140 Workout page "A-balanced · 4 states" (owner approved 30 Oct 2026; UX
// T140-workout-page-BUILD-ruling + PM amendments; FE T140-data-check). Also
// carries the still-live rules of the hub tests deleted with the owner's OK
// (30 Oct): the by-date strip (done on the day trained), week complete, the
// no-/week fallback and the setup state stay covered here and in hubModel /
// weekByDate's own tests.

const mockNavigation = { dispatch: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true), goBack: jest.fn() };
let mockWidth = 390;
let mockHeight = 844;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockHeight, scale: 2, fontScale: 1 }),
}));
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => ({ key: 'Workout-1', name: 'Workout', params: {} }),
    useIsFocused: () => true,
    useFocusEffect: (effect) => useEffect(effect, [effect]),
    usePreventRemove: () => {},
    CommonActions: { navigate: (name) => ({ type: 'NAVIGATE', payload: { name } }) },
    createNavigationContainerRef: () => ({ isReady: () => false }),
  };
});
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()), removeItem: jest.fn(() => Promise.resolve()) }));
jest.mock('../../plans/components/ScheduleSetupCard', () => () => {
  const { View } = require('react-native');
  return <View testID="schedule-setup" />;
});
jest.mock('../../plans/api/libraryApi', () => ({ listDayExercises: jest.fn() }));
jest.mock('../loadWorkoutPage', () => ({ loadWorkoutPage: jest.fn() }));
jest.mock('../../shell/ShellPage', () => ({ children }) => children);
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../../shell/AppHeader', () => () => null);
jest.mock('../runtime/SessionRuntime', () => () => {
  const { View } = require('react-native');
  return <View testID="session-runtime" />;
});
jest.mock('../runtime/RuntimeOverlays', () => ({ CompletionPopup: () => null }));
jest.mock('../runtime/SessionDialogs', () => ({ LeaveWorkoutDialog: () => null }));
jest.mock('../api/workoutApi', () => ({ startWorkout: jest.fn(() => Promise.resolve({ session: null })), getWorkout: jest.fn(() => Promise.reject(new Error('offline'))) }));
jest.mock('../runtime/restAlertPlatform', () => ({ getPermission: jest.fn(() => Promise.resolve('granted')), requestPermission: jest.fn(() => Promise.resolve('granted')) }));

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const hosts = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const host = (root, id) => hosts(root, id)[0];
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const texts = (root) => root.findAll((node) => node.type === 'Text').map(textOf);
const pressable = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const press = (tree, id) => act(async () => pressable(tree.root, id).props.onPress());
const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const confirmDialog = (tree) => tree.root.findAll((node) => node.type === ConfirmDialog && node.props.testID === 'workout-start-confirm')[0];
const sheetOpen = (tree) => tree.root.findAll((node) => node.props.testID === 'workout-day-sheet' && 'isOpen' in node.props)[0]?.props.isOpen === true;
const sheetTexts = (tree) => {
  const sheet = tree.root.findAll((node) => node.props.testID === 'workout-day-sheet' && 'isOpen' in node.props)[0];
  return texts(sheet);
};

// Thursday 29 Oct 2026. Upper A Mon, Lower A Tue, Upper B Thu, Lower B Sat.
const NOW = new Date(2026, 9, 29, 9, 0);
const DAYS = [
  { id: 1, title: 'Upper A', exercises_count: 5 },
  { id: 2, title: 'Lower A', exercises_count: 5 },
  { id: 3, title: 'Upper B', exercises_count: 6 },
  { id: 4, title: 'Lower B', exercises_count: 5 },
];
const wd = (id) => ({ id });
const SCHEDULE = [
  { weekday: wd(1), plan_day: DAYS[0] },
  { weekday: wd(2), plan_day: DAYS[1] },
  { weekday: wd(4), plan_day: DAYS[2] },
  { weekday: wd(6), plan_day: DAYS[3] },
];
const item = (day, date, status, planDay = null) => ({ weekday: wd(day), date, status, is_workout_day: Boolean(planDay), plan_day: planDay });
const WEEK = [
  item(1, '2026-10-26', 'done', DAYS[0]),
  item(2, '2026-10-27', 'done', DAYS[1]),
  item(3, '2026-10-28', 'rest'),
  item(4, '2026-10-29', 'today', DAYS[2]),
  item(5, '2026-10-30', 'rest'),
  item(6, '2026-10-31', 'upcoming', DAYS[3]),
  item(7, '2026-11-01', 'rest'),
];
const weekWith = (...slots) => WEEK.map((slot) => slots.find((other) => other.date === slot.date) ?? slot);
const ex = (id, name) => ({ exercise: { id, name }, target_set_summary: { set_count: 3, target_reps_min: 8, target_reps_max: 10 } });
const PLAN = { enrollment: { id: 31, started_on: '2026-10-12', plan: { id: 9, name: 'Upper / Lower Split', days_per_week: 4 } }, schedule: SCHEDULE };
const TRAINING = { is_workout_day: true, already_completed: false, plan_day: DAYS[2] };
const REST = { is_workout_day: false, already_completed: false, plan_day: null };
const DONE_TODAY = { is_workout_day: true, already_completed: true, plan_day: DAYS[2] };
const at = (day, hour = 10, month = 9) => new Date(2026, month, day, hour).toISOString();
const done = (dayId, day, extra = {}) => ({ workout_plan_day_id: dayId, started_at: at(day), completed_at: at(day, 11), duration_seconds: 2880, total_volume_kg: 3970, workout_plan_day: { title: DAYS[dayId - 1].title }, ...extra });
const DONE_MON = done(1, 26, { id: 101 });
const DONE_TUE = done(2, 27, { id: 102, duration_seconds: 3300, total_volume_kg: 3970 });

function page(data = {}) {
  return {
    ok: true,
    data: {
      session: null,
      currentPlan: PLAN,
      todayStatus: TRAINING,
      planDays: DAYS,
      week: WEEK,
      generatorAvailable: false,
      completedThisWeek: [DONE_MON, DONE_TUE],
      completedThisWeekFailed: false,
      completedThisWeekDayIds: [1, 2],
      lastCompleted: DONE_TUE,
      exerciseStatsMap: {},
      ...data,
    },
  };
}

const mounted = [];
async function renderScreen(result = page()) {
  loadWorkoutPage.mockResolvedValue(result);
  let tree;
  await act(async () => {
    tree = create(<WorkoutScreen />);
  });
  await act(async () => {});
  mounted.push(tree);
  return tree;
}

beforeAll(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick'] });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockHeight = 844;
  useProfileStore.setState({ profile: null });
  listDayExercises.mockImplementation((planId, dayId) =>
    Promise.resolve(dayId === 3 ? [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ex(id, `Upper ${id}`)) : [ex(10 + dayId, `First ${dayId}`), ex(20 + dayId, `Second ${dayId}`)])
  );
});
afterEach(() => act(() => mounted.splice(0).forEach((tree) => tree.unmount())));

describe('entry rule (§1)', () => {
  it('an open session renders the live workout, never the page (every entry opens this one screen)', async () => {
    const tree = await renderScreen(page({ session: { id: 5, exercises: [] } }));
    expect(hosts(tree.root, 'session-runtime')).toHaveLength(1);
    expect(hosts(tree.root, 'workout-hub')).toHaveLength(0);
    expect(hosts(tree.root, 'workout-week-card')).toHaveLength(0);
    expect(texts(tree.root).some((text) => /Resume/.test(text))).toBe(false);
  });
});

describe('page structure + the ring (§2–§4)', () => {
  it('header, plan line "{plan} · week N", week card, stats, Last workout, ONE gold action; no lists', async () => {
    const tree = await renderScreen();
    expect(textOf(host(tree.root, 'workout-plan-line'))).toBe('Upper / Lower Split · week 3');
    ['workout-week-card', 'workout-stats', 'workout-last', 'workout-primary-action'].forEach((id) => expect(hosts(tree.root, id)).toHaveLength(1));
    ['workout-other-days', 'workout-catch-up', 'workout-today-card'].forEach((id) => expect(hosts(tree.root, id)).toHaveLength(0));
    expect(texts(tree.root).some((text) => /Train anyway|Up next|Week \d+ of/.test(text))).toBe(false);
  });

  it('only the number is inside the ring ("2" + "of 4", 8 apart, capped at 1.3×); the label sits UNDER it', async () => {
    const tree = await renderScreen();
    const ring = host(tree.root, 'workout-ring');
    expect(ring.props.accessibilityLabel).toBe('2 of 4 workouts done this week');
    const runs = host(ring, 'workout-ring-number').findAll((node) => node.type === 'Text');
    expect(runs.map(textOf)).toEqual(['2', 'of 4']);
    runs.forEach((run) => expect(run.props.maxFontSizeMultiplier).toBe(1.3));
    expect(flat(runs[1])).toMatchObject({ marginLeft: 8, fontSize: 24, color: colors.textFaint });
    expect(flat(runs[0])).toMatchObject({ fontSize: 52 });
    const label = host(tree.root, 'workout-ring-label');
    expect(textOf(label)).toBe('workouts this week');
    expect(ring.findAll((node) => node === label)).toHaveLength(0);
  });

  it('large text: the ring grows with the number (max(164, number width + 48))', async () => {
    const tree = await renderScreen();
    expect(flat(host(tree.root, 'workout-ring'))).toMatchObject({ width: 164, height: 164 });
    await act(async () => host(tree.root, 'workout-ring-number').props.onLayout({ nativeEvent: { layout: { width: 150, height: 70 } } }));
    expect(flat(host(tree.root, 'workout-ring'))).toMatchObject({ width: 198, height: 198 });
  });

  it('the 7 days are buttons with "{Weekday}[, today], {status}[, {workout}]" labels', async () => {
    const tree = await renderScreen(page({ week: weekWith(item(2, '2026-10-27', 'missed', DAYS[1])), completedThisWeek: [DONE_MON] }));
    const labels = [0, 1, 2, 3, 4, 5, 6].map((index) => pressable(tree.root, `workout-day-${index}`).props.accessibilityLabel);
    expect(labels).toEqual([
      'Monday, done, Upper A',
      'Tuesday, missed, Lower A',
      'Wednesday, rest day',
      'Thursday, today, planned, Upper B',
      'Friday, rest day',
      'Saturday, planned, Lower B',
      'Sunday, rest day',
    ]);
    expect(host(tree.root, 'workout-days').props.accessibilityLabel).toBe('Days this week. Tap a day to see its plan.');
  });

  it('done goes on the day TRAINED (by date): Monday\'s plan day done on Wednesday ticks Wednesday', async () => {
    const tree = await renderScreen(page({ completedThisWeek: [done(1, 28)], week: weekWith(item(1, '2026-10-26', 'done', DAYS[0]), item(2, '2026-10-27', 'missed', DAYS[1])) }));
    expect(hosts(tree.root, 'workout-day-circle-done')).toHaveLength(1);
    expect(pressable(tree.root, 'workout-day-2').props.accessibilityLabel).toBe('Wednesday, done, Upper A');
  });

  it('no /week: the week is rebuilt from the schedule + this week\'s history (shared fallback rule)', async () => {
    const tree = await renderScreen(page({ week: null }));
    expect(hosts(tree.root, 'workout-week-card')).toHaveLength(1);
    expect(pressable(tree.root, 'workout-day-0').props.accessibilityLabel).toBe('Monday, done, Upper A');
    expect(pressable(tree.root, 'workout-day-5').props.accessibilityLabel).toBe('Saturday, planned, Lower B');
  });
});

describe('the one gold action per state (§8)', () => {
  it('training: "Start {today}" starts today at once (the existing direct start)', async () => {
    const tree = await renderScreen();
    expect(pressable(tree.root, 'workout-primary-action').props.title).toBe('Start Upper B');
    await press(tree, 'workout-primary-action');
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 3 });
    expect(confirmDialog(tree)).toBeUndefined();
  });

  it('rest + misses: "Rest day today", the missed line, gold = the MOST RECENT miss via the catch-up confirm', async () => {
    const week = weekWith(item(1, '2026-10-26', 'missed', DAYS[0]), item(2, '2026-10-27', 'missed', DAYS[1]), item(4, '2026-10-29', 'rest'));
    const tree = await renderScreen(page({ todayStatus: REST, week, completedThisWeek: [], completedThisWeekDayIds: [] }));
    expect(textOf(host(tree.root, 'workout-ring-label'))).toBe('Rest day today');
    expect(textOf(host(tree.root, 'workout-missed-line').findAll((node) => node.type === 'Text')[0])).toBe('Missed Tuesday · +1 more');
    expect(pressable(tree.root, 'workout-primary-action').props.title).toBe('Start Lower A');
    await press(tree, 'workout-primary-action');
    expect(startWorkout).not.toHaveBeenCalled();
    expect(confirmDialog(tree).props.title).toBe('Catch up on Lower A?');
    expect(confirmDialog(tree).props.description).toBe('You missed it on Tuesday. Today is a rest day. This starts a live workout.');
    await act(async () => confirmDialog(tree).props.onConfirm());
    expect(startWorkout).toHaveBeenCalledTimes(1);
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 2 });
  });

  it('rest without a miss / today done without a miss: no gold action, no missed line', async () => {
    let tree = await renderScreen(page({ todayStatus: REST, week: weekWith(item(4, '2026-10-29', 'rest')) }));
    expect(hosts(tree.root, 'workout-primary-action')).toHaveLength(0);
    expect(hosts(tree.root, 'workout-missed-line')).toHaveLength(0);
    tree = await renderScreen(page({ todayStatus: DONE_TODAY, week: weekWith(item(4, '2026-10-29', 'done', DAYS[2])), completedThisWeek: [DONE_MON, DONE_TUE, done(3, 29)] }));
    expect(hosts(tree.root, 'workout-primary-action')).toHaveLength(0);
  });

  it('week complete (every training day from started_on done): full ring, "Week complete", no action', async () => {
    const plan = { ...PLAN, enrollment: { ...PLAN.enrollment, started_on: '2026-10-28' } };
    // Mon/Tue were before the plan started: the server calls those slots rest; they don't count.
    const week = weekWith(item(1, '2026-10-26', 'rest', DAYS[0]), item(2, '2026-10-27', 'rest', DAYS[1]), item(4, '2026-10-29', 'done', DAYS[2]), item(6, '2026-10-31', 'done', DAYS[3]));
    const tree = await renderScreen(page({ currentPlan: plan, todayStatus: DONE_TODAY, week, completedThisWeek: [done(3, 29), done(4, 29, { started_at: at(29, 18) })] }));
    expect(textOf(host(tree.root, 'workout-ring-label'))).toBe('Week complete');
    expect(host(tree.root, 'workout-ring').props.accessibilityLabel).toBe('2 of 2 workouts done this week');
    expect(hosts(tree.root, 'workout-primary-action')).toHaveLength(0);
  });

  it('no schedule: today\'s "Choose training days" setup state, no week card', async () => {
    const tree = await renderScreen(page({ currentPlan: { ...PLAN, schedule: [] }, week: WEEK.map((slot) => ({ ...slot, status: 'rest', is_workout_day: false, plan_day: null })), todayStatus: REST }));
    expect(hosts(tree.root, 'workout-week-card')).toHaveLength(0);
    await press(tree, 'schedule-setup-open');
    expect(hosts(tree.root, 'schedule-setup')).toHaveLength(1);
  });
});

describe('stats card + Last workout (§7)', () => {
  it('sums this week\'s completed items: "1h 43m" and "7,940 kg"; lb for an lb member; hidden when the list failed', async () => {
    let tree = await renderScreen();
    expect(textOf(host(tree.root, 'workout-stats-time'))).toBe('1h 43m');
    expect(textOf(host(tree.root, 'workout-stats-volume'))).toBe('7,940 kg');
    useProfileStore.setState({ profile: { current_weight_unit: 'lb' } });
    tree = await renderScreen();
    expect(textOf(host(tree.root, 'workout-stats-volume'))).toBe('17,505 lb');
    tree = await renderScreen(page({ completedThisWeekFailed: true, completedThisWeek: [] }));
    expect(hosts(tree.root, 'workout-stats')).toHaveLength(0);
    expect(hosts(tree.root, 'workout-week-card')).toHaveLength(1);
  });

  it('Last workout = the newest this week: "Tue", taps open that day\'s Done sheet; none ever → no row', async () => {
    let tree = await renderScreen();
    const row = pressable(tree.root, 'workout-last');
    expect(row.props.accessibilityLabel).toBe('Last workout: Lower A, Tue');
    await press(tree, 'workout-last');
    expect(sheetOpen(tree)).toBe(true);
    expect(sheetTexts(tree)).toEqual(expect.arrayContaining(['Tuesday · Done', 'Lower A']));
    tree = await renderScreen(page({ completedThisWeek: [], lastCompleted: null }));
    expect(hosts(tree.root, 'workout-last')).toHaveLength(0);
  });

  it('a Last workout before this week opens a read-only Done sheet "Oct 12 · Done", no action', async () => {
    // This week has none, so the per_page=1 workout is the Last workout.
    const tree = await renderScreen(page({ completedThisWeek: [], completedThisWeekDayIds: [], lastCompleted: done(2, 12, { duration_seconds: 3000 }) }));
    expect(pressable(tree.root, 'workout-last').props.accessibilityLabel).toBe('Last workout: Lower A, Oct 12');
    await press(tree, 'workout-last');
    expect(sheetTexts(tree)).toEqual(expect.arrayContaining(['Oct 12 · Done', 'Lower A']));
    expect(hosts(tree.root, 'workout-sheet-action')).toHaveLength(0);
  });
});

describe('day sheets (§5)', () => {
  it('each day\'s list loads once after the load; today\'s sheet = eyebrow, title, 6 rows max then "+N more", gold Start = the direct start', async () => {
    const tree = await renderScreen();
    expect(listDayExercises.mock.calls.map((call) => call[1]).sort()).toEqual([1, 2, 3, 4]);
    await press(tree, 'workout-day-3');
    expect(listDayExercises).toHaveBeenCalledTimes(4);
    await act(async () => {});
    const sheet = sheetTexts(tree);
    expect(sheet).toEqual(expect.arrayContaining(['Today · Thursday', 'Upper B', '6 exercises', '+3 more']));
    expect(hosts(tree.root, 'workout-sheet-list')[0].findAll((node) => typeof node.type === 'string' && node.props.accessibilityLabel?.startsWith?.('Upper '))).toHaveLength(5);
    expect(hosts(tree.root, 'workout-day-selected')).toHaveLength(1);
    await press(tree, 'workout-sheet-action');
    expect(sheetOpen(tree)).toBe(false);
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 3 });
  });

  it('future: "Saturday · Planned", "Start early" → the sheet closes, then the existing start-early confirm', async () => {
    const tree = await renderScreen();
    await press(tree, 'workout-day-5');
    expect(sheetTexts(tree)).toEqual(expect.arrayContaining(['Saturday · Planned', 'Lower B', '5 exercises']));
    expect(pressable(tree.root, 'workout-sheet-action').props.title).toBe('Start early');
    await press(tree, 'workout-sheet-action');
    expect(sheetOpen(tree)).toBe(false);
    await wait(350);
    expect(confirmDialog(tree).props.isOpen).toBe(true);
    await act(async () => confirmDialog(tree).props.onConfirm());
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 4 });
  });

  it('missed: amber eyebrow, gold Start = the catch-up confirm, "Catch up works this week only."', async () => {
    const tree = await renderScreen(page({ week: weekWith(item(2, '2026-10-27', 'missed', DAYS[1])), completedThisWeek: [DONE_MON] }));
    await press(tree, 'workout-day-1');
    expect(sheetTexts(tree)).toEqual(expect.arrayContaining(['Tuesday · Missed', 'Lower A', 'Catch up works this week only.']));
    expect(flat(host(tree.root, 'workout-sheet-eyebrow'))).toMatchObject({ color: colors.warning });
    expect(pressable(tree.root, 'workout-sheet-action').props.title).toBe('Start Lower A');
    await press(tree, 'workout-sheet-action');
    await wait(350);
    expect(confirmDialog(tree).props.title).toBe('Catch up on Lower A?');
  });

  it('missed line taps open that day\'s sheet', async () => {
    const tree = await renderScreen(page({ week: weekWith(item(2, '2026-10-27', 'missed', DAYS[1])), completedThisWeek: [DONE_MON] }));
    await press(tree, 'workout-missed-line');
    expect(sheetTexts(tree)).toEqual(expect.arrayContaining(['Tuesday · Missed']));
  });

  it('done: "{Weekday} · Done", "{duration} · {n} exercises", ✓ rows, no action; a day done twice = ONE sheet with summed minutes + "· 2 workouts"', async () => {
    let tree = await renderScreen();
    await press(tree, 'workout-day-0');
    await act(async () => {});
    // GET /workouts/{id} failed (the mock): the planned rows with ✓ and no detail.
    expect(sheetTexts(tree)).toEqual(expect.arrayContaining(['Monday · Done', 'Upper A', '48m · 2 exercises', 'First 1', 'Second 1']));
    expect(hosts(tree.root, 'workout-sheet-action')).toHaveLength(0);
    expect(flat(host(tree.root, 'workout-sheet-eyebrow'))).toMatchObject({ color: colors.teal });
    tree = await renderScreen(page({ completedThisWeek: [DONE_MON, done(2, 26, { started_at: at(26, 18), duration_seconds: 1320 }), DONE_TUE] }));
    await press(tree, 'workout-day-0');
    expect(sheetTexts(tree)).toEqual(expect.arrayContaining(['Monday · Done', 'Upper A', '1h 10m · 2 workouts']));
  });

  it('rest: "Rest day" / "Recovery is part of the plan.", no list, no action; the × closes', async () => {
    const tree = await renderScreen();
    await press(tree, 'workout-day-2');
    expect(sheetTexts(tree)).toEqual(expect.arrayContaining(['Wednesday', 'Rest day', 'Recovery is part of the plan.']));
    expect(hosts(tree.root, 'workout-sheet-list')).toHaveLength(0);
    expect(hosts(tree.root, 'workout-sheet-action')).toHaveLength(0);
    const sheet = tree.root.findAll((node) => node.props.testID === 'workout-day-sheet' && 'isOpen' in node.props)[0];
    await act(async () => sheet.props.onClose());
    expect(sheetOpen(tree)).toBe(false);
  });
});

describe('RN-SPEC T-140: logged Done rows + Plan finished', () => {
  it('a Done sheet lists what was logged (GET /workouts/{id} once per session): ≥ 1 completed set, "{n} sets"', async () => {
    const sets = (done, total) => Array.from({ length: total }, (_, i) => ({ is_completed: i < done }));
    getWorkout.mockImplementation(() => Promise.resolve({ id: 101, exercises: [{ exercise_id: 7, exercise_name_snapshot: 'Bench Press', sets: sets(3, 4) }, { exercise_id: 8, exercise_name_snapshot: 'Skipped Fly', sets: sets(0, 3) }] }));
    const tree = await renderScreen();
    await press(tree, 'workout-day-0');
    await act(async () => {});
    expect(getWorkout).toHaveBeenCalledWith(101);
    expect(sheetTexts(tree)).toEqual(expect.arrayContaining(['Monday · Done', '48m · 1 exercise', 'Bench Press', '3 sets']));
    expect(sheetTexts(tree)).not.toContain('Skipped Fly');
    await act(async () => tree.root.findAll((node) => node.props.testID === 'workout-day-sheet' && 'isOpen' in node.props)[0].props.onClose());
    await press(tree, 'workout-day-0');
    expect(getWorkout).toHaveBeenCalledTimes(1);
  });

  it('no active plan + the newest enrollment completed: "{plan} · finished", the card, gold "Find your next plan" → Plans', async () => {
    const { openShellPath } = require('../../shell/shellLinks');
    const tree = await renderScreen(page({ currentPlan: null, week: null, myPlans: [{ id: 4, status: 'completed', plan: { name: 'Strength 101' } }] }));
    expect(textOf(host(tree.root, 'workout-plan-line'))).toBe('Strength 101 · finished');
    expect(texts(host(tree.root, 'workout-plan-finished'))).toEqual(['Plan complete', 'You finished Strength 101']);
    expect(pressable(tree.root, 'workout-primary-action').props.title).toBe('Find your next plan');
    await press(tree, 'workout-primary-action');
    expect(openShellPath).toHaveBeenCalledWith('/plans');
  });

  it('no active plan otherwise: today\'s no-plan card, unchanged', async () => {
    const tree = await renderScreen(page({ currentPlan: null, week: null, myPlans: [{ id: 4, status: 'cancelled', plan: { name: 'Old' } }] }));
    expect(hosts(tree.root, 'workout-plan-finished')).toHaveLength(0);
    expect(hosts(tree.root, 'workout-plan-line')).toHaveLength(0);
  });
});

describe('sizes (§9)', () => {
  it('tablet portrait: one column, max 600, ring 180', async () => {
    mockWidth = 834;
    mockHeight = 1194;
    const tree = await renderScreen();
    expect(flat(host(tree.root, 'workout-hub'))).toMatchObject({ maxWidth: 600 });
    expect(flat(host(tree.root, 'workout-ring'))).toMatchObject({ width: 180 });
    expect(hosts(tree.root, 'workout-split')).toHaveLength(0);
  });

  it('≥ 1024 landscape: the week card left; stats, Last workout and the gold action right; ring 190, number 60', async () => {
    mockWidth = 1366;
    mockHeight = 1024;
    const tree = await renderScreen();
    const side = host(tree.root, 'workout-side');
    ['workout-stats', 'workout-last', 'workout-primary-action'].forEach((id) => expect(hosts(side, id)).toHaveLength(1));
    expect(flat(host(tree.root, 'workout-ring'))).toMatchObject({ width: 190 });
    expect(flat(host(tree.root, 'workout-ring-number').findAll((node) => node.type === 'Text')[0])).toMatchObject({ fontSize: 60 });
  });
});
