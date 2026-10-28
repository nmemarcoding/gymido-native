jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn(), openPlanDetailAlone: jest.fn() }));
jest.mock('./api/homeApi', () => ({ getDashboard: jest.fn(), logWeight: jest.fn(), getCurrentWeek: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../plans/api/libraryApi', () => ({ getCurrentPlan: jest.fn(() => Promise.resolve(null)), listPlanDays: jest.fn() }));
jest.mock('../workout/api/workoutApi', () => ({ getCurrentWorkout: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../planGenerator/api/generatorApi', () => ({ getGeneratorProfile: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ addListener: () => () => {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../workout/runtime/workoutSessionStore', () => ({ verifySessionState: jest.fn(() => Promise.resolve()) }));
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: mockFontScale }),
}));

import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import FeedbackIcon from '../../shared/components/FeedbackIcon';
import Spinner from '../../shared/components/Spinner';
import TextLink from '../../shared/components/TextLink';
import { colors } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getGeneratorProfile } from '../planGenerator/api/generatorApi';
import { resetProfileStore, setStoredProfile } from '../profile/profileStore';
import { openShellPath } from '../shell/shellLinks';
import { getDashboard } from './api/homeApi';
import HomeScreen from './HomeScreen';
import { verifySessionState } from '../workout/runtime/workoutSessionStore';
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
  mockFontScale = 1;
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

  it('the date line on both layouts: phone label style, tablet 15 text-muted (UX, 26 Oct)', async () => {
    const phone = await render();
    expect(textOf(host(phone.root, 'home-date'))).toBe(todayDateLabel());
    mockWidth = 834;
    const tablet = await render();
    const line = host(tablet.root, 'home-date');
    expect(textOf(line)).toBe(todayDateLabel());
    expect(StyleSheet.flatten(line.props.style)).toMatchObject({ fontSize: 15, lineHeight: 20, color: '#9BA1AD', fontFamily: 'Geist-Regular' });
    mockWidth = 390;
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
    expect(StyleSheet.flatten(title.props.style).color).toBe(colors.dangerTextSoft);
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
    expect(texts(host(tree.root, 'home-weight'))).toEqual(expect.arrayContaining(['80 kg', '75 kg', '\u22125 kg', 'Current', 'Goal', 'To goal']));
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
    expect(styleOf(add)).toMatchObject({ minHeight: 52, backgroundColor: colors.goldTint, borderColor: colors.goldLine });
    expect(texts(host(tree.root, 'home-recent-empty'))).toContain('No completed workouts yet');
  });
});

// Phase 2 "exact match + large text" pass (UX §8.4–8.6 colours, §9).
const PLAN = { ...EMPTY, current_plan: { enrollment: { plan: { id: 4, name: 'Upper / Lower' } } }, today_status: { is_workout_day: true } };
const hosts = (root, predicate) => root.findAll((node) => typeof node.type === 'string' && predicate(node));
const flatOf = (node) => StyleSheet.flatten(node.props.style) ?? {};
function pressedChildren(node, pressed) {
  let inner;
  act(() => {
    inner = create(<View>{node.props.children({ pressed })}</View>);
  });
  mounted.push(inner);
  return inner;
}
// §9 rule 2: no Text in an action is cut to one line. The kit TextLink's
// own one-line label is the kit's (listed in the Phase 2 report).
const noTruncation = (root) => {
  const kit = new Set(root.findAllByType(TextLink).flatMap((link) => link.findAll((node) => node.type === 'Text')));
  root.findAll((node) => node.type === 'Text' && !kit.has(node)).forEach((node) => {
    if (node.props.numberOfLines !== undefined) {
      expect(node.props.numberOfLines).toBeGreaterThanOrEqual(2);
    }
  });
};

describe('Phase 2 tokens: exact colours', () => {
  it('phone error: danger-line edge, danger-tint tile, danger-text-soft title and message', async () => {
    const tree = await render(new Error('Network Error'));
    const card = host(tree.root, 'home-error');
    expect(styleOf(card).borderColor).toBe(colors.dangerLine);
    const tile = hosts(card, (node) => flatOf(node).width === 64 && flatOf(node).height === 64)[0];
    expect(flatOf(tile).backgroundColor).toBe(colors.dangerTint);
    const [title, message] = card.findAll((node) => node.type === 'Text');
    expect(flatOf(title).color).toBe(colors.dangerTextSoft);
    expect(flatOf(message).color).toBe(colors.dangerTextSoft);
  });

  it('tablet error: the same edge and tile tokens; text-primary title, text-strong-2 message', async () => {
    mockWidth = 834;
    const tree = await render(new Error('Network Error'));
    const card = host(tree.root, 'home-error');
    expect(styleOf(card).borderColor).toBe(colors.dangerLine);
    const tile = hosts(card, (node) => flatOf(node).width === 104)[0];
    expect(flatOf(tile).backgroundColor).toBe(colors.dangerTint);
    const [title, message] = card.findAll((node) => node.type === 'Text');
    expect(flatOf(title).color).toBe(colors.textPrimary);
    expect(flatOf(message).color).toBe(colors.textStrong2);
  });

  it('empty hero tile: phone gold-line ring + the gold-strong 0 0 40 −6 glow; tablet the tint only', async () => {
    const phone = await render();
    expect(styleOf(host(phone.root, 'home-empty-hero-tile'))).toMatchObject({
      width: 76,
      backgroundColor: colors.goldTint,
      borderColor: colors.goldLine,
      boxShadow: `0px 0px 40px -6px ${colors.goldStrong}`,
    });
    mockWidth = 834;
    const tablet = await render();
    const tile = styleOf(host(tablet.root, 'home-empty-hero-tile'));
    expect(tile).toMatchObject({ width: 84, backgroundColor: colors.goldTint });
    expect(tile.borderWidth).toBeUndefined();
    expect(tile.boxShadow).toBeUndefined();
  });

  it('tile glyph ruling (tokens §7 "Tile glyphs"): the hero glyph is 34 in the 76 tile (phone) and 40 in the 84 tile (tablet), stroke 2.4 on the 32 viewBox', async () => {
    const glyph = (root) => {
      const tile = host(root, 'home-empty-hero-tile');
      const svg = tile.find((node) => node.props.viewBox === '0 0 32 32' && typeof node.type !== 'string');
      const strokes = tile.findAll((node) => node.props.strokeWidth !== undefined).map((node) => Number(node.props.strokeWidth));
      return { width: svg.props.width, tile: styleOf(tile).width, strokes };
    };
    const phone = glyph((await render()).root);
    expect(phone).toMatchObject({ width: 34, tile: 76 });
    phone.strokes.forEach((value) => expect(value).toBe(2.4));
    mockWidth = 834;
    const tablet = glyph((await render()).root);
    expect(tablet).toMatchObject({ width: 40, tile: 84 });
    tablet.strokes.forEach((value) => expect(value).toBe(2.4));
  });

  it('recent (empty, phone): fill-subtle with a dashed hairline-strong edge', async () => {
    const tree = await render();
    expect(styleOf(host(tree.root, 'home-recent-empty'))).toMatchObject({ backgroundColor: colors.fillWell, borderColor: colors.hairlineStrong, borderStyle: 'dashed' });
  });

  it('loading: the phone skeleton ring is color-skeleton; the tablet disc glows gold-strong', async () => {
    const phone = await render(deferred().promise);
    const ring = hosts(phone.root, (node) => flatOf(node).borderWidth === 8)[0];
    expect(flatOf(ring).borderColor).toBe(colors.skeleton);
    mockWidth = 834;
    const tablet = await render(deferred().promise);
    const disc = hosts(tablet.root, (node) => flatOf(node).width === 120 && flatOf(node).boxShadow !== undefined)[0];
    expect(flatOf(disc).boxShadow).toBe(`0px 0px 80px -10px ${colors.goldStrong}`);
  });

  it('tablet "Add weight log": pressed = the tint + a white 4 % overlay (STATE RULE); none at rest', async () => {
    mockWidth = 834;
    const tree = await render();
    const add = pressable(tree.root, 'home-add-weight');
    expect(styleOf(host(tree.root, 'home-add-weight')).backgroundColor).toBe(colors.goldTint);
    expect(queryHost(tree.root, 'home-add-weight-pressed')).toHaveLength(0);
    const pressed = pressedChildren(add, true);
    expect(flatOf(host(pressed.root, 'home-add-weight-pressed')).backgroundColor).toBe(colors.pressOverlay);
    expect(queryHost(pressedChildren(add, false).root, 'home-add-weight-pressed')).toHaveLength(0);
  });
});

describe('§9 large text: caps', () => {
  it.each([1, 2])('header at fontScale %s: greeting = page title (1.3, 3 lines, shrinks a long word), date 2.0, avatar 1.2', async (scale) => {
    mockFontScale = scale;
    const tree = await render();
    expect(host(tree.root, 'home-greeting').props).toMatchObject({ maxFontSizeMultiplier: 1.3, numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    expect(host(tree.root, 'home-date').props.maxFontSizeMultiplier).toBe(2);
    expect(host(tree.root, 'home-avatar').findByType('Text').props.maxFontSizeMultiplier).toBe(1.2);
  });

  it('error titles: phone title-lg 1.6, tablet display 1.3; the message 2.0', async () => {
    const phone = await render(new Error('Network Error'));
    const [title, message] = host(phone.root, 'home-error').findAll((node) => node.type === 'Text');
    expect(title.props).toMatchObject({ maxFontSizeMultiplier: 1.6, numberOfLines: 3, adjustsFontSizeToFit: true });
    expect(message.props.maxFontSizeMultiplier).toBe(2);
    mockWidth = 834;
    const tablet = await render(new Error('Network Error'));
    expect(host(tablet.root, 'home-error').findAll((node) => node.type === 'Text')[0].props.maxFontSizeMultiplier).toBe(1.3);
  });

  it('empty: hero title 1.6 (phone) / 1.3 (tablet), body 2.0, the big numbers 1.3 (never shrunk)', async () => {
    const phone = await render();
    const heroTexts = host(phone.root, 'home-empty-hero').findAll((node) => node.type === 'Text');
    expect(heroTexts.find((node) => textOf(node) === 'No active plan yet').props.maxFontSizeMultiplier).toBe(1.6);
    expect(heroTexts.find((node) => textOf(node).startsWith('Pick a workout')).props.maxFontSizeMultiplier).toBe(2);
    const number = host(phone.root, 'home-stat-done').findAll((node) => node.type === 'Text')[1];
    expect(number.props.maxFontSizeMultiplier).toBe(1.3);
    expect(number.props.adjustsFontSizeToFit).toBeUndefined();
    mockWidth = 834;
    const tablet = await render();
    const title = host(tablet.root, 'home-empty-hero').findAll((node) => node.type === 'Text' && textOf(node) === 'No active plan yet')[0];
    expect(title.props.maxFontSizeMultiplier).toBe(1.3);
  });

  it('tablet loading label scales to 2.0', async () => {
    mockWidth = 834;
    const tree = await render(deferred().promise);
    const label = host(tree.root, 'home-loading-status').findAll((node) => node.type === 'Text' && textOf(node) === 'Loading dashboard')[0];
    expect(label.props.maxFontSizeMultiplier).toBe(2);
  });

  it.each([1, 2])('no truncated action or label on the empty page at fontScale %s (phone + tablet)', async (scale) => {
    mockFontScale = scale;
    noTruncation((await render()).root.findByProps({ testID: 'home-empty-hero' }));
    mockWidth = 834;
    const tablet = await render();
    noTruncation(host(tablet.root, 'home-empty-hero'));
    noTruncation(host(tablet.root, 'home-weight'));
  });
});

describe('§9 large text: reflow past 1.3', () => {
  it('phone at 1: the tiles and the two cards sit side by side', async () => {
    const tree = await render();
    expect(styleOf(host(tree.root, 'home-stat-row')).flexDirection).toBe('row');
    expect(styleOf(host(tree.root, 'home-weight-header')).flexDirection).toBe('row');
    expect(styleOf(host(tree.root, 'home-stat-done')).flex).toBe(1);
  });

  it('phone at 2: tiles stack, the cards stack, "See progress" drops below "Weight"', async () => {
    mockFontScale = 2;
    const tree = await render();
    expect(styleOf(host(tree.root, 'home-stat-row')).flexDirection).toBeUndefined();
    expect(styleOf(host(tree.root, 'home-stat-done')).flex).toBe(0);
    expect(styleOf(host(tree.root, 'home-weight')).flex).toBe(0);
    expect(styleOf(host(tree.root, 'home-recent-empty')).flex).toBe(0);
    expect(styleOf(host(tree.root, 'home-weight-header'))).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['See progress', 'Add weight log', 'Choose a plan']));
  });

  it('tablet at 1: a 2-column grid, the ring beside its text, the pair side by side', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(styleOf(host(tree.root, 'home-grid-cell')).width).toBe('50%');
    expect(styleOf(host(tree.root, 'home-stat-this-week-row')).flexDirection).toBe('row');
    expect(styleOf(host(tree.root, 'home-empty-actions')).flexDirection).toBe('row');
  });

  it('tablet at 3.1 (AX5): one column, the ring above its text, the pair stacked (primary on top, full width)', async () => {
    mockWidth = 834;
    mockFontScale = 3.1;
    const tree = await render();
    expect(styleOf(host(tree.root, 'home-grid-cell')).width).toBe('100%');
    expect(styleOf(host(tree.root, 'home-stat-this-week-row')).flexDirection).toBe('column');
    const actions = host(tree.root, 'home-empty-actions');
    expect(styleOf(actions)).toMatchObject({ flexDirection: 'column', alignSelf: 'stretch' });
    const shown = texts(actions);
    expect(shown.indexOf('Choose a plan')).toBeLessThan(shown.indexOf('Build me a plan'));
    expect(tree.root.find((node) => node.props.testID === 'home-choose-plan' && node.props.title).props.fullWidth).toBe(true);
    expect(tree.root.find((node) => node.props.testID === 'home-build-plan' && node.props.title).props.fullWidth).toBe(true);
    // Nothing lost: every function is still there.
    ['home-choose-plan', 'home-build-plan', 'home-see-progress', 'home-add-weight'].forEach((id) => expect(queryHost(tree.root, id)).toHaveLength(1));
  });

  it('weight values: 3 columns at 1; label → value rows at 2', async () => {
    setStoredProfile({ first_name: 'Nima', current_weight_unit: 'kg', goal_weight_unit: 'kg' });
    const data = { ...EMPTY, current_weight: 80, goal_progress: { goal_weight: 75, difference_to_goal: 5 } };
    const small = await render(data);
    expect(styleOf(host(small.root, 'home-weight-values')).flexDirection).toBe('row');
    expect(queryHost(small.root, 'home-stat-row-Current')).toHaveLength(0);
    mockFontScale = 2;
    const large = await render(data);
    expect(styleOf(host(large.root, 'home-weight-values')).flexDirection).toBe('column');
    const row = host(large.root, 'home-stat-row-Current');
    expect(styleOf(row)).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between' });
    expect(texts(row)).toEqual(['Current', '80 kg']);
    expect(row.findAll((node) => node.type === 'Text')[1].props.numberOfLines).toBeUndefined();
    expect(styleOf(host(large.root, 'home-stat-row-Goal')).borderTopWidth).toBe(1);
  });

  it('recent list: the status pill (cap 1.6) sits beside the text at 1 and drops below at 2; names wrap to 2 lines', async () => {
    const data = { ...EMPTY, recent_workouts: [{ id: 9, status: 'completed', completed_at: '2026-10-20T10:00:00Z', duration_seconds: 1800 }] };
    const small = await render(data);
    expect(styleOf(host(small.root, 'home-recent-9')).flexDirection).toBe('row');
    mockFontScale = 2;
    const large = await render(data);
    const row = host(large.root, 'home-recent-9');
    expect(styleOf(row)).toMatchObject({ flexDirection: 'column', alignItems: 'flex-start' });
    const rowTexts = row.findAll((node) => node.type === 'Text');
    // Phase 3 ND6: the neutral initials tile comes first; the name keeps 2 lines.
    expect(host(row, 'home-recent-title').props.numberOfLines).toBe(2);
    expect(rowTexts.find((node) => textOf(node) === 'completed').props.maxFontSizeMultiplier).toBe(1.6);
  });

  // DECLARED change (T-63): the 1× side-by-side check was on the default 390 phone, which now stacks by the 21rem
  // row rule; it runs on a 430 phone (the 2× render is unchanged).
  it('plan state: the Start · View plan pair stacks at 2 (primary on top, full width), labels never truncate; stats become rows', async () => {
    mockWidth = 430;
    const small = await render(PLAN);
    expect(styleOf(host(small.root, 'home-today-buttons')).flexDirection).toBe('row');
    expect(host(small.root, 'home-today-primary').findByType('Text').props.numberOfLines).toBeUndefined();
    mockFontScale = 2;
    const large = await render(PLAN);
    const buttons = host(large.root, 'home-today-buttons');
    expect(styleOf(buttons).flexDirection).toBe('column');
    // Primary on top: first in the column.
    const order = hosts(buttons, (node) => ['home-today-primary', 'home-view-plan'].includes(node.props.testID)).map((node) => node.props.testID);
    expect(order).toEqual(['home-today-primary', 'home-view-plan']);
    expect(styleOf(host(large.root, 'home-today-primary'))).toMatchObject({ flex: 0, alignSelf: 'stretch' });
    expect(styleOf(host(large.root, 'home-view-plan'))).toMatchObject({ flex: 0, alignSelf: 'stretch' });
    expect(styleOf(host(large.root, 'home-stats')).flexDirection).toBe('column');
    // Phase 3 ND8: the two stat tiles stack and the ring drops above its number.
    expect(styleOf(host(large.root, 'home-stat-this-week-row')).flexDirection).toBe('column');
    noTruncation(host(large.root, 'home-today-buttons'));
  });

  it('re-lays out live when the font scale changes (no relaunch)', async () => {
    const tree = await render();
    expect(styleOf(host(tree.root, 'home-stat-row')).flexDirection).toBe('row');
    mockFontScale = 2;
    await act(async () => tree.update(<HomeScreen />));
    expect(styleOf(host(tree.root, 'home-stat-row')).flexDirection).toBeUndefined();
  });
});

describe('Board geometry (phase2-open-items §3 B)', () => {
  it('avatar initials 17/700 on phone (UX B), 24 on tablet', async () => {
    const phone = await render();
    expect(flatOf(host(phone.root, 'home-avatar').findByType('Text'))).toMatchObject({ fontSize: 17, fontFamily: 'Geist-Bold' });
    mockWidth = 834;
    const tablet = await render();
    expect(flatOf(host(tablet.root, 'home-avatar').findByType('Text')).fontSize).toBe(24);
  });

  it('phone error card: radius 32, padding 24 22; the 64 tile (radius 22) holds a 30 icon; title 30/34', async () => {
    const tree = await render(new Error('Network Error'));
    const card = host(tree.root, 'home-error');
    expect(styleOf(card)).toMatchObject({ borderRadius: 32, overflow: 'hidden', paddingVertical: 24, paddingHorizontal: 22 });
    expect(card.findByType(FeedbackIcon).props).toMatchObject({ name: 'error', size: 30, color: colors.dangerText });
    const tile = hosts(card, (node) => flatOf(node).width === 64 && flatOf(node).height === 64)[0];
    expect(flatOf(tile).borderRadius).toBe(22);
    const title = card.findAll((node) => node.type === 'Text')[0];
    expect(flatOf(title)).toMatchObject({ fontSize: 30, lineHeight: 34, marginTop: 18 });
  });

  it('tablet error card: radius 36, padding 48 40; the 104 tile (radius 32) holds a 48 icon; title 48/50 −0.045em', async () => {
    mockWidth = 834;
    const tree = await render(new Error('Network Error'));
    const card = host(tree.root, 'home-error');
    expect(styleOf(card)).toMatchObject({ borderRadius: 36, overflow: 'hidden', paddingVertical: 48, paddingHorizontal: 40 });
    expect(card.findByType(FeedbackIcon).props).toMatchObject({ name: 'error', size: 48 });
    const tile = hosts(card, (node) => flatOf(node).width === 104)[0];
    expect(flatOf(tile).borderRadius).toBe(32);
    const title = card.findAll((node) => node.type === 'Text')[0];
    expect(flatOf(title)).toMatchObject({ fontSize: 48, lineHeight: 50, letterSpacing: -2.16, fontFamily: 'Geist-Bold' });
    expect(flatOf(title).fontWeight).toBeUndefined();
  });

  it('empty hero: phone 28 radius (hero card) + title 30/34; tablet radius 36 + title 52/54', async () => {
    const phone = await render();
    const heroPhone = host(phone.root, 'home-empty-hero');
    expect(styleOf(heroPhone).borderRadius).toBe(28);
    expect(flatOf(heroPhone.findAll((node) => node.type === 'Text' && textOf(node) === 'No active plan yet')[0])).toMatchObject({ fontSize: 30, lineHeight: 34 });
    mockWidth = 834;
    const tablet = await render();
    const heroTablet = host(tablet.root, 'home-empty-hero');
    expect(styleOf(heroTablet)).toMatchObject({ borderRadius: 36, overflow: 'hidden' });
    expect(flatOf(heroTablet.findAll((node) => node.type === 'Text' && textOf(node) === 'No active plan yet')[0])).toMatchObject({ fontSize: 52, lineHeight: 54 });
  });

  it('tablet loading: the skeleton hero block is radius 36, 300 tall', async () => {
    mockWidth = 834;
    const tree = await render(deferred().promise);
    expect(styleOf(host(tree.root, 'home-skeleton-hero'))).toMatchObject({ borderRadius: 36, height: 300 });
  });

  it.each([1, 2, 3.1])('fontScale %s: the radii and icons are fixed chrome (unchanged); the titles keep their caps', async (scale) => {
    mockFontScale = scale;
    const phone = await render(new Error('Network Error'));
    const phoneCard = host(phone.root, 'home-error');
    expect(styleOf(phoneCard).borderRadius).toBe(32);
    expect(phoneCard.findByType(FeedbackIcon).props.size).toBe(30);
    expect(phoneCard.findAll((node) => node.type === 'Text')[0].props).toMatchObject({ maxFontSizeMultiplier: 1.6, adjustsFontSizeToFit: true });
    expect(styleOf(phoneCard).height).toBeUndefined();
    mockWidth = 834;
    const tablet = await render(new Error('Network Error'));
    const tabletCard = host(tablet.root, 'home-error');
    expect(styleOf(tabletCard).borderRadius).toBe(36);
    expect(tabletCard.findByType(FeedbackIcon).props.size).toBe(48);
    expect(tabletCard.findAll((node) => node.type === 'Text')[0].props).toMatchObject({ maxFontSizeMultiplier: 1.3, adjustsFontSizeToFit: true });
    expect(styleOf(tabletCard).height).toBeUndefined();
    expect(host(tablet.root, 'home-avatar').findByType('Text').props.maxFontSizeMultiplier).toBe(1.2);
  });
});

// PM (T-59 realistic case): a session ended elsewhere while the user is on
// Today must not leave its stored rest alert scheduled; Today re-checks the
// stored session (the store only calls the server when one is stored).
describe('Today re-checks a stored workout session (T-59)', () => {
  it('on every mount / refocus', async () => {
    verifySessionState.mockClear();
    await render();
    expect(verifySessionState).toHaveBeenCalledTimes(1);
  });
});
