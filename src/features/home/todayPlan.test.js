jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), openPlanDetailAlone: jest.fn() }));
jest.mock('./api/homeApi', () => ({ getDashboard: jest.fn(), logWeight: jest.fn(), getCurrentWeek: jest.fn() }));
jest.mock('../plans/api/libraryApi', () => ({ getCurrentPlan: jest.fn(() => Promise.resolve(null)), listPlanDays: jest.fn() }));
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
import { colors, shadows } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { resetProfileStore, setStoredProfile } from '../profile/profileStore';
import { openPlanDetailAlone, openShellPath } from '../shell/shellLinks';
import ProgressRing from '../workout/components/ProgressRing';
import { getCurrentWeek, getDashboard } from './api/homeApi';
import HomeScreen from './HomeScreen';
import { exerciseCountText, heroDayTitle, heroImageUrl, memberVolume, weekRing, weekStrip, workoutInitials } from './homeFormat';
import { TodayHero } from './TodayPlanView';

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

const mounted = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockFontScale = 1;
  resetProfileStore();
  setStoredProfile({ first_name: 'Nima', last_name: 'Memar', current_weight_unit: 'kg', goal_weight_unit: 'kg' });
  useAuthStore.setState({ user: { email: 'nima@example.com', roles: [] } });
  getCurrentWeek.mockResolvedValue(WEEK);
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
  it('weekStrip: statuses, labels "{weekday}, {status}", the training-days line and Day n of N', () => {
    const strip = weekStrip(WEEK, new Date(2026, 9, 29));
    expect(strip.cells.map((cell) => cell.status)).toEqual(['done', 'missed', 'rest', 'today', 'upcoming', 'rest', 'rest']);
    expect(strip.cells.map((cell) => cell.label)).toEqual([
      'Monday, Done',
      'Tuesday, Missed',
      'Wednesday, Rest day',
      'Thursday, Today',
      'Friday, Workout day',
      'Saturday, Rest day',
      'Sunday, Rest day',
    ]);
    expect(strip.trainingDays).toBe('Mon, Tue, Thu, Fri');
    expect(strip.dayOfWeek).toBe('Day 3 of 4');
    expect(strip.cells[3].isToday).toBe(true);
  });

  it('weekStrip: an older server without status derives rest/upcoming/today; none or empty → null', () => {
    const plain = WEEK.map(({ weekday, is_workout_day }) => ({ weekday, is_workout_day }));
    const strip = weekStrip(plain, new Date(2026, 9, 29));
    expect(strip.cells.map((cell) => cell.status)).toEqual(['upcoming', 'upcoming', 'rest', 'today', 'upcoming', 'rest', 'rest']);
    expect(weekStrip(null)).toBeNull();
    expect(weekStrip([])).toBeNull();
  });

  it('weekStrip: today on a rest day → no Day n of N', () => {
    expect(weekStrip(WEEK, new Date(2026, 9, 28)).dayOfWeek).toBeNull();
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

  it('weekRing: "{done} done · {planned} planned" and the ring label', () => {
    expect(weekRing(DASH)).toMatchObject({ caption: '2 done · 4 planned', ringLabel: '2 of 4 planned workouts done', plannedText: '/4' });
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

  it('primary: gold, the gold glow, a ground disc; pressed adds the ink 4 % overlay (state rule)', async () => {
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
  it('stat tiles: the 64 flat ring + "2" "/4" + "2 done · 4 planned"; Done total 37 + teal "Last workout"', async () => {
    const tree = await render();
    const ring = host(tree.root, 'home-stat-this-week').findByType(ProgressRing);
    expect(ring.props).toMatchObject({ flat: true, size: 64, value: 2, total: 4, label: '2 of 4 planned workouts done' });
    expect(texts(host(tree.root, 'home-stat-caption'))).toEqual(['2 done · 4 planned']);
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
    expect(cell('2026-10-26').props.accessibilityLabel).toBe('Monday, Done');
    expect(styleOf(cell('2026-10-26'))).toMatchObject({ width: 34, backgroundColor: colors.gold });
    expect(styleOf(cell('2026-10-29'))).toMatchObject({ borderWidth: 2, borderColor: colors.gold });
    expect(styleOf(cell('2026-10-27')).backgroundColor).toBe(colors.track);
    expect(queryHost(cell('2026-10-27'), 'home-week-missed-dot')).toHaveLength(1);
    expect(styleOf(cell('2026-10-28'))).toMatchObject({ borderStyle: 'dashed', borderColor: colors.hairlineStrong });
    // Display only.
    expect(cell('2026-10-26').props.onPress).toBeUndefined();
  });

  it('Your week is hidden when the week call fails (null)', async () => {
    getCurrentWeek.mockResolvedValue(null);
    const tree = await render();
    expect(queryHost(tree.root, 'home-week')).toHaveLength(0);
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
    const tree = await render({ ...DASH, current_weight: 82.1, goal_progress: { goal_weight: 78, difference_to_goal: -4.1 } });
    expect(texts(host(tree.root, 'home-weight-values'))).toEqual(['82.1 kg', ' kg', 'Current', '78 kg', 'Goal', '-4.1 kg', 'To goal']);
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
  it.each([1, 2, 3.1])('at %s: headline cap 1.3 + word fit; body 2.0; no truncated actions', async (scale) => {
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
