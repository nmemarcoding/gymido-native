import {
  applyOverlay,
  buildSetPatch,
  centeredScrollOffset,
  completionSnapshot,
  createPendingSets,
  draftFromSavedSet,
  firstPendingSetKey,
  muscleGroups,
  nextSetKeyAfter,
  orderedSets,
  propagateDraft,
  reconcileOverlay,
  seedDrafts,
  sessionProgress,
  sessionViewState,
  setMetaLabel,
  setRepsLabel,
  setsWord,
  staleSessionTitle,
  parseWeight,
  validateDraftWeight,
  convertWeight,
  doneSetLabel,
  elapsedSpokenLabel,
  formatClock,
  lastTimeLabel,
  lastTimeWeight,
  memberWeightUnit,
  parseReps,
  previousSetFor,
  repsFieldLabel,
  repsPrefill,
  roundForUnit,
  sanitizeReps,
  seedRepsDrafts,
  segmentLabel,
  setOfLabel,
  setVolumeKg,
  stageEyebrow,
  stepReps,
  stepWeight,
  tabletEyebrow,
  targetRange,
  volumeInUnit,
} from './sessionMath';

const set = (id, extra = {}) => ({ id, set_number: id, is_completed: false, ...extra });
const session = {
  id: 9,
  started_at: '2026-10-22T10:00:00Z',
  exercises: [
    {
      id: 1,
      exercise: { id: 50, primary_muscle_group: { name: 'Chest' } },
      sets: [set(11, { is_completed: true, actual_reps: 10, actual_weight_value: 50 }), set(12, { target_reps_max: 10 })],
    },
    { id: 2, exercise: { id: 51, primary_muscle_group: { name: 'Back' } }, sets: [set(21), set(22)] },
    { id: 3, exercise: { id: 52, primary_muscle_group: { name: 'Chest' } }, sets: [] },
  ],
};

describe('O12 overlay', () => {
  it('renders confirmed writes and reconciles them after a reload', () => {
    const overlay = { 12: { fields: { is_completed: true }, seq: 1 }, 21: { fields: { is_completed: true }, seq: 2 } };
    const view = applyOverlay(session, overlay);
    expect(view.exercises[0].sets[1].is_completed).toBe(true);
    expect(sessionProgress(view).completedSets).toBe(3);

    // A reload started after write 1 answers it (server still says pending → contradiction) and keeps write 2.
    expect(reconcileOverlay(session, overlay, 1)).toEqual({ kept: { 21: overlay[21] }, contradicted: true });
    const agreed = applyOverlay(session, { 12: { fields: { is_completed: true }, seq: 1 } });
    expect(reconcileOverlay(agreed, { 12: { fields: { is_completed: true }, seq: 1 } }, 1)).toEqual({ kept: {}, contradicted: false });
  });
});

describe('progress and next set (§26)', () => {
  it('totals sets, reps and unit-blind volume (⚠W15)', () => {
    expect(sessionProgress(session)).toMatchObject({
      totalSets: 4,
      completedSets: 1,
      completedExercises: 0,
      totalExercises: 3,
      actualReps: 10,
      liveVolume: 500,
      activeExerciseIndex: 0,
    });
  });

  it('finds the next pending set across the whole session', () => {
    const ordered = orderedSets(session);
    expect(nextSetKeyAfter(ordered, 12)).toBe('2:21');
    expect(nextSetKeyAfter(ordered.map((item) => ({ ...item, isCompleted: true })), 12)).toBe('');
  });
});

describe('drafts (§20.2–§20.3)', () => {
  it('seeds from actual, target, then the last logged weight, keeping existing drafts', () => {
    const drafts = seedDrafts(session, { 51: { value: 40, unit: 'kg' } }, { 12: { actualWeightValue: '77', actualWeightUnit: 'lb' } });
    expect(drafts[11]).toEqual({ actualWeightValue: 50, actualWeightUnit: 'lb' });
    expect(drafts[12]).toEqual({ actualWeightValue: '77', actualWeightUnit: 'lb' });
    expect(drafts[21]).toEqual({ actualWeightValue: 40, actualWeightUnit: 'kg' });
    expect(seedDrafts({ exercises: [] }, {}, { 1: {} })).toEqual({});
  });

  it('seeds a completed set with only its saved weight (T-16)', () => {
    const done = { exercises: [{ id: 1, exercise: { id: 50 }, sets: [set(31, { is_completed: true, target_weight_value: 60 })] }] };
    expect(seedDrafts(done, { 50: { value: 40, unit: 'kg' } }, {})[31]).toEqual({ actualWeightValue: '', actualWeightUnit: 'kg' });
  });

  // Final audit (27 Oct, PM priority): a BODYWEIGHT set ("Bodyweight Squat",
  // target weight 0) was seeded "0" (`??` keeps 0), so "Did it" said "Weight
  // must be greater than 0." and the set could not be logged. Weight is
  // optional on every set (T-16): a 0 or non-positive seed means no weight.
  it('a 0 / non-positive target, saved or last weight seeds NO weight, so a bodyweight set logs', () => {
    const bodyweight = {
      exercises: [
        { id: 1, exercise: { id: 60 }, sets: [set(41, { target_weight_value: 0 }), set(42, { actual_weight_value: 0, target_weight_value: 20 }), set(43, { target_weight_value: -5 })] },
        { id: 2, exercise: { id: 61 }, sets: [set(51)] },
      ],
    };
    const drafts = seedDrafts(bodyweight, { 61: { value: 0, unit: 'kg' } }, {});
    [41, 43, 51].forEach((id) => {
      expect(drafts[id].actualWeightValue).toBe('');
      expect(validateDraftWeight(drafts[id].actualWeightValue)).toBeNull();
    });
    // A non-positive value counts as missing at each step of §20.2's chain.
    expect(drafts[42].actualWeightValue).toBe(20);
    // API decimals may come as strings: "0.00" is no weight, "50.00" seeds as sent.
    const strings = seedDrafts({ exercises: [{ id: 4, exercise: { id: 63 }, sets: [set(71, { target_weight_value: '0.00' }), set(72, { target_weight_value: '50.00' })] }] }, {}, {});
    expect(strings[71].actualWeightValue).toBe('');
    expect(strings[72].actualWeightValue).toBe('50.00');
    // A real target still seeds.
    expect(seedDrafts({ exercises: [{ id: 3, exercise: { id: 62 }, sets: [set(61, { target_weight_value: 12.5 })] }] }, {}, {})[61].actualWeightValue).toBe(12.5);
  });

  it('a typed 0 is still refused (§21.1: a typed weight must be > 0)', () => {
    expect(validateDraftWeight('0')).toBe('Weight must be greater than 0.');
  });

  it('writes an edit to the set and every later set of the exercise (⚠W19)', () => {
    const exercise = session.exercises[1];
    const next = propagateDraft({ 21: { actualWeightValue: 1 }, 22: { actualWeightValue: 2 } }, exercise, 21, 'actualWeightValue', '60');
    expect(next[21].actualWeightValue).toBe('60');
    expect(next[22].actualWeightValue).toBe('60');
    expect(propagateDraft({ 21: {}, 22: {} }, exercise, 22, 'actualWeightUnit', 'kg')[21]).toEqual({});
  });
});

describe('set toggle (§20.4, §21.1)', () => {
  it('validates the weight on completion', () => {
    expect(validateDraftWeight('0')).toBe('Weight must be greater than 0.');
    expect(validateDraftWeight('abc')).toBe('Weight must be greater than 0.');
    expect(validateDraftWeight('20')).toBeNull();
  });

  it('completes with no weight when the draft is blank (T-16)', () => {
    for (const blank of ['', '   ', null, undefined]) {
      expect(validateDraftWeight(blank)).toBeNull();
    }
    expect(buildSetPatch(set(12), { actualWeightValue: '  ', actualWeightUnit: 'kg' }, new Date('2026-10-25T10:00:00Z'))).toMatchObject({
      actual_weight_value: null,
      actual_weight_unit: null,
      is_completed: true,
    });
  });

  it('takes the saved weight after "Did it" (T-16)', () => {
    expect(draftFromSavedSet({ actual_weight_value: 80, actual_weight_unit: 'kg' }, 'lb')).toEqual({ actualWeightValue: 80, actualWeightUnit: 'kg' });
    expect(draftFromSavedSet({ actual_weight_value: null, actual_weight_unit: null }, 'lb')).toEqual({ actualWeightValue: '', actualWeightUnit: 'lb' });
  });

  it('sends target reps, the device time and a null unit without weight', () => {
    const now = new Date('2026-10-22T10:05:00Z');
    expect(buildSetPatch(set(12, { target_reps_max: 10, target_reps_min: 8, rest_seconds_planned: 90 }), { actualWeightValue: '50', actualWeightUnit: 'kg' }, now)).toEqual({
      actual_reps: 10,
      actual_weight_value: 50,
      actual_weight_unit: 'kg',
      rest_seconds_actual: 90,
      is_completed: true,
      completed_at: '2026-10-22T10:05:00.000Z',
    });
    expect(buildSetPatch(set(11, { is_completed: true, actual_reps: 10 }), { actualWeightValue: '' }, now)).toMatchObject({
      actual_reps: 10,
      actual_weight_value: null,
      actual_weight_unit: null,
      is_completed: false,
      completed_at: null,
    });
  });
});

describe('comma decimal weights (W3)', () => {
  it('reads a comma as the decimal mark', () => {
    expect(parseWeight('22,5')).toBe(22.5);
    expect(parseWeight('22.5')).toBe(22.5);
    expect(parseWeight(40)).toBe(40);
    expect(parseWeight('1,2,3')).toBeNaN();
    expect(parseWeight('')).toBeNaN();
    expect(validateDraftWeight('22,5')).toBeNull();
    expect(validateDraftWeight('0,0')).toBe('Weight must be greater than 0.');
    expect(validateDraftWeight('1e2')).toBe('Weight must be greater than 0.');
    expect(validateDraftWeight('8,5,1')).toBe('Weight must be greater than 0.');
  });

  it('sends 22.5 for "22,5"', () => {
    const patch = buildSetPatch(set(3), { actualWeightValue: '22,5', actualWeightUnit: 'kg' }, new Date('2026-10-22T10:05:00Z'));
    expect(patch).toMatchObject({ actual_weight_value: 22.5, actual_weight_unit: 'kg' });
  });
});

describe('createPendingSets (double tap on "Did it")', () => {
  it('ignores a second begin for a pending set and tracks sets independently', () => {
    const pending = createPendingSets();
    expect(pending.begin(1)).toBe(true);
    expect(pending.begin(1)).toBe(false);
    expect(pending.begin(2)).toBe(true);
    pending.end(1);
    // Set 2 stays pending when set 1 finishes (M4).
    expect([...pending.snapshot()]).toEqual([2]);
    expect(pending.begin(1)).toBe(true);
  });
});

describe('labels', () => {
  it('writes the reps and meta lines', () => {
    expect(setRepsLabel({ target_reps_min: 8, target_reps_max: 12 })).toBe('8–12 reps');
    expect(setRepsLabel({ target_reps_min: 12, target_reps_max: 12 })).toBe('12 reps');
    expect(setRepsLabel({})).toBe('0 reps');
    expect(setMetaLabel({ rest_seconds_planned: 90 }, true)).toBe('Rest 90s · Up next');
    expect(setsWord(1)).toBe('set');
    expect(setsWord(0)).toBe('sets');
  });

  it('lists muscle groups in first-appearance order', () => {
    expect(muscleGroups(session)).toEqual(['Chest', 'Back']);
  });

  it('titles a stale session from another local day (O8)', () => {
    const now = new Date(2026, 8, 23, 9);
    expect(staleSessionTitle(new Date(2026, 8, 21, 18).toISOString(), now)).toBe('Started Monday, Sep 21');
    expect(staleSessionTitle(new Date(2026, 8, 23, 7).toISOString(), now)).toBeNull();
  });

  it('snapshots the popup before completing', () => {
    // v2 VOLUME RULE (PM, 27 Oct): kg first (50 lb × 10, no saved unit → lb),
    // shown in the member's unit (default kg).
    const snapshot = completionSnapshot(session, '', 125);
    expect(snapshot).toMatchObject({ planName: 'Workout', durationSeconds: 125, totalReps: 10, completedSets: 1, totalSets: 4, volumeUnit: 'kg' });
    expect(snapshot.totalVolume).toBeCloseTo(500 / 2.20462, 5);
    expect(completionSnapshot(session, '', 125, 'lb').totalVolume).toBeCloseTo(500, 5);
  });
});

describe('viewed-exercise "next" set (O12 firstPendingSetId, §19.3)', () => {
  it('is the first pending set of the VIEWED exercise, so a later exercise can be started out of order', () => {
    const later = { id: 2, sets: [{ id: 21, is_completed: false }, { id: 22, is_completed: false }] };
    expect(firstPendingSetKey(later)).toBe('2:21');
    expect(firstPendingSetKey({ id: 1, sets: [{ id: 11, is_completed: true }, { id: 12, is_completed: false }] })).toBe('1:12');
    expect(firstPendingSetKey({ id: 1, sets: [{ id: 11, is_completed: true }] })).toBe('');
    expect(firstPendingSetKey(undefined)).toBe('');
  });
});

describe('sessionViewState (§19 / §19.2 / §19.5, web parity)', () => {
  const ex = (done) => ({ sets: done.map((d, i) => ({ id: i, is_completed: d })) });
  const exercises = [ex([true, true]), ex([true, false]), ex([false])];

  it('"Last exercise — finish strong" only while viewing the active exercise (#29)', () => {
    const last = [ex([true]), ex([false])];
    expect(sessionViewState(last, 1, 1).isLastIncomplete).toBe(true);
    expect(sessionViewState(last, 0, 1).isLastIncomplete).toBe(false);
    expect(sessionViewState(exercises, 1, 1).isLastIncomplete).toBe(false);
    expect(sessionViewState(exercises, 1, 1).laterIncomplete).toBe(2);
  });

  it('with every set done the last exercise counts as active (#30), and never "finish strong"', () => {
    const done = [ex([true]), ex([true]), ex([true])];
    expect(sessionViewState(done, 2, -1)).toMatchObject({ currentIndex: 2, isActiveView: true, isLastIncomplete: false, laterIncomplete: -1 });
    expect(sessionViewState(done, 0, -1).isActiveView).toBe(false);
  });
});

describe('centeredScrollOffset (§22.3)', () => {
  it('centres the row and clamps to [0, content − visible]', () => {
    expect(centeredScrollOffset({ rowY: 500, rowHeight: 100, visibleHeight: 400, contentHeight: 2000 })).toBe(350);
    expect(centeredScrollOffset({ rowY: 20, rowHeight: 100, visibleHeight: 400, contentHeight: 2000 })).toBe(0);
    expect(centeredScrollOffset({ rowY: 1900, rowHeight: 100, visibleHeight: 400, contentHeight: 2000 })).toBe(1600);
    expect(centeredScrollOffset({ rowY: 100, rowHeight: 100, visibleHeight: 400, contentHeight: 300 })).toBe(0);
  });

  it('does nothing while the viewport is unmeasured', () => {
    expect(centeredScrollOffset({ rowY: 500, rowHeight: 100, visibleHeight: 0, contentHeight: 2000 })).toBeNull();
  });
});

describe('v2 F1 weight stepper (ND1)', () => {
  it('steps ±5 lb / ±2.5 kg, keeps decimals and never shows float noise', () => {
    expect(stepWeight('135', 'lb', 1)).toBe('140');
    expect(stepWeight('82,5', 'kg', 1)).toBe('85');
    expect(stepWeight('0.1', 'kg', 1)).toBe('2.6');
    expect(stepWeight('20', 'kg', -1)).toBe('17.5');
  });

  it('an empty field starts from the Last time weight, else 0 (first + = one step)', () => {
    expect(stepWeight('', 'lb', 1)).toBe('5');
    expect(stepWeight('', 'kg', 1)).toBe('2.5');
    expect(stepWeight('', 'lb', 1, 135)).toBe('140');
    expect(stepWeight('abc', 'lb', 1, 135)).toBe('140');
    expect(stepWeight('', 'lb', -1, 135)).toBe('130');
  });

  it('"−" at or below one step clears the field (never 0)', () => {
    expect(stepWeight('5', 'lb', -1)).toBe('');
    expect(stepWeight('4', 'lb', -1)).toBe('');
    expect(stepWeight('2.5', 'kg', -1)).toBe('');
    expect(stepWeight('', 'kg', -1)).toBe('');
  });
});

describe('v2 F1 reps (ND2)', () => {
  it('typed reps keep digits only, 1–99', () => {
    expect(sanitizeReps('1a2')).toBe('12');
    expect(sanitizeReps('007')).toBe('7');
    expect(sanitizeReps('0')).toBe('');
    expect(sanitizeReps('150')).toBe('99');
    expect(sanitizeReps('-3')).toBe('3');
    expect(sanitizeReps(null)).toBe('');
  });

  it('parses only integers 1–99', () => {
    expect(parseReps('10')).toBe(10);
    expect(parseReps('')).toBeNull();
    expect(parseReps('0')).toBeNull();
    expect(parseReps('100')).toBeNull();
    expect(parseReps(undefined)).toBeNull();
  });

  it('steps ±1 within 1–99; − on a blank stays blank', () => {
    expect(stepReps('10', 1)).toBe('11');
    expect(stepReps('99', 1)).toBe('99');
    expect(stepReps('1', -1)).toBe('1');
    expect(stepReps('', 1)).toBe('1');
    expect(stepReps('', -1)).toBe('');
  });

  // Batch 3 (b), web parity: a blank field steps from the target (max ?? min).
  it('blank field: ± steps from target_reps_max ?? target_reps_min (+ on blank 8–10 → 11, − → 9)', () => {
    expect(stepReps('', 1, 10)).toBe('11');
    expect(stepReps('', -1, 10)).toBe('9');
    expect(stepReps('', 1, 12)).toBe('13');
    expect(stepReps('', 1, 99)).toBe('99');
    expect(stepReps('', -1, 1)).toBe('1');
    expect(stepReps('', 1, null)).toBe('1');
    expect(stepReps('', -1, null)).toBe('');
    expect(stepReps('', -1, 0)).toBe('');
    expect(stepReps('6', 1, 10)).toBe('7');
    expect(stepReps('6', -1, 10)).toBe('5');
  });

  it('prefill: the set\'s own Last time reps, else the top of the target, else blank; a done set shows its reps', () => {
    expect(repsPrefill({ target_reps_min: 8, target_reps_max: 10 }, { reps: 6 })).toBe('6');
    expect(repsPrefill({ target_reps_min: 8, target_reps_max: 10 }, null)).toBe('10');
    expect(repsPrefill({ target_reps_min: 12 }, null)).toBe('12');
    expect(repsPrefill({}, null)).toBe('');
    expect(repsPrefill({ is_completed: true, actual_reps: 9, target_reps_max: 10 }, { reps: 6 })).toBe('9');
  });

  it('prefill target is target_reps_max ?? target_reps_min (batch 3 (b))', () => {
    expect(repsPrefill({ target_reps_max: 10 }, null)).toBe('10');
    expect(repsPrefill({ target_reps_min: 8, target_reps_max: null }, null)).toBe('8');
    expect(repsPrefill({ target_reps_min: 8, target_reps_max: 0 }, null)).toBe('');
  });

  it('seeds once per set and keeps typed values', () => {
    const s = { exercises: [{ id: 1, previous_sets: [{ set_number: 1, reps: 7 }], sets: [{ id: 5, set_number: 1 }, { id: 6, set_number: 2, target_reps_max: 12 }] }] };
    expect(seedRepsDrafts(s, {})).toEqual({ 5: '7', 6: '12' });
    expect(seedRepsDrafts(s, { 5: '3' })).toEqual({ 5: '3', 6: '12' });
    expect(seedRepsDrafts({ exercises: [] }, { 5: '3' })).toEqual({});
  });

  it('labels the field "Reps · target {range}" or "Reps"', () => {
    expect(repsFieldLabel({ target_reps_min: 8, target_reps_max: 10 })).toBe('Reps · target 8–10');
    expect(repsFieldLabel({ target_reps_min: 12, target_reps_max: 12 })).toBe('Reps · target 12');
    expect(repsFieldLabel({})).toBe('Reps');
    expect(targetRange({ target_reps_max: 6 })).toBe('6');
  });

  it('"Did it" sends the typed reps; blank or junk falls back to v1 (saved, else target)', () => {
    const now = new Date('2026-10-27T10:00:00Z');
    expect(buildSetPatch(set(12, { target_reps_max: 10 }), { actualWeightValue: '', actualReps: '13' }, now).actual_reps).toBe(13);
    expect(buildSetPatch(set(12, { target_reps_max: 10 }), { actualWeightValue: '', actualReps: '' }, now).actual_reps).toBe(10);
    expect(buildSetPatch(set(12, { target_reps_max: 10 }), { actualWeightValue: '', actualReps: '0' }, now).actual_reps).toBe(10);
    // Undo keeps v1's reps.
    expect(buildSetPatch(set(11, { is_completed: true, actual_reps: 9 }), { actualReps: '13' }, now).actual_reps).toBe(9);
  });
});

describe('v2 F1 "Last time" (U3)', () => {
  const exercise = {
    previous_sets: [
      { set_number: 1, weight_value: 60, weight_unit: 'kg', reps: 10 },
      { set_number: 2, reps: 12 },
      { set_number: 3, weight_value: 140, weight_unit: 'lb', reps: 8 },
    ],
  };

  it('looks up the SAME set number only (no fallback)', () => {
    expect(previousSetFor(exercise, { set_number: 3 })).toEqual(exercise.previous_sets[2]);
    expect(previousSetFor(exercise, { set_number: 4 })).toBeNull();
    expect(previousSetFor({}, { set_number: 1 })).toBeNull();
  });

  it('formats "{w} × {r}" in the current unit (kg to 0.5, lb whole) or "{r} reps"', () => {
    expect(lastTimeLabel(exercise.previous_sets[0], 'kg')).toBe('Last time 60 × 10');
    expect(lastTimeLabel(exercise.previous_sets[0], 'lb')).toBe('Last time 132 × 10');
    expect(lastTimeLabel(exercise.previous_sets[2], 'kg')).toBe('Last time 63.5 × 8');
    expect(lastTimeLabel(exercise.previous_sets[1], 'lb')).toBe('Last time 12 reps');
    expect(lastTimeLabel(null, 'lb')).toBeNull();
    expect(lastTimeLabel({ set_number: 1 }, 'lb')).toBeNull();
    // Review LOW (web "Last time 135"): a weight-only previous set shows its weight.
    expect(lastTimeLabel({ set_number: 1, weight_value: 135, weight_unit: 'lb' }, 'lb')).toBe('Last time 135');
  });

  it('gives the stepper start weight in the current unit', () => {
    expect(lastTimeWeight(exercise.previous_sets[0], 'lb')).toBe(132);
    expect(lastTimeWeight(exercise.previous_sets[1], 'lb')).toBeNull();
    expect(roundForUnit(61.23, 'kg')).toBe(61);
    expect(roundForUnit(61.3, 'kg')).toBe(61.5);
  });
});

describe('v2 volume rule (PM, 27 Oct)', () => {
  it('sums each set in kg (saved unit, else the planned one, else lb) and shows it in the member unit', () => {
    expect(setVolumeKg({ actual_weight_value: 100, actual_weight_unit: 'kg', actual_reps: 10 })).toBe(1000);
    expect(setVolumeKg({ actual_weight_value: 100, actual_weight_unit: 'lb', actual_reps: 10 })).toBeCloseTo(453.59, 2);
    expect(setVolumeKg({ actual_weight_value: 100, target_weight_unit: 'kg', actual_reps: 1 })).toBe(100);
    expect(setVolumeKg({ actual_weight_value: null, actual_reps: 10 })).toBe(0);
    expect(volumeInUnit(1000, 'lb')).toBeCloseTo(2204.62, 2);
    expect(convertWeight(10, 'kg', 'kg')).toBe(10);
    expect(Number.isNaN(convertWeight('x', 'kg', 'lb'))).toBe(true);
    expect(sessionProgress(session).volumeKg).toBeCloseTo(500 / 2.20462, 5);
  });

  it('the member unit is current, else goal, else kg', () => {
    expect(memberWeightUnit({ current_weight_unit: 'lb', goal_weight_unit: 'kg' })).toBe('lb');
    expect(memberWeightUnit({ goal_weight_unit: 'lb' })).toBe('lb');
    expect(memberWeightUnit({ current_weight_unit: 'stone' })).toBe('kg');
    expect(memberWeightUnit(null)).toBe('kg');
  });
});

describe('v2 F1 texts', () => {
  it('the timer pill is m:ss and never rolls into hours; its spoken name moves every 30 s', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(1122)).toBe('18:42');
    expect(formatClock(5703)).toBe('95:03');
    expect(formatClock(-4)).toBe('0:00');
    expect(elapsedSpokenLabel(1122)).toBe('Elapsed time 18 minutes 30 seconds');
    expect(elapsedSpokenLabel(1139)).toBe('Elapsed time 18 minutes 30 seconds');
    expect(elapsedSpokenLabel(60)).toBe('Elapsed time 1 minute');
  });

  it('writes the stage eyebrows, segment labels and set headers', () => {
    expect(stageEyebrow({ isActive: true, index: 1, count: 5, muscle: 'Chest', completedSets: 4, totalSets: 15 })).toBe('Current exercise · Chest · 4/15 sets done');
    expect(stageEyebrow({ isActive: false, index: 3, count: 5, muscle: '', completedSets: 0, totalSets: 0 })).toBe('Exercise 4 of 5');
    const ex = { sets: [{ is_completed: true, target_reps_min: 8, target_reps_max: 10, rest_seconds_planned: 90 }, { is_completed: false }, {}] };
    expect(tabletEyebrow({ isActive: true, index: 1, count: 5, exercise: ex })).toBe('Current exercise · 3 sets · 8–10 reps · rest 90s');
    expect(segmentLabel(ex, 0)).toBe('Exercise 1: 1 of 3 sets done');
    expect(setOfLabel({ rest_seconds_planned: 90 }, 3)).toBe('of 3 · rest 90s');
    expect(setOfLabel({}, 3)).toBe('of 3');
    expect(doneSetLabel({ actual_weight_value: 135, actual_reps: 10 })).toBe('135 × 10');
    expect(doneSetLabel({ actual_weight_value: null, actual_reps: 10 })).toBe('10 reps');
  });

  it('done chip reps = actual_reps ?? target_reps_max ?? target_reps_min (batch 3 (b))', () => {
    expect(doneSetLabel({ actual_weight_value: 135, actual_reps: null, target_reps_min: 8, target_reps_max: 10 })).toBe('135 × 10');
    expect(doneSetLabel({ actual_weight_value: null, target_reps_min: 8 })).toBe('8 reps');
    expect(doneSetLabel({ actual_weight_value: 135, actual_reps: 0, target_reps_max: 10 })).toBe('135');
    expect(doneSetLabel({ actual_weight_value: null, actual_reps: 0, target_reps_max: 10 })).toBe('Done');
    expect(doneSetLabel({})).toBe('Done');
    expect(doneSetLabel({ actual_weight_value: 62.5 })).toBe('62.5');
  });
});
