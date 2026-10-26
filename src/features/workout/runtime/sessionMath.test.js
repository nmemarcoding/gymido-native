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
    expect(completionSnapshot(session, '', 125)).toMatchObject({ planName: 'Workout', durationSeconds: 125, totalVolume: 500, totalReps: 10, completedSets: 1, totalSets: 4 });
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
