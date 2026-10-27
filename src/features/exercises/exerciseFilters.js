// Dated change (27 Oct 2026, owner T-62): the Exercises filter, variant B
// (Muscle + Equipment). Pure, so Jest covers it without rendering. Filtering
// stays client-side over the loaded list (no new request params).

import { formatCount } from '../../shared/format/counts';
import { groupKey } from './exercisesCatalog';

export const NO_FILTERS = Object.freeze({ muscle: '', equipment: '' });

// The grouping map, matched to the real seeded names, case-insensitive;
// anything else → Other. Back, Arms, Legs, Obliques and Cardio were placed by
// meaning (UX confirmed 27 Oct 2026); native uses this exact map.
export const MUSCLE_SECTIONS = Object.freeze(['Upper body', 'Lower body', 'Core', 'Other']);
const SECTION_OF = new Map(
  [
    ['Upper body', ['Chest', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Lats', 'Upper Back', 'Traps & Neck', 'Back', 'Arms']],
    ['Lower body', ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abductors', 'Adductors', 'Legs']],
    ['Core', ['Abs', 'Lower Back', 'Obliques']],
  ].flatMap(([section, names]) => names.map((name) => [name.toLowerCase(), section]))
);

export function muscleSection(name) {
  return SECTION_OF.get(String(name ?? '').trim().toLowerCase()) ?? 'Other';
}

// Equipment = the list item's `equipment_type_id`, named from ONE
// GET /equipment-types per screen load (id → name). An id the lookup doesn't
// name is not offered.
export function equipmentIdOf(exercise) {
  const id = exercise?.equipment_type_id;
  return id === null || id === undefined || id === '' ? '' : String(id);
}

export function equipmentNameMap(types) {
  const names = new Map();
  (Array.isArray(types) ? types : []).forEach((type) => {
    if (type?.id !== null && type?.id !== undefined && typeof type.name === 'string' && type.name) {
      names.set(String(type.id), type.name);
    }
  });
  return names;
}

// A kept equipment filter only applies once its name is known (fail-soft:
// with no lookup the screen is Muscle only).
export function appliedFilters(filters, names) {
  const equipment = filters?.equipment && names?.has(filters.equipment) ? filters.equipment : '';
  return { muscle: filters?.muscle || '', equipment };
}

export function filterExercises(items, { muscle, equipment }) {
  const list = Array.isArray(items) ? items : [];
  if (!muscle && !equipment) {
    return list;
  }
  return list.filter((exercise) => (!muscle || groupKey(exercise) === muscle) && (!equipment || equipmentIdOf(exercise) === equipment));
}

const byLabel = (a, b) => a.label.localeCompare(b.label);

// The rows of both sections. Each row counts the loaded list (= the current
// search) narrowed by the OTHER facet; "All …" likewise. A selected value the
// list lacks still shows (at 0). `loading`: counts are null ("—").
// `names` null → no Equipment section (variant A).
export function filterFacets(items, filters, names, { loading = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  const { muscle, equipment } = filters;
  const byEquipment = filterExercises(list, { muscle: '', equipment });
  const byMuscle = filterExercises(list, { muscle, equipment: '' });
  const count = (value) => (loading ? null : value);

  const muscleCounts = new Map();
  list.forEach((exercise) => muscleCounts.set(groupKey(exercise), 0));
  if (muscle) {
    muscleCounts.set(muscle, 0);
  }
  byEquipment.forEach((exercise) => {
    const key = groupKey(exercise);
    muscleCounts.set(key, muscleCounts.get(key) + 1);
  });
  const muscleGroups = MUSCLE_SECTIONS.map((title) => ({
    title,
    rows: [...muscleCounts.entries()]
      .filter(([key]) => muscleSection(key) === title)
      .map(([key, value]) => ({ value: key, label: key, count: count(value) }))
      .sort(byLabel),
  })).filter((group) => group.rows.length > 0);

  let equipmentRows = null;
  if (names) {
    const equipmentCounts = new Map();
    list.forEach((exercise) => {
      const id = equipmentIdOf(exercise);
      if (names.has(id)) {
        equipmentCounts.set(id, 0);
      }
    });
    if (equipment && names.has(equipment)) {
      equipmentCounts.set(equipment, 0);
    }
    byMuscle.forEach((exercise) => {
      const id = equipmentIdOf(exercise);
      if (equipmentCounts.has(id)) {
        equipmentCounts.set(id, equipmentCounts.get(id) + 1);
      }
    });
    equipmentRows = [...equipmentCounts.entries()].map(([id, value]) => ({ value: id, label: names.get(id), count: count(value) })).sort(byLabel);
  }

  return {
    muscleTotal: count(byEquipment.length),
    muscleGroups,
    equipmentTotal: names ? count(byMuscle.length) : null,
    equipment: equipmentRows,
  };
}

// "Find a muscle": case-insensitive contains; while typing the "All …" rows
// hide, and so do groups with no match. `empty`: nothing matches at all.
export function findFacets(facets, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) {
    return { ...facets, showAll: true, empty: false };
  }
  const match = (row) => row.label.toLowerCase().includes(q);
  const muscleGroups = facets.muscleGroups.map((group) => ({ ...group, rows: group.rows.filter(match) })).filter((group) => group.rows.length > 0);
  const equipment = facets.equipment ? facets.equipment.filter(match) : null;
  return { ...facets, muscleGroups, equipment, showAll: false, empty: muscleGroups.length === 0 && !equipment?.length };
}

// The set filters, Muscle then Equipment, by display name.
export function activeFilterValues(filters, names) {
  const values = [];
  if (filters.muscle) {
    values.push({ facet: 'muscle', value: filters.muscle });
  }
  if (filters.equipment && names?.has(filters.equipment)) {
    values.push({ facet: 'equipment', value: names.get(filters.equipment) });
  }
  return values;
}

export function filterButtonLabel(values) {
  if (values.length > 1) {
    return `Filter · ${values.length}`;
  }
  return values[0] ?? 'Filter';
}

export function filtersA11yLabel(values) {
  return `Filters: ${values.length ? values.join(', ') : 'none'}`;
}

export function resultCountText({ loading, count }) {
  return loading ? 'Loading…' : formatCount(count, 'exercise', 'exercises');
}

export function showLabel(count) {
  return `Show ${formatCount(count, 'exercise', 'exercises')}`;
}

// a11y names use a plain space (NBSP is display only).
export function rowA11yLabel(label, count) {
  if (count === null || count === undefined) {
    return label;
  }
  if (count === 0) {
    return `${label}, no exercises`;
  }
  return `${label}, ${count} ${count === 1 ? 'exercise' : 'exercises'}`;
}

export function clearAllShown({ muscle, equipment, search }) {
  return [muscle, equipment, search].filter(Boolean).length >= 2;
}

// The no-match body: only a search (or nothing) → the code's string, else
// "Nothing matches {Chest}{ · Dumbbell}{ and "{q}"}.".
export function noMatchMessage(values, search) {
  if (!values.length) {
    return 'Try a different search term.';
  }
  return `Nothing matches ${values.join(' · ')}${search ? ` and "${search}"` : ''}.`;
}
