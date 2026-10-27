jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), openPlanDetailAlone: jest.fn() }));
jest.mock('./api/homeApi', () => ({ getDashboard: jest.fn(), logWeight: jest.fn() }));
jest.mock('../plans/api/libraryApi', () => ({ getCurrentPlan: jest.fn(() => Promise.resolve(null)), listPlanDays: jest.fn() }));
jest.mock('../planGenerator/api/generatorApi', () => ({ getGeneratorProfile: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ addListener: () => () => {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: 1 }),
}));

import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import Spinner from '../../shared/components/Spinner';
import { colors } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getGeneratorProfile } from '../planGenerator/api/generatorApi';
import { resetProfileStore, setStoredProfile } from '../profile/profileStore';
import { openShellPath } from '../shell/shellLinks';
import { getDashboard } from './api/homeApi';
import HomeScreen from './HomeScreen';
import { avatarInitials, todayDateLabel, todayEmptyStats } from './homeFormat';

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
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const EMPTY = { current_plan: null, quick_stats: { completed_workouts_total: 0, completed_workouts_this_week: 0, planned_workouts_this_week: 0 }, recent_workouts: [] };
const mounted = [];
let announce;
beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  resetProfileStore();
  setStoredProfile({ first_name: 'Nima', last_name: 'Memar' });
  useAuthStore.setState({ user: { email: 'nima@example.com', roles: [] } });
  getGeneratorProfile.mockResolvedValue({ available: true });
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

async function render(dashboard = EMPTY) {
  if (dashboard instanceof Promise) {
    getDashboard.mockReturnValue(dashboard);
  } else if (dashboard instanceof Error) {
    getDashboard.mockRejectedValue(dashboard);
  } else {
    getDashboard.mockResolvedValue(dashboard);
  }
  let tree;
  await act(async () => {
    tree = create(<HomeScreen />);
  });
  await flush();
  mounted.push(tree);
  return tree;
}

describe('homeFormat (B3 header + empty stats)', () => {
  it('todayDateLabel: "{weekday}, {Mon} {d}" (no "Today ·" prefix)', () => {
    expect(todayDateLabel(new Date(2026, 9, 29, 9))).toBe('Thursday, Oct 29');
  });

  it('avatarInitials: first + last, else first, else the email letter, else none', () => {
    expect(avatarInitials({ first_name: 'nima', last_name: 'memar' }, 'x@y.z')).toBe('NM');
    expect(avatarInitials({ first_name: ' Sam ' }, 'x@y.z')).toBe('S');
    expect(avatarInitials(null, ' asad@example.com')).toBe('A');
    expect(avatarInitials(null, '')).toBe('');
  });

  it('todayEmptyStats: the H1.4 numbers regrouped, with the ring label', () => {
    expect(
      todayEmptyStats({ quick_stats: { completed_workouts_total: 12, completed_workouts_this_week: 2, planned_workouts_this_week: 3, last_workout_at: null } })
    ).toMatchObject({ thisWeek: 2, planned: 3, doneTotal: 12, thisWeekText: '2', plannedText: '/3', doneTotalText: '12', ringLabel: '2 of 3 workouts this week', lastWorkout: null });
    expect(todayEmptyStats(null)).toMatchObject({ thisWeekText: '0', plannedText: '/0', doneTotalText: '0' });
  });
});

describe('B3 header (every Today state)', () => {
  it('avatar initials (decorative), the date line and the greeting', async () => {
    const tree = await render();
    const avatar = host(tree.root, 'home-avatar');
    expect(avatar.props.accessibilityElementsHidden).toBe(true);
    expect(textOf(avatar.findByType('Text'))).toBe('NM');
    expect(texts(tree.root)).toEqual(expect.arrayContaining([todayDateLabel(), 'Welcome back, Nima']));
  });

  it('shows while loading and on error', async () => {
    const loading = await render(deferred().promise);
    expect(textOf(host(loading.root, 'home-greeting'))).toBe('Welcome back, Nima');
    const failed = await render(new Error('Network Error'));
    expect(textOf(host(failed.root, 'home-greeting'))).toBe('Welcome back, Nima');
  });

  it('the greeting is the page heading (the shell header on "/" is untitled)', async () => {
    const tree = await render();
    expect(host(tree.root, 'home-greeting').props.accessibilityRole).toBe('header');
    expect(texts(tree.root)).not.toContain('Today');
  });
});

describe('B3 loading (ND3)', () => {
  it('phone: skeleton hidden from screen readers + the "Loading dashboard" row, announced once', async () => {
    const tree = await render(deferred().promise);
    const loading = host(tree.root, 'home-loading');
    expect(loading.props.accessibilityState).toEqual({ busy: true });
    const skeleton = host(tree.root, 'home-skeleton');
    expect(skeleton.props.accessibilityElementsHidden).toBe(true);
    const status = host(tree.root, 'home-loading-status');
    expect(status.find((node) => node.props.accessibilityLabel === 'Loading dashboard' && typeof node.type === 'string').props.accessibilityRole).toBe('progressbar');
    expect(texts(tree.root)).toContain('Loading dashboard');
    expect(announce.mock.calls.filter(([text]) => text === 'Loading dashboard')).toHaveLength(1);
  });

  it('the shimmer is off under reduced motion; the spinner never stops (3 s loop)', async () => {
    const tree = await render(deferred().promise);
    const shimmer = host(tree.root, 'home-skeleton-shimmer');
    expect(styleOf(shimmer).opacity).toBe(0);
    expect(tree.root.findAllByType(Spinner)).toHaveLength(1);
  });

  it('tablet: the centred 120 glass disc with a 72 spinner and the 22 px label', async () => {
    mockWidth = 834;
    const tree = await render(deferred().promise);
    const status = host(tree.root, 'home-loading-status');
    expect(status.props).toMatchObject({ accessibilityRole: 'progressbar', accessibilityLabel: 'Loading dashboard' });
    expect(tree.root.findByType(Spinner).props).toMatchObject({ size: 72, thickness: 6 });
    const label = status.findAll((node) => node.type === 'Text' && textOf(node) === 'Loading dashboard')[0];
    expect(StyleSheet.flatten(label.props.style).fontSize).toBe(22);
  });
});

describe('B3 error (no Retry)', () => {
  it('phone: role alert, "Dashboard unavailable" + the transport text; nothing pressable', async () => {
    const tree = await render(new Error('Request failed with status code 500'));
    const card = host(tree.root, 'home-error');
    expect(card.props.accessibilityRole).toBe('alert');
    expect(texts(card)).toEqual(['Dashboard unavailable', 'Request failed with status code 500']);
    expect(card.findAll((node) => typeof node.props.onPress === 'function')).toHaveLength(0);
    const title = card.findAll((node) => node.type === 'Text')[0];
    expect(StyleSheet.flatten(title.props.style).color).toBe(colors.dangerText);
    expect(texts(tree.root)).not.toContain('Retry');
  });

  it('falls back to "Please try again."', async () => {
    const tree = await render(new Error(''));
    expect(texts(host(tree.root, 'home-error'))).toContain('Please try again.');
  });

  it('tablet: the centred large card, title in text-primary', async () => {
    mockWidth = 834;
    const tree = await render(new Error('Network Error'));
    const card = host(tree.root, 'home-error');
    expect(styleOf(card)).toMatchObject({ alignItems: 'center', marginTop: 120 });
    const title = card.findAll((node) => node.type === 'Text')[0];
    expect(StyleSheet.flatten(title.props.style).color).toBe(colors.textPrimary);
  });
});

describe('B3 empty: "Choose a plan" + #42 "Build me a plan" (gated)', () => {
  it('hero copy; "Choose a plan" opens Plans', async () => {
    const tree = await render();
    expect(texts(host(tree.root, 'home-empty-hero'))).toEqual(
      expect.arrayContaining(['No active plan yet', 'Pick a workout plan to unlock your weekly schedule and guided workouts.', 'Choose a plan'])
    );
    act(() => pressable(tree.root, 'home-choose-plan').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/plans');
  });

  it('available: true → a gold text link under "Choose a plan" that opens the generator', async () => {
    const tree = await render();
    expect(getGeneratorProfile).toHaveBeenCalledTimes(1);
    const link = pressable(tree.root, 'home-build-plan');
    expect(host(tree.root, 'home-build-plan').props.accessibilityRole).toBe('link');
    expect(styleOf(host(tree.root, 'home-build-plan')).minHeight).toBe(44);
    act(() => link.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/plans/generate');
    const shown = texts(tree.root);
    expect(shown.indexOf('Build me a plan')).toBeGreaterThan(shown.indexOf('Choose a plan'));
  });

  it.each([
    ['unavailable', () => getGeneratorProfile.mockResolvedValue({ available: false })],
    ['unknown (no flag)', () => getGeneratorProfile.mockResolvedValue({})],
    ['a trainer (403)', () => getGeneratorProfile.mockRejectedValue({ response: { status: 403 } })],
    ['an error', () => getGeneratorProfile.mockRejectedValue(new Error('Network Error'))],
  ])('hidden when %s; "Choose a plan" unaffected', async (_, arrange) => {
    arrange();
    const tree = await render();
    expect(queryHost(tree.root, 'home-build-plan')).toHaveLength(0);
    expect(texts(tree.root)).not.toContain('Build me a plan');
    expect(queryHost(tree.root, 'home-choose-plan')).toHaveLength(1);
  });

  it('hidden while the generator profile is loading', async () => {
    const pending = deferred();
    getGeneratorProfile.mockReturnValue(pending.promise);
    const tree = await render();
    expect(queryHost(tree.root, 'home-build-plan')).toHaveLength(0);
    await act(async () => pending.resolve({ available: true }));
    expect(queryHost(tree.root, 'home-build-plan')).toHaveLength(1);
  });

  it('not requested when the member has a plan (the v1 Today card shows)', async () => {
    const tree = await render({ ...EMPTY, current_plan: { enrollment: { plan: { id: 4, name: 'Upper / Lower' } } }, today_status: { is_workout_day: true } });
    expect(getGeneratorProfile).not.toHaveBeenCalled();
    expect(queryHost(tree.root, 'home-today-card')).toHaveLength(1);
    expect(queryHost(tree.root, 'home-empty-hero')).toHaveLength(0);
  });

  it('tablet: "Build me a plan" is a glass secondary button beside the gold one', async () => {
    mockWidth = 834;
    const tree = await render();
    const build = host(tree.root, 'home-build-plan');
    expect(build.props.accessibilityRole).toBe('button');
    expect(styleOf(build).backgroundColor).toBe(colors.fillButton);
    expect(styleOf(host(tree.root, 'home-choose-plan')).backgroundColor).toBe(colors.gold);
  });
});

describe('B3 empty: tiles, weight and recent (v1 content)', () => {
  it('phone: "This week 0/0 Planned" and "Done total 0 workouts", zero values dim', async () => {
    const tree = await render();
    const week = host(tree.root, 'home-stat-this-week');
    expect(week.props.accessibilityLabel).toBe('This week 0 /0 Planned');
    expect(texts(week)).toEqual(expect.arrayContaining(['This week', '0/0', 'Planned']));
    const done = host(tree.root, 'home-stat-done');
    expect(texts(done)).toEqual(['Done total', '0', 'workouts']);
    expect(StyleSheet.flatten(done.findAll((node) => node.type === 'Text')[1].props.style).color).toBe(colors.textFaint);
  });

  it('non-zero values read in text-primary; the last-workout line shows when set', async () => {
    const tree = await render({ ...EMPTY, quick_stats: { completed_workouts_total: 7, completed_workouts_this_week: 0, planned_workouts_this_week: 0, last_workout_at: '2026-10-20T10:00:00Z' } });
    const done = host(tree.root, 'home-stat-done');
    expect(StyleSheet.flatten(done.findAll((node) => node.type === 'Text')[1].props.style).color).toBe(colors.textPrimary);
    expect(texts(tree.root).some((line) => line.startsWith('Last workout '))).toBe(true);
  });

  it('weight (no data): copy, "See progress" (44 link) → Progress, "Add weight log" (44) opens the modal', async () => {
    const tree = await render();
    expect(texts(host(tree.root, 'home-weight'))).toEqual(
      expect.arrayContaining(['Weight', 'See progress', "Log today's weight to start tracking your trend.", 'Add weight log'])
    );
    expect(styleOf(host(tree.root, 'home-see-progress')).minHeight).toBe(44);
    act(() => pressable(tree.root, 'home-see-progress').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/progress');
    expect(styleOf(host(tree.root, 'home-add-weight')).minHeight).toBe(44);
    act(() => pressable(tree.root, 'home-add-weight').props.onPress());
    expect(tree.root.find((node) => node.props.isOpen !== undefined && node.props.defaultUnit !== undefined).props.isOpen).toBe(true);
  });

  it('weight with data: the v1 Current / Goal / To goal values', async () => {
    setStoredProfile({ first_name: 'Nima', current_weight_unit: 'kg', goal_weight_unit: 'kg' });
    const tree = await render({ ...EMPTY, current_weight: 80, goal_progress: { goal_weight: 75, difference_to_goal: 5 } });
    expect(texts(host(tree.root, 'home-weight'))).toEqual(expect.arrayContaining(['80 kg', '75 kg', '+5 kg', 'Current', 'Goal', 'To goal']));
  });

  it('recent workouts: the dashed empty box; a list when there are workouts', async () => {
    const tree = await render();
    const empty = host(tree.root, 'home-recent-empty');
    expect(styleOf(empty).borderStyle).toBe('dashed');
    expect(texts(empty)).toEqual(['Recent workouts', 'No completed workouts yet', 'Once you finish a workout, it will show up here.']);
    const withList = await render({ ...EMPTY, recent_workouts: [{ id: 9, status: 'completed', completed_at: '2026-10-20T10:00:00Z', duration_seconds: 1800 }] });
    expect(queryHost(withList.root, 'home-recent-empty')).toHaveLength(0);
    expect(queryHost(withList.root, 'home-recent-9')).toHaveLength(1);
  });

  it('tablet (ND4): the 96 ring labelled "0 of 0 workouts this week", the teal tile and the gold-tint Add weight log', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === '0 of 0 workouts this week' && typeof node.type === 'string')).toHaveLength(1);
    const add = host(tree.root, 'home-add-weight');
    expect(styleOf(add)).toMatchObject({ minHeight: 52, backgroundColor: colors.goldTint, borderColor: colors.goldBorder });
    expect(texts(host(tree.root, 'home-recent-empty'))).toContain('No completed workouts yet');
  });
});
