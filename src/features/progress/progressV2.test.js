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

let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockFontScale }),
}));
jest.mock('../../shared/api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../shell/ShellPage', () => ({ children }) => children);
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
  weightProgress: { current_weight: 82.1, goal_weight: 78, difference_to_goal: -4.1, total_change: -2.4 },
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
    expect(toGoalLine(DATA.weightProgress, { goal: 'kg' })).toBe('-4.1 kg to goal (78 kg)');
    expect(toGoalLine({}, { goal: 'kg' })).toBeNull();
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
    expect(grid.label).toBe('2 of 3 planned days done in the last 4 weeks');
    expect(completionCells({ count: 1, planned_count: 4 }, null)).toBeNull();
  });

  it('recentWorkoutRows: newest first, Missed rows, older missed dropped, max 8, VOLUME RULE', () => {
    const rows = recentWorkoutRows(
      DATA.recentWorkouts,
      [...DATA.missed.items, { date: '2026-09-01', plan_day: { title: 'Old' } }],
      'kg',
      memberVolume
    );
    expect(rows.map((row) => [row.kind, row.title])).toEqual([
      ['missed', 'Upper B'],
      ['done', 'Lower A'],
    ]);
    expect(rows[1].volume).toBe('1,000 kg');
    expect(rows[0].meta).toMatch(/ · —$/);
    const many = Array.from({ length: 10 }, (_, index) => ({ id: index, completed_at: `2026-10-${10 + index}T10:00:00Z` }));
    expect(recentWorkoutRows(many, [], 'kg', memberVolume)).toHaveLength(8);
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
    expect(texts(host(tree.root, 'progress-delta'))).toEqual(['↓ 2.4 kg in this range · -4.1 kg to goal (78 kg)']);
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
    expect(queryHost(tree.root, 'progress-delta')[0] && texts(host(tree.root, 'progress-delta'))).toEqual(['-4.1 kg to goal (78 kg)']);
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

  it('Activity without plan data: no Consistency tile, no recent missed rows', async () => {
    loadProgress.mockResolvedValue({ ...DATA, missed: null, recentWorkouts: [] });
    const tree = await render();
    press(tree.root, 'progress-tab-activity');
    expect(queryHost(tree.root, 'progress-completion')).toHaveLength(0);
    expect(queryHost(tree.root, 'progress-recent')).toHaveLength(0);
  });

  it('switch: gold selected segment, 44 tall; Body on mount', async () => {
    const tree = await render();
    expect(host(tree.root, 'progress-tab-body').props.accessibilityState).toEqual({ selected: true });
    expect(flat(host(tree.root, 'progress-tab-body'))).toMatchObject({ backgroundColor: colors.gold, minHeight: 44 });
  });
});

describe('Progress tablet', () => {
  it('H1 + switch row; Goal progress ring 190 + "Add weight" primary; Current 76; To goal gold; no ranges', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(queryHost(tree.root, 'progress-header')).toHaveLength(1);
    expect(getWeightLogsInRange).not.toHaveBeenCalled();
    expect(queryHost(tree.root, 'progress-ranges')).toHaveLength(0);
    expect(tree.root.find((node) => node.props.accessibilityRole === 'progressbar' && node.props.size).props.size).toBe(190);
    expect(tree.root.findAllByType(PillButton).find((button) => button.props.testID === 'progress-add-weight').props.title).toBe('Add weight');
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

  it('tablet at 3.1: the header row stacks', async () => {
    mockWidth = 834;
    mockFontScale = 3.1;
    const tree = await render();
    expect(flat(host(tree.root, 'progress-header')).flexDirection).toBe('column');
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
