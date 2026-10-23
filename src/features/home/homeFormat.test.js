import {
  greetingName,
  quickStats,
  recentWorkoutMeta,
  todayCard,
  validateWeightLog,
  weightCard,
  weightLogBody,
} from './homeFormat';

describe('greetingName (H1.2)', () => {
  it('falls back from first name to the email local part to "there"', () => {
    expect(greetingName({ first_name: '  Arash ' }, 'a@b.c')).toBe('Arash');
    expect(greetingName({ first_name: ' ' }, ' coach@x.com')).toBe('coach');
    expect(greetingName(null, '@x.com')).toBe('there');
  });
});

describe('todayCard (H1.3 + Batch B)', () => {
  const day = { title: 'Push' };
  const miss = (name, title) => ({ weekday: { name }, plan_day: { title } });

  it('puts setup first, then completed, training, missed, rest', () => {
    expect(todayCard({ today_status: { is_workout_day: true } }, 3)).toMatchObject({
      state: 'setup',
      pill: 'Set up',
      headline: 'Pick your training days',
      sub: "Choose the 3 days you'll train each week.",
      primary: 'Choose days',
    });
    expect(todayCard({ today_status: { already_completed: true, plan_day: day } })).toMatchObject({ state: 'completed', headline: 'Push' });
    expect(todayCard({ today_status: { already_completed: true } }).headline).toBe('Workout done');
    expect(todayCard({ today_status: { is_workout_day: true } })).toMatchObject({ state: 'training', headline: 'Workout ready', primary: 'Start workout' });
    expect(todayCard({ today_status: {}, missed_this_week: [miss('Monday', 'Legs')] })).toMatchObject({
      state: 'missed',
      headline: "You missed Monday's Legs",
      primary: 'Do it now',
    });
    expect(todayCard({ today_status: {}, missed_this_week: [miss('Monday')] }).headline).toBe("You missed Monday's workout");
    expect(todayCard({ today_status: { plan_day: day } })).toMatchObject({ state: 'rest', headline: 'Push' });
    expect(todayCard({}).headline).toBe('Recovery day');
  });

  it('counts the extra misses in every state (⚠H-4)', () => {
    const missed = [miss('Monday', 'A'), miss('Tuesday', 'B'), miss('Wednesday', 'C')];
    expect(todayCard({ today_status: { is_workout_day: true }, missed_this_week: missed }).moreMissed).toBe('+2 more missed this week');
    expect(todayCard({ missed_this_week: [miss('Monday', 'A')] }).moreMissed).toBeNull();
  });
});

describe('quick stats, weight and recent workouts', () => {
  it('formats the stats strip and the last workout', () => {
    const stats = quickStats({ quick_stats: { completed_workouts_total: 1234, last_workout_at: '2026-10-21T18:00:00Z' } });
    expect(stats.items.map((item) => item.value)).toEqual(['1,234', '0', '0']);
    expect(stats.lastWorkout).toMatch(/^Last workout Oct 2[01], 2026$/);
    expect(quickStats({}).lastWorkout).toBeNull();
  });

  it('builds the weight card with the profile units (⚠H-5)', () => {
    const profile = { current_weight_unit: 'lb', goal_weight_unit: 'kg' };
    expect(weightCard({ current_weight: 180, goal_progress: { goal_weight: 75, difference_to_goal: -3 } }, profile)).toEqual({
      hasData: true,
      current: '180 lb',
      goal: '75 kg',
      toGoal: '-3 kg',
    });
    expect(weightCard({ goal_progress: { goal_weight: 75, difference_to_goal: 2.5 } }, null)).toMatchObject({ current: '—', toGoal: '+2.5 kg' });
    expect(weightCard({}, null).hasData).toBe(false);
  });

  it('writes the recent workout meta line (⚠H-6)', () => {
    const base = { completed_at: '2026-10-21T18:00:00Z' };
    expect(recentWorkoutMeta({ ...base, duration_seconds: 725, total_volume: 0 })).toMatch(/ · 12m 5s · vol 0$/);
    expect(recentWorkoutMeta({ ...base })).toMatch(/ · —$/);
  });
});

describe('weight log (H2)', () => {
  it('validates in order with JavaScript Number', () => {
    expect(validateWeightLog('  ', 'kg')).toEqual({ field: 'weight_value', message: 'Weight is required' });
    expect(validateWeightLog('83,5', 'kg').message).toBe('Weight must be a positive number');
    expect(validateWeightLog('0', 'kg').message).toBe('Weight must be a positive number');
    expect(validateWeightLog('1e2', '')).toEqual({ field: 'weight_unit', message: 'Weight unit is required' });
    expect(validateWeightLog(' 83 ', 'kg')).toBeNull();
  });

  it('posts the local date and a null note', () => {
    expect(weightLogBody(' 83 ', 'kg', new Date(2026, 9, 22, 23, 30))).toEqual({
      weight_value: 83,
      weight_unit: 'kg',
      recorded_on: '2026-10-22',
      note: null,
    });
  });
});
