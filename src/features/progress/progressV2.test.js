import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import PillButton from '../../shared/components/PillButton';
import StatusPill from '../../shared/components/StatusPill';
import { colors } from '../../shared/theme/tokens';
import { resetProfileStore, setStoredProfile } from '../profile/profileStore';
import { getWeightLogsInRange, loadProgress } from './api/progressApi';
import ProgressScreen from './ProgressScreen';
import ProgressWeightChart, { chartGeometry } from './ProgressWeightChart';
import {
  chartLabel,
  completionCells,
  consistencyPercent,
  goalInUnit,
  rangeDates,
  rangeDelta,
  recentWorkoutRows,
  toGoalLine,
  weeklyBars,
} from './progressFormat';
import { memberVolume } from '../home/homeFormat';
import { getHeaderTitle } from '../shell/shellRules';

let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockFontScale }),
}));
jest.mock('../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
// The shell page draws the header-actions slot (FE batch 1) above the page, as the header does.
jest.mock('../shell/ShellPage', () => {
  const { View } = require('react-native');
  return function MockShellPage({ children, headerActions }) {
    return (
      <>
        {headerActions ? <View testID="shell-header-actions">{headerActions}</View> : null}
        {children}
      </>
    );
  };
});
jest.mock('../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./api/progressApi', () => ({ loadProgress: jest.fn(), getWeightLogsInRange: jest.fn() }));

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const texts = (root) => root.findAll((node) => node.type === 'Text').map(textOf);
const host = (root, id) => root.find((node) => node.props.testID === id && typeof node.type === 'string');
const queryHost = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const press = (root, id) => act(() => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function').props.onPress());
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const flush = () => act(() => new Promise((resolve) => setImmediate(resolve)));

const LOGS_DESC = [
  { id: 3, weight_value: 82.1, weight_unit: 'kg', recorded_on: '2026-10-26', note: 'Morning' },
  { id: 2, weight_value: 83, weight_unit: 'kg', recorded_on: '2026-10-12' },
  { id: 1, weight_value: 84.5, weight_unit: 'kg', recorded_on: '2026-09-07' },
];
const RANGE_ASC = [...LOGS_DESC].reverse();
const DATA = {
  weightProgress: { current_weight: 82.1, goal_weight: 78, difference_to_goal: 4.1, total_change: -2.4 },
  weightLogs: LOGS_DESC,
  overview: { current_streak: 3, workouts_completed: 12 },
  history: { total_workouts: 10, completed_workouts: 8, total_duration_seconds: 24000 },
  frequency: [3, 4, 2, 4, 4, 3, 4, 2].map((count, index) => ({ period_start: `w${index}`, workout_count: count })),
  missed: {
    count: 1,
    planned_count: 4,
    items: [{ date: '2026-10-21', plan_day: { title: 'Upper B' } }],
    days: [
      { date: '2026-10-19', status: 'done' },
      { date: '2026-10-20', status: 'rest' },
      { date: '2026-10-21', status: 'missed' },
    ],
  },
  recentWorkouts: [{ id: 9, workout_plan_day: { title: 'Lower A' }, completed_at: '2026-10-20T10:00:00Z', duration_seconds: 3120, total_volume_kg: 1000, total_volume: 1 }],
  week: [
    { is_workout_day: true, date: '2026-10-26', status: 'done' },
    { is_workout_day: false, date: '2026-10-27', status: 'rest' },
    { is_workout_day: true, date: '2026-10-29', status: 'upcoming' },
  ],
};

const mounted = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockFontScale = 1;
  resetProfileStore();
  setStoredProfile({ current_weight_value: 82.1, current_weight_unit: 'kg', goal_weight_unit: 'kg' });
  loadProgress.mockResolvedValue(DATA);
  getWeightLogsInRange.mockResolvedValue(RANGE_ASC);
});
afterEach(() => act(() => mounted.splice(0).forEach((tree) => tree.unmount())));
async function render() {
  let tree;
  await act(async () => {
    tree = create(<ProgressScreen />);
  });
  await flush();
  mounted.push(tree);
  return tree;
}
function layout(tree, id, width) {
  const node = tree.root.find((n) => n.props.testID === id && n.props.onLayout);
  act(() => node.props.onLayout({ nativeEvent: { layout: { width, height: 110 } } }));
}

describe('progressFormat (Phase 3)', () => {
  it('rangeDates: device-local end today, start N days back', () => {
    expect(rangeDates('7D', new Date(2026, 9, 27))).toEqual({ start_date: '2026-10-20', end_date: '2026-10-27' });
    expect(rangeDates('3M', new Date(2026, 9, 27)).start_date).toBe('2026-07-29');
  });

  it('rangeDelta: ↓/↑ in the unit, null under 2 logs', () => {
    expect(rangeDelta(RANGE_ASC, 'kg')).toBe('↓ 2.4 kg in this range');
    expect(rangeDelta([RANGE_ASC[2], RANGE_ASC[0]], 'kg')).toBe('↑ 2.4 kg in this range');
    expect(rangeDelta([RANGE_ASC[0]], 'kg')).toBeNull();
  });

  it('toGoalLine / goalInUnit: the code sign; goal unit converted for the chart', () => {
    expect(toGoalLine(DATA.weightProgress, { goal: 'kg' })).toBe('\u22124.1 kg to goal (78 kg)');
    expect(toGoalLine({}, { goal: 'kg' })).toBeNull();
    // T-64: −difference_to_goal; a gain goal "+", no sign at a rounded 0.
    expect(toGoalLine({ goal_weight: 80, difference_to_goal: -5 }, { goal: 'kg' })).toBe('+5 kg to goal (80 kg)');
    expect(toGoalLine({ goal_weight: 80, difference_to_goal: 0.04 }, { goal: 'kg' })).toBe('0 kg to goal (80 kg)');
    expect(goalInUnit({ goal_weight: 100 }, { goal: 'kg', current: 'lb' })).toBeCloseTo(220.46, 1);
    expect(goalInUnit({}, { goal: 'kg', current: 'kg' })).toBeNull();
  });

  it('chartLabel: data-based', () => {
    expect(chartLabel(RANGE_ASC, 'kg')).toBe('Weight history, down from 84.5 to 82.1 kg');
  });

  it('weeklyBars: last 8, the mean, the current week last; all 0 → empty', () => {
    const bars = weeklyBars(DATA.frequency);
    expect(bars.average).toBe('3.3');
    expect(bars.bars.map((bar) => bar.current)).toEqual([false, false, false, false, false, false, false, true]);
    expect(bars.label).toBe('Workouts per week, last 8 weeks: 3, 4, 2, 4, 4, 3, 4, 2');
    expect(weeklyBars([{ workout_count: 0 }]).empty).toBe(true);
  });

  it('consistencyPercent: (planned − count) / planned; 404 or planned 0 → null', () => {
    expect(consistencyPercent({ count: 1, planned_count: 4 })).toBe(75);
    expect(consistencyPercent(null)).toBeNull();
    expect(consistencyPercent({ count: 0, planned_count: 0 })).toBeNull();
  });

  it('completionCells: done/missed from days[] (rest → no cell) + this week (upcoming → due); no days[] → null', () => {
    const grid = completionCells(DATA.missed, DATA.week, new Date(2026, 9, 27));
    expect(grid.cells.map((cell) => cell.status)).toEqual(['done', 'missed', 'done', 'due']);
    expect(grid.label).toBe('2 of 3\u00a0planned days done in the last 4 weeks');
    expect(completionCells({ count: 1, planned_count: 4 }, null)).toBeNull();
  });

  it('recentWorkoutRows: newest first, Missed rows, older missed dropped, max 8, VOLUME RULE', () => {
    const rows = recentWorkoutRows(
      DATA.recentWorkouts,
      [...DATA.missed.items, { date: '2026-09-01', plan_day: { title: 'Old' } }],
      'kg',
      memberVolume
    );
    // DECLARED change (review M2, web mergeRecentWorkouts progressData.js:158): was [Upper B, Lower A] (any completed
    // row cut the older missed ones). Web cuts only when completed ≥ 5; with 1 completed row "Old" stays.
    expect(rows.map((row) => [row.kind, row.title])).toEqual([
      ['missed', 'Upper B'],
      ['done', 'Lower A'],
      ['missed', 'Old'],
    ]);
    expect(rows[1].volume).toBe('1,000 kg');
    expect(rows[0].meta).toMatch(/ · —$/);
    const many = Array.from({ length: 10 }, (_, index) => ({ id: index, completed_at: `2026-10-${10 + index}T10:00:00Z` }));
    expect(recentWorkoutRows(many, [], 'kg', memberVolume)).toHaveLength(8);
  });

  it('recentWorkoutRows (M2): older Missed rows are cut only when there are ≥ 5 completed rows', () => {
    const done = (count) => Array.from({ length: count }, (_, index) => ({ id: index, completed_at: `2026-10-${20 + index}T10:00:00Z` }));
    const older = [1, 2, 3, 4].map((day) => ({ date: `2026-10-0${day}`, plan_day: { title: `Old ${day}` } }));
    const two = recentWorkoutRows(done(2), older, 'kg', memberVolume);
    expect(two).toHaveLength(6);
    expect(two.filter((row) => row.kind === 'missed')).toHaveLength(4);
    const four = recentWorkoutRows(done(4), older, 'kg', memberVolume);
    expect(four.filter((row) => row.kind === 'missed')).toHaveLength(4);
    const five = recentWorkoutRows(done(5), [...older, { date: '2026-10-22', plan_day: { title: 'Inside' } }], 'kg', memberVolume);
    expect(five.filter((row) => row.kind === 'missed').map((row) => row.title)).toEqual(['Inside']);
  });

  it('recentWorkoutRows (batch 3 (d)): sorted by timestamp, newest first (completed_at, else started_at)', () => {
    const rows = recentWorkoutRows(
      [
        { id: 1, workout_plan_day: { title: 'A' }, completed_at: '2026-10-22T01:00:00+05:00' },
        { id: 2, workout_plan_day: { title: 'B' }, completed_at: '2026-10-21T22:00:00Z' },
        { id: 3, workout_plan_day: { title: 'C' }, completed_at: null, started_at: '2026-10-21T21:00:00Z' },
      ],
      [],
      'kg',
      memberVolume
    );
    expect(rows.map((row) => row.title)).toEqual(['B', 'C', 'A']);
  });

  it('recentWorkoutRows (batch 3 (d)): a Missed row sorts at LOCAL midnight of its date', () => {
    const before = new Date(2026, 9, 21, 23, 59).toISOString();
    const after = new Date(2026, 9, 22, 0, 1).toISOString();
    const missed = [{ date: '2026-10-22', plan_day: { title: 'Missed' } }];
    const done = (iso) => [{ id: 1, workout_plan_day: { title: 'Done' }, completed_at: iso }];
    expect(recentWorkoutRows(done(before), missed, 'kg', memberVolume).map((row) => row.title)).toEqual(['Missed', 'Done']);
    expect(recentWorkoutRows(done(after), missed, 'kg', memberVolume).map((row) => row.title)).toEqual(['Done', 'Missed']);
  });

  it('recentWorkoutRows (LOW): a Missed row with no title reads "Workout session", else the day name', () => {
    expect(recentWorkoutRows([], [{ date: '2026-10-21', plan_day: {} }], 'kg', memberVolume)[0].title).toBe('Workout session');
    expect(recentWorkoutRows([], [{ date: '2026-10-21', plan_day: { name: 'Leg day' } }], 'kg', memberVolume)[0].title).toBe('Leg day');
  });

  it('chartGeometry: the axis widens to contain the goal; the goal y is inside the plot', () => {
    const geo = chartGeometry(RANGE_ASC, 'kg', 70, 300, 110);
    expect(geo.goalY).toBeGreaterThan(0);
    expect(geo.goalY).toBeLessThanOrEqual(110);
    expect(chartGeometry([RANGE_ASC[0]], 'kg', 70, 300, 110)).toBeNull();
  });
});

describe('Progress phone (UX G)', () => {
  it('Body: Current 82.1 + faint unit, the teal delta line, the gold 44 "Add weight" circle', async () => {
    const tree = await render();
    expect(texts(host(tree.root, 'progress-current'))).toEqual(['82.1 kg', ' kg']);
    expect(texts(host(tree.root, 'progress-delta'))).toEqual(['↓ 2.4 kg in this range · \u22124.1 kg to goal (78 kg)']);
    expect(flat(host(tree.root, 'progress-delta')).color).toBe(colors.teal);
    const add = host(tree.root, 'progress-add-weight');
    expect(add.props.accessibilityLabel).toBe('Add weight');
    expect(flat(add)).toMatchObject({ width: 44, height: 44, backgroundColor: colors.gold });
  });

  it('ranges 7D/1M/3M/1Y (3M default); a press refetches that range and keeps the selection', async () => {
    const tree = await render();
    expect(getWeightLogsInRange).toHaveBeenCalledTimes(1);
    expect(host(tree.root, 'progress-range-3M').props.accessibilityState).toEqual({ selected: true });
    expect(flat(host(tree.root, 'progress-range-3M')).minHeight).toBe(32);
    getWeightLogsInRange.mockResolvedValueOnce(RANGE_ASC.slice(2));
    press(tree.root, 'progress-range-7D');
    await flush();
    expect(getWeightLogsInRange).toHaveBeenLastCalledWith(rangeDates('7D'));
    expect(host(tree.root, 'progress-range-7D').props.accessibilityState).toEqual({ selected: true });
    expect(texts(host(tree.root, 'progress-log-count'))).toEqual(['1 log']);
    expect(texts(tree.root)).toContain('Not enough weight history yet');
    expect(queryHost(tree.root, 'progress-delta')[0] && texts(host(tree.root, 'progress-delta'))).toEqual(['\u22124.1 kg to goal (78 kg)']);
  });

  it('batch 3 (e): while a new range loads the chart keeps the previous data dimmed (busy, 0.6), no skeleton; the new chip is already selected', async () => {
    const tree = await render();
    expect(host(tree.root, 'progress-chart-wrap').props.accessibilityState).toEqual({ busy: false });
    expect(flat(host(tree.root, 'progress-chart-wrap')).opacity).toBeUndefined();
    let resolve;
    getWeightLogsInRange.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    press(tree.root, 'progress-range-7D');
    await flush();
    expect(host(tree.root, 'progress-range-7D').props.accessibilityState).toEqual({ selected: true });
    expect(host(tree.root, 'progress-range-3M').props.accessibilityState).toEqual({ selected: false });
    const wrap = host(tree.root, 'progress-chart-wrap');
    expect(wrap.props.accessibilityState).toEqual({ busy: true });
    expect(flat(wrap).opacity).toBe(0.6);
    expect(queryHost(tree.root, 'progress-chart-plot')).toHaveLength(1);
    expect(texts(host(tree.root, 'progress-log-count'))).toEqual(['3 logs']);
    expect(texts(tree.root)).not.toContain('Not enough weight history yet');
    expect(tree.root.findAll((node) => /skeleton/i.test(String(node.props.testID ?? '')))).toHaveLength(0);
    await act(async () => resolve(RANGE_ASC.slice(2)));
    await flush();
    expect(host(tree.root, 'progress-chart-wrap').props.accessibilityState).toEqual({ busy: false });
    expect(flat(host(tree.root, 'progress-chart-wrap')).opacity).toBeUndefined();
    expect(texts(host(tree.root, 'progress-log-count'))).toEqual(['1 log']);
  });

  it('batch 3 (e): a quick second pick keeps the last settled range dimmed until its own data lands', async () => {
    const tree = await render();
    getWeightLogsInRange.mockImplementationOnce(() => new Promise(() => {}));
    press(tree.root, 'progress-range-7D');
    let resolve;
    getWeightLogsInRange.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    press(tree.root, 'progress-range-1Y');
    await flush();
    expect(host(tree.root, 'progress-range-1Y').props.accessibilityState).toEqual({ selected: true });
    expect(host(tree.root, 'progress-chart-wrap').props.accessibilityState).toEqual({ busy: true });
    expect(texts(host(tree.root, 'progress-log-count'))).toEqual(['3 logs']);
    await act(async () => resolve(RANGE_ASC.slice(1)));
    await flush();
    expect(host(tree.root, 'progress-chart-wrap').props.accessibilityState).toEqual({ busy: false });
    expect(texts(host(tree.root, 'progress-log-count'))).toEqual(['2 logs']);
  });

  it('chart: gold line, dashed goal line (U9), data label', async () => {
    const tree = await render();
    layout(tree, 'progress-chart-plot', 300);
    const plot = host(tree.root, 'progress-chart-plot');
    expect(plot.props.accessibilityLabel).toBe('Weight history, down from 84.5 to 82.1 kg');
    expect(tree.root.find((node) => node.props.testID === 'progress-chart-line').props.stroke).toBe(colors.gold);
    expect(tree.root.find((node) => node.props.testID === 'progress-chart-goal').props.strokeDasharray).toBe('6 5');
  });

  it('a range fetch failure falls back to the loaded logs in that range (no error)', async () => {
    getWeightLogsInRange.mockRejectedValue(new Error('x'));
    const tree = await render();
    expect(queryHost(tree.root, 'progress-error')).toHaveLength(0);
    expect(queryHost(tree.root, 'progress-history')).toHaveLength(1);
  });

  it('0 logs: "—" current, the chart empty state, "No weight logs yet."', async () => {
    loadProgress.mockResolvedValue({ ...DATA, weightLogs: [], weightProgress: {} });
    getWeightLogsInRange.mockResolvedValue([]);
    const tree = await render();
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['No weight logs yet', 'Add your first weight entry to unlock the chart.', 'No weight logs yet.']));
  });

  it('Goal progress kept (ring, progressbar) + Goal / To goal; recent logs with unit pill and note', async () => {
    const tree = await render();
    expect(texts(host(tree.root, 'progress-goal-value'))).toEqual(['37%']);
    const ring = tree.root.find((node) => node.props.accessibilityRole === 'progressbar');
    expect(ring.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 37 });
    expect(texts(host(tree.root, 'progress-log-3'))).toEqual(['82.1 kg', 'Oct 27', 'kg', 'Morning']);
  });

  it('Activity: per-week bars (current gold), Consistency 75% + grid (gold / warning-strong / track), stats, 12 weeks, recent with Missed', async () => {
    const tree = await render();
    press(tree.root, 'progress-tab-activity');
    expect(texts(host(tree.root, 'progress-per-week'))).toEqual(expect.arrayContaining(['Workouts per week', '3.3']));
    expect(flat(host(tree.root, 'progress-week-bar-current')).backgroundColor).toBe(colors.gold);
    expect(texts(host(tree.root, 'progress-completion'))).toEqual(['Consistency', '75%', 'of planned days']);
    expect(flat(queryHost(tree.root, 'progress-cell-missed')[0]).backgroundColor).toBe(colors.warningStrong);
    expect(flat(queryHost(tree.root, 'progress-cell-due')[0]).backgroundColor).toBe(colors.track);
    expect(texts(host(tree.root, 'progress-activity-stats'))).toEqual(expect.arrayContaining(['Streak', 'Workouts', 'Completion', '80%', 'Avg time']));
    expect(queryHost(tree.root, 'progress-consistency')).toHaveLength(1);
    const recent = host(tree.root, 'progress-recent');
    expect(texts(recent)).toEqual(expect.arrayContaining(['Recent workouts', 'UB', 'Upper B', 'LA', 'Lower A', '1,000 kg']));
    expect(recent.findAllByType(StatusPill).map((pill) => pill.props)).toEqual([expect.objectContaining({ tone: 'warning', label: 'Missed' })]);
  });

  it('ND-10: "Goal {n}" right of the label (13/500 muted, tabular, one line, no shrink); the label truncates first; a11y reads goal + average', async () => {
    loadProgress.mockResolvedValue({ ...DATA, planDaysPerWeek: 4 });
    const tree = await render();
    press(tree.root, 'progress-tab-activity');
    const row = host(tree.root, 'progress-per-week-head');
    expect(flat(row)).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between' });
    const label = host(tree.root, 'progress-per-week-label');
    expect(textOf(label)).toBe('Workouts per week');
    expect(label.props.numberOfLines).toBe(1);
    expect(flat(label).flexShrink).toBe(1);
    const goal = host(tree.root, 'progress-per-week-goal');
    expect(textOf(goal)).toBe('Goal 4');
    expect(goal.props.numberOfLines).toBe(1);
    expect(flat(goal)).toMatchObject({ fontSize: 13, color: colors.textMuted, flexShrink: 0, fontVariant: ['tabular-nums'] });
    const summary = host(tree.root, 'progress-per-week-summary');
    expect(summary.props.accessible).toBe(true);
    expect(summary.props.accessibilityLabel).toBe('Workouts per week, goal 4, average 3.3');
  });

  it('ND-10: no plan → the label alone, a11y without the goal; tablet shows the goal too', async () => {
    const tree = await render();
    press(tree.root, 'progress-tab-activity');
    expect(queryHost(tree.root, 'progress-per-week-goal')).toHaveLength(0);
    expect(host(tree.root, 'progress-per-week-summary').props.accessibilityLabel).toBe('Workouts per week, average 3.3');
    mockWidth = 834;
    loadProgress.mockResolvedValue({ ...DATA, planDaysPerWeek: 3 });
    const tablet = await render();
    press(tablet.root, 'progress-tab-activity');
    expect(textOf(host(tablet.root, 'progress-per-week-goal'))).toBe('Goal 3');
    expect(host(tablet.root, 'progress-per-week-summary').props.accessibilityLabel).toBe('Workouts per week, goal 3, average 3.3');
  });

  it('ND-10: no completed workouts yet → the label row still carries the goal', async () => {
    loadProgress.mockResolvedValue({ ...DATA, frequency: [], planDaysPerWeek: 4 });
    const tree = await render();
    press(tree.root, 'progress-tab-activity');
    expect(textOf(host(tree.root, 'progress-per-week-goal'))).toBe('Goal 4');
    expect(host(tree.root, 'progress-per-week-summary').props.accessibilityLabel).toBe('Workouts per week, goal 4');
  });

  it('Activity without plan data: no Consistency tile, no recent missed rows', async () => {
    loadProgress.mockResolvedValue({ ...DATA, missed: null, recentWorkouts: [] });
    const tree = await render();
    press(tree.root, 'progress-tab-activity');
    expect(queryHost(tree.root, 'progress-completion')).toHaveLength(0);
    expect(queryHost(tree.root, 'progress-recent')).toHaveLength(0);
  });

  // DECLARED change (UX verdict P3-3, faf7f85): the selected segment was GOLD
  // (was: toMatchObject({ backgroundColor: colors.gold, minHeight: 44 })). Web's view switch is GLASS: selected =
  // white 0.12 fill + primary text 600; the gold "+" Add weight stays the one gold element.
  it('switch: GLASS selected segment (white 0.12 + primary 600), 44 tall; Body on mount (P3-3)', async () => {
    const tree = await render();
    expect(host(tree.root, 'progress-tab-body').props.accessibilityState).toEqual({ selected: true });
    // DECLARED (kit batch, reviewer LOW): the selected fill has its own alias
    // (was the borrowed border token colors.hairlineButton; same value).
    expect(flat(host(tree.root, 'progress-tab-body'))).toMatchObject({ backgroundColor: colors.glassSelectedFill, minHeight: 44 });
    expect(colors.glassSelectedFill).toBe('rgba(255, 255, 255, 0.12)');
    expect(flat(host(tree.root, 'progress-tab-body')).backgroundColor).not.toBe(colors.gold);
    const label = (id) => flat(host(tree.root, id).findAll((node) => node.type === 'Text')[0]);
    expect(label('progress-tab-body')).toMatchObject({ color: colors.textPrimary, fontFamily: 'Geist-SemiBold' });
    expect(label('progress-tab-activity')).toMatchObject({ color: colors.textSecondary });
    expect(flat(host(tree.root, 'progress-tab-activity')).backgroundColor).toBeUndefined();
    // Pressed (either segment): the white 4 % overlay, never the ink one (no gold under it any more).
    const segment = tree.root.find((node) => node.props.testID === 'progress-tab-body' && typeof node.props.children === 'function');
    let pressed;
    act(() => {
      pressed = create(<>{segment.props.children({ pressed: true })}</>);
    });
    const overlays = pressed.root.findAll((node) => node.type === 'View' && flat(node)?.backgroundColor === colors.pressOverlay);
    expect(overlays).toHaveLength(1);
    expect(pressed.root.findAll((node) => node.type === 'View' && flat(node)?.backgroundColor === colors.pressOverlayInk)).toHaveLength(0);
    act(() => pressed.unmount());
  });

  it('switch: Activity selected takes the glass look; Body goes back to plain (P3-3)', async () => {
    const tree = await render();
    press(tree.root, 'progress-tab-activity');
    expect(host(tree.root, 'progress-tab-activity').props.accessibilityState).toEqual({ selected: true });
    expect(flat(host(tree.root, 'progress-tab-activity')).backgroundColor).toBe(colors.glassSelectedFill);
    expect(flat(host(tree.root, 'progress-tab-body')).backgroundColor).toBeUndefined();
  });
});

describe('Progress tablet', () => {
  // DECLARED change (UX verdict I1, iPad 15e819a): was "H1 + switch row" with
  // expect(queryHost(tree.root, 'progress-header')).toHaveLength(1). The shell header already draws the tablet 52
  // "Progress", so the page's own title row (a second H1) is gone; the switch has its own row (I1 test below).
  it('switch row; Goal progress ring 190 + "Add weight" primary; Current 76; To goal gold; no ranges', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(queryHost(tree.root, 'progress-tabs')).toHaveLength(1);
    expect(getWeightLogsInRange).not.toHaveBeenCalled();
    expect(queryHost(tree.root, 'progress-ranges')).toHaveLength(0);
    expect(tree.root.find((node) => node.props.accessibilityRole === 'progressbar' && node.props.size).props.size).toBe(190);
    expect(tree.root.findAllByType(PillButton).find((button) => button.props.testID === 'progress-add-weight').props.title).toBe('Add weight');
  });

  // UX verdict I1 (iPad, 15e819a): the title showed TWICE (the shell's "Progress", then the page's 60 H1 squeezed
  // beside the switch into "Progr / ess"). ONE title: the shell header's tablet 52, as on every other tablet page.
  // DECLARED change (FE batch 1 ruling, header-actions slot): was "the switch is on its own row" at 1 and 3.1. Now at
  // 1 the switch sits right-aligned in the shell header's title row (the slot); past the reflow scale (3.1) it keeps
  // its own row under the title (the title row cannot hold the 52 title + the switch + the bell).
  it.each([1, 3.1])('I1 at %s: one page title (the shell header\'s); the page draws no "Progress" H1', async (scale) => {
    mockWidth = 834;
    mockFontScale = scale;
    expect(getHeaderTitle('/progress')).toBe('Progress');
    const tree = await render();
    const isProgressText = (node) => node.type === 'Text' && textOf(node) === 'Progress';
    expect(tree.root.findAll(isProgressText)).toHaveLength(0);
    const tabs = host(tree.root, 'progress-tabs');
    expect(tabs.parent.findAll(isProgressText)).toHaveLength(0);
    expect(flat(tabs).width).toBe(320);
  });

  it('header-actions slot: at 1 the Body/Activity switch is in the shell title row (one switch, still works)', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(queryHost(tree.root, 'progress-tabs')).toHaveLength(1);
    const slot = host(tree.root, 'shell-header-actions');
    expect(queryHost(slot, 'progress-tabs')).toHaveLength(1);
    press(tree.root, 'progress-tab-activity');
    expect(host(slot, 'progress-tab-activity').props.accessibilityState).toEqual({ selected: true });
    expect(queryHost(tree.root, 'progress-consistency')).toHaveLength(1);
  });

  it('header-actions slot: past the reflow scale the switch keeps its own row; phone never uses the slot', async () => {
    mockWidth = 834;
    mockFontScale = 3.1;
    const large = await render();
    expect(queryHost(large.root, 'shell-header-actions')).toHaveLength(0);
    expect(queryHost(large.root, 'progress-tabs')).toHaveLength(1);
    mockWidth = 390;
    mockFontScale = 1;
    const phone = await render();
    expect(queryHost(phone.root, 'shell-header-actions')).toHaveLength(0);
    expect(queryHost(phone.root, 'progress-tabs')).toHaveLength(1);
  });

  it('Activity on tablet: no Recent workouts (not drawn)', async () => {
    mockWidth = 834;
    const tree = await render();
    press(tree.root, 'progress-tab-activity');
    expect(queryHost(tree.root, 'progress-recent')).toHaveLength(0);
  });
});

describe('§9 large text', () => {
  it.each([1, 2, 3.1])('at %s: numbers cap 1.3; the tiles stack past 1.3; ranges wrap', async (scale) => {
    mockFontScale = scale;
    const tree = await render();
    expect(host(tree.root, 'progress-current').props.maxFontSizeMultiplier).toBe(1.3);
    expect(flat(host(tree.root, 'progress-weight-stats')).flexDirection).toBe(scale > 1.3 ? 'column' : 'row');
    expect(flat(host(tree.root, 'progress-ranges')).flexWrap).toBe(scale > 1.3 ? 'wrap' : undefined);
  });

  it.each([1, 2, 3.1])('ND-10 at %s: Goal caps at the body cap; past reflow the label wraps (column), never truncated', async (scale) => {
    mockFontScale = scale;
    loadProgress.mockResolvedValue({ ...DATA, planDaysPerWeek: 4 });
    const tree = await render();
    press(tree.root, 'progress-tab-activity');
    const reflow = scale > 1.3;
    expect(flat(host(tree.root, 'progress-per-week-head')).flexDirection).toBe(reflow ? 'column' : 'row');
    expect(host(tree.root, 'progress-per-week-label').props.numberOfLines).toBe(reflow ? undefined : 1);
    expect(host(tree.root, 'progress-per-week-goal').props.maxFontSizeMultiplier).toBe(host(tree.root, 'progress-per-week-label').props.maxFontSizeMultiplier);
  });

  // DECLARED change (UX verdict I1): was "tablet at 3.1: the header row stacks" with
  // expect(flat(host(tree.root, 'progress-header')).flexDirection).toBe('column'). There is no page title row on
  // tablet any more (the shell header holds the one title), so nothing stacks beside the switch.
  it('tablet at 3.1: no page title row; the switch keeps its own row', async () => {
    mockWidth = 834;
    mockFontScale = 3.1;
    const tree = await render();
    expect(queryHost(tree.root, 'progress-header')).toHaveLength(0);
    expect(queryHost(tree.root, 'progress-tabs')).toHaveLength(1);
  });
});

describe('ProgressWeightChart', () => {
  it('no goal → no goal line; fewer than 2 logs → no svg', () => {
    let tree;
    act(() => {
      tree = create(<ProgressWeightChart logs={RANGE_ASC} unit="kg" goal={null} label="x" />);
    });
    act(() => tree.root.find((n) => n.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 200 } } }));
    expect(tree.root.findAll((node) => node.props.testID === 'progress-chart-goal')).toHaveLength(0);
    expect(tree.root.findAll((node) => node.props.testID === 'progress-chart-line').length).toBeGreaterThan(0);
    act(() => tree.unmount());
  });
});
