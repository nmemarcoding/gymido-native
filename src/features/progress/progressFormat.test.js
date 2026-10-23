import {
  activityStats,
  averageWorkoutDuration,
  barHeight,
  chartLogs,
  completionRate,
  goalCompletion,
  gridRows,
  logCountLabel,
  maxFrequency,
  progressUnit,
  recentLogRows,
  weightStats,
} from './progressFormat';

describe('progressUnit (⚠PR-2)', () => {
  it('uses the newest log unit, else kg', () => {
    expect(progressUnit([{ weight_unit: 'lb' }, { weight_unit: 'kg' }])).toBe('lb');
    expect(progressUnit([{ weight_unit: '' }])).toBe('kg');
    expect(progressUnit([])).toBe('kg');
    expect(progressUnit(undefined)).toBe('kg');
  });
});

describe('weightStats', () => {
  it('formats all three with the same unit, unconverted', () => {
    const stats = weightStats({ current_weight: '80.25', goal_weight: 170, difference_to_goal: -5.5 }, 'kg');
    expect(stats.map((s) => [s.label, s.value])).toEqual([
      ['Current', '80.3 kg'],
      ['Goal', '170 kg'],
      ['To goal', '-5.5 kg'],
    ]);
    expect(weightStats({ difference_to_goal: 2 }, 'kg')[2].value).toBe('+2 kg');
    expect(weightStats(null, 'kg').map((s) => s.value)).toEqual(['—', '—', '—']);
  });
});

describe('goalCompletion (⚠PR-3)', () => {
  it('measures loss from the start towards the goal', () => {
    expect(goalCompletion({ starting_weight: 100, current_weight: 90, goal_weight: 80 })).toBe(50);
    expect(goalCompletion({ starting_weight: '100', current_weight: '75', goal_weight: '80' })).toBe(100);
  });
  it('falls back to current as the start', () => {
    expect(goalCompletion({ starting_weight: null, current_weight: 90, goal_weight: 80 })).toBe(0);
  });
  it('clamps a gain goal to 0 and floors the gap at 1', () => {
    expect(goalCompletion({ starting_weight: 70, current_weight: 72, goal_weight: 80 })).toBe(0);
    expect(goalCompletion({ starting_weight: 80.5, current_weight: 80.2, goal_weight: 80 })).toBeCloseTo(30);
  });
  it('is 0 when goal or current is missing', () => {
    expect(goalCompletion({ current_weight: 90, goal_weight: null })).toBe(0);
    expect(goalCompletion({ current_weight: null, goal_weight: 80 })).toBe(0);
    expect(goalCompletion(null)).toBe(0);
  });
});

describe('activity derived values', () => {
  it('completionRate needs a truthy total', () => {
    expect(completionRate({ total_workouts: 4, completed_workouts: 3 })).toBe(75);
    expect(completionRate({ total_workouts: 0 })).toBeNull();
    expect(completionRate({ total_workouts: 4 })).toBe(0);
    expect(completionRate({ total_workouts: 4, completed_workouts: null })).toBe(0);
    expect(completionRate({ completed_workouts: 3 })).toBeNull();
    expect(completionRate(null)).toBeNull();
  });
  it('averageWorkoutDuration divides by completed workouts (⚠PR-4)', () => {
    expect(averageWorkoutDuration({ total_workouts: 10, completed_workouts: 3, total_duration_seconds: 1000 })).toBe(333);
    expect(averageWorkoutDuration({ completed_workouts: 0, total_duration_seconds: 1000 })).toBeNull();
  });
  it('builds the four stats with "—" rules', () => {
    expect(
      activityStats(
        { current_streak: 3, workouts_completed: 1234 },
        { total_workouts: 3, completed_workouts: 2, total_duration_seconds: 3725 }
      ).map((s) => [s.label, s.value])
    ).toEqual([
      ['Streak', '3'],
      ['Workouts', '1,234'],
      ['Completion', '67%'],
      ['Avg time', '31m 3s'],
    ]);
    expect(activityStats(null, null).map((s) => s.value)).toEqual(['—', '—', '—', '—']);
  });
});

describe('consistency bars', () => {
  it('finds the largest count', () => {
    expect(maxFrequency([{ workout_count: 2 }, { workout_count: 5 }, { workout_count: 0 }])).toBe(5);
    expect(maxFrequency([])).toBe(0);
  });
  it('scales to 52 px with an 8 px floor', () => {
    expect(barHeight(5, 5)).toBe(52);
    expect(barHeight(1, 5)).toBe(10);
    expect(barHeight(0, 5)).toBe(8);
    expect(barHeight(0, 0)).toBe(8);
  });
  it('keeps 12 columns and wraps extra items (⚠PR-6)', () => {
    const items = Array.from({ length: 14 }, (_, i) => i);
    const rows = gridRows(items, 12);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([12, 13, ...Array(10).fill(null)]);
    expect(gridRows([1, 2, 3], 12)[0]).toHaveLength(12);
  });
});

describe('logs', () => {
  const logs = [
    { id: 3, weight_value: '81.0', weight_unit: 'kg', recorded_on: '2026-10-22', note: 'Morning' },
    { id: 2, weight_value: '182', weight_unit: 'lb', recorded_on: '2026-10-20', note: null },
    { id: 1, weight_value: '82', weight_unit: null, recorded_on: '2026-10-18' },
  ];

  it('labels the count pill (⚠PR-5)', () => {
    expect(logCountLabel(1)).toBe('1 log');
    expect(logCountLabel(0)).toBe('0 logs');
    expect(logCountLabel(20)).toBe('20 logs');
  });

  it('reverses for the chart without mutating', () => {
    expect(chartLogs(logs).map((l) => l.id)).toEqual([1, 2, 3]);
    expect(logs[0].id).toBe(3);
  });

  it('shows the newest 5 with shifted dates (⚠PR-8)', () => {
    const rows = recentLogRows([...logs, ...logs].map((l, i) => ({ ...l, id: i })));
    expect(rows).toHaveLength(5);
    const first = recentLogRows(logs);
    expect(first[0]).toEqual({ key: '3', weight: '81 kg', date: expect.any(String), unit: 'kg', note: 'Morning' });
    expect(first[0].date).toMatch(/^Oct (22|23)$/);
    expect(first[2]).toMatchObject({ weight: '82', unit: 'kg', note: null });
  });
});
