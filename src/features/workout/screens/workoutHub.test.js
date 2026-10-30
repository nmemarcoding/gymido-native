import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { NBSP } from '../../../shared/format/counts';
import { colors } from '../../../shared/theme/tokens';
import { listDayExercises } from '../../plans/api/libraryApi';
import { openShellPath } from '../../shell/shellLinks';
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
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
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
// DECLARED (T-140, UX C1): the Back pill is the shell header's leading control now, so the mock draws it too.
jest.mock('../../shell/ShellPage', () => ({ children, headerLeading }) => (
  <>
    {headerLeading}
    {children}
  </>
));
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../../shell/AppHeader', () => () => null);
jest.mock('../runtime/SessionRuntime', () => () => null);
jest.mock('../runtime/RuntimeOverlays', () => ({ CompletionPopup: () => null }));
jest.mock('../runtime/SessionDialogs', () => ({ LeaveWorkoutDialog: () => null }));
jest.mock('../api/workoutApi', () => ({ startWorkout: jest.fn(() => Promise.resolve({ session: null })) }));
jest.mock('../runtime/restAlertPlatform', () => ({ getPermission: jest.fn(() => Promise.resolve('granted')), requestPermission: jest.fn(() => Promise.resolve('granted')) }));

const s = (text) => text.replace(/(\d) /g, `$1${NBSP}`);
// T-74: a row's meta keeps each "·" with the text before it (NBSP + "· ").
const m = (text) => s(text).replace(/ · /g, `${NBSP}· `);
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
// T-81: the strip goes by the LOCAL date of started_at, so the board's Mon/Tue
// ticks need their completed workouts (Upper A Mon, Lower A Tue).
const startedAt = (day, hour = 10) => new Date(2026, 9, day, hour).toISOString();
const DONE_MON = { workout_plan_day_id: 1, started_at: startedAt(26), completed_at: startedAt(26, 11) };
const DONE_TUE = { workout_plan_day_id: 2, started_at: startedAt(27), completed_at: startedAt(27, 11) };

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
      completedThisWeek: [DONE_MON, DONE_TUE],
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

// DECLARED (T-140, PM-approved update to the owner-approved A-balanced ruling
// §3/§6/§9): "Workout" 40/44 → 34/38 on phone; the plan name 15/22 → the plan
// line "{plan} · week N" 15/20 (testID workout-plan-line); tablet 52/56 →
// portrait keeps the phone 34/38, ≥ 1024 landscape 44/48.
// DECLARED (T-140, owner OK 30 Oct 2026 via PM): DELETED 29 tests of the removed hub UI (today card, other days, Up next, the old strip/bar, ×n badge, Not-started caption, layouts); their
// still-live rules are re-tested in workoutPage.t140.test.js. RESTORED as was (FE
// RN-SPEC T-140 keeps the no-schedule state): "Set up your week" … "Or start now".
describe('header (T-65 + T-140 ruling)', () => {
  const started = (startedOn) => hub({ currentPlan: { ...PLAN, enrollment: { ...PLAN.enrollment, started_on: startedOn } } });

  it('"‹ Today" opens the Today root (M1), never goBack; "Workout" 34/38 and the plan line 15/20 secondary on phone', async () => {
    const tree = await renderScreen(started('2026-10-12'));
    tree.root.findAll((node) => node.props.testID === 'workout-back-today' && typeof node.props.onPress === 'function').at(-1).props.onPress();
    expect(openShellPath).toHaveBeenCalledWith('/');
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    expect(flat(host(tree.root, 'workout-title'))).toMatchObject({ fontSize: 34, lineHeight: 38, color: colors.textPrimary });
    const plan = host(tree.root, 'workout-plan-line');
    expect(textOf(plan)).toBe('Upper / Lower Split · week 3');
    expect(flat(plan)).toMatchObject({ fontSize: 15, lineHeight: 20, color: colors.textSecondary });
  });

  it('tablet portrait keeps 34/38; ≥ 1024 landscape "Workout" 44/48', async () => {
    mockWidth = 834;
    let tree = await renderScreen(started('2026-10-12'));
    expect(flat(host(tree.root, 'workout-title'))).toMatchObject({ fontSize: 34, lineHeight: 38 });
    mockWidth = 1366;
    mockHeight = 1024;
    tree = await renderScreen(started('2026-10-12'));
    expect(flat(host(tree.root, 'workout-title'))).toMatchObject({ fontSize: 44, lineHeight: 48 });
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
    // DECLARED (T-74): was s('Any day · 6 exercises'); the " · " is now NBSP + "· " (m), so "·" never starts a line.
    expect(texts(host(tree.root, 'workout-other-days'))).toEqual(expect.arrayContaining(['Or start now', 'Tap any day to start it.', m('Any day · 6 exercises')]));
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

  // DECLARED (UX M2, web b6413372): reverses the round-1 rule: the body is ALWAYS "Please try again."
  // (was the transport message, e.g. "Network Error").
  it('failed: "Workout unavailable" / always "Please try again." (never the transport text); "Try again" reloads', async () => {
    const tree = await renderScreen({ ok: false, error: new Error('Network Error') });
    expect(texts(host(tree.root, 'workout-error'))).toEqual(['Workout unavailable', 'Please try again.', 'Try again']);
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
});

// T-81 (PM "DECIDED", UX T81-week-strip-states, RN-SPEC T-81).
describe('T-81 week strip by date', () => {

  it('no Not-started day in view → no caption', async () => {
    const tree = await renderScreen();
    expect(hosts(tree.root, 'workout-week-caption')).toHaveLength(0);
  });
});
