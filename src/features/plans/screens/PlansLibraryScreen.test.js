// v2 Phase 4 §1 (UX H Plans #21 / Tablet: Plans #88): every state and
// action of S1, phone and tablet, and §9 large text at 1 / 2 / 3.1.
let mockWindow = { width: 390, height: 844, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ scale: 3, ...mockWindow }),
}));
const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'PlansLibrary-1', name: 'PlansLibrary', params: {} }),
}));
jest.mock('../../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children, testID }) => <View testID={testID}>{children}</View>;
});
jest.mock('../../shell/shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn() }));
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../api/libraryApi', () => ({
  listPlans: jest.fn(),
  getCurrentPlan: jest.fn(),
  getCurrentWeek: jest.fn(),
  getCurrentToday: jest.fn(),
  listPlanDays: jest.fn(),
  listDifficultyLevels: jest.fn(),
}));
jest.mock('../../myPlans/api/myPlansApi', () => ({ listMyPlans: jest.fn() }));
jest.mock('../../planGenerator/api/generatorApi', () => ({ getGeneratorProfile: jest.fn() }));

import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import { InlineError } from '../../../shared/components/FeedbackBox';
import GradientFill from '../../../shared/components/GradientFill';
import RemoteImage from '../../../shared/components/RemoteImage';
import Loader from '../../../shared/components/Loader';
import { colors, radii, shadows, textScale } from '../../../shared/theme/tokens';
import { listMyPlans } from '../../myPlans/api/myPlansApi';
import { getGeneratorProfile } from '../../planGenerator/api/generatorApi';
import { openShellPath } from '../../shell/shellLinks';
import { getCurrentPlan, getCurrentToday, getCurrentWeek, listDifficultyLevels, listPlanDays, listPlans } from '../api/libraryApi';
import PlansLibraryScreen from './PlansLibraryScreen';

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const texts = (tree) => tree.root.findAll((node) => node.type === 'Text').map(textOf);
const host = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const hosts = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const pressableEl = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.props.children === 'function')[0];
// The PressOverlay element a Pressable's children render for a press state.
const overlayOf = (node, pressed) => [].concat(node.props.children({ pressed }).props.children).find((child) => child?.props && 'pressed' in child.props);
const flat = (node, pressed = false) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed }) : node.props.style);
const pending = () => new Promise(() => {});
const textNode = (tree, text) => tree.root.findAll((node) => node.type === 'Text' && textOf(node) === text)[0];

const weekday = (id, name) => ({ id, name, sort_order: id });
const THUMB = { url: 'https://drive.google.com/uc?export=view&id=F1le', media_type: 'image' };
const PLANS = [
  { id: 1, name: 'Upper / Lower Split', is_active: true, days_per_week: 4, category: { name: 'Strength' }, difficulty_level_id: 2, thumbnail: THUMB },
  { id: 2, name: 'Push / Pull / Legs', is_active: true, days_per_week: 6, category: { name: 'Hypertrophy' }, difficulty_level_id: 2, description: 'A classic split.', thumbnail: THUMB },
  { id: 3, name: 'Full Body Basics', is_active: true, days_per_week: 3, category: { name: 'Hypertrophy' } },
];
const CURRENT = {
  enrollment: { id: 50, plan: { id: 1 } },
  schedule: [
    { weekday: weekday(1, 'Monday'), plan_day: { id: 11, title: 'Upper A' } },
    { weekday: weekday(4, 'Thursday'), plan_day: { id: 12, title: 'Lower A' } },
  ],
};
// GET /my-plans/current/week for Mon 26 Oct → Sun 1 Nov 2026: Mon done, Thu today.
const DATES = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
function weekOf(overrides = {}) {
  return DATES.map((date, index) => {
    const id = index + 1;
    const training = { 1: { plan_day: { id: 11, title: 'Upper A' }, status: 'done' }, 4: { plan_day: { id: 12, title: 'Lower A' }, status: 'today' } }[id];
    const base = { weekday: { id, sort_order: id }, is_workout_day: Boolean(training), date, status: 'rest', ...(training ?? {}) };
    return { ...base, ...(overrides[id] ?? {}) };
  });
}
const NOW = new Date(2026, 9, 29, 10, 0, 0);

async function render() {
  let tree;
  await act(async () => {
    tree = create(<PlansLibraryScreen />);
  });
  return tree;
}

// Only Date is faked (the local "today"); promises and timers stay real.
const REAL = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'];
afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: REAL });
  jest.clearAllMocks();
  mockWindow = { width: 390, height: 844, fontScale: 1 };
  listPlans.mockResolvedValue(PLANS);
  getCurrentPlan.mockResolvedValue(CURRENT);
  listMyPlans.mockResolvedValue({ items: [] });
  getGeneratorProfile.mockResolvedValue({ available: true });
  getCurrentWeek.mockResolvedValue(weekOf());
  getCurrentToday.mockResolvedValue({ action: 'start_workout', is_workout_day: true, already_completed: false, plan_day: { id: 12, title: 'Lower A' } });
  listPlanDays.mockResolvedValue([
    { id: 11, title: 'Upper A', exercises_count: 6 },
    { id: 12, title: 'Lower A', exercises_count: 5 },
    { id: 13, title: 'Upper B', exercises_count: 1 },
  ]);
  listDifficultyLevels.mockResolvedValue([{ id: 2, name: 'Intermediate' }]);
});

describe('Plans states', () => {
  it('loading (phone, UX X5): the page-shaped skeleton, busy and labelled "Loading plans"; no Loader', async () => {
    listPlans.mockReturnValue(pending());
    const tree = await render();
    expect(tree.root.findAllByType(Loader)).toHaveLength(0);
    const skeleton = host(tree, 'plans-skeleton');
    expect(skeleton.props).toEqual(expect.objectContaining({ accessibilityRole: 'progressbar', accessibilityLabel: 'Loading plans', accessibilityState: { busy: true } }));
    expect(flat(host(tree, 'plans-skeleton-card'))).toEqual(expect.objectContaining({ borderRadius: radii.xxl, backgroundColor: colors.surface }));
    expect(flat(host(tree, 'plans-skeleton-photo')).height).toBe(150);
    expect(hosts(tree, 'plans-skeleton-circle')).toHaveLength(7);
    expect(flat(host(tree, 'plans-skeleton-start')).height).toBe(54);
    expect(hosts(tree, 'plans-skeleton-row')).toHaveLength(2);
    expect(hosts(tree, 'plans-skeleton-plan')).toHaveLength(2);
    expect(host(tree, 'plans-active-card')).toBeUndefined();
  });

  // DECLARED change (T-60 review cf504b3): web shows PlansSkeleton at ALL
  // widths (UX X5). Was: the tablet kept the Loader.
  it('loading on tablet: the same skeleton (busy, "Loading plans"); no Loader', async () => {
    mockWindow = { width: 834, height: 1194, fontScale: 1 };
    listPlans.mockReturnValue(pending());
    const tree = await render();
    expect(tree.root.findAllByType(Loader)).toHaveLength(0);
    expect(host(tree, 'plans-skeleton').props).toEqual(expect.objectContaining({ accessibilityRole: 'progressbar', accessibilityLabel: 'Loading plans', accessibilityState: { busy: true } }));
  });

  it('error (N2): "Plans unavailable" + the transport text + Retry, which re-runs the load', async () => {
    listPlans.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    const tree = await render();
    const error = tree.root.findByType(InlineError);
    expect([error.props.title, error.props.message]).toEqual(['Plans unavailable', 'Network Error']);
    await act(async () => pressable(tree, 'plans-retry').props.onPress());
    expect(listPlans).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType(InlineError)).toHaveLength(0);
    expect(host(tree, 'plans-active-card')).toBeDefined();
  });

  it('error without a transport text: "Please try again."', async () => {
    listPlans.mockRejectedValueOnce({});
    const tree = await render();
    expect(tree.root.findByType(InlineError).props.message).toBe('Please try again.');
  });

  it('a 404 current plan = no active plan; "Choose your next plan" with the count', async () => {
    getCurrentPlan.mockRejectedValue({ response: { status: 404 } });
    const tree = await render();
    expect(host(tree, 'plans-active-card')).toBeUndefined();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Choose your next plan', '3 plans']));
  });

  it('empty (0 plans): the EmptyState copy; no browse heading', async () => {
    listPlans.mockResolvedValue([]);
    getCurrentPlan.mockResolvedValue(null);
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['No plans available', 'No active workout plans were returned by the backend.']));
    expect(texts(tree)).not.toContain('Choose your next plan');
  });

  it('active plan only: the card + "Make it your own", no catalog heading', async () => {
    listPlans.mockResolvedValue([PLANS[0]]);
    const tree = await render();
    expect(host(tree, 'plans-active-card')).toBeDefined();
    expect(texts(tree)).toContain('Make it your own');
    expect(texts(tree)).not.toContain('Try a different plan');
  });
});

// Dated change (27 Oct 2026, owner T-60): the PHONE Plans page. "Today" is
// Thursday 29 Oct 2026 (local); the /week fixture trains Mon + Thu.
describe('T-60 phone: active plan card', () => {
  it('surface card, gold 0.35 edge, radius 28, clipped; the gold "Your active plan" badge (no label on the card View)', async () => {
    const tree = await render();
    const card = host(tree, 'plans-active-card');
    // No label on the non-accessible card View (dead on iOS); the visible badge text is read.
    expect(card.props.accessibilityLabel).toBeUndefined();
    expect(flat(card)).toEqual(expect.objectContaining({ backgroundColor: colors.surface, borderColor: colors.goldBorder, borderWidth: 1, borderRadius: radii.xxl, overflow: 'hidden' }));
    expect(flat(host(tree, 'plans-active-badge'))).toEqual(expect.objectContaining({ backgroundColor: colors.gold, minHeight: 28, borderRadius: radii.full }));
    const badge = textNode(tree, 'Your active plan');
    expect(flat(badge)).toEqual(expect.objectContaining({ fontSize: 13, color: colors.onGold }));
  });

  it('the name: ONE line + ellipsis, never shrinks, the full name as its accessible text, capped ≈1.6×', async () => {
    listPlans.mockResolvedValue([{ ...PLANS[0], name: 'Upper Lower 4 days Strength Builder' }, PLANS[1], PLANS[2]]);
    const tree = await render();
    const name = host(tree, 'plans-active-name');
    expect(textOf(name)).toBe('Upper Lower 4 days Strength Builder');
    expect(name.props).toEqual(expect.objectContaining({ numberOfLines: 1, ellipsizeMode: 'tail', accessibilityRole: 'header', accessibilityLabel: 'Upper Lower 4 days Strength Builder', maxFontSizeMultiplier: textScale.title }));
    expect(name.props.adjustsFontSizeToFit).toBeFalsy();
    expect(flat(name)).toEqual(expect.objectContaining({ fontSize: 30, lineHeight: 34, color: colors.textPrimary }));
  });

  it('meta "{category} · {n} days a week · {level}" (one line); the level comes from GET /exercise-difficulty-levels', async () => {
    const tree = await render();
    // DECLARED change (QA T60-1 + UX): the meta is three parts in one row so
    // the LEVEL truncates first and "{n} days a week" never cuts (was: one
    // Text, numberOfLines 1, which cut the days at font 2.0).
    const meta = host(tree, 'plans-active-meta');
    expect(meta.props.accessibilityLabel).toBe('Strength · 4\u00a0days a week · Intermediate');
    const part = (id) => host(tree, id);
    expect(textOf(part('plans-active-meta-category'))).toBe('Strength · ');
    expect(textOf(part('plans-active-meta-days'))).toBe('4\u00a0days a week');
    expect(textOf(part('plans-active-meta-level'))).toBe(' · Intermediate');
    ['plans-active-meta-category', 'plans-active-meta-days', 'plans-active-meta-level'].forEach((id) => {
      expect(part(id).props).toEqual(expect.objectContaining({ numberOfLines: 1 }));
      expect(flat(part(id))).toEqual(expect.objectContaining({ fontSize: 15, color: colors.textSecondary }));
    });
    expect(flat(part('plans-active-meta-days')).flexShrink).toBe(0);
    expect(flat(part('plans-active-meta-level')).flexShrink).toBeGreaterThan(flat(part('plans-active-meta-category')).flexShrink);
    expect(part('plans-active-meta-level').props.ellipsizeMode).toBe('tail');
    expect(listDifficultyLevels).toHaveBeenCalledTimes(1);
  });

  it('photo header 150 tall = the plan thumbnail through the shared image chain, over the always-drawn gradient', async () => {
    const tree = await render();
    expect(flat(host(tree, 'plans-active-photo')).height).toBe(150);
    const image = host(tree, 'plans-active-photo').findAllByType(RemoteImage)[0];
    expect(image.props.url).toBe(THUMB.url);
    expect(image.props.sources[0]).toContain('drive.google.com/thumbnail?id=F1le');
    // The fallback is present from the first render (Android gradient rule), under the photo.
    expect(host(tree, 'plans-active-photo-fallback').findAllByType(GradientFill)).toHaveLength(2);
  });

  it('no thumbnail (or a video) → the gradient + gold glow header, same 150 height, never an empty box', async () => {
    listPlans.mockResolvedValue([{ ...PLANS[0], thumbnail: { url: 'https://x.test/a.mp4', media_type: 'video' } }, PLANS[1], PLANS[2]]);
    const tree = await render();
    expect(host(tree, 'plans-active-photo').findAllByType(RemoteImage)).toHaveLength(0);
    expect(flat(host(tree, 'plans-active-photo')).height).toBe(150);
    expect(host(tree, 'plans-active-photo-fallback').findAllByType(GradientFill)).toHaveLength(2);
  });

  it('a photo whose every candidate fails → the photo layer goes; the same gradient header shows', async () => {
    const tree = await render();
    await act(async () => host(tree, 'plans-active-photo').findAllByType(RemoteImage)[0].props.onExhausted());
    expect(host(tree, 'plans-active-photo-image')).toBeUndefined();
    expect(host(tree, 'plans-active-photo-fallback').findAllByType(GradientFill)).toHaveLength(2);
  });
});

describe('T-60 phone: Your week', () => {
  it('"Your week" inset; 7 days Monday first; per-day labels; today carries the current-date (selected) state only', async () => {
    const tree = await render();
    expect(textOf(host(tree, 'plans-week-heading'))).toBe('Your week');
    expect(host(tree, 'plans-week-heading').props.accessibilityRole).toBe('header');
    expect(flat(host(tree, 'plans-week'))).toEqual(expect.objectContaining({ backgroundColor: colors.surfaceWell, borderRadius: radii.lg }));
    const days = [1, 2, 3, 4, 5, 6, 7].map((id) => host(tree, `plans-week-day-${id}`));
    expect(days.map((day) => day.props.accessibilityLabel)).toEqual(['Mon: training', 'Tue: rest', 'Wed: rest', 'Thu: training, today', 'Fri: rest', 'Sat: rest', 'Sun: rest']);
    expect(days.every((day) => day.props.accessible)).toBe(true);
    expect(days.map((day) => Boolean(day.props.accessibilityState?.selected))).toEqual([false, false, false, true, false, false, false]);
    expect([1, 2, 3, 4, 5, 6, 7].map((id) => textOf(host(tree, `plans-week-label-${id}`)))).toEqual(['Train', 'Rest', 'Rest', 'Today', 'Rest', 'Rest', 'Rest']);
    expect([1, 2, 3, 4, 5, 6, 7].map((id) => textOf(host(tree, `plans-week-letter-${id}`))).join('')).toBe('MTWTFSS');
  });

  it('look: training gold 36 circle, rest dashed, today ringed gold; week labels 11 px (owner decision)', async () => {
    const tree = await render();
    expect(flat(host(tree, 'plans-week-circle-1'))).toEqual(expect.objectContaining({ width: 36, height: 36, backgroundColor: colors.gold }));
    expect(flat(host(tree, 'plans-week-circle-2'))).toEqual(expect.objectContaining({ borderStyle: 'dashed', borderColor: colors.hairlineBright }));
    expect(flat(host(tree, 'plans-week-ring-4'))).toEqual(expect.objectContaining({ borderColor: colors.gold }));
    expect(host(tree, 'plans-week-ring-1')).toBeUndefined();
    expect(flat(host(tree, 'plans-week-label-1'))).toEqual(expect.objectContaining({ fontSize: 11, color: colors.textStrong2 }));
    expect(flat(host(tree, 'plans-week-label-4'))).toEqual(expect.objectContaining({ fontSize: 11, color: colors.gold }));
  });

  it('a valid /week is used AS-IS even when the schedule disagrees', async () => {
    getCurrentWeek.mockResolvedValue(weekOf({ 1: { is_workout_day: false, plan_day: undefined, status: 'rest' }, 3: { is_workout_day: true, plan_day: { id: 13, title: 'Upper B' }, status: 'upcoming' } }));
    const tree = await render();
    expect([1, 3, 4].map((id) => host(tree, `plans-week-day-${id}`).props.accessibilityLabel)).toEqual(['Mon: rest', 'Wed: training', 'Thu: training, today']);
  });

  it('today = the LOCAL date: Fri local with the server still calling Thu "today"', async () => {
    jest.setSystemTime(new Date(2026, 9, 30, 0, 10));
    const tree = await render();
    expect(host(tree, 'plans-week-day-4').props.accessibilityLabel).toBe('Thu: training');
    expect(host(tree, 'plans-week-day-5').props.accessibilityLabel).toBe('Fri: rest, today');
    expect(host(tree, 'plans-week-day-5').props.accessibilityState).toEqual({ selected: true });
    expect(flat(host(tree, 'plans-week-ring-5'))).toEqual(expect.objectContaining({ borderColor: colors.gold }));
  });

  it('a pre-enrollment training day (status rest) is a rest circle', async () => {
    getCurrentWeek.mockResolvedValue(weekOf({ 1: { status: 'rest' } }));
    const tree = await render();
    expect(host(tree, 'plans-week-day-1').props.accessibilityLabel).toBe('Mon: rest');
  });

  it('a VALID /week with no training day → the week hides (the schedule is not used)', async () => {
    getCurrentWeek.mockResolvedValue(weekOf({ 1: { status: 'rest' }, 4: { status: 'rest' } }));
    const tree = await render();
    expect(host(tree, 'plans-week')).toBeUndefined();
    expect(texts(tree)).not.toContain('Your week');
  });

  it('/week failed → the circles come from the enrollment schedule', async () => {
    getCurrentWeek.mockRejectedValue(new Error('boom'));
    const tree = await render();
    expect(host(tree, 'plans-week-day-4').props.accessibilityLabel).toBe('Thu: training, today');
    expect(host(tree, 'plans-week-day-1').props.accessibilityLabel).toBe('Mon: training');
  });

  it('/week failed and no schedule day → no week (never seven rest days); the page still renders', async () => {
    getCurrentWeek.mockRejectedValue(new Error('boom'));
    getCurrentPlan.mockResolvedValue({ ...CURRENT, schedule: [] });
    const tree = await render();
    expect(host(tree, 'plans-week')).toBeUndefined();
    expect(host(tree, 'plans-active-card')).toBeDefined();
  });

  it('320–359: circles 32 and the body padding 16', async () => {
    mockWindow = { width: 320, height: 640, fontScale: 1 };
    const tree = await render();
    expect(flat(host(tree, 'plans-week-circle-1'))).toEqual(expect.objectContaining({ width: 32, height: 32 }));
    expect(flat(host(tree, 'plans-active-body')).paddingHorizontal).toBe(16);
  });
});

describe('T-60 phone: next workout + Start (§2a)', () => {
  it('start_workout → "Next workout · Today" / "Lower A · 5 exercises"; GOLD 54 "Start Lower A" → the Workout tab', async () => {
    const tree = await render();
    expect(textOf(host(tree, 'plans-next-when'))).toBe('Next workout · Today');
    expect(textOf(host(tree, 'plans-next-title'))).toBe('Lower A');
    expect(textOf(host(tree, 'plans-next-count'))).toBe(' · 5 exercises');
    const start = pressable(tree, 'plans-start');
    expect(start.props).toEqual(expect.objectContaining({ accessibilityRole: 'button', accessibilityLabel: 'Start Lower A' }));
    expect(flat(start)).toEqual(expect.objectContaining({ minHeight: 54, backgroundColor: colors.gold, borderRadius: radii.full, boxShadow: shadows.goldGlow }));
    expect(texts(tree)).toContain('Start Lower A');
    await act(async () => start.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/workout');
    expect(listPlanDays).toHaveBeenCalledWith(1);
  });

  it('a11y: the row is one item "Next workout · Today, Lower A · 5 exercises"; the week is a list labelled "Your week"', async () => {
    const tree = await render();
    expect(host(tree, 'plans-next-workout').props).toEqual(expect.objectContaining({ accessible: true, accessibilityLabel: 'Next workout · Today, Lower A · 5\u00a0exercises' }));
    expect(host(tree, 'plans-week-days').props).toEqual(expect.objectContaining({ accessibilityRole: 'list', accessibilityLabel: 'Your week' }));
  });

  it('already_completed → the first upcoming day in /week, GLASS start (same size)', async () => {
    getCurrentToday.mockResolvedValue({ action: 'already_completed', already_completed: true, is_workout_day: true, plan_day: { id: 12, title: 'Lower A' } });
    getCurrentWeek.mockResolvedValue(weekOf({ 4: { status: 'done' }, 6: { is_workout_day: true, plan_day: { id: 13, title: 'Upper B' }, status: 'upcoming' } }));
    const tree = await render();
    expect(textOf(host(tree, 'plans-next-when'))).toBe('Next workout · Sat');
    expect(textOf(host(tree, 'plans-next-title'))).toBe('Upper B');
    expect(textOf(host(tree, 'plans-next-count'))).toBe(' · 1 exercise');
    expect(flat(pressable(tree, 'plans-start'))).toEqual(expect.objectContaining({ minHeight: 54, backgroundColor: colors.fillGlass, borderColor: colors.hairlineButton }));
    expect(flat(pressable(tree, 'plans-start')).boxShadow).toBeUndefined();
    // Today keeps its ring + label.
    expect(textOf(host(tree, 'plans-week-label-4'))).toBe('Today');
  });

  it('next_workout_day → "Next workout · {weekday}" of that plan day, glass', async () => {
    jest.setSystemTime(new Date(2026, 9, 27, 9));
    getCurrentToday.mockResolvedValue({ action: 'next_workout_day', is_workout_day: false, plan_day: { id: 12, title: 'Lower A' } });
    getCurrentWeek.mockResolvedValue(weekOf({ 4: { status: 'upcoming' } }));
    const tree = await render();
    expect(textOf(host(tree, 'plans-next-when'))).toBe('Next workout · Thu');
    expect(flat(pressable(tree, 'plans-start')).backgroundColor).toBe(colors.fillGlass);
  });

  it('/week failed + a plan day repeated Mon + Thu: a rest-day next workout names the NEXT weekday, wrapping past Sunday', async () => {
    getCurrentWeek.mockRejectedValue(new Error('boom'));
    getCurrentToday.mockResolvedValue({ action: 'next_workout_day', plan_day: { id: 12, title: 'Lower A' } });
    getCurrentPlan.mockResolvedValue({
      ...CURRENT,
      schedule: [
        { weekday: weekday(1, 'Monday'), plan_day: { id: 12, title: 'Lower A' } },
        { weekday: weekday(4, 'Thursday'), plan_day: { id: 12, title: 'Lower A' } },
      ],
    });
    jest.setSystemTime(new Date(2026, 9, 27, 9));
    let tree = await render();
    expect(textOf(host(tree, 'plans-next-when'))).toBe('Next workout · Thu');
    jest.setSystemTime(new Date(2026, 10, 1, 9));
    tree = await render();
    expect(textOf(host(tree, 'plans-next-when'))).toBe('Next workout · Mon');
  });

  it('/today failed → /week’s today item (gold)', async () => {
    getCurrentToday.mockRejectedValue(new Error('boom'));
    const tree = await render();
    expect(textOf(host(tree, 'plans-next-when'))).toBe('Next workout · Today');
    expect(flat(pressable(tree, 'plans-start')).backgroundColor).toBe(colors.gold);
  });

  it('nothing found → no row and no Start; "See full plan" stays and opens Plan detail', async () => {
    getCurrentToday.mockRejectedValue(new Error('boom'));
    getCurrentWeek.mockRejectedValue(new Error('boom'));
    const tree = await render();
    expect(host(tree, 'plans-next-workout')).toBeUndefined();
    expect(pressable(tree, 'plans-start')).toBeUndefined();
    const see = pressable(tree, 'plans-see-full-plan');
    expect(see.props).toEqual(expect.objectContaining({ accessibilityRole: 'button', accessibilityLabel: 'See full plan' }));
    expect(flat(see)).toEqual(expect.objectContaining({ minHeight: 50, borderColor: colors.hairlineBright, borderWidth: 1 }));
    await act(async () => see.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanDetail', { planId: '1' });
  });

  it('no count (GET /plans/{id}/days failed) → no " · n exercises"; no levels → no " · {level}"', async () => {
    listPlanDays.mockRejectedValue(new Error('boom'));
    listDifficultyLevels.mockRejectedValue(new Error('boom'));
    const tree = await render();
    expect(host(tree, 'plans-next-count')).toBeUndefined();
    expect(textOf(host(tree, 'plans-next-title'))).toBe('Lower A');
    expect(textOf(host(tree, 'plans-active-meta'))).toBe('Strength · 4 days a week');
    expect(textOf(host(tree, 'plans-card-meta-2'))).toBe('6 days a week');
  });

  it('320 wide: the day title truncates (1 line, shrinks) BEFORE the count, which never shrinks', async () => {
    mockWindow = { width: 320, height: 640, fontScale: 1 };
    getCurrentToday.mockResolvedValue({ action: 'start_workout', plan_day: { id: 12, title: 'Lower Body Power and Posterior Chain' } });
    const tree = await render();
    const title = host(tree, 'plans-next-title');
    const count = host(tree, 'plans-next-count');
    expect(title.props).toEqual(expect.objectContaining({ numberOfLines: 1, ellipsizeMode: 'tail' }));
    expect(flat(title).flexShrink).toBe(1);
    expect(count.props.numberOfLines).toBe(1);
    expect(flat(count).flexShrink).toBe(0);
    expect(flat(host(tree, 'plans-next-line'))).toEqual(expect.objectContaining({ flexDirection: 'row' }));
  });

  it('side data never blocks: with every side call pending the page and card render', async () => {
    getCurrentWeek.mockReturnValue(pending());
    getCurrentToday.mockReturnValue(pending());
    listPlanDays.mockReturnValue(pending());
    listDifficultyLevels.mockReturnValue(pending());
    const tree = await render();
    expect(host(tree, 'plans-active-card')).toBeDefined();
    expect(host(tree, 'plans-next-workout')).toBeUndefined();
    expect(host(tree, 'plans-week')).toBeUndefined();
    expect(textOf(host(tree, 'plans-active-meta'))).toBe('Strength · 4 days a week');
  });

  it('side calls only with a current plan (levels always, once)', async () => {
    getCurrentPlan.mockRejectedValue({ response: { status: 404 } });
    await render();
    expect(getCurrentWeek).not.toHaveBeenCalled();
    expect(getCurrentToday).not.toHaveBeenCalled();
    expect(listPlanDays).not.toHaveBeenCalled();
    expect(listDifficultyLevels).toHaveBeenCalledTimes(1);
  });
});

describe('T-60 phone: Make it your own', () => {
  it('heading + one list card with "Build me a plan" and "My plans" (code sub-lines); each opens its screen', async () => {
    const tree = await render();
    expect(host(tree, 'plans-own-heading').props.accessibilityRole).toBe('header');
    expect(textOf(host(tree, 'plans-own-heading'))).toBe('Make it your own');
    expect(texts(tree)).toEqual(
      expect.arrayContaining(['Build me a plan', 'Answer 6 questions and get a plan made for you.', 'My plans', 'Build your own, or copy one from the catalog to change it.'])
    );
    const generator = pressable(tree, 'generator-entry-start');
    const mine = pressable(tree, 'my-plans-entry');
    expect(generator.props.accessibilityRole).toBe('button');
    expect(generator.props.accessibilityLabel).toBe('Build me a plan. Answer 6 questions and get a plan made for you.');
    expect(flat(mine).minHeight).toBe(76);
    await act(async () => generator.props.onPress());
    await act(async () => mine.props.onPress());
    expect(mockNavigation.push.mock.calls.map((call) => call[0])).toEqual(['PlanGenerator', 'MyPlans']);
  });

  it('generator unavailable → only the "My plans" row', async () => {
    getGeneratorProfile.mockResolvedValue({ available: false });
    const tree = await render();
    expect(pressable(tree, 'generator-entry-start')).toBeUndefined();
    expect(pressable(tree, 'my-plans-entry')).toBeDefined();
  });
});

describe('T-60 phone: catalog', () => {
  it('"Try a different plan" + "2 plans"; no category sub-headings; cards stacked', async () => {
    const tree = await render();
    expect(textOf(host(tree, 'plans-catalog-heading'))).toBe('Try a different plan');
    expect(host(tree, 'plans-catalog-heading').props.accessibilityRole).toBe('header');
    expect(textOf(host(tree, 'plans-catalog-count'))).toBe('2 plans');
    expect(texts(tree)).not.toContain('Switch your plan');
    expect(hosts(tree, 'plans-tile-row')).toHaveLength(0);
  });

  it('"1 plan" singular; without an active plan "Choose your next plan"', async () => {
    listPlans.mockResolvedValue([PLANS[0], PLANS[1]]);
    let tree = await render();
    expect(textOf(host(tree, 'plans-catalog-count'))).toBe('1 plan');
    getCurrentPlan.mockRejectedValue({ response: { status: 404 } });
    tree = await render();
    expect(textOf(host(tree, 'plans-catalog-heading'))).toBe('Choose your next plan');
  });

  it('card: photo 84 from the thumbnail, gold 13/600 kicker, 2-line name, meta line, the description clamped to 2 lines + tail', async () => {
    const tree = await render();
    const card = pressable(tree, 'plans-card-2');
    expect(card.props.accessibilityLabel).toBe('Push / Pull / Legs, Hypertrophy, 6 days a week · Intermediate, A classic split.');
    expect(flat(card)).toEqual(expect.objectContaining({ padding: 12, borderRadius: radii.lgPlus, backgroundColor: colors.surface, flexDirection: 'row' }));
    const photo = tree.root.findAll((node) => node.type === ExerciseImage && node.props.testID === 'plans-card-photo-2')[0];
    expect(photo.props).toEqual(expect.objectContaining({ size: 84, url: THUMB.url, name: 'Push / Pull / Legs' }));
    expect(flat(host(tree, 'plans-card-category-2'))).toEqual(expect.objectContaining({ fontSize: 13, color: colors.gold }));
    const name = host(tree, 'plans-card-name-2');
    expect(name.props).toEqual(expect.objectContaining({ numberOfLines: 2, ellipsizeMode: 'tail' }));
    expect(name.props.adjustsFontSizeToFit).toBeFalsy();
    expect(textOf(host(tree, 'plans-card-meta-2'))).toBe('6 days a week · Intermediate');
    expect(host(tree, 'plans-card-meta-2').props.numberOfLines).toBe(1);
    const description = host(tree, 'plans-card-description-2');
    expect(textOf(description)).toBe('A classic split.');
    expect(description.props).toEqual(expect.objectContaining({ numberOfLines: 2, ellipsizeMode: 'tail' }));
    expect(flat(description)).toEqual(expect.objectContaining({ fontSize: 13, color: colors.textFaint }));
    await act(async () => card.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlanDetail', { planId: '2' });
  });

  it('no thumbnail → the neutral initials tile (url null); no description → the line is omitted', async () => {
    const tree = await render();
    const photo = tree.root.findAll((node) => node.type === ExerciseImage && node.props.testID === 'plans-card-photo-3')[0];
    expect(photo.props.url).toBeNull();
    expect(photo.props.muscleCode).toBeNull();
    // The board's 28 px initials (ExerciseImage's shared default would be 30 at 84).
    const initials = host(tree, 'plans-card-photo-3-initials').findAll((node) => node.type === 'Text')[0];
    expect(textOf(initials)).toBe('FB');
    expect(flat(initials)).toEqual(expect.objectContaining({ fontSize: 28 }));
    expect(host(tree, 'plans-card-description-3')).toBeUndefined();
  });
});

describe('T-60 phone: pressed (§8.6 state rule)', () => {
  it('gold Start: ink 4 % overlay; glass Start, See full plan, the own rows and a catalog card: the white 4 % overlay; rest colours kept', async () => {
    let tree = await render();
    const gold = pressableEl(tree, 'plans-start');
    expect(overlayOf(gold, true).props).toEqual(expect.objectContaining({ pressed: true, ink: true }));
    expect(overlayOf(gold, false).props.pressed).toBe(false);
    expect(flat(gold).backgroundColor).toBe(colors.gold);
    const see = pressableEl(tree, 'plans-see-full-plan');
    expect(overlayOf(see, true).props).toEqual(expect.objectContaining({ pressed: true }));
    expect(Boolean(overlayOf(see, true).props.ink)).toBe(false);
    for (const id of ['generator-entry-start', 'my-plans-entry', 'plans-card-2']) {
      const node = pressableEl(tree, id);
      expect(overlayOf(node, true).props.pressed).toBe(true);
      expect(Boolean(overlayOf(node, true).props.ink)).toBe(false);
    }
    expect(flat(pressableEl(tree, 'plans-card-2'), true).borderColor).toBe(colors.goldLine);
    getCurrentToday.mockResolvedValue({ action: 'already_completed', plan_day: { id: 12, title: 'Lower A' } });
    getCurrentWeek.mockResolvedValue(weekOf({ 4: { status: 'done' }, 6: { is_workout_day: true, plan_day: { id: 13, title: 'Upper B' }, status: 'upcoming' } }));
    tree = await render();
    const glass = pressableEl(tree, 'plans-start');
    expect(Boolean(overlayOf(glass, true).props.ink)).toBe(false);
    expect(flat(glass).backgroundColor).toBe(colors.fillGlass);
  });
});

describe('T-60 phone: header', () => {
  it('phone: no "New plan" and no My plans check (tablet only, unchanged)', async () => {
    const tree = await render();
    expect(pressable(tree, 'plans-new-plan')).toBeUndefined();
    expect(listMyPlans).not.toHaveBeenCalled();
  });
});

describe('T-60 phone: text sizes and tablet split', () => {
  it('every text on the phone page is ≥ 13 px except the three 11 px week labels', async () => {
    const tree = await render();
    const small = tree.root
      .findAll((node) => node.type === 'Text')
      .filter((node) => (flat(node)?.fontSize ?? 13) < 13)
      .map((node) => node.props.testID ?? textOf(node));
    expect(small.every((id) => /^plans-week-label-/.test(id))).toBe(true);
    expect(small).toHaveLength(7);
  });

  it('tablet makes none of the side calls (unchanged)', async () => {
    mockWindow = { width: 834, height: 1194, fontScale: 1 };
    await render();
    expect(getCurrentWeek).not.toHaveBeenCalled();
    expect(getCurrentToday).not.toHaveBeenCalled();
    expect(listDifficultyLevels).not.toHaveBeenCalled();
  });
});

describe('Tablet: Plans', () => {
  beforeEach(() => {
    mockWindow = { width: 834, height: 1194, fontScale: 1 };
  });

  it('N1 "New plan" (glass, plus icon) → My plan create', async () => {
    const tree = await render();
    const button = pressable(tree, 'plans-new-plan');
    expect(button.props.variant).toBe('secondary');
    await act(async () => button.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlanCreate');
  });

  it('"New plan" is hidden for a member on hold (403), shown on any other failure', async () => {
    listMyPlans.mockRejectedValueOnce({ response: { status: 403 } });
    let tree = await render();
    expect(pressable(tree, 'plans-new-plan')).toBeUndefined();
    listMyPlans.mockRejectedValueOnce({ response: { status: 500 } });
    tree = await render();
    expect(pressable(tree, 'plans-new-plan')).toBeDefined();
  });

  it('the active card: radius 32, padding 32, the 7-day grid with the day titles, the 56 pair', async () => {
    const tree = await render();
    expect(flat(host(tree, 'plans-active-card'))).toEqual(expect.objectContaining({ borderRadius: radii.xxxl, padding: 32 }));
    expect(texts(tree)).toEqual(expect.arrayContaining(['Strength · 4\u00a0days / week', 'Upper A', 'Lower A']));
    expect(host(tree, 'plans-week-grid').props.accessibilityLabel).toBe('Training days: Monday, Thursday');
    expect(flat(host(tree, 'plans-week-cell-4')).backgroundColor).toBe(colors.ground);
    expect(flat(pressableEl(tree, 'plans-go-to-workout')).minHeight).toBe(56);
  });

  it('entry rows side by side with "Get started" as a TextLink; plan cards 2 per row at radius 28', async () => {
    const tree = await render();
    expect(host(tree, 'generator-entry-card')).toBeDefined();
    expect(texts(tree)).toContain('Get started →');
    const tile = pressable(tree, 'plans-card-2');
    expect(flat(tile)).toEqual(expect.objectContaining({ borderRadius: radii.xxl, padding: 22, gap: 36 }));
    expect(hosts(tree, 'plans-tile-row')).toHaveLength(1);
  });
});

describe('Plans large text (§9)', () => {
  it.each([1, 2, 3.1])('phone fontScale %s: the column layout holds; the name never shrinks (1 line, title cap)', async (fontScale) => {
    mockWindow = { width: 390, height: 844, fontScale };
    const tree = await render();
    expect(flat(host(tree, 'plans-active-actions')).flexDirection).toBe('column');
    const title = host(tree, 'plans-active-name');
    expect(title.props).toEqual(expect.objectContaining({ maxFontSizeMultiplier: textScale.title, numberOfLines: 1 }));
    expect(title.props.adjustsFontSizeToFit).toBeFalsy();
    const label = textNode(tree, 'Start Lower A');
    expect(label.props).toEqual(expect.objectContaining({ numberOfLines: 1, ellipsizeMode: 'tail' }));
  });

  it('tablet past 1.3×: the week grid becomes the wrapping chip row', async () => {
    mockWindow = { width: 834, height: 1194, fontScale: 2 };
    const tree = await render();
    expect(host(tree, 'plans-week-grid')).toBeUndefined();
    expect(flat(host(tree, 'plans-week-chips')).flexWrap).toBe('wrap');
  });
});
