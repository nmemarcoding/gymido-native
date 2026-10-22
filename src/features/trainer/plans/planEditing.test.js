import { PlanAction, getActionCopy } from './planActions';
import { formatAffectsNotice, formatClientsOnPlan, moveItem } from './planFormat';
import {
  buildEditDayPayload,
  buildEditSetPayload,
  getChangedPlanFields,
  getDaysPerWeekOptions,
  getEditPlanInitial,
  getSetPrefill,
  isDayEdited,
  validateEditSet,
} from './planValidation';

describe('edit plan details (§B3)', () => {
  const plan = { name: 'PPL', category_id: 2, days_per_week: 0, difficulty_level_id: 3, description: null };

  it('starts from the plan, with days 3 when unset', () => {
    expect(getEditPlanInitial(plan)).toEqual({
      name: 'PPL',
      categoryId: '2',
      daysPerWeek: '3',
      difficultyLevelId: '3',
      description: '',
    });
  });

  it('sends only changed fields and never clears the difficulty', () => {
    const initial = getEditPlanInitial(plan);
    expect(getChangedPlanFields(initial, initial)).toEqual({});
    expect(getChangedPlanFields(initial, { ...initial, name: ' PPL ', difficultyLevelId: '' })).toEqual({});
    expect(
      getChangedPlanFields(initial, { ...initial, name: 'New', daysPerWeek: '4', categoryId: '5', difficultyLevelId: '1', description: ' x ' })
    ).toEqual({ name: 'New', days_per_week: 4, category_id: 5, difficulty_level_id: 1, description: 'x' });
  });

  it('clears a description with ""', () => {
    const initial = getEditPlanInitial({ ...plan, description: 'old' });
    expect(getChangedPlanFields(initial, { ...initial, description: '  ' })).toEqual({ description: '' });
  });

  it('floors days per week at the day count', () => {
    expect(getDaysPerWeekOptions(0).map((o) => o.value)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(getDaysPerWeekOptions(5).map((o) => o.value)).toEqual(['5', '6', '7']);
  });
});

describe('edit day (§B6)', () => {
  it('compares against raw values (⚠B-4)', () => {
    expect(isDayEdited({ title: 'A', description: null }, { title: 'A', description: '' })).toBe(true);
    expect(isDayEdited({ title: 'A', description: 'd' }, { title: 'A', description: 'd' })).toBe(false);
  });

  it('keeps the day number and always sends the description', () => {
    expect(buildEditDayPayload({ day_number: 3 }, { title: ' Legs ', description: '' })).toEqual({
      day_number: 3,
      title: 'Legs',
      description: '',
    });
  });
});

describe('edit set (§B8)', () => {
  it('prefills strings and defaults the unit', () => {
    expect(getSetPrefill({ set_number: 2, target_reps_min: 8, target_reps_max: null, rest_seconds: 60 })).toEqual({
      setNumber: '2',
      repsMin: '8',
      repsMax: '',
      weight: '',
      unit: 'lb',
      rest: '60',
    });
  });

  it('requires a set number of at least 1', () => {
    expect(validateEditSet({ setNumber: '0', repsMin: '8', repsMax: '', weight: '', unit: 'lb', rest: '' })).toEqual({
      set_number: 'Set number is required.',
    });
  });

  it('omits blanks (a full replace clears them) and never sends 0 or ""', () => {
    expect(buildEditSetPayload({ setNumber: '2', repsMin: '8', repsMax: '', weight: '', unit: 'kg', rest: '' })).toEqual({
      set_number: 2,
      target_reps_min: 8,
    });
  });
});

describe('copy and reorder helpers', () => {
  it('pluralises the count copy', () => {
    expect(formatClientsOnPlan(1)).toBe('1 client is on this plan');
    expect(formatClientsOnPlan(3)).toBe('3 clients are on this plan');
    expect(formatAffectsNotice(1)).toBe(
      'This affects 1 client. Changes apply from their next workout; past and in-progress workouts stay as they are.'
    );
  });

  it('moves one item', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });

  it('builds the dialog copy (§B4)', () => {
    expect(getActionCopy({ type: PlanAction.deleteDay, day: { day_number: 2 } }).title).toBe('Delete Day 2?');
    expect(getActionCopy({ type: PlanAction.deleteExercise, exercise: { exercise_id: 7 } }).title).toBe('Remove Exercise #7?');
    expect(getActionCopy({ type: PlanAction.deleteSet, set: { set_number: 1 }, exercise: { exercise: { name: 'Squat' } } })).toMatchObject({
      title: 'Delete set 1?',
      description: 'This removes set 1 from Squat.',
      tone: 'danger',
    });
    expect(getActionCopy({ type: PlanAction.deactivatePlan }).tone).toBe('primary');
  });
});
