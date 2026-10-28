jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), openPlanDetailAlone: jest.fn() }));
jest.mock('./api/homeApi', () => ({ getDashboard: jest.fn(), logWeight: jest.fn(), getCurrentWeek: jest.fn() }));
jest.mock('../plans/api/libraryApi', () => ({ getCurrentPlan: jest.fn(() => Promise.resolve(null)), listPlanDays: jest.fn() }));
jest.mock('../workout/api/workoutApi', () => ({ getCurrentWorkout: jest.fn(() => Promise.resolve(null)), listCompletedWorkouts: jest.fn(() => Promise.resolve([])) }));
jest.mock('../planGenerator/api/generatorApi', () => ({ getGeneratorProfile: jest.fn(() => Promise.resolve({ available: false })) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ addListener: () => () => {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: mockFontScale }),
}));

import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import RemoteImage from '../../shared/components/RemoteImage';
import StatusPill from '../../shared/components/StatusPill';
import { colors, font, shadows } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { resetProfileStore, setStoredProfile } from '../profile/profileStore';
import { openPlanDetailAlone, openShellPath } from '../shell/shellLinks';
import ProgressRing from '../workout/components/ProgressRing';
import { getCurrentWeek, getDashboard } from './api/homeApi';
import { getCurrentPlan, listPlanDays } from '../plans/api/libraryApi';
import HomeScreen from './HomeScreen';
import { exerciseCountText, heroDayTitle, isSessionOpen, todayCard, todayExerciseCount, heroImageUrl, memberVolume, weekRing, weekStrip, workoutInitials } from './homeFormat';
import { TodayHero } from './TodayPlanView';

const { getCurrentWorkout, listCompletedWorkouts } = jest.requireMock('../workout/api/workoutApi');

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const texts = (root) => root.findAll((node) => node.type === 'Text').map(textOf);
const host = (root, id) => root.find((node) => node.props.testID === id && typeof node.type === 'string');
const queryHost = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const styleOf = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const flush = () => act(() => new Promise((resolve) => setImmediate(resolve)));

const DASH = {
  current_plan: { enrollment: { plan: { id: 4, name: 'Upper / Lower' } } },
  today_status: { is_workout_day: true, plan_day: { title: 'Upper A' } },
  quick_stats: { completed_workouts_total: 37, completed_workouts_this_week: 2, planned_workouts_this_week: 4, last_workout_at: '2026-10-28T10:00:00Z' },
  recent_workouts: [],
};
const WEEK = [
  { weekday: { id: 1, name: 'Monday' }, is_workout_day: true, date: '2026-10-26', status: 'done' },
  { weekday: { id: 2, name: 'Tuesday' }, is_workout_day: true, date: '2026-10-27', status: 'missed' },
  { weekday: { id: 3, name: 'Wednesday' }, is_workout_day: false, date: '2026-10-28', status: 'rest' },
  { weekday: { id: 4, name: 'Thursday' }, is_workout_day: true, date: '2026-10-29', status: 'today' },
  { weekday: { id: 5, name: 'Friday' }, is_workout_day: true, date: '2026-10-30', status: 'upcoming' },
  { weekday: { id: 6, name: 'Saturday' }, is_workout_day: false, date: '2026-10-31', status: 'rest' },
  { weekday: { id: 7, name: 'Sunday' }, is_workout_day: false, date: '2026-11-01', status: 'rest' },
];
// T-81: the strip is per DATE: Monday is Done because a workout STARTED that local date.
const workoutOn = (day, hour = 10) => ({ status: 'completed', started_at: new Date(2026, 9, day, hour).toISOString() });
const COMPLETED = [workoutOn(26)];

const mounted = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockFontScale = 1;
  resetProfileStore();
  setStoredProfile({ first_name: 'Nima', last_name: 'Memar', current_weight_unit: 'kg', goal_weight_unit: 'kg' });
  useAuthStore.setState({ user: { email: 'nima@example.com', roles: [] } });
  getCurrentWeek.mockResolvedValue(WEEK);
  listCompletedWorkouts.mockResolvedValue(COMPLETED);
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  jest.setSystemTime(new Date(2026, 9, 29, 9, 0, 0));
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.useRealTimers();
});

async function render(dashboard = DASH) {
  getDashboard.mockResolvedValue(dashboard);
  let tree;
  await act(async () => {
    tree = create(<HomeScreen />);
  });
  await flush();
  mounted.push(tree);
  return tree;
}

describe('homeFormat (Phase 3 Today)', () => {
  // DECLARED (T-81): was weekStrip(WEEK, now) reading /week `status` (cells[].status, labels "Monday, Done"); now
  // weekStrip({ week, completed, startedOn, now }) per DATE via plans/weekByDate (cells[].kind, a11y "Mon: done").
  it('weekStrip: kinds per date, a11y "Mon: done", the training-days line and Day n of N (T-81)', () => {
    const strip = weekStrip({ week: WEEK, completed: COMPLETED, now: new Date(2026, 9, 29) });
    expect(strip.cells.map((cell) => cell.kind)).toEqual(['done', 'missed', 'rest', 'today', 'train', 'rest', 'rest']);
    expect(strip.cells.map((cell) => cell.a11y)).toEqual([
      'Mon: done',
      'Tue: missed',
      'Wed: rest',
      'Thu: today, training',
      'Fri: training',
      'Sat: rest',
      'Sun: rest',
    ]);
    expect(strip.cells.map((cell) => cell.key)).toEqual(WEEK.map((day) => day.date));
    expect(strip.trainingDays).toBe('Mon, Tue, Thu, Fri');
    expect(strip.dayOfWeek).toBe('Day 3 of 4');
    expect(strip.cells[3].isToday).toBe(true);
    expect(strip.caption).toBeNull();
  });

  // DECLARED (T-81): was "an older server without status derives rest/upcoming/today" (cells[].status from
  // is_workout_day). Now /week `status` never drives a cell: a week without a done workout that date is not Done
  // even when its status says "done"; and only a valid 7-day /week builds a strip.
  it('weekStrip: /week "done" alone is not Done (no workout that date); none, empty or not 7 days → null', () => {
    const strip = weekStrip({ week: WEEK, completed: [], now: new Date(2026, 9, 29) });
    expect(strip.cells[0]).toMatchObject({ kind: 'missed', a11y: 'Mon: missed', count: 0 });
    expect(weekStrip({ week: null })).toBeNull();
    expect(weekStrip({ week: [] })).toBeNull();
    expect(weekStrip({ week: WEEK.slice(0, 6) })).toBeNull();
    expect(weekStrip()).toBeNull();
  });

  it('weekStrip: today on a rest day → no Day n of N', () => {
    expect(weekStrip({ week: WEEK, now: new Date(2026, 9, 28) }).dayOfWeek).toBeNull();
  });

  it('workoutInitials: two words → their first letters; one word → two letters; none → ""', () => {
    expect(workoutInitials('Upper A')).toBe('UA');
    expect(workoutInitials('Legs')).toBe('LE');
    expect(workoutInitials('  ')).toBe('');
    expect(workoutInitials(undefined)).toBe('');
  });

  it('memberVolume: total_volume_kg in the member unit; absent → null', () => {
    expect(memberVolume(1000, 'kg')).toBe('1,000 kg');
    expect(memberVolume(100, 'lb')).toBe('220 lb');
    expect(memberVolume(0, 'kg')).toBe('0 kg');
    expect(memberVolume(undefined, 'kg')).toBeNull();
    expect(memberVolume(null, 'kg')).toBeNull();
  });

  it('heroImageUrl: today_status.image.url or null', () => {
    expect(heroImageUrl({ today_status: { image: { url: 'https://x/y.jpg' } } })).toBe('https://x/y.jpg');
    expect(heroImageUrl({ today_status: {} })).toBeNull();
    expect(heroImageUrl(null)).toBeNull();
  });

  // Without /week (progress null) the ring keeps the quick_stats numbers (the fallback).
  it('weekRing: "{done} done · {planned} planned" and the ring label', () => {
    expect(weekRing(DASH)).toMatchObject({ caption: '2 done · 4 planned', ringLabel: '2 of 4 planned workouts done', plannedText: '/4' });
    expect(weekRing(DASH, null)).toMatchObject({ thisWeek: 2, planned: 4, thisWeekText: '2' });
  });

  it('weekRing: X of Y from weekProgressByDate, not quick_stats (T-81); Done total stays quick_stats', () => {
    expect(weekRing(DASH, { done: 1, total: 2, complete: false })).toMatchObject({
      thisWeek: 1,
      planned: 2,
      thisWeekText: '1',
      plannedText: '/2',
      caption: '1 done · 2 planned',
      ringLabel: '1 of 2 planned workouts done',
      doneTotalText: '37',
    });
    expect(weekRing(DASH, { done: 0, total: 0, complete: false })).toMatchObject({ thisWeekText: '0', plannedText: '/0', caption: '0 done · 0 planned' });
  });
});

describe('Today hero (UX E, all five states)', () => {
  it('training: gold pill "Today\'s workout", the 52 headline, the plan name, Start workout → Workout, View plan → plan', async () => {
    const tree = await render();
    expect(tree.root.findAllByType(StatusPill)[0].props).toMatchObject({ tone: 'gold', label: "Today's workout" });
    expect(styleOf(host(tree.root, 'home-today-headline'))).toMatchObject({ fontSize: 52, lineHeight: 52 });
    expect(texts(host(tree.root, 'home-today-card'))).toEqual(expect.arrayContaining(['Upper A', 'Upper / Lower', 'Start workout', 'View plan']));
    act(() => pressable(tree.root, 'home-today-primary').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/workout');
    act(() => pressable(tree.root, 'home-view-plan').props.onPress());
    expect(openPlanDetailAlone).toHaveBeenCalledWith(4);
  });

  it('completed / missed / rest / setup pills and labels', async () => {
    const cases = [
      [{ ...DASH, today_status: { already_completed: true, plan_day: { title: 'Upper A' } } }, 'completed', 'Completed', 'Go to workout'],
      [{ ...DASH, today_status: {}, missed_this_week: [{ weekday: { name: 'Monday' }, plan_day: { title: 'Lower' } }, {}] }, 'warning', 'Missed', 'Do it now'],
      [{ ...DASH, today_status: {} }, 'neutral', 'Rest day', 'Go to workout'],
    ];
    for (const [dash, tone, pill, primary] of cases) {
      const tree = await render(dash);
      expect(tree.root.findAllByType(StatusPill)[0].props).toMatchObject({ tone, label: pill });
      expect(texts(host(tree.root, 'home-today-primary'))).toContain(primary);
    }
    const missed = await render(cases[1][0]);
    expect(texts(host(missed.root, 'home-more-missed'))).toEqual(['+1 more missed this week']);
    expect(styleOf(host(missed.root, 'home-more-missed')).color).toBe(colors.warning);
  });

  // DECLARED change (T-63): was the default 390 phone; 390 now stacks (View plan 52), so the side-by-side 58 / 58
  // pair is checked on a 430 phone.
  it('primary: gold, the gold glow, a ground disc; pressed adds the ink 4 % overlay (state rule)', async () => {
    mockWidth = 430;
    const tree = await render();
    const primary = host(tree.root, 'home-today-primary');
    expect(styleOf(primary)).toMatchObject({ backgroundColor: colors.gold, minHeight: 58, boxShadow: shadows.goldGlow });
    expect(queryHost(tree.root, 'home-today-primary-pressed')).toHaveLength(0);
    const node = tree.root.find((n) => n.props.testID === 'home-today-primary' && typeof n.props.children === 'function');
    let pressed;
    act(() => {
      pressed = create(<>{node.props.children({ pressed: true })}</>);
    });
    mounted.push(pressed);
    expect(StyleSheet.flatten(pressed.root.findByProps({ testID: 'home-today-primary-pressed' }).props.style).backgroundColor).toBe(colors.pressOverlayInk);
    const glass = styleOf(host(tree.root, 'home-view-plan'));
    expect(glass).toMatchObject({ backgroundColor: colors.fillGlass, borderColor: colors.hairlineButton, minHeight: 58 });
  });

  it('phone photo: the image at 0.35 on the right 58 % when today_status.image.url is set; none → glow only', async () => {
    const withPhoto = await render({ ...DASH, today_status: { ...DASH.today_status, image: { url: 'https://img/a.jpg' } } });
    expect(styleOf(host(withPhoto.root, 'home-today-photo'))).toMatchObject({ width: '58%', right: 0 });
    expect(withPhoto.root.findByType(RemoteImage).props.url).toBe('https://img/a.jpg');
    const none = await render();
    expect(queryHost(none.root, 'home-today-photo')).toHaveLength(0);
  });

  // DECLARED change (Batch 2 item 4, web HomePage.jsx:185-197): was "tablet: no photo" (queryHost home-today-photo
  // length 0); the tablet hero now has the web ≥1024 right media half (photo / failed icon tile / initials tile).
  it('tablet: the media half, radius 32, padding 32, 76 headline, "Day 3 of 4" on training only', async () => {
    mockWidth = 834;
    const tree = await render({ ...DASH, today_status: { ...DASH.today_status, image: { url: 'https://img/a.jpg' } } });
    expect(queryHost(tree.root, 'home-today-photo')).toHaveLength(0);
    expect(queryHost(tree.root, 'home-today-media')).toHaveLength(1);
    expect(styleOf(host(tree.root, 'home-today-card'))).toMatchObject({ borderRadius: 32, padding: 32 });
    expect(styleOf(host(tree.root, 'home-today-headline')).fontSize).toBe(76);
    expect(texts(host(tree.root, 'home-day-of-week'))).toEqual(['Day 3 of 4']);
    expect(styleOf(host(tree.root, 'home-today-buttons')).maxWidth).toBe(480);
    const rest = await render({ ...DASH, today_status: {} });
    expect(queryHost(rest.root, 'home-day-of-week')).toHaveLength(0);
  });
});

// Batch 2 item 4 (pm-web-facts): image = today_status.image.url only; tile name = the plan day title (the latest
// miss's when missed; none in setup). Phone: no image → gradient + glow only. Tablet: photo, else the failed-photo
// workout-icon tile, else the neutral initials tile of the title, else the plain gradient.
describe('ND4 hero sub-line "{plan name} · {n} exercises" (UX E 27 Oct)', () => {
  const CARD = { state: 'training', tone: 'brand', pill: "Today's workout", headline: 'Upper A', primary: 'Start workout' };
  function hero(props = {}) {
    let tree;
    act(() => {
      tree = create(<TodayHero plan={{ id: 4, name: 'Upper / Lower Split' }} card={CARD} tablet={false} reflow={false} onPrimary={() => {}} onViewPlan={() => {}} {...props} />);
    });
    return tree;
  }

  it('exerciseCountText: " · n exercises", singular at 1; 0 / none / junk → null', () => {
    expect(exerciseCountText(5)).toBe(' · 5 exercises');
    expect(exerciseCountText(1)).toBe(' · 1 exercise');
    expect(exerciseCountText(0)).toBeNull();
    expect(exerciseCountText(null)).toBeNull();
    expect(exerciseCountText(undefined)).toBeNull();
    expect(exerciseCountText(-2)).toBeNull();
    expect(exerciseCountText(2.5)).toBeNull();
  });

  it.each([false, true])('tablet=%s: the plan name truncates (1 line, shrinks); the count never does (flexShrink 0, 1 line); same sub-line style', (tablet) => {
    const tree = hero({ tablet, exerciseCount: 5 });
    const row = host(tree.root, 'home-today-sub');
    expect(styleOf(row).flexDirection).toBe('row');
    const name = host(tree.root, 'home-today-sub-plan');
    expect(textOf(name)).toBe('Upper / Lower Split');
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode).toBe('tail');
    expect(styleOf(name).flexShrink).toBe(1);
    const count = host(tree.root, 'home-today-sub-count');
    expect(textOf(count)).toBe(' · 5 exercises');
    expect(count.props.numberOfLines).toBe(1);
    expect(styleOf(count).flexShrink).toBe(0);
    [name, count].forEach((node) => {
      expect(styleOf(node).color).toBe(colors.textSecondary);
      expect(styleOf(node).fontSize).toBe(tablet ? 17 : 15);
    });
    expect(row.props.accessible).toBe(true);
    expect(row.props.accessibilityLabel).toBe('Upper / Lower Split · 5 exercises');
  });

  it('1 exercise → singular', () => {
    const tree = hero({ exerciseCount: 1 });
    expect(textOf(host(tree.root, 'home-today-sub-count'))).toBe(' · 1 exercise');
  });

  it('count 0 / absent → the plan name alone (the v1 sub-line, unchanged)', () => {
    [0, null, undefined].forEach((exerciseCount) => {
      const tree = hero({ exerciseCount });
      expect(queryHost(tree.root, 'home-today-sub-count')).toHaveLength(0);
      const sub = host(tree.root, 'home-today-sub');
      expect(textOf(sub)).toBe('Upper / Lower Split');
      expect(sub.props.numberOfLines).toBe(2);
    });
  });

  it('a card sub (setup) wins over the count', () => {
    const tree = hero({ card: { ...CARD, state: 'setup', sub: "Choose the 3 days you'll train each week." }, exerciseCount: 5 });
    expect(queryHost(tree.root, 'home-today-sub-count')).toHaveLength(0);
    expect(textOf(host(tree.root, 'home-today-sub'))).toBe("Choose the 3 days you'll train each week.");
  });

  it('past reflow the pair wraps instead of hiding the plan name', () => {
    const tree = hero({ reflow: true, exerciseCount: 5 });
    expect(styleOf(host(tree.root, 'home-today-sub')).flexWrap).toBe('wrap');
    expect(host(tree.root, 'home-today-sub-plan').props.numberOfLines).toBeUndefined();
  });

  it('Today today: /dashboard carries no exercise count, so the screen shows the plan name alone', async () => {
    const tree = await render();
    expect(queryHost(tree.root, 'home-today-sub-count')).toHaveLength(0);
    expect(textOf(host(tree.root, 'home-today-sub'))).toBe('Upper / Lower');
  });
});

// ND4 data (pm-web-facts "ND4"): n = exercises_count of today's day in GET /plans/{planId}/days (planId from
// /my-plans/current), matched by today_status.plan_day.id; training state only; any failure → the plan name alone.
describe('ND4 count wiring: exercises_count of today\'s plan day', () => {
  const TRAINING = { ...DASH, today_status: { is_workout_day: true, plan_day: { id: 12, title: 'Upper A' } } };
  const CURRENT = { enrollment: { plan: { id: 4 } }, schedule: [{ weekday_id: 1 }] };
  function days(count) {
    return [
      { id: 11, title: 'Lower A', exercises_count: 9 },
      { id: 12, title: 'Upper A', exercises_count: count },
    ];
  }
  beforeEach(() => {
    getCurrentPlan.mockResolvedValue(CURRENT);
  });
  afterEach(() => {
    getCurrentPlan.mockReset().mockImplementation(() => Promise.resolve(null));
    listPlanDays.mockReset();
  });
  const sub = (root) => textOf(host(root, 'home-today-sub'));

  it('todayExerciseCount: the matching day\'s finite exercises_count, else null', () => {
    expect(todayExerciseCount(days(5), TRAINING)).toBe(5);
    expect(todayExerciseCount(days('5'), TRAINING)).toBeNull();
    expect(todayExerciseCount(days(undefined), TRAINING)).toBeNull();
    expect(todayExerciseCount(days(Number.NaN), TRAINING)).toBeNull();
    expect(todayExerciseCount(days(5), DASH)).toBeNull();
    expect(todayExerciseCount(null, TRAINING)).toBeNull();
  });

  it('training + matching day with 5 → "{plan} · 5 exercises" (the plan id from /my-plans/current)', async () => {
    listPlanDays.mockResolvedValue(days(5));
    const tree = await render(TRAINING);
    expect(listPlanDays).toHaveBeenCalledWith(4);
    expect(textOf(host(tree.root, 'home-today-sub-count'))).toBe(' · 5 exercises');
    expect(host(tree.root, 'home-today-sub').props.accessibilityLabel).toBe('Upper / Lower · 5 exercises');
  });

  it('1 → "1 exercise"', async () => {
    listPlanDays.mockResolvedValue(days(1));
    const tree = await render(TRAINING);
    expect(textOf(host(tree.root, 'home-today-sub-count'))).toBe(' · 1 exercise');
  });

  it.each([[undefined], [null], ['5'], ['lots']])('count %p → the plan name alone', async (count) => {
    listPlanDays.mockResolvedValue(days(count));
    const tree = await render(TRAINING);
    expect(queryHost(tree.root, 'home-today-sub-count')).toHaveLength(0);
    expect(sub(tree.root)).toBe('Upper / Lower');
  });

  it('not training (rest day): no extra days call (only the setup check\'s one) and the plan name alone', async () => {
    listPlanDays.mockResolvedValue(days(5));
    const tree = await render({ ...TRAINING, today_status: { is_workout_day: false, plan_day: { id: 12 } } });
    expect(listPlanDays).toHaveBeenCalledTimes(1);
    expect(queryHost(tree.root, 'home-today-sub-count')).toHaveLength(0);
    expect(sub(tree.root)).toBe('Upper / Lower');
  });

  it('completed today: no count', async () => {
    listPlanDays.mockResolvedValue(days(5));
    const tree = await render({ ...TRAINING, today_status: { ...TRAINING.today_status, already_completed: true } });
    expect(queryHost(tree.root, 'home-today-sub-count')).toHaveLength(0);
  });

  it('the days call fails → the plan name alone, the screen renders, no error UI', async () => {
    listPlanDays.mockRejectedValue(new Error('boom'));
    const tree = await render(TRAINING);
    expect(queryHost(tree.root, 'home-today-sub-count')).toHaveLength(0);
    expect(sub(tree.root)).toBe('Upper / Lower');
    expect(texts(tree.root)).not.toContain('boom');
    expect(textOf(host(tree.root, 'home-today-headline'))).toBe('Upper A');
  });

  it('/my-plans/current fails → no days call, the plan name alone', async () => {
    getCurrentPlan.mockRejectedValue(new Error('nope'));
    const tree = await render(TRAINING);
    expect(listPlanDays).not.toHaveBeenCalled();
    expect(sub(tree.root)).toBe('Upper / Lower');
  });

  it('no day matches today_status.plan_day.id → the plan name alone', async () => {
    listPlanDays.mockResolvedValue([{ id: 99, exercises_count: 5 }]);
    const tree = await render(TRAINING);
    expect(queryHost(tree.root, 'home-today-sub-count')).toHaveLength(0);
    expect(sub(tree.root)).toBe('Upper / Lower');
  });
});

describe('Today hero with no image (Batch 2 item 4)', () => {
  afterEach(() => {
    mockWidth = 390;
  });
  const media = (root) => queryHost(root, 'home-today-media');
  const tile = (root, suffix) => queryHost(root, `home-today-media-image${suffix}`);

  it('heroDayTitle: today\'s day title, the latest miss\'s when missed, none in setup', () => {
    expect(heroDayTitle(DASH, { state: 'training' })).toBe('Upper A');
    expect(heroDayTitle({ today_status: {}, missed_this_week: [{ plan_day: { title: 'Lower B' } }] }, { state: 'missed' })).toBe('Lower B');
    expect(heroDayTitle(DASH, { state: 'setup' })).toBeNull();
    expect(heroDayTitle({ today_status: { plan_day: { title: '  ' } } }, { state: 'rest' })).toBeNull();
    expect(heroDayTitle(null, { state: 'training' })).toBeNull();
  });

  it('phone, no image: the gradient card and the gold glow only, no tile', async () => {
    const tree = await render();
    expect(media(tree.root)).toHaveLength(0);
    expect(queryHost(tree.root, 'home-today-photo')).toHaveLength(0);
    expect(queryHost(tree.root, 'exercise-image-initials')).toHaveLength(0);
  });

  it('tablet, no image: the neutral initials tile of the day title ("UA") on the right half, hidden from readers', async () => {
    mockWidth = 834;
    const tree = await render();
    const [half] = media(tree.root);
    expect(styleOf(half)).toMatchObject({ position: 'absolute', top: 0, right: 0, bottom: 0, width: '50%' });
    expect(half.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
    expect(tile(tree.root, '-initials')).toHaveLength(1);
    expect(texts(tile(tree.root, '-initials')[0])).toEqual(['UA']);
    // Neutral: no muscle tint.
    expect(tile(tree.root, '-tint')).toHaveLength(0);
  });

  it('tablet, photo: the photo in the media half; a failed photo → the workout-icon tile', async () => {
    mockWidth = 834;
    const tree = await render({ ...DASH, today_status: { ...DASH.today_status, image: { url: 'https://img/a.jpg' } } });
    expect(tree.root.findByType(RemoteImage).props.url).toBe('https://img/a.jpg');
    await act(async () => tree.root.findByType(RemoteImage).props.onExhausted());
    expect(tile(tree.root, '-failed')).toHaveLength(1);
    expect(tile(tree.root, '-initials')).toHaveLength(0);
  });

  it('tablet, no image and no day title: the plain gradient, no media half', async () => {
    mockWidth = 834;
    const tree = await render({ ...DASH, today_status: { is_workout_day: true } });
    expect(media(tree.root)).toHaveLength(0);
  });
});

describe('Stats, week, weight and recent', () => {
  // DECLARED (T-81, PM ruling 2): was value 2 / total 4 / "2 of 4 planned workouts done" / "2 done · 4 planned"
  // (quick_stats 2 of 4); now /week + started_on: X = 1 /week day "done" (Mon), Y = 4 training days (no started_on).
  it('stat tiles: the 64 flat ring + "1" "/4" + "1 done · 4 planned" from /week; Done total 37 + teal "Last workout"', async () => {
    const tree = await render();
    const ring = host(tree.root, 'home-stat-this-week').findByType(ProgressRing);
    expect(ring.props).toMatchObject({ flat: true, size: 64, value: 1, total: 4, label: '1 of 4 planned workouts done' });
    expect(texts(host(tree.root, 'home-stat-caption'))).toEqual(['1 done · 4 planned']);
    expect(host(tree.root, 'home-stat-this-week').props.accessibilityLabel).toBe('This week 1 /4 Planned');
    expect(texts(host(tree.root, 'home-stat-done'))).toEqual(expect.arrayContaining(['37']));
    expect(styleOf(host(tree.root, 'home-last-workout')).color).toBe(colors.teal);
  });

  it('tablet stat tiles: ring 96, number 52, Done 68, no caption', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(host(tree.root, 'home-stat-this-week').findByType(ProgressRing).props.size).toBe(96);
    expect(queryHost(tree.root, 'home-stat-caption')).toHaveLength(0);
  });

  it('flat ring: gold arc on the 0.08 track', () => {
    let tree;
    act(() => {
      tree = create(<ProgressRing flat value={1} total={2} size={64} thickness={12.5} label="x" />);
    });
    mounted.push(tree);
    expect(tree.root.findByProps({ testID: 'progress-ring-track' }).props.stroke).toBe(colors.track);
    expect(tree.root.findByProps({ testID: 'progress-ring-arc' }).props.stroke).toBe(colors.gold);
  });

  it('Your week: 7 labelled display cells; done gold, today ring, missed planned fill + amber dot, rest dashed', async () => {
    const tree = await render();
    expect(texts(host(tree.root, 'home-week-days'))).toEqual(['Mon, Tue, Thu, Fri']);
    const cell = (date) => host(tree.root, `home-week-cell-${date}`);
    // DECLARED (T-81): was 'Monday, Done' (the UX T-81 SR form "Mon: done").
    expect(cell('2026-10-26').props.accessibilityLabel).toBe('Mon: done');
    expect(cell('2026-10-27').props.accessibilityLabel).toBe('Tue: missed');
    expect(styleOf(cell('2026-10-26'))).toMatchObject({ width: 34, backgroundColor: colors.gold });
    expect(styleOf(cell('2026-10-29'))).toMatchObject({ borderWidth: 2, borderColor: colors.gold });
    expect(styleOf(cell('2026-10-27')).backgroundColor).toBe(colors.track);
    expect(queryHost(cell('2026-10-27'), 'home-week-missed-dot')).toHaveLength(1);
    expect(styleOf(cell('2026-10-28'))).toMatchObject({ borderStyle: 'dashed', borderColor: colors.hairlineStrong });
    // Display only.
    expect(cell('2026-10-26').props.onPress).toBeUndefined();
  });

  it('Your week is hidden when the week call fails (null); the ring falls back to quick_stats (2 of 4)', async () => {
    getCurrentWeek.mockResolvedValue(null);
    const tree = await render();
    expect(queryHost(tree.root, 'home-week')).toHaveLength(0);
    expect(listCompletedWorkouts).not.toHaveBeenCalled();
    expect(host(tree.root, 'home-stat-this-week').findByType(ProgressRing).props).toMatchObject({ value: 2, total: 4 });
    expect(texts(host(tree.root, 'home-stat-caption'))).toEqual(['2 done · 4 planned']);
  });

  it('tablet Your week: 52 cells, short names, a muted "See progress" (44) → Progress', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(styleOf(host(tree.root, 'home-week-cell-2026-10-26')).width).toBe(52);
    expect(texts(host(tree.root, 'home-week-strip'))).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(styleOf(host(tree.root, 'home-week-see-progress')).minHeight).toBe(44);
    act(() => pressable(tree.root, 'home-week-see-progress').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/progress');
  });

  it('weight card: Current big + faint unit, Goal, To goal teal; the glass 46 "Add weight log" opens the modal', async () => {
    const tree = await render({ ...DASH, current_weight: 82.1, goal_progress: { goal_weight: 78, difference_to_goal: 4.1 } });
    expect(texts(host(tree.root, 'home-weight-values'))).toEqual(['82.1 kg', ' kg', 'Current', '78 kg', 'Goal', '\u22124.1 kg', 'To goal']);
    const add = host(tree.root, 'home-add-weight');
    expect(styleOf(add)).toMatchObject({ minHeight: 46, backgroundColor: colors.fillGlass });
    act(() => pressable(tree.root, 'home-add-weight').props.onPress());
    expect(tree.root.findAll((node) => node.props.isOpen === true).length).toBeGreaterThan(0);
  });

  it('weight card without data: the prompt text', async () => {
    const tree = await render();
    expect(texts(host(tree.root, 'home-weight'))).toContain("Log today's weight to start tracking your trend.");
  });

  it('recent: neutral initials tile, meta with vol in the member unit (total_volume_kg), raw status pill', async () => {
    const tree = await render({
      ...DASH,
      recent_workouts: [
        { id: 9, status: 'completed', workout_plan_day: { title: 'Lower A' }, completed_at: '2026-10-28T10:00:00Z', duration_seconds: 3120, total_volume: 5, total_volume_kg: 1000 },
      ],
    });
    const row = host(tree.root, 'home-recent-9');
    expect(styleOf(host(row, 'home-recent-tile'))).toMatchObject({ backgroundColor: colors.fillSkeleton, width: 40 });
    expect(texts(row)).toEqual(expect.arrayContaining(['LA', 'Lower A', 'completed']));
    expect(texts(row).some((text) => / · vol 1,000 kg$/.test(text))).toBe(true);
    expect(row.findByType(StatusPill).props.tone).toBe('completed');
  });

  it('recent empty: the v1 empty state', async () => {
    const tree = await render();
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['No completed workouts yet']));
  });
});

describe('§9 large text (fontScale 1 / 2 / 3.1)', () => {
  // DECLARED change (T-63): was the default 390 phone; at 1× a 390 phone now stacks by the 21rem row rule, so the
  // scale-only check runs on a 430 phone (row 354 ≥ 336).
  it.each([1, 2, 3.1])('at %s: headline cap 1.3 + word fit; body 2.0; no truncated actions', async (scale) => {
    mockWidth = 430;
    mockFontScale = scale;
    const tree = await render();
    const headline = host(tree.root, 'home-today-headline');
    expect(headline.props).toMatchObject({ maxFontSizeMultiplier: 1.3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    tree.root
      .findAll((node) => node.type === 'Text' && ['Start workout', 'View plan', 'Add weight log'].includes(textOf(node)))
      .forEach((node) => expect(node.props.numberOfLines).toBeUndefined());
    const buttons = styleOf(host(tree.root, 'home-today-buttons'));
    const tiles = styleOf(host(tree.root, 'home-stats'));
    if (scale > 1.3) {
      expect(buttons.flexDirection).toBe('column');
      expect(tiles.flexDirection).toBe('column');
    } else {
      expect(buttons.flexDirection).toBe('row');
      expect(tiles.flexDirection).toBe('row');
    }
  });

  it('tablet at 3.1: the pair stacks with no max width', async () => {
    mockWidth = 834;
    mockFontScale = 3.1;
    const tree = await render();
    expect(styleOf(host(tree.root, 'home-today-buttons'))).toMatchObject({ flexDirection: 'column', maxWidth: undefined });
  });
});

// RN-SPEC-home H1.3 dated change (27 Oct 2026, owner T-63): "Resume workout"
// while GET /workouts/current returns a session, in every state; fail-soft.
describe('T-63 "Resume workout" while a session is open', () => {
  // Reviewer LOW (exact parity with web): open = (status ?? 'in_progress') === 'in_progress'.
  it('a session is open only while in progress (a missing status counts as in progress)', () => {
    expect(isSessionOpen({ id: 1, status: 'in_progress' })).toBe(true);
    expect(isSessionOpen({ id: 1 })).toBe(true);
    expect(isSessionOpen({ id: 1, status: 'completed' })).toBe(false);
    expect(isSessionOpen({ id: 1, status: 'abandoned' })).toBe(false);
    expect(isSessionOpen(null)).toBe(false);
    expect(isSessionOpen(undefined)).toBe(false);
  });

  const SESSION = { id: 9, status: 'in_progress' };
  const SETUP_PLAN = { enrollment: { plan: { id: 4, name: 'Upper / Lower' } }, schedule: [] };
  const STATES = [
    ['training', DASH, "Today's workout", 'Upper A'],
    ['completed', { ...DASH, today_status: { already_completed: true, plan_day: { title: 'Upper A' } } }, 'Completed', 'Upper A'],
    ['missed', { ...DASH, today_status: {}, missed_this_week: [{ weekday: { name: 'Monday' }, plan_day: { title: 'Lower' } }] }, 'Missed', "You missed Monday's Lower"],
    ['rest', { ...DASH, today_status: {} }, 'Rest day', 'Recovery day'],
  ];
  beforeEach(() => {
    getCurrentWorkout.mockResolvedValue(null);
    getCurrentPlan.mockResolvedValue(null);
  });

  it('todayCard: an open session relabels the primary only; none keeps the usual label', () => {
    expect(todayCard(DASH, null, true)).toMatchObject({ state: 'training', pill: "Today's workout", headline: 'Upper A', primary: 'Resume workout' });
    expect(todayCard(DASH, 3, true)).toMatchObject({ state: 'setup', primary: 'Resume workout' });
    expect(todayCard(DASH, null, false).primary).toBe('Start workout');
    expect(todayCard(DASH).primary).toBe('Start workout');
  });

  it.each(STATES)('%s: "Resume workout", the pill and headline unchanged, the same push to Workout', async (state, dash, pill, headline) => {
    getCurrentWorkout.mockResolvedValue(SESSION);
    const tree = await render(dash);
    expect(texts(host(tree.root, 'home-today-primary'))).toEqual(['Resume workout']);
    expect(tree.root.findAllByType(StatusPill)[0].props.label).toBe(pill);
    expect(texts(host(tree.root, 'home-today-headline'))).toEqual([headline]);
    act(() => pressable(tree.root, 'home-today-primary').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/workout');
  });

  it('"Choose days" setup: "Resume workout" too', async () => {
    getCurrentWorkout.mockResolvedValue(SESSION);
    getCurrentPlan.mockResolvedValue(SETUP_PLAN);
    listPlanDays.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const tree = await render();
    expect(texts(host(tree.root, 'home-today-headline'))).toEqual(['Pick your training days']);
    expect(texts(host(tree.root, 'home-today-primary'))).toEqual(['Resume workout']);
  });

  it('no session (200 session null) or a failed read: the usual label, the page still loads', async () => {
    const none = await render();
    expect(texts(host(none.root, 'home-today-primary'))).toEqual(['Start workout']);
    getCurrentWorkout.mockRejectedValue(new Error('Network Error'));
    const failed = await render();
    expect(texts(host(failed.root, 'home-today-primary'))).toEqual(['Start workout']);
    expect(queryHost(failed.root, 'home-error')).toHaveLength(0);
  });

  it('one GET /workouts/current per Today load (mount / refocus)', async () => {
    await render();
    expect(getCurrentWorkout).toHaveBeenCalledTimes(1);
  });
});

// T-63 layout (UX ruling, 27 Oct): the phone pair stacks while the measured
// row is narrower than 21rem (21 × 16 × fontScale); from 21rem side by side.
describe('T-63 phone button pair: stacks below 21rem of row width', () => {
  const layout = (tree, width) =>
    act(() => host(tree.root, 'home-today-buttons').props.onLayout({ nativeEvent: { layout: { width, height: 120 } } }));
  const order = (tree) =>
    host(tree.root, 'home-today-buttons')
      .findAll((node) => ['home-today-primary', 'home-view-plan'].includes(node.props.testID) && typeof node.type === 'string')
      .map((node) => node.props.testID);
  beforeEach(() => getCurrentWorkout.mockResolvedValue(null));

  it.each([
    ['Start workout', null],
    ['Resume workout', { id: 9 }],
  ])('%s: below 336 stacked (gold first, 58 full width with its disc; View plan 52 full width; gap 10); from 336 side by side (both 58)', async (label, session) => {
    getCurrentWorkout.mockResolvedValue(session);
    const tree = await render();
    expect(texts(host(tree.root, 'home-today-primary'))).toEqual([label]);
    layout(tree, 335);
    expect(styleOf(host(tree.root, 'home-today-buttons'))).toMatchObject({ flexDirection: 'column', alignItems: 'stretch', gap: 10 });
    expect(order(tree)).toEqual(['home-today-primary', 'home-view-plan']);
    expect(styleOf(host(tree.root, 'home-today-primary'))).toMatchObject({ minHeight: 58, flex: 0, alignSelf: 'stretch' });
    expect(host(tree.root, 'home-today-primary').findAll((node) => node.type === 'RNSVGSvgView' || node.type === 'Svg').length).toBeGreaterThan(0);
    expect(styleOf(host(tree.root, 'home-view-plan'))).toMatchObject({ minHeight: 52, flex: 0, alignSelf: 'stretch' });
    layout(tree, 336);
    expect(styleOf(host(tree.root, 'home-today-buttons')).flexDirection).toBe('row');
    expect(styleOf(host(tree.root, 'home-today-primary')).minHeight).toBe(58);
    expect(styleOf(host(tree.root, 'home-view-plan')).minHeight).toBe(58);
  });

  it('the threshold follows the font scale: at 1.2 a 380 row (< 403.2) stacks, a 404 row does not', async () => {
    mockFontScale = 1.2;
    const tree = await render();
    layout(tree, 380);
    expect(styleOf(host(tree.root, 'home-today-buttons')).flexDirection).toBe('column');
    layout(tree, 404);
    expect(styleOf(host(tree.root, 'home-today-buttons')).flexDirection).toBe('row');
  });

  it('before the first measure: estimated from the window (390 → stacked, 430 → side by side)', async () => {
    const narrow = await render();
    expect(styleOf(host(narrow.root, 'home-today-buttons')).flexDirection).toBe('column');
    mockWidth = 430;
    const wide = await render();
    expect(styleOf(host(wide.root, 'home-today-buttons')).flexDirection).toBe('row');
  });

  it('tablet: no width rule (side by side at 1×, the 480 max row kept)', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(host(tree.root, 'home-today-buttons').props.onLayout).toBeUndefined();
    expect(styleOf(host(tree.root, 'home-today-buttons'))).toMatchObject({ flexDirection: 'row', maxWidth: 480 });
  });
});

// T-81 (PM "DECIDED" 28 Oct 2026 ruling 2; UX T81-week-strip-states): Today's strip per DATE + the ring from /week + started_on.
describe('T-81 Today week strip by date + ring', () => {
  const OWNER_WEEK = [
    { weekday: { id: 1, name: 'Monday' }, is_workout_day: true, date: '2026-10-26', status: 'done', plan_day: { id: 11 } },
    { weekday: { id: 2, name: 'Tuesday' }, is_workout_day: true, date: '2026-10-27', status: 'missed', plan_day: { id: 12 } },
    { weekday: { id: 3, name: 'Wednesday' }, is_workout_day: false, date: '2026-10-28', status: 'rest' },
    { weekday: { id: 4, name: 'Thursday' }, is_workout_day: true, date: '2026-10-29', status: 'upcoming', plan_day: { id: 13 } },
    { weekday: { id: 5, name: 'Friday' }, is_workout_day: true, date: '2026-10-30', status: 'upcoming', plan_day: { id: 14 } },
    { weekday: { id: 6, name: 'Saturday' }, is_workout_day: false, date: '2026-10-31', status: 'rest' },
    { weekday: { id: 7, name: 'Sunday' }, is_workout_day: false, date: '2026-11-01', status: 'rest' },
  ];
  const STARTED = { enrollment: { started_on: '2026-10-28', plan: { id: 4 } }, schedule: [{ weekday_id: 1 }] };
  const cell = (root, date) => host(root, `home-week-cell-${date}`);
  afterEach(() => {
    getCurrentPlan.mockReset().mockImplementation(() => Promise.resolve(null));
    listPlanDays.mockReset();
  });

  it('owner case: plan started Wed; Mon/Tue training = not started; Monday\'s workout done on Wednesday ticks Wednesday', async () => {
    jest.setSystemTime(new Date(2026, 9, 28, 18, 0, 0));
    getCurrentWeek.mockResolvedValue(OWNER_WEEK);
    getCurrentPlan.mockResolvedValue(STARTED);
    listPlanDays.mockResolvedValue([]);
    // Monday's plan day (11), started Wednesday 08:00 local.
    listCompletedWorkouts.mockResolvedValue([{ ...workoutOn(28, 8), workout_plan_day_id: 11 }]);
    const tree = await render({ ...DASH, today_status: { is_workout_day: false } });
    expect(listCompletedWorkouts).toHaveBeenCalledWith({ startDate: '2026-10-26', endDate: '2026-11-01' });
    for (const [date, a11y] of [
      ['2026-10-26', 'Mon: not started'],
      ['2026-10-27', 'Tue: not started'],
    ]) {
      expect(cell(tree.root, date).props.accessibilityLabel).toBe(a11y);
      const style = styleOf(cell(tree.root, date));
      expect(style).toMatchObject({ width: 34, height: 34, backgroundColor: colors.fillSkeleton });
      expect(style.borderWidth).toBeUndefined();
      expect(queryHost(cell(tree.root, date), 'home-week-missed-dot')).toHaveLength(0);
    }
    const monLetter = host(tree.root, 'home-week-strip').findAll((node) => node.type === 'Text')[0];
    expect(textOf(monLetter)).toBe('M');
    expect(styleOf(monLetter).color).toBe(colors.textMuted);
    // Wednesday (a rest day, today) is Done: the gold Done cell, no ×n.
    expect(cell(tree.root, '2026-10-28').props.accessibilityLabel).toBe('Wed: today, done');
    expect(styleOf(cell(tree.root, '2026-10-28'))).toMatchObject({ backgroundColor: colors.gold });
    expect(queryHost(tree.root, 'home-week-count-2026-10-28')).toHaveLength(0);
    expect(cell(tree.root, '2026-10-29').props.accessibilityLabel).toBe('Thu: training');
    // The caption, once, under the strip.
    expect(texts(host(tree.root, 'home-week-caption'))).toEqual(['Your plan started Wednesday.']);
    expect(styleOf(host(tree.root, 'home-week-caption'))).toMatchObject({ fontSize: 13, lineHeight: 18, marginTop: 10, color: colors.textMuted });
    // The ring: X = 1 (/week Monday "done"), Y = 2 (Thu, Fri: training days on/after started_on).
    expect(host(tree.root, 'home-stat-this-week').findByType(ProgressRing).props).toMatchObject({ value: 1, total: 2, label: '1 of 2 planned workouts done' });
    expect(texts(host(tree.root, 'home-stat-caption'))).toEqual(['1 done · 2 planned']);
    expect(host(tree.root, 'home-stat-this-week').props.accessibilityLabel).toBe('This week 1 /2 Planned');
  });

  it('started_on with a time part: only its first 10 characters count (never converted to local)', () => {
    const strip = weekStrip({ week: OWNER_WEEK, completed: [], startedOn: '2026-10-28T23:30:00-07:00', now: new Date(2026, 9, 28, 18) });
    expect(strip.cells.map((item) => item.kind)).toEqual(['notStarted', 'notStarted', 'todayRest', 'train', 'train', 'rest', 'rest']);
    expect(strip.cells[0].label).toBe('');
    expect(strip.caption).toBe('Your plan started Wednesday.');
  });

  // UX T-81 §5: the Today strip's badge takes its gold Done colour (was teal in this new test).
  it('×n: two workouts on a rest day → Done + a "×2" badge (20 high, min 22, GOLD 1.5 ring on surface), SR "Wed: done, 2 workouts"', async () => {
    listCompletedWorkouts.mockResolvedValue([workoutOn(26), workoutOn(28, 9), workoutOn(28, 19)]);
    const tree = await render();
    const wed = cell(tree.root, '2026-10-28');
    expect(wed.props.accessibilityLabel).toBe('Wed: done, 2 workouts');
    expect(styleOf(wed)).toMatchObject({ width: 34, backgroundColor: colors.gold });
    const badge = host(tree.root, 'home-week-count-2026-10-28');
    expect(badge.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
    expect(styleOf(badge)).toMatchObject({
      position: 'absolute',
      height: 20,
      minWidth: 22,
      paddingHorizontal: 5,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.gold,
    });
    const label = badge.findByType('Text');
    expect(textOf(label)).toBe('×2');
    expect(styleOf(label)).toMatchObject({ ...font(600), fontSize: 13, color: colors.gold, fontVariant: ['tabular-nums'] });
    // One workout → no badge; the badge text is the only extra text (no label below the cell).
    expect(queryHost(tree.root, 'home-week-count-2026-10-26')).toHaveLength(0);
    expect(texts(host(tree.root, 'home-week-strip'))).toEqual(['M', 'T', 'W', '×2', 'T', 'F', 'S', 'S']);
  });

  it('no Not-started day in view → no caption (started before this week, or no started_on)', async () => {
    getCurrentPlan.mockResolvedValue({ ...STARTED, enrollment: { ...STARTED.enrollment, started_on: '2026-10-01' } });
    listPlanDays.mockResolvedValue([]);
    const tree = await render();
    expect(queryHost(tree.root, 'home-week-caption')).toHaveLength(0);
    expect(cell(tree.root, '2026-10-27').props.accessibilityLabel).toBe('Tue: missed');
    expect(host(tree.root, 'home-stat-this-week').findByType(ProgressRing).props).toMatchObject({ value: 1, total: 4 });
  });

  it('the completed-workouts read fails → the strip still shows from /week (no Done), the page renders', async () => {
    listCompletedWorkouts.mockRejectedValue(new Error('boom'));
    const tree = await render();
    expect(queryHost(tree.root, 'home-week')).toHaveLength(1);
    expect(cell(tree.root, '2026-10-26').props.accessibilityLabel).toBe('Mon: missed');
    expect(texts(tree.root)).not.toContain('boom');
    expect(host(tree.root, 'home-stat-this-week').findByType(ProgressRing).props).toMatchObject({ value: 1, total: 4 });
  });

  it('the /week call throws → strip hidden, ring on quick_stats, no workouts read', async () => {
    getCurrentWeek.mockRejectedValue(new Error('down'));
    const tree = await render();
    expect(queryHost(tree.root, 'home-week')).toHaveLength(0);
    expect(listCompletedWorkouts).not.toHaveBeenCalled();
    expect(host(tree.root, 'home-stat-this-week').findByType(ProgressRing).props).toMatchObject({ value: 2, total: 4 });
  });
});
