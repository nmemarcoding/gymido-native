import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors } from '../../../shared/theme/tokens';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { NBSP } from '../../../shared/format/counts';
import { listDayExercises } from '../../plans/api/libraryApi';
import { loadWorkoutPage } from '../loadWorkoutPage';
import WorkoutScreen from './WorkoutScreen';

// T-116 (owner; UX T116-train-anyway-labels ruling; RN-SPEC-workout dated 29 Oct 2026, web 2.1.8): on a rest day
// "Train anyway?" = this week's training slots in week order Mon → Sun, today left out, one row per slot; "{Status}
// · {Weekday} · n exercises". Setup as workoutHub.t102.test.js (Thursday 29 Oct 2026, a rest day).

const mockNavigation = { dispatch: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true), goBack: jest.fn() };
let mockWidth = 390;
let mockHeight = 1194;
let mockFontScale = 1;
let mockParams = {};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockHeight, scale: 2, fontScale: mockFontScale }),
}));
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => ({ key: 'Workout-1', name: 'Workout', params: mockParams }),
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
jest.mock('../../../shared/components/ExerciseImage', () => (props) => {
  const { View } = require('react-native');
  return <View testID={props.loading ? `${props.testID}-loading` : props.testID} style={props.style} />;
});
jest.mock('../loadWorkoutPage', () => ({ loadWorkoutPage: jest.fn() }));
jest.mock('../../shell/ShellPage', () => ({ children }) => children);
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn(), openPlanDetailAlone: jest.fn() }));
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
const texts = (root) => root.findAll((node) => node.type === 'Text').map(textOf);
const confirmDialog = (tree) => tree.root.findAll((node) => node.type === ConfirmDialog && node.props.testID === 'workout-start-confirm')[0];
// DECLARED (T-116 review N1, PM OK 29 Oct): was ^workout-day-start-\d+$; a plan day's 2nd slot is {dayId}-{date}.
const dayButtons = (root) =>
  root.findAll((node) => typeof node.props.testID === 'string' && /^workout-day-start-[\d-]+$/.test(node.props.testID) && typeof node.props.onPress === 'function');

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
  mockParams = {};
  listDayExercises.mockImplementation((planId, dayId) => Promise.resolve(dayId === 3 ? UPPER_B : [ex(10 + dayId, `First ${dayId}`, 'Legs')]));
});
afterEach(() => act(() => mounted.splice(0).forEach((tree) => tree.unmount())));


const MISSED_MON = item(1, '2026-10-26', 'missed', DAYS[0]);
const MISSED_TUE = item(2, '2026-10-27', 'missed', DAYS[1]);
const weekWith = (...slots) => WEEK.map((slot) => slots.find((other) => other.date === slot.date) ?? slot);
const REST = { is_workout_day: false, already_completed: false, plan_day: null };
const restWeek = (...slots) => weekWith(item(4, '2026-10-29', 'rest'), ...slots);

const UPCOMING_FRI = item(5, '2026-10-30', 'upcoming', DAYS[2]);
const DONE_WED = item(3, '2026-10-28', 'done', DAYS[3]);
const restDay = (week, data = {}) => hub({ todayStatus: REST, week, completedThisWeek: [], completedThisWeekDayIds: [], ...data });
const labels = (tree) => dayButtons(tree.root).map((row) => row.props.accessibilityLabel);

describe('T-116 "Train anyway?" = this week only, in week order', () => {
  it('2 missed + 1 done + tomorrow + upcoming: Mon → Sun; each meta "{Status} · {Weekday} · n exercises"; today not listed', async () => {
    const week = restWeek(MISSED_MON, MISSED_TUE, DONE_WED, UPCOMING_FRI);
    const tree = await renderScreen(restDay(week));
    expect(labels(tree)).toEqual(['Start Upper A, missed Monday', 'Start Lower A, missed Tuesday', 'Repeat Lower B', 'Start Upper B, tomorrow, Friday', 'Start Lower B, upcoming, Saturday']);
    expect(texts(host(tree.root, 'workout-other-days'))).toEqual(
      expect.arrayContaining([m('Missed · Monday · 5 exercises'), m('Missed · Tuesday · 5 exercises'), m('Wednesday · 5 exercises'), m('Tomorrow · Friday · 6 exercises'), m('Upcoming · Saturday · 5 exercises')])
    );
    // ✓ Done stays the existing mark (+ "·") before the meta.
    expect(hosts(tree.root, 'workout-day-done-4')).toHaveLength(1);
  });

  it('a missed meta is text-muted; tomorrow / upcoming stay text-secondary', async () => {
    const tree = await renderScreen(restDay(restWeek(MISSED_MON, UPCOMING_FRI)));
    const meta = (text) => tree.root.findAll((node) => node.type === 'Text' && textOf(node) === m(text))[0];
    expect(StyleSheet.flatten(meta('Missed · Monday · 5 exercises').props.style).color).toBe(colors.textMuted);
    expect(StyleSheet.flatten(meta('Tomorrow · Friday · 6 exercises').props.style).color).toBe(colors.textSecondary);
  });

  it('taps: Missed → the catch-up rest copy for its weekday; Tomorrow / Upcoming → "Start {title} today?"; Done → Repeat', async () => {
    const tree = await renderScreen(restDay(restWeek(MISSED_MON, DONE_WED, UPCOMING_FRI)));
    const open = async (label) => {
      const row = dayButtons(tree.root).find((node) => node.props.accessibilityLabel === label);
      await act(async () => row.props.onPress());
      const props = confirmDialog(tree).props;
      await act(async () => props.onClose());
      return { title: props.title, description: props.description };
    };
    expect(await open('Start Upper A, missed Monday')).toEqual({ title: 'Catch up on Upper A?', description: 'You missed it on Monday. Today is a rest day. This starts a live workout.' });
    expect(await open('Start Upper B, tomorrow, Friday')).toEqual({ title: 'Start Upper B today?', description: 'Today is a rest day. This starts a live workout.' });
    expect(await open('Repeat Lower B')).toMatchObject({ title: 'Do Lower B again?' });
  });

  it('a plan day on two weekdays gets one row per slot; a plan day with no slot this week is not listed', async () => {
    const week = restWeek(MISSED_MON, item(5, '2026-10-30', 'upcoming', DAYS[0]));
    const tree = await renderScreen(restDay(week));
    expect(labels(tree)).toEqual(['Start Upper A, missed Monday', 'Repeat Lower A', 'Start Upper A, tomorrow, Friday', 'Start Lower B, upcoming, Saturday']);
    expect(labels(tree).some((label) => /Upper B/.test(label))).toBe(false);
  });

  it('a past slot that is neither missed nor done (e.g. before the plan started) is not listed', async () => {
    const week = restWeek(item(1, '2026-10-26', 'rest_not_started', DAYS[0]));
    const tree = await renderScreen(restDay(week));
    expect(labels(tree).some((label) => /Upper A/.test(label))).toBe(false);
  });

  it('no other slot this week → the "Train anyway?" section is hidden', async () => {
    const empty = WEEK.map((slot) => ({ ...slot, status: 'rest', is_workout_day: false, plan_day: null }));
    const tree = await renderScreen(restDay(empty));
    expect(hosts(tree.root, 'workout-other-days')).toHaveLength(0);
  });

  it('only the rest day changes: the training day keeps its "Other days" (every other plan day)', async () => {
    const tree = await renderScreen(hub({ week: weekWith(MISSED_MON) }));
    expect(texts(host(tree.root, 'workout-other-days'))).toContain('Other days');
    expect(labels(tree)).toEqual(expect.arrayContaining(['Start Lower B']));
  });
});

// T-118 (UX, T-116 native verdict) + T-116 review N1.
describe('T-118 "Made up" + unique row ids', () => {
  const doneMark = (tree, key) => textOf(host(tree.root, `workout-day-done-${key}`).findAll((node) => node.type === 'Text')[0]);

  it('a done slot whose day was NOT started on that date reads "✓ Made up"; one started that day reads "✓ Done"', async () => {
    // Mon: Upper A done, started Monday (DONE_MON) → Done. Wed: Lower B done, started only on Thursday (later) → Made up.
    const lowerBThu = { workout_plan_day_id: 4, started_at: new Date(2026, 9, 29, 8).toISOString(), completed_at: new Date(2026, 9, 29, 9).toISOString() };
    const tree = await renderScreen(restDay(restWeek(item(1, '2026-10-26', 'done', DAYS[0]), DONE_WED), { completedThisWeek: [DONE_MON, DONE_TUE, lowerBThu] }));
    expect(doneMark(tree, 1)).toBe('Done');
    expect(doneMark(tree, 4)).toBe('Made up');
    // The SR name and the tap are unchanged (Repeat).
    expect(labels(tree)).toEqual(expect.arrayContaining(['Repeat Upper A', 'Repeat Lower B']));
  });

  it('reviewer M1: a slot done EARLY (started before its date, e.g. "Start … early") reads "✓ Done", not "Made up"', async () => {
    // Saturday's Lower B slot is done, started Thursday (today, early).
    const early = { workout_plan_day_id: 4, started_at: new Date(2026, 9, 29, 8).toISOString(), completed_at: new Date(2026, 9, 29, 9).toISOString() };
    // Tuesday stays missed, so the week isn't complete (the hub stays on the rest day).
    const tree = await renderScreen(restDay(restWeek(MISSED_TUE, item(6, '2026-10-31', 'done', DAYS[3])), { completedThisWeek: [DONE_MON, early] }));
    expect(doneMark(tree, 4)).toBe('Done');
    // A past slot done early (Mon's Upper A started the Sunday before → not this week's data) stays Done too.
    const past = await renderScreen(restDay(restWeek(MISSED_TUE, item(1, '2026-10-26', 'done', DAYS[0])), { completedThisWeek: [early] }));
    expect(doneMark(past, 1)).toBe('Done');
  });

  it('without this week\'s completed workouts the slot keeps "Done" (never guesses a make-up)', async () => {
    const tree = await renderScreen(restDay(restWeek(DONE_WED), { completedThisWeek: [] }));
    expect(doneMark(tree, 4)).toBe('Done');
  });

  it('N1: a plan day on two slots gets unique ids (day id, then day id + date)', async () => {
    const tree = await renderScreen(restDay(restWeek(MISSED_MON, item(5, '2026-10-30', 'upcoming', DAYS[0]))));
    expect(hosts(tree.root, 'workout-day-start-1')).toHaveLength(1);
    expect(hosts(tree.root, 'workout-day-start-1-2026-10-30')).toHaveLength(1);
    expect(host(tree.root, 'workout-day-start-1-2026-10-30').props.accessibilityLabel).toBe('Start Upper A, tomorrow, Friday');
  });
});

