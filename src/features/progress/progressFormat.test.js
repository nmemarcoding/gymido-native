import { profileAfterWeightLog } from '../profile/profileStore';
import {
  activityStats,
  averageWorkoutDuration,
  barHeight,
  chartLogs,
  completionRate,
  convertWeight,
  goalCompletion,
  gridRows,
  logCountLabel,
  maxFrequency,
  progressUnit,
  recentLogRows,
  weightStats,
  weightUnits,
} from './progressFormat';

describe('progressUnit (⚠PR-2)', () => {
  it('uses the newest log unit, else kg', () => {
    expect(progressUnit([{ weight_unit: 'lb' }, { weight_unit: 'kg' }])).toBe('lb');
    expect(progressUnit([{ weight_unit: '' }])).toBe('kg');
    expect(progressUnit([])).toBe('kg');
    expect(progressUnit(undefined)).toBe('kg');
  });
});

describe('weightUnits (T-34)', () => {
  it("uses the profile's current unit only when it has a current weight, else the newest log's", () => {
    const logs = [{ weight_unit: 'kg' }];
    expect(weightUnits({ current_weight_value: 170, current_weight_unit: 'lb', goal_weight_unit: 'kg' }, logs)).toEqual({ current: 'lb', goal: 'kg' });
    expect(weightUnits({ current_weight_value: null, current_weight_unit: 'lb', goal_weight_unit: 'lb' }, logs)).toEqual({ current: 'kg', goal: 'lb' });
    expect(weightUnits({ current_weight_value: 80, current_weight_unit: '' }, [{ weight_unit: 'lb' }])).toEqual({ current: 'lb', goal: 'lb' });
  });

  it('falls back to the current unit for the goal, and to kg without logs', () => {
    expect(weightUnits({ current_weight_value: 80, current_weight_unit: 'kg' }, [])).toEqual({ current: 'kg', goal: 'kg' });
    expect(weightUnits(null, [])).toEqual({ current: 'kg', goal: 'kg' });
  });
});

describe('weightStats (T-34)', () => {
  it('labels Current with the current unit and Goal and To goal with the goal unit, unconverted', () => {
    const stats = weightStats({ current_weight: 170, goal_weight: 75, difference_to_goal: 2.1 }, { current: 'lb', goal: 'kg' });
    expect(stats.map((s) => [s.label, s.value])).toEqual([
      ['Current', '170 lb'],
      ['Goal', '75 kg'],
      ['To goal', '+2.1 kg'],
    ]);
    const same = { current: 'kg', goal: 'kg' };
    expect(weightStats({ current_weight: '80.25', goal_weight: 170, difference_to_goal: -5.5 }, same).map((s) => s.value)).toEqual(['80.3 kg', '170 kg', '-5.5 kg']);
    expect(weightStats(null, same).map((s) => s.value)).toEqual(['—', '—', '—']);
  });
});

describe('profileAfterWeightLog (T-34 F1)', () => {
  it('patches the current weight + unit from the saved log, so Current keeps its unit', () => {
    const profile = { current_weight_value: 80, current_weight_unit: 'kg', goal_weight_unit: 'kg', first_name: 'QA' };
    const patched = profileAfterWeightLog(profile, { weight_log: { id: 9, weight_value: 170, weight_unit: 'lb' } });
    expect(patched).toEqual({ ...profile, current_weight_value: 170, current_weight_unit: 'lb' });
    const units = weightUnits(patched, [{ weight_unit: 'lb' }]);
    const stats = weightStats({ current_weight: 170, goal_weight: 75, difference_to_goal: -2.1 }, units);
    expect(stats.map((s) => s.value)).toEqual(['170 lb', '75 kg', '-2.1 kg']);
  });

  it('leaves the store alone without a profile or without both saved fields', () => {
    expect(profileAfterWeightLog(null, { weight_log: { weight_value: 170, weight_unit: 'lb' } })).toBeNull();
    expect(profileAfterWeightLog({ current_weight_unit: 'kg' }, { weight_log: { weight_value: 170 } })).toBeNull();
    expect(profileAfterWeightLog({ current_weight_unit: 'kg' }, { weight_log: { weight_unit: 'lb' } })).toBeNull();
    expect(profileAfterWeightLog({ current_weight_unit: 'kg' }, undefined)).toBeNull();
  });
});

describe('convertWeight', () => {
  it('converts between lb and kg and leaves same or unknown units alone', () => {
    expect(convertWeight(100, 'lb', 'kg')).toBeCloseTo(45.359237);
    expect(convertWeight(45.359237, 'kg', 'lb')).toBeCloseTo(100);
    expect(convertWeight('80', 'kg', 'kg')).toBe(80);
    expect(convertWeight(80, undefined, 'kg')).toBe(80);
    expect(convertWeight(80, 'st', 'kg')).toBe(80);
    expect(convertWeight(80, 'lb', 'st')).toBe(80);
  });
});

describe('goalCompletion (⚠PR-3)', () => {
  it('works in the current unit, with start = current − total_change (T-34)', () => {
    // RN-SPEC-progress PR1.2 example: 170 lb, total_change −10 (start 180 lb), goal 75 kg = 165.35 lb → 10 / 14.65.
    const units = { current: 'lb', goal: 'kg' };
    expect(goalCompletion({ current_weight: 170, total_change: -10, goal_weight: 75, starting_weight: 85 }, units)).toBeCloseTo(68.26, 1);
    expect(goalCompletion({ current_weight: '170', total_change: '-10', goal_weight: '75' }, units)).toBeCloseTo(68.26, 1);
    // total_change wins over starting_weight (which is in the earliest log's unit).
    expect(goalCompletion({ current_weight: 90, total_change: -10, goal_weight: 80, starting_weight: 220 }, { current: 'kg', goal: 'kg' })).toBe(50);
    // total_change 0 is present: no progress yet.
    expect(goalCompletion({ current_weight: 90, total_change: 0, goal_weight: 80, starting_weight: 100 }, { current: 'kg', goal: 'kg' })).toBe(0);
  });

  it('keeps the max(1, …) floor in the current unit (T-34)', () => {
    // start 80.5 lb, current 80.2 lb, goal 36.4 kg = 80.25 lb: gap 0.25 → floored to 1 → 30%.
    expect(goalCompletion({ current_weight: 80.2, total_change: -0.3, goal_weight: 36.4 }, { current: 'lb', goal: 'kg' })).toBeCloseTo(30);
  });
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
