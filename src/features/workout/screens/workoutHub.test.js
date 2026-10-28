import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { colors, shadows } from '../../../shared/theme/tokens';
import PlanDayCard from '../components/PlanDayCard';
import ProgressRing from '../components/ProgressRing';
import TodayHeroCard from '../components/TodayHeroCard';
import { loadWorkoutPage } from '../loadWorkoutPage';
import WorkoutScreen from './WorkoutScreen';
import { endSessionState } from '../runtime/workoutSessionStore';

const mockNavigation = { dispatch: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true), goBack: jest.fn() };
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: mockFontScale }),
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
jest.mock('../../plans/components/ScheduleSetupCard', () => () => null);
jest.mock('../loadWorkoutPage', () => ({ loadWorkoutPage: jest.fn() }));
jest.mock('../../shell/ShellPage', () => ({ children }) => children);
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../../shell/AppHeader', () => () => null);
jest.mock('../runtime/SessionRuntime', () => () => null);
jest.mock('../runtime/RuntimeOverlays', () => ({ CompletionPopup: () => null }));
jest.mock('../runtime/SessionDialogs', () => ({ LeaveWorkoutDialog: () => null }));
jest.mock('../api/workoutApi', () => ({ startWorkout: jest.fn() }));
jest.mock('../runtime/restAlertPlatform', () => ({ getPermission: jest.fn(), requestPermission: jest.fn() }));

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const host = (root, id) => root.find((node) => node.props.testID === id && typeof node.type === 'string');
const queryHost = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const mounted = [];
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
async function renderScreen() {
  let tree;
  await act(async () => {
    tree = create(<WorkoutScreen />);
  });
  mounted.push(tree);
  return tree;
}

const HUB = {
  ok: true,
  data: {
    session: null,
    currentPlan: { enrollment: { id: 3, plan: { name: 'Upper / Lower Split' } }, schedule: [] },
    todayStatus: { is_workout_day: true, plan_day: { id: 11, title: 'Upper A' }, image: { url: 'https://img/bench.jpg' } },
    planDays: [{ id: 11, title: 'Upper A' }, { id: 12, title: 'Lower A' }],
    completedThisWeekDayIds: [12],
    exerciseStatsMap: {},
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockFontScale = 1;
  loadWorkoutPage.mockResolvedValue(HUB);
});
afterEach(() => act(() => mounted.splice(0).forEach((tree) => tree.unmount())));

const HERO = { planName: 'Upper / Lower Split', dayCountLabel: '4 training days', state: 'training', detail: 'Upper A is ready to go.', ringValue: 2, ringTotal: 4, showStart: true, starting: false, onStart: jest.fn() };

describe('Workout hub page (UX G)', () => {
  it('"← Today" (U5, 44 hit) always opens the Today root, never goBack (M1); H1 "Workout" 52 phone', async () => {
    const tree = await renderScreen();
    const back = tree.root.find((node) => node.props.testID === 'workout-back-today' && node.props.onPress);
    // DECLARED (T-65, PHONE-NAV spec §3): was back.props.accessibilityRole; the role sits on the pill's host view now.
    expect(host(tree.root, 'workout-back-today').props.accessibilityRole).toBe('link');
    // DECLARED (T-65, PHONE-NAV spec §3): was minHeight + 2 × hitSlop ≥ 44 (the 32-tall gold text link). The kit
    // BackPill is 44 tall on phones itself (no hit slop).
    expect(flat(host(tree.root, 'workout-back-today')).minHeight).toBeGreaterThanOrEqual(44);
    // DECLARED bug-fix change (review M1, PM-approved): was expect(mockNavigation.goBack).toHaveBeenCalled(); goBack
    // with backBehavior="history" could land on another tab. "← Today" ALWAYS opens the Today root.
    require('../../shell/shellLinks').openShellPath.mockClear();
    mockNavigation.goBack.mockClear();
    act(() => back.props.onPress());
    expect(require('../../shell/shellLinks').openShellPath).toHaveBeenCalledWith('/');
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    expect(flat(host(tree.root, 'workout-title'))).toMatchObject({ fontSize: 52, color: colors.textPrimary });
  });

  // UX verdict P3-1: ONE header. The shell header on /workout is bell-only (shellRules/AppHeader tests); the page
  // header is the only "← Today" + "Workout", in every hub state (loaded, empty, error), and always opens Today.
  it.each([
    ['loaded', () => HUB],
    ['empty (no plan)', () => ({ ok: true, data: { ...HUB.data, currentPlan: null } })],
    ['error', () => ({ ok: false, error: { message: 'Offline' } })],
  ])('%s: exactly one "← Today" and one "Workout" H1; "← Today" opens the Today root (P3-1, M1)', async (_name, data) => {
    loadWorkoutPage.mockResolvedValue(data());
    const tree = await renderScreen();
    expect(queryHost(tree.root, 'workout-hub-header')).toHaveLength(1);
    // DECLARED (T-65, PHONE-NAV spec §3): was the text '← Today'. The back pill draws a chevron + the word "Today".
    expect(tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'Today')).toHaveLength(1);
    expect(tree.root.findAll((node) => node.type === 'Text' && node.props.accessibilityRole === 'header' && textOf(node) === 'Workout')).toHaveLength(1);
    require('../../shell/shellLinks').openShellPath.mockClear();
    act(() => tree.root.find((node) => node.props.testID === 'workout-back-today' && node.props.onPress).props.onPress());
    expect(require('../../shell/shellLinks').openShellPath).toHaveBeenCalledWith('/');
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('no back stack → opens Today', async () => {
    mockNavigation.canGoBack.mockReturnValueOnce(false);
    const tree = await renderScreen();
    act(() => tree.root.find((node) => node.props.testID === 'workout-back-today' && node.props.onPress).props.onPress());
    expect(require('../../shell/shellLinks').openShellPath).toHaveBeenCalledWith('/');
  });

  it('"All training days" is sentence case title-sm (no uppercase); tablet 16/600 secondary, H1 64', async () => {
    const phone = await renderScreen();
    const heading = phone.root.find((node) => node.type === 'Text' && textOf(node) === 'All training days');
    expect(flat(heading)).toMatchObject({ fontSize: 22 });
    expect(flat(heading).textTransform).toBeUndefined();
    mockWidth = 834;
    const tablet = await renderScreen();
    expect(flat(tablet.root.find((node) => node.type === 'Text' && textOf(node) === 'All training days'))).toMatchObject({ fontSize: 16, color: colors.textSecondary });
    expect(flat(host(tablet.root, 'workout-title')).fontSize).toBe(64);
  });

  it('the hero gets today\'s photo URL (ND-1)', async () => {
    mockWidth = 834;
    const tree = await renderScreen();
    expect(tree.root.findByType(TodayHeroCard).props.imageUrl).toBe('https://img/bench.jpg');
    expect(queryHost(tree.root, 'workout-hero-photo')).toHaveLength(1);
  });
});

describe('TodayHeroCard (v2)', () => {
  it('phone: radius 32, "Your plan" gold, gold "Training day" pill, 40 plan name, flat 104 ring, no photo', () => {
    const tree = render(<TodayHeroCard {...HERO} imageUrl="https://img/x.jpg" />);
    expect(flat(host(tree.root, 'workout-hero'))).toMatchObject({ borderRadius: 32, padding: 22 });
    expect(host(tree.root, 'workout-hero-badge')).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'workout-hero-badge' }).props).toMatchObject({ tone: 'gold', label: 'Training day' });
    expect(flat(host(tree.root, 'workout-hero-plan')).fontSize).toBe(40);
    expect(tree.root.findByType(ProgressRing).props).toMatchObject({ flat: true, size: 104, label: '2 of 4\u00a0training days completed this week' });
    expect(queryHost(tree.root, 'workout-hero-photo')).toHaveLength(0);
  });

  it('Start: sentence case "Start today\'s workout", gold 60 with the large glow; pressed ink overlay; starting 0.5 + spinner + busy', () => {
    const tree = render(<TodayHeroCard {...HERO} />);
    const start = host(tree.root, 'workout-hero-start');
    expect(flat(start)).toMatchObject({ minHeight: 60, backgroundColor: colors.gold, boxShadow: shadows.goldGlowLarge });
    expect(tree.root.findAll((node) => node.type === 'Text').map(textOf)).toContain("Start today's workout");
    const pressable = tree.root.find((node) => node.props.testID === 'workout-hero-start' && typeof node.props.children === 'function');
    const pressed = render(<>{pressable.props.children({ pressed: true })}</>);
    expect(StyleSheet.flatten(pressed.root.findByProps({ testID: 'workout-hero-start-pressed' }).props.style).backgroundColor).toBe(colors.pressOverlayInk);
    act(() => pressable.props.onPress());
    expect(HERO.onStart).toHaveBeenCalled();
    const busy = render(<TodayHeroCard {...HERO} starting />);
    const busyStart = host(busy.root, 'workout-hero-start');
    expect(flat(busyStart).opacity).toBe(0.5);
    expect(busyStart.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('completed / rest: their pills, no Start', () => {
    const done = render(<TodayHeroCard {...HERO} state="completed" showStart={false} />);
    expect(done.root.findByProps({ testID: 'workout-hero-badge' }).props).toMatchObject({ tone: 'completed', label: 'Completed' });
    expect(queryHost(done.root, 'workout-hero-start')).toHaveLength(0);
    const rest = render(<TodayHeroCard {...HERO} state="rest" showStart={false} />);
    expect(rest.root.findByProps({ testID: 'workout-hero-badge' }).props).toMatchObject({ tone: 'neutral', label: 'Rest day' });
  });

  it('tablet: padding 32, 60 plan name, ring 132, the photo layer at 0.5 when a URL exists; none → no frame', () => {
    mockWidth = 834;
    const tree = render(<TodayHeroCard {...HERO} imageUrl="https://img/x.jpg" />);
    expect(flat(host(tree.root, 'workout-hero')).padding).toBe(32);
    expect(flat(host(tree.root, 'workout-hero-plan')).fontSize).toBe(60);
    expect(tree.root.findByType(ProgressRing).props.size).toBe(132);
    expect(flat(host(tree.root, 'workout-hero-photo')).width).toBe('60%');
    const none = render(<TodayHeroCard {...HERO} />);
    expect(queryHost(none.root, 'workout-hero-photo')).toHaveLength(0);
  });

  it.each([1, 2, 3.1])('large text %s: plan name cap 1.3 + word fit; Start label never truncates; past 1.3 the ring drops below', (scale) => {
    mockFontScale = scale;
    const tree = render(<TodayHeroCard {...HERO} />);
    expect(host(tree.root, 'workout-hero-plan').props).toMatchObject({ maxFontSizeMultiplier: 1.3, adjustsFontSizeToFit: true });
    const label = tree.root.find((node) => node.type === 'Text' && textOf(node) === "Start today's workout");
    expect(label.props.numberOfLines).toBeUndefined();
    expect(flat(host(tree.root, 'workout-hero-top')).flexDirection).toBe(scale > 1.3 ? 'column' : 'row');
  });
});

describe('PlanDayCard (v2)', () => {
  const day = { id: 3, title: 'Upper A' };
  it('done (phone): gold-card gradient shows (solid layer off), gold-strong ring, gold "Done this week" pill', () => {
    const tree = render(<PlanDayCard day={day} weekdays={[{ id: 1, name: 'Monday' }]} isDone starting={false} onStart={jest.fn()} index={0} />);
    expect(flat(host(tree.root, 'workout-day-3'))).toMatchObject({ borderColor: colors.goldStrong, minHeight: 188 });
    expect(flat(host(tree.root, 'workout-day-solid-3')).opacity).toBe(0);
    expect(flat(host(tree.root, 'workout-day-done-3')).backgroundColor).toBe(colors.gold);
  });

  // UX native final audit 27 Oct 2026, row A110 (MUST): at 320 the 2-up day
  // card's "Done this week" pill wrapped to 2 lines and the text ran out of
  // the pill. It is ONE line: the label shrinks to fit (down to 0.8×) and
  // never wraps; the pill never grows past its card.
  it.each([320, 390, 834])('A110 (width %i): "Done this week" is one line inside its pill (shrinks, never wraps)', (width) => {
    mockWidth = width;
    const tree = render(<PlanDayCard day={day} weekdays={[{ id: 1, name: 'Monday' }]} isDone starting={false} onStart={jest.fn()} index={0} />);
    const pill = host(tree.root, 'workout-day-done-3');
    expect(flat(pill)).toMatchObject({ flexDirection: 'row', alignSelf: 'flex-start', maxWidth: '100%' });
    const label = pill.find((node) => node.type === 'Text' && textOf(node) === 'Done this week');
    expect(label.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.8 });
    expect(flat(label).flexShrink).toBe(1);
  });

  it('not done: surface layer on, hairline edge, no pill, "Unscheduled" when no weekday', () => {
    const tree = render(<PlanDayCard day={day} weekdays={[]} isDone={false} starting={false} onStart={jest.fn()} index={0} />);
    expect(flat(host(tree.root, 'workout-day-3')).borderColor).toBe(colors.hairline);
    expect(flat(host(tree.root, 'workout-day-solid-3')).opacity).toBe(1);
    expect(queryHost(tree.root, 'workout-day-done-3')).toHaveLength(0);
    expect(tree.root.findAll((node) => node.type === 'Text').map(textOf)).toContain('Unscheduled');
  });

  it('Start: glass 44, named "Start {day}", pressed white overlay, starting 0.5 + busy', () => {
    const onStart = jest.fn();
    const tree = render(<PlanDayCard day={day} weekdays={[]} isDone={false} starting={false} onStart={onStart} index={0} />);
    const start = tree.root.find((node) => node.props.testID === 'workout-day-start-3' && typeof node.props.children === 'function');
    expect(start.props.accessibilityLabel).toBe('Start Upper A');
    expect(flat(host(tree.root, 'workout-day-start-3'))).toMatchObject({ minHeight: 44, backgroundColor: colors.fillGlass });
    const pressed = render(<>{start.props.children({ pressed: true })}</>);
    expect(StyleSheet.flatten(pressed.root.findByProps({ testID: 'workout-day-start-pressed-3' }).props.style).backgroundColor).toBe(colors.pressOverlay);
    act(() => start.props.onPress());
    expect(onStart).toHaveBeenCalled();
    const busy = render(<PlanDayCard day={day} weekdays={[]} isDone={false} starting onStart={onStart} index={0} />);
    expect(flat(host(busy.root, 'workout-day-start-3')).opacity).toBe(0.5);
  });

  it('tablet: Start 50; title 30', () => {
    mockWidth = 834;
    const tree = render(<PlanDayCard day={day} weekdays={[]} isDone starting={false} onStart={jest.fn()} index={0} />);
    expect(flat(host(tree.root, 'workout-day-start-3')).minHeight).toBe(50);
  });
});

// T-59 follow-up: the live session's state outlives the screen; no test inherits another's.
afterEach(() => endSessionState());
