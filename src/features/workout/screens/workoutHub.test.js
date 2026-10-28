import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { NBSP } from '../../../shared/format/counts';
import { colors, textScale } from '../../../shared/theme/tokens';
import { listDayExercises } from '../../plans/api/libraryApi';
import { openShellPath } from '../../shell/shellLinks';
import { startWorkout } from '../api/workoutApi';
import { loadWorkoutPage } from '../loadWorkoutPage';
import WorkoutScreen from './WorkoutScreen';

// T-76 Workout hub redesign (owner brief, UX check, PM rulings 28 Oct 2026).
// DECLARED: this file replaces the pre-T-76 hub tests (UX G "Workout hub page",
// TodayHeroCard (v2), PlanDayCard (v2)) whose components are retired. Every
// old check has an equal or stricter replacement here: the "‹ Today" root
// (M1) and the H1 sizes (now 40 phone / 52 tablet per the T-76 boards), the
// section title (now per state), the Start action (now the one gold 56 with
// no glow), the day Start (now the whole row, "Start" / "Repeat"), the
// done-this-week marking (now the teal "Done" row, sorted last) and the
// photo (now the exercise strip from the day's exercises).

const mockNavigation = { dispatch: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true), goBack: jest.fn() };
let mockWidth = 390;
let mockHeight = 1194;
let mockFontScale = 1;
let mockSetupProps = null;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockHeight, scale: 2, fontScale: mockFontScale }),
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
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()), removeItem: jest.fn(() => Promise.resolve()) }));
jest.mock('../../plans/components/ScheduleSetupCard', () => (props) => {
  mockSetupProps = props;
  const { View } = require('react-native');
  return <View testID="schedule-setup" />;
});
jest.mock('../../plans/api/libraryApi', () => ({ listDayExercises: jest.fn() }));
jest.mock('../../../shared/components/ExerciseImage', () => (props) => {
  const { View } = require('react-native');
  return <View testID={props.loading ? `${props.testID}-loading` : props.testID} style={props.style} />;
});
jest.mock('../loadWorkoutPage', () => ({ loadWorkoutPage: jest.fn() }));
jest.mock('../../shell/ShellPage', () => ({ children }) => children);
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../../shell/AppHeader', () => () => null);
jest.mock('../runtime/SessionRuntime', () => () => null);
jest.mock('../runtime/RuntimeOverlays', () => ({ CompletionPopup: () => null }));
jest.mock('../runtime/SessionDialogs', () => ({ LeaveWorkoutDialog: () => null }));
jest.mock('../api/workoutApi', () => ({ startWorkout: jest.fn(() => Promise.resolve({ session: null })) }));
jest.mock('../runtime/restAlertPlatform', () => ({ getPermission: jest.fn(() => Promise.resolve('granted')), requestPermission: jest.fn(() => Promise.resolve('granted')) }));

const s = (text) => text.replace(/(\d) /g, `$1${NBSP}`);
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
// The pressable itself (role button), not a wrapper component with the same testID.
const pressable = (root, id) =>
  root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function' && node.props.accessibilityRole === 'button')[0];
const dayButtons = (root) =>
  root.findAll((node) => typeof node.props.testID === 'string' && /^workout-day-start-\d+$/.test(node.props.testID) && typeof node.props.onPress === 'function');

// Thursday 29 Oct 2026 (local). The board's plan: Upper A Mon, Lower A Tue,
// Upper B Thu, Lower B Sat.
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
const ex = (id, name, muscle) => ({ exercise: { id, name, primary_muscle_group: { name: muscle } } });
const UPPER_B = [ex(1, 'Incline Press', 'Chest'), ex(2, 'Pull-up', 'Back'), ex(3, 'Push-up', 'Chest'), ex(4, 'Dumbbell Curl', 'Arms'), ex(5, 'Row', 'Back'), ex(6, 'Dip', 'Arms')];
const PLAN = { enrollment: { id: 31, plan: { id: 9, name: 'Upper / Lower Split' } }, schedule: SCHEDULE };
const TRAINING = { is_workout_day: true, already_completed: false, plan_day: DAYS[2] };

function hub(data = {}) {
  return {
    ok: true,
    data: {
      session: null,
      currentPlan: PLAN,
      todayStatus: TRAINING,
      planDays: DAYS,
      week: WEEK,
      generatorAvailable: false,
      completedThisWeek: [],
      completedThisWeekDayIds: [1, 2],
      exerciseStatsMap: {},
      ...data,
    },
  };
}

const mounted = [];
async function renderScreen(page = hub()) {
  loadWorkoutPage.mockResolvedValue(page);
  let tree;
  await act(async () => {
    tree = create(<WorkoutScreen />);
  });
  await act(async () => {});
  mounted.push(tree);
  return tree;
}

beforeAll(() => {
  // Only the clock is fixed: promises and timers run for real.
  jest.useFakeTimers({ now: NOW, doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick'] });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockHeight = 1194;
  mockFontScale = 1;
  mockSetupProps = null;
  listDayExercises.mockImplementation((planId, dayId) => Promise.resolve(dayId === 3 ? UPPER_B : [ex(10 + dayId, `First ${dayId}`, 'Legs')]));
});
afterEach(() => act(() => mounted.splice(0).forEach((tree) => tree.unmount())));

describe('header (T-65 + T-76 boards)', () => {
  it('"‹ Today" opens the Today root (M1), never goBack; "Workout" 40/44 and the plan name 15/22 secondary on phone', async () => {
    const tree = await renderScreen();
    tree.root.findAll((node) => node.props.testID === 'workout-back-today' && typeof node.props.onPress === 'function').at(-1).props.onPress();
    expect(openShellPath).toHaveBeenCalledWith('/');
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    expect(flat(host(tree.root, 'workout-title'))).toMatchObject({ fontSize: 40, lineHeight: 44, color: colors.textPrimary });
    const plan = host(tree.root, 'workout-plan-name');
    expect(textOf(plan)).toBe('Upper / Lower Split');
    expect(flat(plan)).toMatchObject({ fontSize: 15, lineHeight: 22, color: colors.textSecondary });
  });

  it('tablet: "Workout" 52/56', async () => {
    mockWidth = 834;
    const tree = await renderScreen();
    expect(flat(host(tree.root, 'workout-title'))).toMatchObject({ fontSize: 52, lineHeight: 56 });
  });
});

describe('state 1: training day (main board)', () => {
  it('today card: gold 0.30 edge r28, "TODAY · THURSDAY", the day, exercises · muscles', async () => {
    const tree = await renderScreen();
    const card = host(tree.root, 'workout-hero');
    expect(flat(card)).toMatchObject({ borderRadius: 28, padding: 18, backgroundColor: colors.surface, borderColor: colors.goldLine });
    expect(textOf(host(tree.root, 'workout-hero-eyebrow'))).toBe('TODAY · THURSDAY');
    expect(flat(host(tree.root, 'workout-hero-eyebrow')).color).toBe(colors.gold);
    expect(texts(card)).toContain('Upper B');
    expect(textOf(host(tree.root, 'workout-hero-meta'))).toBe(s('6 exercises · Chest, back and arms'));
  });

  it('phone photos: 3 + a dimmed "+3" / "more" tile; tablet shows all 6', async () => {
    const tree = await renderScreen();
    act(() => host(tree.root, 'workout-hero-photos').props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
    expect(hosts(tree.root, 'workout-hero-photo')).toHaveLength(4);
    expect(texts(host(tree.root, 'workout-hero-more'))).toEqual(['+3']);
    expect(texts(host(tree.root, 'workout-hero-photos'))).toEqual(['Incline Press', 'Pull-up', 'Push-up', '+3', 'more']);
    mockWidth = 834;
    const tablet = await renderScreen();
    act(() => host(tablet.root, 'workout-hero-photos').props.onLayout({ nativeEvent: { layout: { width: 700 } } }));
    expect(hosts(tablet.root, 'workout-hero-photo')).toHaveLength(6);
    expect(hosts(tablet.root, 'workout-hero-more')).toHaveLength(0);
  });

  it('one gold "Start workout": 56, gold fill, no glow; starts today\'s day', async () => {
    const tree = await renderScreen();
    const start = pressable(tree.root, 'workout-hero-start');
    expect(start.props.accessibilityLabel).toBe('Start Upper B');
    expect(flat(start)).toMatchObject({ minHeight: 56, backgroundColor: colors.gold });
    expect(flat(start).boxShadow).toBeUndefined();
    await act(async () => {
      start.props.onPress();
    });
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 3 });
  });

  it('this week: "2 of 4 done", the teal bar at 50 %, the strip from /week', async () => {
    const tree = await renderScreen();
    expect(textOf(host(tree.root, 'workout-week-count'))).toBe('2 of 4 done');
    expect(flat(host(tree.root, 'workout-week-bar'))).toMatchObject({ width: '50%', backgroundColor: colors.teal });
    const labels = [1, 2, 3, 4, 5, 6, 7].map((id) => host(tree.root, `workout-week-day-${id}`).props.accessibilityLabel);
    expect(labels).toEqual(['Mon: done', 'Tue: done', 'Wed: rest', 'Thu: today, training', 'Fri: rest', 'Sat: training', 'Sun: rest']);
    expect(flat(host(tree.root, 'workout-week-circle-4')).backgroundColor).toBe(colors.gold);
    // RN-SPEC T-76 (review carry 3): Train = a 2px text-muted outline.
    expect(flat(host(tree.root, 'workout-week-circle-6'))).toMatchObject({ borderWidth: 2, borderColor: colors.textMuted });
  });

  it('week strip looks: 13/600 labels (N1), rest in text-muted (N2), missed dashed (C3)', async () => {
    const missed = WEEK.map((entry, index) => (index === 1 ? { ...entry, status: 'missed' } : entry));
    const tree = await renderScreen(hub({ week: missed }));
    const label = (id) => host(tree.root, `workout-week-day-${id}`).findAll((node) => node.type === 'Text').at(-1);
    expect(flat(label(3))).toMatchObject({ fontSize: 13, color: colors.textMuted });
    expect(textOf(label(2))).toBe('Missed');
    expect(host(tree.root, 'workout-week-day-2').props.accessibilityLabel).toBe('Tue: missed');
    expect(flat(host(tree.root, 'workout-week-circle-2'))).toMatchObject({ borderStyle: 'dashed', borderWidth: 1.5, borderColor: colors.hairlineBright });
    expect(textOf(host(tree.root, 'workout-week-count'))).toBe('1 of 4 done');
  });

  it('other days: today left out (b); not done first; done last, faded, teal "Done", "Repeat"', async () => {
    const tree = await renderScreen();
    expect(texts(host(tree.root, 'workout-other-days'))).toEqual(expect.arrayContaining(['Other days', "Not feeling today's? Tap any day to start it instead."]));
    expect(hosts(tree.root, 'workout-day-start-3')).toHaveLength(0);
    const order = dayButtons(tree.root);
    expect(order.map((node) => node.props.accessibilityLabel)).toEqual(['Start Lower B', 'Repeat Upper A', 'Repeat Lower A']);
    expect(flat(order[0])).toMatchObject({ minHeight: 56 });
    expect(hosts(tree.root, 'workout-day-done-1')).toHaveLength(1);
    expect(hosts(tree.root, 'workout-day-done-4')).toHaveLength(0);
    await act(async () => {
      order[1].props.onPress();
    });
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 1 });
  });

  it('photos are lazy: today first, one call per day; a failed day draws the tile', async () => {
    listDayExercises.mockImplementation((planId, dayId) => (dayId === 4 ? Promise.reject(new Error('x')) : Promise.resolve(dayId === 3 ? UPPER_B : [])));
    const tree = await renderScreen();
    expect(listDayExercises.mock.calls[0]).toEqual([9, 3]);
    expect(listDayExercises).toHaveBeenCalledTimes(4);
    expect(hosts(tree.root, 'workout-day-photo-4')).toHaveLength(1);
    expect(hosts(tree.root, 'workout-day-photo-4-loading')).toHaveLength(0);
  });
});

describe('state 2: rest day', () => {
  const REST = { is_workout_day: false, already_completed: false, plan_day: DAYS[2] };
  const restWeek = WEEK.map((entry, index) => (index === 3 ? { ...entry, status: 'rest', is_workout_day: false, plan_day: null } : entry));

  it('moon card, Up next, outlined "Start {day} early" (starts that day); "Train anyway?" lists every day', async () => {
    const tree = await renderScreen(hub({ todayStatus: REST, week: restWeek }));
    const card = host(tree.root, 'workout-hero');
    expect(flat(card).borderColor).toBe(colors.hairlineStrong);
    expect(texts(card)).toEqual(expect.arrayContaining(['TODAY · THURSDAY', 'Rest day', 'Recovery is part of the plan. Nothing is scheduled today.', 'Up next']));
    expect(host(tree.root, 'workout-up-next').props.accessibilityLabel).toBe(s('Up next: Lower B, Saturday · 5 exercises'));
    const early = pressable(tree.root, 'workout-start-early');
    expect(texts(early)).toEqual(['Start Lower B early']);
    expect(flat(early)).toMatchObject({ minHeight: 52, borderColor: colors.hairlineBright });
    await act(async () => {
      early.props.onPress();
    });
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 4 });
    expect(texts(host(tree.root, 'workout-other-days'))).toEqual(expect.arrayContaining(['Train anyway?', 'Tap a day to start it now.']));
    expect(hosts(tree.root, 'workout-day-start-3')).toHaveLength(1);
    expect(host(tree.root, 'workout-week-day-4').props.accessibilityLabel).toBe('Thu: today, rest');
  });
});

describe('state 3: today done', () => {
  it('teal card "{day} done", minutes from today\'s completed workout, Up next, "View progress"; today listed last as Repeat', async () => {
    const doneWeek = WEEK.map((entry, index) => (index === 3 ? { ...entry, status: 'done' } : entry));
    const completed = [{ workout_plan_day_id: 3, duration_seconds: 3120, completed_at: new Date(2026, 9, 29, 8).toISOString() }];
    const tree = await renderScreen(
      // Lower B (after today in plan order) was also done earlier this week: today still lists last (review M1).
      hub({ todayStatus: { ...TRAINING, already_completed: true }, week: doneWeek, completedThisWeek: completed, completedThisWeekDayIds: [1, 2, 3, 4] })
    );
    const card = host(tree.root, 'workout-hero');
    expect(flat(card).borderColor).toBe(colors.tealLine);
    expect(texts(card)).toContain('Upper B done');
    expect(textOf(host(tree.root, 'workout-hero-meta'))).toBe(s('Nice work. 6 exercises · 52 min.'));
    expect(hosts(tree.root, 'workout-up-next')).toHaveLength(1);
    pressable(tree.root, 'workout-view-progress').props.onPress();
    expect(openShellPath).toHaveBeenCalledWith('/progress');
    expect(texts(host(tree.root, 'workout-other-days'))).toContain('Want more? Tap a day to start it.');
    expect(dayButtons(tree.root).map((node) => node.props.accessibilityLabel)).toEqual(['Repeat Upper A', 'Repeat Lower A', 'Repeat Lower B', 'Repeat Upper B']);
    expect(textOf(host(tree.root, 'workout-week-count'))).toBe('3 of 4 done');
  });
});

describe('state 4: week complete', () => {
  it('"THIS WEEK" / "Week complete" / next week\'s start; "Extra session" rows all Repeat', async () => {
    const allDone = WEEK.map((entry) => (entry.plan_day ? { ...entry, status: 'done' } : entry));
    const tree = await renderScreen(hub({ todayStatus: { ...TRAINING, already_completed: true }, week: allDone, completedThisWeekDayIds: [1, 2, 3, 4] }));
    expect(texts(host(tree.root, 'workout-hero'))).toEqual(expect.arrayContaining(['THIS WEEK', 'Week complete']));
    expect(textOf(host(tree.root, 'workout-hero-meta'))).toBe(s('All 4 workouts done. Next week starts Monday with Upper A.'));
    expect(texts(host(tree.root, 'workout-other-days'))).toEqual(expect.arrayContaining(['Extra session', 'Tap a day to do it again.']));
    expect(dayButtons(tree.root).map((node) => node.props.accessibilityLabel)).toEqual(['Repeat Upper A', 'Repeat Lower A', 'Repeat Upper B', 'Repeat Lower B']);
    expect(textOf(host(tree.root, 'workout-week-count'))).toBe('4 of 4 done');
  });
});

describe('state 5: no schedule (C2 inline setup)', () => {
  const NO_SCHEDULE = hub({
    currentPlan: { ...PLAN, schedule: [] },
    week: WEEK.map((entry) => ({ ...entry, status: 'rest', is_workout_day: false, plan_day: null })),
    completedThisWeekDayIds: [],
  });

  it('"Set up your week" card, no week card, "Or start now" with every day as "Any day"', async () => {
    const tree = await renderScreen(NO_SCHEDULE);
    expect(texts(host(tree.root, 'workout-hero'))).toEqual(
      expect.arrayContaining(['Set up your week', 'Choose the days you train. We will put each workout on a day and show you what is next.', 'Choose training days'])
    );
    expect(hosts(tree.root, 'workout-week')).toHaveLength(0);
    expect(texts(host(tree.root, 'workout-other-days'))).toEqual(expect.arrayContaining(['Or start now', 'Tap any day to start it.', s('Any day · 6 exercises')]));
  });

  it('"Choose training days" opens the setup in place; Cancel goes back; Save reloads', async () => {
    const tree = await renderScreen(NO_SCHEDULE);
    act(() => pressable(tree.root, 'schedule-setup-open').props.onPress());
    expect(hosts(tree.root, 'schedule-setup')).toHaveLength(1);
    expect(hosts(tree.root, 'workout-hero')).toHaveLength(0);
    expect(mockSetupProps).toMatchObject({ enrollmentId: 31, planDays: DAYS });
    act(() => mockSetupProps.onCancel());
    expect(hosts(tree.root, 'schedule-setup')).toHaveLength(0);
    expect(hosts(tree.root, 'workout-hero')).toHaveLength(1);
    act(() => pressable(tree.root, 'schedule-setup-open').props.onPress());
    loadWorkoutPage.mockClear();
    await act(async () => {
      await mockSetupProps.onSaved();
    });
    expect(loadWorkoutPage).toHaveBeenCalledTimes(1);
  });
});

describe('state 6: no active plan (U2)', () => {
  it('"Browse plans" gold → /plans; "Build me a plan" only with the generator on → /plans/generate', async () => {
    const off = await renderScreen(hub({ currentPlan: null, planDays: [], week: null }));
    expect(texts(host(off.root, 'workout-empty'))).toEqual(
      expect.arrayContaining(['No active workout plan', 'Pick a plan first, then come back here to start a workout.', 'Browse plans'])
    );
    expect(hosts(off.root, 'workout-build-plan')).toHaveLength(0);
    pressable(off.root, 'workout-browse-plans').props.onPress();
    expect(openShellPath).toHaveBeenCalledWith('/plans');
    const on = await renderScreen(hub({ currentPlan: null, planDays: [], week: null, generatorAvailable: true }));
    pressable(on.root, 'workout-build-plan').props.onPress();
    expect(openShellPath).toHaveBeenCalledWith('/plans/generate');
  });
});

describe('states 7 and 8: loading and failed', () => {
  it('loading: the page header over the skeleton and "Loading your workout…"', async () => {
    loadWorkoutPage.mockReturnValue(new Promise(() => {}));
    let tree;
    await act(async () => {
      tree = create(<WorkoutScreen />);
    });
    mounted.push(tree);
    expect(hosts(tree.root, 'workout-hub-header')).toHaveLength(1);
    expect(hosts(tree.root, 'workout-skeleton')).toHaveLength(1);
    expect(textOf(host(tree.root, 'workout-skeleton-status'))).toBe('Loading your workout…');
  });

  it('failed: "Workout unavailable", the transport message (else "Please try again."), "Try again" reloads', async () => {
    const bare = await renderScreen({ ok: false, error: new Error('') });
    expect(texts(host(bare.root, 'workout-error'))).toEqual(['Workout unavailable', 'Please try again.', 'Try again']);
    const tree = await renderScreen({ ok: false, error: new Error('Network Error') });
    expect(texts(host(tree.root, 'workout-error'))).toEqual(['Workout unavailable', 'Network Error', 'Try again']);
    loadWorkoutPage.mockClear();
    await act(async () => {
      pressable(tree.root, 'workout-error-retry').props.onPress();
    });
    expect(loadWorkoutPage).toHaveBeenCalledTimes(1);
  });
});

describe('layout per size', () => {
  it('phone: stacked (no split row)', async () => {
    const tree = await renderScreen();
    expect(hosts(tree.root, 'workout-split')).toHaveLength(0);
  });

  it('tablet: today full width, then the week and other days side by side (1 : 1.15)', async () => {
    mockWidth = 834;
    const tree = await renderScreen();
    const split = host(tree.root, 'workout-split');
    expect(flat(split)).toMatchObject({ flexDirection: 'row' });
    expect(flat(host(split, 'workout-week')).flex).toBe(1);
    expect(flat(host(split, 'workout-other-days')).flex).toBe(1.15);
    expect(hosts(split, 'workout-hero')).toHaveLength(0);
  });

  it('tablet landscape: today and the week side by side (2 : 1); other days below as cards in columns of min 300', async () => {
    mockWidth = 1194;
    mockHeight = 834;
    const tree = await renderScreen();
    const split = host(tree.root, 'workout-split');
    expect(hosts(split, 'workout-hero')).toHaveLength(1);
    expect(flat(host(split, 'workout-week')).flex).toBe(1);
    expect(flat(host(split, 'workout-side-today')).flex).toBe(2);
    expect(hosts(split, 'workout-other-days')).toHaveLength(0);
    const cards = host(tree.root, 'workout-day-cards');
    act(() => cards.props.onLayout({ nativeEvent: { layout: { width: 1000 } } }));
    const rows = dayButtons(tree.root).filter((node) => node.props.accessibilityRole === 'button');
    expect(flat(rows[0])).toMatchObject({ width: (1000 - 2 * 12) / 3, borderRadius: 24, backgroundColor: colors.surface });
  });

  it('past the large-text reflow: stacked on tablet; the week strip wraps to 3 columns', async () => {
    mockWidth = 834;
    mockFontScale = textScale.reflowAbove + 0.1;
    const tree = await renderScreen();
    expect(hosts(tree.root, 'workout-split')).toHaveLength(0);
    expect(flat(host(tree.root, 'workout-week-strip')).flexWrap).toBe('wrap');
    expect(flat(host(tree.root, 'workout-week-day-1')).width).toBe('33.333%');
  });

  it('no /week: the week is rebuilt from the schedule + this week\'s history (shared rule)', async () => {
    const tree = await renderScreen(hub({ week: null, completedThisWeekDayIds: [1] }));
    expect(textOf(host(tree.root, 'workout-week-count'))).toBe('1 of 4 done');
    expect(host(tree.root, 'workout-week-day-2').props.accessibilityLabel).toBe('Tue: missed');
    expect(hosts(tree.root, 'workout-hero-start')).toHaveLength(1);
  });
});
