import {
  equipmentLines,
  factChips,
  isComingSoon,
  primaryMuscleName,
  substituteSummary,
  substituteTileCode,
} from './exerciseProfile';

const item = (code, name) => ({ code, name });

describe('exercise detail derived values (§X1.3)', () => {
  it('prefers the profile muscle, then the exercise, then blank', () => {
    expect(primaryMuscleName({ primary_muscle: { name: 'Chest' } }, { primary_muscle_group: { name: 'Arms' } })).toBe('Chest');
    expect(primaryMuscleName(null, { primary_muscle_group: { name: 'Arms' } })).toBe('Arms');
    expect(primaryMuscleName(null, null)).toBe('');
  });

  it('lists fact chips in order and skips nulls', () => {
    expect(
      factChips({
        difficulty_level: { name: 'Beginner' },
        mechanic: 'compound',
        is_unilateral: false,
        movement_pattern: { name: 'Horizontal push' },
      })
    ).toEqual(['Beginner', 'Compound', 'Both sides', 'Horizontal push']);
    expect(factChips({ mechanic: 'isolation', is_unilateral: true })).toEqual(['Isolation', 'One side at a time']);
    expect(factChips({ mechanic: null, is_unilateral: null })).toEqual([]);
  });

  it('joins any-of groups with "or" and satisfies bodyweight groups', () => {
    expect(equipmentLines([])).toBeNull();
    expect(equipmentLines([[]])).toBeNull();
    expect(equipmentLines([[item('BENCH', 'Bench'), item('BOX', 'Box')], [item('BARBELL', 'Barbell')]])).toEqual([
      'Bench or Box',
      'Barbell',
    ]);
    expect(equipmentLines([[item('BODYWEIGHT', 'Bodyweight')]])).toEqual(['No equipment needed']);
    expect(equipmentLines([[item('BODYWEIGHT', 'Bodyweight'), item('DUMBBELL', 'Dumbbell')], [item('MAT', 'Mat')]])).toEqual(['Mat']);
  });

  it('shows coming soon only for a loaded profile with every tag empty', () => {
    expect(isComingSoon(null)).toBe(false);
    expect(isComingSoon({ primary_muscle: { name: 'Chest' }, secondary_muscles: [], equipment: [], substitutes: [], is_unilateral: null })).toBe(true);
    expect(isComingSoon({ is_unilateral: false })).toBe(false);
    expect(isComingSoon({ equipment: [[item('BODYWEIGHT', 'Bodyweight')]] })).toBe(false);
  });

  it('builds the alternatives tile and summary (⚠X-6)', () => {
    expect(substituteTileCode({ primary_muscle_group: { code: 'HAMSTRINGS' } })).toBe('HAM');
    expect(substituteTileCode({})).toBe('EX');
    expect(substituteSummary({ primary_muscle_group: { name: 'Chest' }, equipment: [[item('BENCH', 'Bench')]] })).toBe('Chest · Bench');
    expect(substituteSummary({ primary_muscle_group: { name: 'Legs' }, equipment: [[item('BODYWEIGHT', 'Bodyweight')]] })).toBe(
      'Legs · No equipment needed'
    );
    expect(substituteSummary({ primary_muscle_group: { name: 'Legs' }, equipment: [] })).toBe('Legs');
    expect(substituteSummary({})).toBe('Exercise');
  });
});
