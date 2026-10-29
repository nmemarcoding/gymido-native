import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { NBSP } from '../../../shared/format/counts';
import { colors } from '../../../shared/theme/tokens';
import { listDayExercises } from '../../plans/api/libraryApi';
import { openPlanDetailAlone } from '../../shell/shellLinks';
import { startWorkout } from '../api/workoutApi';
import { loadWorkoutPage } from '../loadWorkoutPage';
import WorkoutScreen from './WorkoutScreen';

// T-102 (RN-SPEC-workout dated 29 Oct 2026; web WorkoutPage.t102.test.jsx): the
// hub names this week's open misses from /week; T-108 (UX ruling, owner OK
// 29 Oct): a rest day with a miss is ONE card.
// The setup (mocks, the board's plan) is the one of workoutHub.test.js.

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
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const texts = (root) => root.findAll((node) => node.type === 'Text').map(textOf);
// The pressable itself (role button), not a wrapper component with the same testID.
const pressable = (root, id) =>
  root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function' && node.props.accessibilityRole === 'button')[0];
const confirmDialog = (tree) => tree.root.findAll((node) => node.type === ConfirmDialog && node.props.testID === 'workout-start-confirm')[0];
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
const press = (tree, id) => act(async () => pressable(tree.root, id).props.onPress());

describe('Catch-up row (training / done)', () => {
  it('training + 1 miss: the row under the hero names Monday, no line 2; tap = the T-80 confirm with the training copy → one start', async () => {
    const tree = await renderScreen(hub({ week: weekWith(MISSED_MON), completedThisWeek: [DONE_TUE], completedThisWeekDayIds: [2] }));
    const row = pressable(tree.root, 'workout-catch-up');
    expect(row.props.accessibilityLabel).toBe("Catch up on Monday's Upper A.");
    expect(textOf(host(tree.root, 'workout-catch-up-line1'))).toBe("Catch up: Monday's Upper A");
    expect(hosts(tree.root, 'workout-catch-up-line2')).toHaveLength(0);
    // Order: the hero, then the row, then This week.
    const ids = tree.root.findAll((node) => typeof node.type === 'string' && ['workout-hero', 'workout-catch-up', 'workout-week'].includes(node.props.testID)).map((node) => node.props.testID);
    expect([...new Set(ids)].slice(0, 2)).toEqual(['workout-hero', 'workout-catch-up']);
    await press(tree, 'workout-catch-up');
    expect(confirmDialog(tree).props).toMatchObject({
      isOpen: true,
      title: 'Catch up on Upper A?',
      description: 'You missed it on Monday. Today’s plan is Upper B. This starts a live workout.',
    });
    expect(startWorkout).not.toHaveBeenCalled();
    await act(async () => confirmDialog(tree).props.onConfirm());
    expect(startWorkout).toHaveBeenCalledTimes(1);
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 1 });
  });

  it('today done + 2 misses: names the most recent (Tuesday) with "+1 more", the done copy', async () => {
    const done = { ...TRAINING, already_completed: true };
    const tree = await renderScreen(hub({ todayStatus: done, week: weekWith(MISSED_MON, MISSED_TUE), completedThisWeek: [], completedThisWeekDayIds: [3] }));
    expect(pressable(tree.root, 'workout-catch-up').props.accessibilityLabel).toBe("Catch up on Tuesday's Lower A. 1 more missed this week.");
    expect(textOf(host(tree.root, 'workout-catch-up-line2'))).toBe('+1 more missed this week');
    await press(tree, 'workout-catch-up');
    expect(confirmDialog(tree).props.description).toBe('You missed it on Tuesday. You’ve already done Upper B today. This starts a live workout.');
  });

  it('no misses, or no /week → no row', async () => {
    let tree = await renderScreen();
    expect(hosts(tree.root, 'workout-catch-up')).toHaveLength(0);
    tree = await renderScreen(hub({ week: null }));
    expect(hosts(tree.root, 'workout-catch-up')).toHaveLength(0);
  });
});

describe('T-108 rest day + open miss: ONE card', () => {
  const restWithMisses = (...slots) => hub({ todayStatus: REST, week: restWeek(...slots), completedThisWeek: [], completedThisWeekDayIds: [] });

  it('one hero card: eyebrow, "! Missed", the headline, plan name; no separate rest block, no "Recovery…" line; Up next footer', async () => {
    const tree = await renderScreen(restWithMisses(MISSED_MON));
    expect(hosts(tree.root, 'workout-hero')).toHaveLength(1);
    const card = host(tree.root, 'workout-hero');
    expect(textOf(host(card, 'workout-hero-eyebrow'))).toBe('TODAY · THURSDAY · REST DAY');
    expect(textOf(host(card, 'workout-missed-headline'))).toBe("You missed Monday's Upper A");
    expect(flat(host(card, 'workout-missed-headline'))).toMatchObject({ fontSize: 34, lineHeight: 38 });
    // Large text: no line cap, Today's display cap (a long weekday never breaks inside the word).
    expect(host(card, 'workout-missed-headline').props.numberOfLines).toBeUndefined();
    expect(host(card, 'workout-missed-headline').props.maxFontSizeMultiplier).toBe(1.3);
    expect(textOf(host(card, 'workout-missed-sub'))).toBe('Upper / Lower Split');
    expect(texts(card)).toContain('Missed');
    expect(texts(tree.root).join('|')).not.toContain('Recovery is part of the plan');
    expect(texts(tree.root)).not.toContain('Rest day');
    expect(host(card, 'workout-up-next').props.accessibilityLabel).toBe(`Up next: Lower B, ${s('Saturday · 5 exercises')}`);
    expect(texts(host(card, 'workout-missed-footer'))).toEqual(expect.arrayContaining(['Up next: Lower B', 'Start early']));
    // UX T-108 §1.5 amended: the next day's name gets 2 lines, never 1.
    expect(host(card, 'workout-missed-footer-title').props.numberOfLines).toBe(2);
    // One gold action: Do it now; View plan is the glass one.
    expect(flat(pressable(tree.root, 'workout-missed-start')).backgroundColor).toBe(colors.gold);
    expect(flat(pressable(tree.root, 'workout-missed-view-plan')).backgroundColor).toBe(colors.fillGlass);
    expect(hosts(tree.root, 'workout-catch-up')).toHaveLength(0);
  });

  it('"Do it now" = one tap start of the missed day (T-107), no confirm', async () => {
    const tree = await renderScreen(restWithMisses(MISSED_MON));
    await press(tree, 'workout-missed-start');
    expect(confirmDialog(tree)).toBeUndefined();
    expect(startWorkout).toHaveBeenCalledTimes(1);
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 1 });
  });

  it('"View plan" opens the plan; "Start early" (SR "Start Lower B early") keeps the T-80 rest confirm', async () => {
    const tree = await renderScreen(restWithMisses(MISSED_MON));
    await press(tree, 'workout-missed-view-plan');
    expect(openPlanDetailAlone).toHaveBeenCalledWith(9);
    const early = pressable(tree.root, 'workout-start-early');
    expect(early.props.accessibilityLabel).toBe('Start Lower B early');
    await press(tree, 'workout-start-early');
    expect(confirmDialog(tree).props).toMatchObject({ isOpen: true, title: 'Start Lower B today?' });
  });

  it('no next day → no footer', async () => {
    const week = restWeek(MISSED_MON, item(6, '2026-10-31', 'rest'));
    const tree = await renderScreen(hub({ todayStatus: REST, week, currentPlan: { ...PLAN, schedule: [{ weekday: wd(1), plan_day: null }] }, completedThisWeek: [], completedThisWeekDayIds: [] }));
    expect(hosts(tree.root, 'workout-missed-headline')).toHaveLength(1);
    expect(hosts(tree.root, 'workout-missed-footer')).toHaveLength(0);
  });

  it('2 misses: the card names the latest (Tuesday), the Catch-up row the 2nd with the rest copy; "Train anyway?" lists misses first', async () => {
    const tree = await renderScreen(restWithMisses(MISSED_MON, MISSED_TUE));
    expect(textOf(host(tree.root, 'workout-missed-headline'))).toBe("You missed Tuesday's Lower A");
    expect(pressable(tree.root, 'workout-catch-up').props.accessibilityLabel).toBe("Catch up on Monday's Upper A.");
    await press(tree, 'workout-catch-up');
    expect(confirmDialog(tree).props).toMatchObject({ title: 'Catch up on Upper A?', description: 'You missed it on Monday. Today is a rest day. This starts a live workout.' });
    const rows = dayButtons(tree.root);
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['Start Lower A, missed Tuesday', 'Start Upper A, missed Monday', 'Start Upper B', 'Start Lower B']);
    expect(texts(tree.root)).toEqual(expect.arrayContaining([m('Missed Tuesday · 5 exercises'), m('Missed Monday · 5 exercises')]));
    await act(async () => rows[0].props.onPress());
    expect(confirmDialog(tree).props).toMatchObject({ title: 'Catch up on Lower A?', description: 'You missed it on Tuesday. Today is a rest day. This starts a live workout.' });
  });

  it('a rest day WITHOUT a miss is unchanged: the full rest card with its copy', async () => {
    const tree = await renderScreen(hub({ todayStatus: REST, week: restWeek(), completedThisWeek: [DONE_MON, DONE_TUE] }));
    expect(texts(host(tree.root, 'workout-hero'))).toEqual(expect.arrayContaining(['Rest day', 'Recovery is part of the plan. Nothing is scheduled today.']));
    expect(hosts(tree.root, 'workout-missed-headline')).toHaveLength(0);
  });
});

describe('hand-off from Today (startPlanDayId)', () => {
  it('starts that day ONCE when the load finishes (no confirm) and clears the param', async () => {
    mockParams = { startPlanDayId: 1 };
    await renderScreen(hub({ week: weekWith(MISSED_MON) }));
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ startPlanDayId: undefined });
    expect(startWorkout).toHaveBeenCalledTimes(1);
    expect(startWorkout).toHaveBeenCalledWith({ user_plan_enrollment_id: 31, workout_plan_day_id: 1 });
  });

  it('an open session wins: nothing starts', async () => {
    mockParams = { startPlanDayId: 1 };
    await renderScreen(hub({ session: { id: 77, status: 'in_progress' } }));
    expect(startWorkout).not.toHaveBeenCalled();
  });
});
