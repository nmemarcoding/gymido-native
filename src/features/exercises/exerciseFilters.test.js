import {
  NO_FILTERS,
  activeFilterValues,
  appliedFilters,
  clearAllShown,
  equipmentNameMap,
  filterButtonLabel,
  filterExercises,
  filterFacets,
  filtersA11yLabel,
  findFacets,
  muscleSection,
  noMatchMessage,
  resultCountText,
  rowA11yLabel,
  showLabel,
} from './exerciseFilters';

// Dated change 27 Oct 2026 (owner T-62, variant B): the pure filter logic.
const ex = (id, muscle, equipment) => ({
  id,
  name: `Ex ${id}`,
  ...(muscle ? { primary_muscle_group: { name: muscle } } : {}),
  ...(equipment === undefined ? {} : { equipment_type_id: equipment }),
});
const NAMES = equipmentNameMap([
  { id: 1, name: 'Dumbbell' },
  { id: 2, name: 'Barbell' },
  { id: 3, name: 'Cable' },
]);
const ITEMS = [ex(1, 'Chest', 1), ex(2, 'Chest', 2), ex(3, 'Legs', 1), ex(4, null, 9), ex(5, 'Obliques'), ex(6, 'Biceps', 1)];

describe('grouping map (UX confirmed 27 Oct 2026)', () => {
  it.each([
    ['Chest', 'Upper body'],
    ['Shoulders', 'Upper body'],
    ['Biceps', 'Upper body'],
    ['Triceps', 'Upper body'],
    ['Forearms', 'Upper body'],
    ['Lats', 'Upper body'],
    ['Upper Back', 'Upper body'],
    ['Traps & Neck', 'Upper body'],
    ['Back', 'Upper body'],
    ['Arms', 'Upper body'],
    ['Quads', 'Lower body'],
    ['Hamstrings', 'Lower body'],
    ['Glutes', 'Lower body'],
    ['Calves', 'Lower body'],
    ['Abductors', 'Lower body'],
    ['Adductors', 'Lower body'],
    ['Legs', 'Lower body'],
    ['Abs', 'Core'],
    ['Lower Back', 'Core'],
    ['Obliques', 'Core'],
    ['Cardio', 'Other'],
    ['Other', 'Other'],
    ['Something new', 'Other'],
  ])('%s → %s', (name, group) => {
    expect(muscleSection(name)).toBe(group);
  });

  it('matches case-insensitively', () => {
    expect(muscleSection('upper back')).toBe('Upper body');
    expect(muscleSection('LEGS')).toBe('Lower body');
    expect(muscleSection('  abs ')).toBe('Core');
  });
});

describe('equipment lookup', () => {
  it('maps id → name; rows without an id or a name are dropped', () => {
    const names = equipmentNameMap([{ id: 4, name: 'Kettlebell' }, { id: null, name: 'X' }, { id: 5 }, { id: 6, name: '' }]);
    expect([...names.entries()]).toEqual([['4', 'Kettlebell']]);
    expect(equipmentNameMap(null).size).toBe(0);
  });

  it('an equipment filter only applies once its name is known', () => {
    expect(appliedFilters({ muscle: 'Chest', equipment: '1' }, NAMES)).toEqual({ muscle: 'Chest', equipment: '1' });
    expect(appliedFilters({ muscle: 'Chest', equipment: '1' }, null)).toEqual({ muscle: 'Chest', equipment: '' });
    expect(appliedFilters({ muscle: '', equipment: '9' }, NAMES)).toEqual({ muscle: '', equipment: '' });
  });
});

describe('filterExercises', () => {
  it('narrows by muscle (the group key, "Other" when missing) and by equipment id', () => {
    expect(filterExercises(ITEMS, NO_FILTERS)).toBe(ITEMS);
    expect(filterExercises(ITEMS, { muscle: 'Chest', equipment: '' }).map((item) => item.id)).toEqual([1, 2]);
    expect(filterExercises(ITEMS, { muscle: '', equipment: '1' }).map((item) => item.id)).toEqual([1, 3, 6]);
    expect(filterExercises(ITEMS, { muscle: 'Chest', equipment: '1' }).map((item) => item.id)).toEqual([1]);
    expect(filterExercises(ITEMS, { muscle: 'Other', equipment: '' }).map((item) => item.id)).toEqual([4]);
  });
});

describe('filterFacets: counts over the OTHER facet', () => {
  it('no filter: muscles grouped Upper/Lower/Core/Other, A–Z inside, empty groups dropped; named equipment A–Z', () => {
    const facets = filterFacets(ITEMS, NO_FILTERS, NAMES);
    expect(facets.muscleTotal).toBe(6);
    expect(facets.muscleGroups.map((group) => [group.title, group.rows.map((row) => [row.label, row.count])])).toEqual([
      ['Upper body', [['Biceps', 1], ['Chest', 2]]],
      ['Lower body', [['Legs', 1]]],
      ['Core', [['Obliques', 1]]],
      ['Other', [['Other', 1]]],
    ]);
    expect(facets.equipmentTotal).toBe(6);
    // id 9 is not named by the lookup → not offered; Cable has no exercise → not offered.
    expect(facets.equipment.map((row) => [row.value, row.label, row.count])).toEqual([
      ['2', 'Barbell', 1],
      ['1', 'Dumbbell', 3],
    ]);
  });

  it('a muscle row counts the chosen equipment; an equipment row the chosen muscle', () => {
    const facets = filterFacets(ITEMS, { muscle: 'Chest', equipment: '1' }, NAMES);
    expect(facets.muscleTotal).toBe(3);
    const muscles = Object.fromEntries(facets.muscleGroups.flatMap((group) => group.rows).map((row) => [row.value, row.count]));
    expect(muscles).toEqual({ Biceps: 1, Chest: 1, Legs: 1, Obliques: 0, Other: 0 });
    expect(facets.equipmentTotal).toBe(2);
    expect(facets.equipment.map((row) => [row.label, row.count])).toEqual([
      ['Barbell', 1],
      ['Dumbbell', 1],
    ]);
  });

  it('a selected muscle / equipment the list lacks still shows, at 0', () => {
    const facets = filterFacets([ex(1, 'Chest', 1)], { muscle: 'Calves', equipment: '3' }, NAMES);
    expect(facets.muscleGroups.map((group) => group.title)).toEqual(['Upper body', 'Lower body']);
    expect(facets.muscleGroups[1].rows).toEqual([{ value: 'Calves', label: 'Calves', count: 0 }]);
    expect(facets.equipment.find((row) => row.value === '3')).toEqual({ value: '3', label: 'Cable', count: 0 });
  });

  it('no lookup → no Equipment section (variant A); loading → counts null ("—")', () => {
    expect(filterFacets(ITEMS, NO_FILTERS, null).equipment).toBeNull();
    const loading = filterFacets(ITEMS, NO_FILTERS, NAMES, { loading: true });
    expect(loading.muscleTotal).toBeNull();
    expect(loading.muscleGroups[0].rows[0].count).toBeNull();
    expect(loading.equipment[0].count).toBeNull();
  });
});

describe('findFacets ("Find a muscle")', () => {
  it('case-insensitive contains over both sections; empty groups and the "All" rows drop while typing', () => {
    const facets = filterFacets(ITEMS, NO_FILTERS, NAMES);
    const found = findFacets(facets, 'BELL');
    expect(found.showAll).toBe(false);
    expect(found.muscleGroups).toEqual([]);
    expect(found.equipment.map((row) => row.label)).toEqual(['Barbell', 'Dumbbell']);
    expect(found.empty).toBe(false);
    const legs = findFacets(facets, 'eg');
    expect(legs.muscleGroups.map((group) => group.title)).toEqual(['Lower body']);
    expect(findFacets(facets, 'zzz').empty).toBe(true);
    expect(findFacets(facets, '  ').showAll).toBe(true);
  });
});

describe('labels', () => {
  it('Filter button: "Filter", the one value, or "Filter · 2"; a11y "Filters: …"', () => {
    expect(filterButtonLabel([])).toBe('Filter');
    expect(filterButtonLabel(['Chest'])).toBe('Chest');
    expect(filterButtonLabel(['Dumbbell'])).toBe('Dumbbell');
    expect(filterButtonLabel(['Chest', 'Dumbbell'])).toBe('Filter · 2');
    expect(filtersA11yLabel([])).toBe('Filters: none');
    expect(filtersA11yLabel(['Chest'])).toBe('Filters: Chest');
    expect(filtersA11yLabel(['Chest', 'Dumbbell'])).toBe('Filters: Chest, Dumbbell');
  });

  it('active values: Muscle, then Equipment (by name)', () => {
    expect(activeFilterValues({ muscle: 'Chest', equipment: '1' }, NAMES)).toEqual([
      { facet: 'muscle', value: 'Chest' },
      { facet: 'equipment', value: 'Dumbbell' },
    ]);
    expect(activeFilterValues(NO_FILTERS, NAMES)).toEqual([]);
  });

  it('results count: NBSP formatCount, "1 exercise", "Loading…"', () => {
    expect(resultCountText({ loading: false, count: 82 })).toBe('82 exercises');
    expect(resultCountText({ loading: false, count: 1 })).toBe('1 exercise');
    expect(resultCountText({ loading: true, count: 0 })).toBe('Loading…');
    expect(showLabel(1)).toBe('Show 1 exercise');
    expect(showLabel(12)).toBe('Show 12 exercises');
  });

  it('row a11y: "{name}, {n} exercises" / "{name}, no exercises"; the name alone while loading', () => {
    expect(rowA11yLabel('Chest', 82)).toBe('Chest, 82 exercises');
    expect(rowA11yLabel('Chest', 1)).toBe('Chest, 1 exercise');
    expect(rowA11yLabel('Neck', 0)).toBe('Neck, no exercises');
    expect(rowA11yLabel('Neck', null)).toBe('Neck');
  });

  it('Clear all with 2+ of {muscle, equipment, search}', () => {
    expect(clearAllShown({ muscle: 'Chest', equipment: '', search: '' })).toBe(false);
    expect(clearAllShown({ muscle: 'Chest', equipment: '', search: 'curl' })).toBe(true);
    expect(clearAllShown({ muscle: 'Chest', equipment: '1', search: '' })).toBe(true);
    expect(clearAllShown({ muscle: '', equipment: '', search: 'curl' })).toBe(false);
  });

  it('no-match body', () => {
    expect(noMatchMessage([], 'curl')).toBe('Try a different search term.');
    expect(noMatchMessage([], '')).toBe('Try a different search term.');
    expect(noMatchMessage(['Chest'], '')).toBe('Nothing matches Chest.');
    expect(noMatchMessage(['Chest', 'Dumbbell'], 'curl')).toBe('Nothing matches Chest · Dumbbell and "curl".');
  });
});
