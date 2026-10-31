import {
  completionSetsLine,
  completionVolume,
  isFinalTen,
  isRestWarn,
  personalBestLines,
  remainingRatio,
  restHero,
  restNextPreview,
  restTimerLabel,
  restTotalLabel,
  ringCircumference,
  ringDashOffset,
  shareSummaryText,
  spokenRecordLine,
} from './restPresentation';

describe('rest ring maths (UX F2 shared rest rules)', () => {
  it('the 300 ring circumference is 854.5 and the board sample 1:00 of 1:30 → 285', () => {
    expect(ringCircumference(136)).toBeCloseTo(854.5, 0);
    expect(ringDashOffset(60, 90, 136)).toBeCloseTo(284.8, 0);
  });

  it('full at the start, empty at zero, never past a full turn', () => {
    expect(ringDashOffset(90, 90, 136)).toBe(0);
    expect(ringDashOffset(0, 90, 136)).toBeCloseTo(854.5, 0);
    expect(remainingRatio(120, 90)).toBe(1);
    expect(remainingRatio(-3, 90)).toBe(0);
    expect(remainingRatio(5, 0)).toBe(0);
    expect(remainingRatio(5, undefined)).toBe(0);
  });

  it('the mini disc sample: 47 of 90 on r40 → offset ≈ 119.6', () => {
    expect(ringDashOffset(47, 90, 40)).toBeCloseTo(120, 0);
  });

  it('last 10 s is 0 < s ≤ 10', () => {
    expect(isFinalTen(11)).toBe(false);
    expect(isFinalTen(10)).toBe(true);
    expect(isFinalTen(1)).toBe(true);
    expect(isFinalTen(0)).toBe(false);
  });

  it('"of m:ss" = the total', () => {
    expect(restTotalLabel(90)).toBe('of 1:30');
    expect(restTotalLabel(95)).toBe('of 1:35');
    expect(restTotalLabel(8)).toBe('of 0:08');
    expect(restTotalLabel(undefined)).toBe('of 0:00');
  });
});

describe('restNextPreview (U4)', () => {
  const session = {
    exercises: [
      { id: 1, exercise_name_snapshot: 'Squat', sets: [{ id: 11, set_number: 1, target_reps_min: 5, target_reps_max: 5 }] },
      {
        id: 2,
        exercise_name_snapshot: 'Barbell Bench Press',
        exercise: { id: 9, name: 'Bench', thumbnail: { url: 'https://example.com/b.jpg' } },
        sets: [
          { id: 21, target_reps_min: 8, target_reps_max: 10 },
          { id: 22, target_reps_min: 8, target_reps_max: 10, target_weight_unit: 'kg' },
          { id: 23, set_number: 3, target_reps_min: 8, target_reps_max: 10 },
        ],
      },
    ],
  };

  it('names the exercise and the set line with the draft weight', () => {
    expect(restNextPreview(session, '2:23', { 23: { actualWeightValue: '135', actualWeightUnit: 'lb' } })).toEqual({
      exerciseName: 'Barbell Bench Press',
      exercise: session.exercises[1].exercise,
      line: 'Set 3 · 8–10 reps · 135 lb',
    });
  });

  it('numbers the set by position when set_number is missing; comma decimals read', () => {
    expect(restNextPreview(session, '2:22', { 22: { actualWeightValue: '22,5', actualWeightUnit: '' } }).line).toBe('Set 2 · 8–10 reps · 22.5 kg');
  });

  it('drops the weight part when none is known (blank or junk)', () => {
    expect(restNextPreview(session, '2:21', {}).line).toBe('Set 1 · 8–10 reps');
    expect(restNextPreview(session, '2:21', { 21: { actualWeightValue: 'abc' } }).line).toBe('Set 1 · 8–10 reps');
    expect(restNextPreview(session, '1:11', null)).toEqual({ exerciseName: 'Squat', exercise: null, line: 'Set 1 · 5 reps' });
  });

  // Review M3 (web nextSetLabel setEditorUtils.js:101-109): the weight part only when > 0.
  it('M3: a 0 (or negative) weight is not shown ("0 lb" never reads on a bodyweight set)', () => {
    expect(restNextPreview(session, '2:21', { 21: { actualWeightValue: '0', actualWeightUnit: 'lb' } }).line).toBe('Set 1 · 8–10 reps');
    expect(restNextPreview(session, '2:21', { 21: { actualWeightValue: 0 } }).line).toBe('Set 1 · 8–10 reps');
    expect(restNextPreview(session, '2:21', { 21: { actualWeightValue: '-5' } }).line).toBe('Set 1 · 8–10 reps');
    expect(restNextPreview(session, '2:21', { 21: { actualWeightValue: '0.5', actualWeightUnit: 'kg' } }).line).toBe('Set 1 · 8–10 reps · 0.5 kg');
  });

  it('LOW: with no draft unit the set\'s actual_weight_unit comes before the target unit', () => {
    const withActual = { exercises: [{ id: 3, exercise_name_snapshot: 'Row', sets: [{ id: 31, set_number: 1, target_reps_min: 8, actual_weight_unit: 'kg', target_weight_unit: 'lb' }] }] };
    expect(restNextPreview(withActual, '3:31', { 31: { actualWeightValue: '40' } }).line).toBe('Set 1 · 8 reps · 40 kg');
  });

  it('no next set (the last set) or an unknown key → null', () => {
    expect(restNextPreview(session, '', {})).toBeNull();
    expect(restNextPreview(session, '9:99', {})).toBeNull();
    expect(restNextPreview(null, '2:21', {})).toBeNull();
  });
});

describe('personalBestLines (#15)', () => {
  const weight = (id, name, value, previous, extra = {}) => ({ exercise_id: id, exercise_name: name, record_type: 'weight', value, unit: 'lb', previous_value: previous, ...extra });
  const reps = (id, name, value, previous) => ({ exercise_id: id, exercise_name: name, record_type: 'reps', value, unit: '', previous_value: previous });

  it('shows only beaten bests (previous_value != null)', () => {
    expect(personalBestLines([weight(1, 'Bench', 145, null), reps(2, 'Push-up', 30, null)])).toEqual([]);
    expect(personalBestLines([weight(1, 'Bench', 145, 140)]).map((l) => l.text)).toEqual(['Bench · 145 lb']);
  });

  // Web parity (PersonalBestCard.jsx:11-33, PM 27 Oct): "× r" comes from the
  // same exercise's beaten reps record in the same list, never from a field.
  it('one line per exercise, the weight record wins; "× r" from the same exercise\'s beaten reps record', () => {
    const lines = personalBestLines([reps(1, 'Bench', 12, 10), weight(1, 'Bench', 145, 140)]);
    expect(lines.map((l) => l.text)).toEqual(['Bench · 145 lb × 12']);
  });

  it('no "× r" without a beaten reps record for that exercise (an unbeaten one or a `reps` field doesn\'t count)', () => {
    expect(personalBestLines([reps(1, 'Bench', 12, null), weight(1, 'Bench', 145, 140)]).map((l) => l.text)).toEqual(['Bench · 145 lb']);
    expect(personalBestLines([weight(1, 'Bench', 145, 140, { reps: 8 })]).map((l) => l.text)).toEqual(['Bench · 145 lb']);
    expect(personalBestLines([reps(2, 'Squat', 12, 10), weight(1, 'Bench', 145, 140)]).map((l) => l.text)).toEqual(['Bench · 145 lb', 'Squat · 12 reps']);
  });

  it('a reps-only record reads "{r} reps"; previous_value 0 counts as a previous best', () => {
    expect(personalBestLines([reps(3, 'Pull-up', 12, 0)]).map((l) => l.text)).toEqual(['Pull-up · 12 reps']);
  });

  it('weight first, at most 3 lines', () => {
    const lines = personalBestLines([
      reps(1, 'A', 10, 9),
      weight(2, 'B', 100, 90),
      reps(3, 'C', 10, 9),
      weight(4, 'D', 60.5, 60),
      reps(5, 'E', 10, 9),
    ]);
    expect(lines.map((l) => l.text)).toEqual(['B · 100 lb', 'D · 60.5 lb', 'A · 10 reps']);
  });

  it('ignores junk and non-arrays (no card)', () => {
    expect(personalBestLines(undefined)).toEqual([]);
    expect(personalBestLines(null)).toEqual([]);
    expect(personalBestLines([null, { record_type: 'volume', value: 1, previous_value: 0 }, weight(1, 'X', null, 1)])).toEqual([]);
  });

  it('spoken form: "145 pounds times 8"', () => {
    expect(spokenRecordLine('Barbell Bench Press · 145 lb × 8')).toBe('Barbell Bench Press, 145 pounds times 8');
    expect(spokenRecordLine('Squat · 100 kg')).toBe('Squat, 100 kilograms');
  });
});

describe('completion text (U6, VOLUME RULE)', () => {
  const popup = { planName: 'Upper / Lower', durationSeconds: 3130, totalVolume: 9820, totalReps: 142, completedSets: 15, totalSets: 15, completedExercises: 5, totalExercises: 5 };

  // DECLARED parity change (PM-approved, web facts batch 3 (a)): no unit → kg, never v1 "lb".
  it('volume in the snapshot unit, else kg (web parity, never "lb")', () => {
    expect(completionVolume(popup)).toBe('9,820 kg');
    expect(completionVolume({ ...popup, volumeUnit: 'kg', totalVolume: 4454.4 })).toBe('4,454 kg');
    expect(completionVolume({ ...popup, volumeUnit: 'lb' })).toBe('9,820 lb');
    expect(completionVolume({ ...popup, volumeUnit: '' })).toBe('9,820 kg');
    expect(completionVolume(null)).toBe('0 kg');
  });

  it('share summary text', () => {
    expect(shareSummaryText(popup, [{ text: 'Bench · 145 lb × 8' }])).toBe(
      ['Workout complete: Upper / Lower', 'Time: 52m 10s', 'Volume: 9,820 kg', 'Reps: 142', 'Sets: 15/15', 'New personal best: Bench · 145 lb × 8'].join('\n')
    );
    expect(shareSummaryText({ ...popup, planName: '' })).toMatch(/^Workout complete: Workout\n/);
  });

  it('sets line, singular at 1', () => {
    expect(completionSetsLine(popup)).toBe('15/15 sets done. Consistency wins.');
    expect(completionSetsLine({ completedSets: 1, totalSets: 1 })).toBe('1/1 set done. Consistency wins.');
  });
});

describe('T-146 rest rules', () => {
  it('isRestWarn: the last 5 s, only for a rest ≥ 10 s', () => {
    expect(isRestWarn(5, 90)).toBe(true);
    expect(isRestWarn(1, 10)).toBe(true);
    expect(isRestWarn(6, 90)).toBe(false);
    expect(isRestWarn(0, 90)).toBe(false);
    expect(isRestWarn(5, 9)).toBe(false);
  });

  // DECLARED (T-153 §2, PM-approved): "Rest, … left" (was "Resting, … left").
  it('restTimerLabel: minutes and seconds, singular at 1', () => {
    expect(restTimerLabel(108)).toBe('Rest, 1 minute 48 seconds left');
    expect(restTimerLabel(120)).toBe('Rest, 2 minutes left');
    expect(restTimerLabel(4)).toBe('Rest, 4 seconds left');
    expect(restTimerLabel(1)).toBe('Rest, 1 second left');
    expect(restTimerLabel(0)).toBe('Rest, 0 seconds left');
  });

  describe('restHero', () => {
    const photo = { thumbnail: { url: 'https://example.com/leg.jpg' } };
    const SESSION = {
      exercises: [
        { id: 1, exercise_name_snapshot: 'Leg Press', exercise: photo, sets: [{ id: 11, is_completed: true }, { id: 12 }, { id: 13 }, { id: 14 }] },
        { id: 2, exercise_name_snapshot: 'Seated Leg Curl', exercise: null, sets: [{ id: 21 }] },
      ],
    };

    it('mid-exercise: that exercise\'s photo and name; left counts the set just done (overlay not landed yet)', () => {
      expect(restHero(SESSION, 12, '1:13')).toEqual({ mode: 'mid', name: 'Leg Press', exercise: photo, left: 2 });
    });

    it('after the exercise\'s last set: the NEXT exercise\'s photo and name', () => {
      const done = { exercises: [{ ...SESSION.exercises[0], sets: SESSION.exercises[0].sets.map((set) => ({ ...set, is_completed: set.id !== 14 })) }, SESSION.exercises[1]] };
      expect(restHero(done, 14, '2:21')).toEqual({ mode: 'next', name: 'Seated Leg Curl', exercise: null, left: 0 });
    });

    it('an unknown set → null; no next set stays mid (never below 0 left)', () => {
      expect(restHero(SESSION, 99, '1:13')).toBeNull();
      expect(restHero({ exercises: [{ ...SESSION.exercises[1], sets: [{ id: 21, is_completed: true }] }] }, 21, '')).toMatchObject({ mode: 'mid', left: 0 });
    });
  });
});
