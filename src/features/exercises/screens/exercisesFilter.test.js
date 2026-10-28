import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import AppModal from '../../../shared/components/AppModal';
import { colors, font } from '../../../shared/theme/tokens';
import { listEquipmentTypes, listExercisesPage, listMuscleGroups } from '../api/exercisesApi';
import { focusNode } from '../../../shared/hooks/useSheetFocus';
import ExerciseFilterSheet from '../components/ExerciseFilterSheet';
import { clearExerciseListCache } from '../exerciseListCache';
import ExercisesScreen from './ExercisesScreen';

// Dated change (27 Oct 2026, owner T-62): the Exercises filter, variant B
// (RN-SPEC-exercises "the Exercises filter"; UX T62-EXERCISE-FILTER-spec).
const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockFontScale }),
}));
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => ({ key: 'Exercises-1', name: 'Exercises', params: {} }),
    useFocusEffect: (effect) => useEffect(effect, [effect]),
  };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
let mockKeyboard = 0;
let mockOverlap = 0;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('../../../shared/hooks/useKeyboardHeight', () => ({ useKeyboardHeight: () => mockKeyboard, useKeyboardOverlap: () => mockOverlap }));
jest.mock('../api/exercisesApi', () => ({ listExercisesPage: jest.fn(), listEquipmentTypes: jest.fn(), listMuscleGroups: jest.fn() }));
jest.mock('../../shell/AppHeader', () => () => null);
jest.mock('../../shell/TabletFrame', () => ({ children }) => children);
jest.mock('../../shell/ModeSwitch', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => () => null);
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../../shared/hooks/useSheetFocus', () => ({ ...jest.requireActual('../../../shared/hooks/useSheetFocus'), focusNode: jest.fn() }));

const NBSP = ' ';
const ITEMS = [
  { id: 1, name: 'Bench Press', primary_muscle_group: { name: 'Chest' }, equipment_type_id: 2 },
  { id: 2, name: 'Dumbbell Fly', primary_muscle_group: { name: 'Chest' }, equipment_type_id: 1 },
  { id: 3, name: 'Goblet Squat', primary_muscle_group: { name: 'Legs' }, equipment_type_id: 1 },
  { id: 4, name: 'Plank', equipment_type_id: 7 },
];
const TYPES = [
  { id: 1, name: 'Dumbbell' },
  { id: 2, name: 'Barbell' },
];

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const hosts = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const host = (root, id) => hosts(root, id)[0];
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const press = async (root, id) => {
  await act(async () => {
    pressable(root, id).props.onPress();
  });
};
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const texts = (node) => node.findAll((child) => child.type === 'Text').map(textOf);
const cardIds = (root) => root.findAll((node) => typeof node.type === 'string' && /^exercise-card-\d+$/.test(node.props.testID ?? '')).map((node) => Number(node.props.testID.split('-')[2]));
const sheet = (root) => root.findByType(AppModal);
const searchInput = (root) => root.find((node) => node.props.testID === 'exercises-search' && node.props.onChangeText);

const mounted = [];
let announce;
beforeEach(() => {
  clearExerciseListCache();
  mockWidth = 390;
  mockFontScale = 1;
  mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  mockKeyboard = 0;
  mockOverlap = 0;
  listExercisesPage.mockResolvedValue({ items: ITEMS, pagination: { total_pages: 1 } });
  listEquipmentTypes.mockResolvedValue(TYPES);
  listMuscleGroups.mockResolvedValue([]);
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
async function render() {
  let tree;
  await act(async () => {
    tree = create(<ExercisesScreen />);
  });
  mounted.push(tree);
  return tree;
}
async function searchFor(tree, text) {
  act(() => searchInput(tree.root).props.onChangeText(text));
  await act(async () => {
    searchInput(tree.root).props.onSubmitEditing();
  });
}

describe('T-62 toolbar: ONE Filter button replaces the chip row', () => {
  it('no chip row and no "All muscle groups ▾" chip; the Filter button is off: glass, "Filter", "Filters: none"', async () => {
    const tree = await render();
    expect(hosts(tree.root, 'exercises-chips')).toHaveLength(0);
    expect(tree.root.findAll((node) => /^exercises-chip-(all|Chest)$/.test(node.props.testID ?? ''))).toHaveLength(0);
    const button = host(tree.root, 'exercises-filter');
    expect(button.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Filters: none', accessibilityHint: 'Opens the filters' });
    expect(button.props.accessibilityState).toMatchObject({ expanded: false });
    expect(texts(button)).toEqual(['Filter']);
    expect(flat(button)).toMatchObject({ borderRadius: 999, backgroundColor: colors.fillButton, borderColor: colors.hairlineButton, minHeight: 52 });
  });

  it('search + button share one row (search flex 1); tablet both 56 tall', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(flat(host(tree.root, 'exercises-toolbar'))).toMatchObject({ flexDirection: 'row', gap: 10 });
    expect(flat(host(tree.root, 'exercises-search-box'))).toMatchObject({ flex: 1, minWidth: 0 });
    expect(flat(host(tree.root, 'exercises-filter')).minHeight).toBe(56);
    expect(flat(host(tree.root, 'exercises-filter')).maxWidth).toBe(220);
  });

  it('on: gold tint + gold line, the one value; "Filter · 2" with both; a11y "Filters: Chest, Dumbbell"', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    await press(tree.root, 'exercise-filter-muscle-Chest');
    let button = host(tree.root, 'exercises-filter');
    expect(flat(button)).toMatchObject({ backgroundColor: colors.goldTint, borderColor: colors.goldLine });
    expect(texts(button)).toEqual(['Chest']);
    expect(button.props.accessibilityLabel).toBe('Filters: Chest');
    await press(tree.root, 'exercise-filter-equipment-1');
    button = host(tree.root, 'exercises-filter');
    expect(texts(button)).toEqual(['Filter · 2']);
    expect(button.props.accessibilityLabel).toBe('Filters: Chest, Dumbbell');
    expect(flat(host(tree.root, 'exercises-filter-label')).color).toBe(colors.gold);
  });

  it('large text: the label drops, the icon stays, the a11y name is kept', async () => {
    mockFontScale = 2;
    const tree = await render();
    const button = host(tree.root, 'exercises-filter');
    expect(texts(button)).toEqual([]);
    expect(button.props.accessibilityLabel).toBe('Filters: none');
    expect(hosts(tree.root, 'exercises-filter-icon')).toHaveLength(1);
  });
});

describe('T-62 active filter line', () => {
  it('nothing set: "{total} exercises" 14 secondary; any filter: "{n} exercises" 15/600 primary', async () => {
    const tree = await render();
    const count = () => host(tree.root, 'exercises-result-count');
    expect(textOf(count())).toBe(`4${NBSP}exercises`);
    expect(flat(count())).toMatchObject({ fontSize: 14, color: colors.textSecondary });
    await press(tree.root, 'exercises-filter');
    await press(tree.root, 'exercise-filter-muscle-Legs');
    expect(textOf(count())).toBe(`1${NBSP}exercise`);
    expect(flat(count())).toMatchObject({ ...font(600), fontSize: 15, color: colors.textPrimary });
  });

  it('one gold chip per set filter (Muscle, then Equipment) with "Remove filter {value}"; Clear all with 2+', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    await press(tree.root, 'exercise-filter-muscle-Chest');
    expect(hosts(tree.root, 'exercises-clear-all')).toHaveLength(0);
    await press(tree.root, 'exercise-filter-equipment-1');
    const chips = tree.root.findAll((node) => typeof node.type === 'string' && /^exercises-active-chip-(muscle|equipment)$/.test(node.props.testID ?? ''));
    expect(chips.map((chip) => chip.props.testID)).toEqual(['exercises-active-chip-muscle', 'exercises-active-chip-equipment']);
    expect(flat(chips[0])).toMatchObject({ backgroundColor: colors.goldTint, minHeight: 38, borderRadius: 999 });
    const remove = host(tree.root, 'exercises-active-chip-remove-equipment');
    expect(remove.props.accessibilityLabel).toBe('Remove filter Dumbbell');
    expect(hosts(tree.root, 'exercises-clear-all')).toHaveLength(1);
    expect(cardIds(tree.root)).toEqual([2]);

    await press(tree.root, 'exercises-active-chip-remove-equipment');
    expect(cardIds(tree.root)).toEqual([1, 2]);
    await press(tree.root, 'exercises-active-chip-remove-muscle');
    expect(cardIds(tree.root)).toHaveLength(4);
  });

  it('Clear all clears muscle, equipment and the search', async () => {
    const tree = await render();
    await searchFor(tree, 'press');
    await press(tree.root, 'exercises-filter');
    await press(tree.root, 'exercise-filter-muscle-Chest');
    listExercisesPage.mockClear();
    await press(tree.root, 'exercises-clear-all');
    expect(searchInput(tree.root).props.value).toBe('');
    expect(listExercisesPage).toHaveBeenCalledWith(1, '');
    expect(hosts(tree.root, 'exercises-active-chip-muscle')).toHaveLength(0);
  });

  it('the count is announced once per submit, never while typing', async () => {
    const tree = await render();
    announce.mockClear();
    act(() => searchInput(tree.root).props.onChangeText('pla'));
    expect(announce).not.toHaveBeenCalledWith(expect.stringMatching(/exercise/));
    listExercisesPage.mockResolvedValue({ items: [ITEMS[3]], pagination: { total_pages: 1 } });
    await act(async () => {
      searchInput(tree.root).props.onSubmitEditing();
    });
    expect(announce.mock.calls.filter(([text]) => /exercise/.test(text))).toEqual([[`1 exercise`]]);
  });
});

describe('T-62 phone: the shared bottom sheet (variant B)', () => {
  it('the shared AppModal, title "Filters", the pinned ×, find field "Find a muscle or equipment"', async () => {
    const tree = await render();
    expect(sheet(tree.root).props.isOpen).toBe(false);
    await press(tree.root, 'exercises-filter');
    const modal = sheet(tree.root);
    expect(modal.props).toMatchObject({ isOpen: true, title: 'Filters' });
    expect(modal.props.footerDismiss).toBeFalsy();
    expect(hosts(tree.root, 'app-modal-close')).toHaveLength(1);
    // DECLARED (27 Oct 2026, audit b3): was the TextInput's own `placeholder`. The placeholder is now our one-line
    // Text (tail ellipsis) over the field, so a long copy ends in "…"; the field keeps it as its label.
    expect(host(tree.root, 'exercise-filter-find').props.accessibilityLabel).toBe('Find a muscle or equipment');
    expect(textOf(host(tree.root, 'exercise-filter-find-placeholder'))).toBe('Find a muscle or equipment');
    expect(host(tree.root, 'exercises-filter').props.accessibilityState).toMatchObject({ expanded: true });
  });

  it('sections "Muscle group" (All + Upper/Lower/Other headings) and "Equipment" (All + A–Z), radios with counts', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    const muscle = host(tree.root, 'exercise-filter-section-muscle');
    expect(muscle.props).toMatchObject({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Muscle group' });
    expect(texts(muscle)).toEqual(['Muscle group', 'All muscle groups', '4', 'Upper body', 'Chest', '2', 'Lower body', 'Legs', '1', 'Other', 'Other', '1']);
    const equipment = host(tree.root, 'exercise-filter-section-equipment');
    expect(equipment.props).toMatchObject({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Equipment' });
    expect(texts(equipment)).toEqual(['Equipment', 'All equipment', '4', 'Barbell', '1', 'Dumbbell', '2']);
    const chest = host(tree.root, 'exercise-filter-muscle-Chest');
    expect(chest.props).toMatchObject({ accessibilityRole: 'radio', accessibilityLabel: 'Chest, 2 exercises' });
    expect(chest.props.accessibilityState).toEqual({ checked: false });
    expect(host(tree.root, 'exercise-filter-all-muscle').props.accessibilityState).toEqual({ checked: true });
  });

  it('a tap applies live (counts over the other facet), the sheet stays open; selected = gold tint + ✓', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    await press(tree.root, 'exercise-filter-equipment-1');
    expect(sheet(tree.root).props.isOpen).toBe(true);
    expect(cardIds(tree.root)).toEqual([2, 3]);
    const row = host(tree.root, 'exercise-filter-equipment-1');
    expect(row.props.accessibilityState).toEqual({ checked: true });
    expect(flat(row).backgroundColor).toBe(colors.goldTint);
    expect(hosts(tree.root, 'exercise-filter-check-equipment-1')).toHaveLength(1);
    // Muscle rows now count Dumbbell's exercises; zero rows stay selectable.
    expect(host(tree.root, 'exercise-filter-muscle-Chest').props.accessibilityLabel).toBe('Chest, 1 exercise');
    expect(host(tree.root, 'exercise-filter-muscle-Other').props.accessibilityLabel).toBe('Other, no exercises');
    expect(textOf(host(tree.root, 'exercise-filter-all-muscle-count'))).toBe('2');
    // "All equipment" clears that section.
    await press(tree.root, 'exercise-filter-all-equipment');
    expect(cardIds(tree.root)).toHaveLength(4);
  });

  it('the pinned gold footer "Show {n} exercises" closes the sheet', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    await press(tree.root, 'exercise-filter-muscle-Legs');
    const show = tree.root.findByProps({ testID: 'exercise-filter-show' });
    expect(show.props).toMatchObject({ title: `Show 1${NBSP}exercise`, variant: 'primary', fullWidth: true });
    await press(tree.root, 'exercise-filter-show');
    expect(sheet(tree.root).props.isOpen).toBe(false);
  });

  it('find: contains, case-insensitive; the "All …" rows hide; nothing → No match for "{q}"', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    const find = () => host(tree.root, 'exercise-filter-find');
    act(() => find().props.onChangeText('BELL'));
    expect(hosts(tree.root, 'exercise-filter-all-muscle')).toHaveLength(0);
    expect(hosts(tree.root, 'exercise-filter-all-equipment')).toHaveLength(0);
    expect(hosts(tree.root, 'exercise-filter-muscle-Chest')).toHaveLength(0);
    expect(hosts(tree.root, 'exercise-filter-equipment-2')).toHaveLength(1);
    act(() => find().props.onChangeText('zzz'));
    expect(textOf(host(tree.root, 'exercise-filter-no-match'))).toBe('No match for "zzz"');
  });

  it('the shared sheet unchanged: the default max height, 26/30 title; Android back / scrim close it', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    expect(sheet(tree.root).props.sheetTopGap).toBeUndefined();
    act(() => sheet(tree.root).props.onClose());
    expect(sheet(tree.root).props.isOpen).toBe(false);
  });
});

describe('T-62 fail-soft: GET /equipment-types fails → variant A (Muscle only)', () => {
  it('title "Muscle group", no Equipment, no headings for the section, a tap applies AND closes, no footer', async () => {
    listEquipmentTypes.mockRejectedValue(new Error('boom'));
    const tree = await render();
    expect(listEquipmentTypes).toHaveBeenCalledTimes(1);
    await press(tree.root, 'exercises-filter');
    expect(sheet(tree.root).props).toMatchObject({ title: 'Muscle group', footer: null });
    expect(hosts(tree.root, 'exercise-filter-section-equipment')).toHaveLength(0);
    // DECLARED (audit b3): was `placeholder`; see above.
    expect(textOf(host(tree.root, 'exercise-filter-find-placeholder'))).toBe('Find a muscle');
    expect(texts(host(tree.root, 'exercise-filter-section-muscle'))[0]).toBe('All muscle groups');
    await press(tree.root, 'exercise-filter-muscle-Chest');
    expect(sheet(tree.root).props.isOpen).toBe(false);
    expect(cardIds(tree.root)).toEqual([1, 2]);
  });

  it('one lookup per screen load, not per search', async () => {
    const tree = await render();
    await searchFor(tree, 'squat');
    expect(listEquipmentTypes).toHaveBeenCalledTimes(1);
  });
});

describe('T-62 tablet: the centred dialog', () => {
  it('520 wide (md), the list in 2 columns with full-width headings', async () => {
    mockWidth = 834;
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    expect(sheet(tree.root).props).toMatchObject({ size: 'md', title: 'Filters' });
    expect(flat(host(tree.root, 'exercise-filter-muscle-Chest-cell')).width).toBe('50%');
    expect(flat(host(tree.root, 'exercise-filter-group-Upper body')).width).toBe('100%');
  });
});

describe('T-62 states', () => {
  it('first load: the toolbar is usable, the count says "Loading…", the Loader in the results area; rows show 6 skeletons', async () => {
    listExercisesPage.mockImplementation(() => new Promise(() => {}));
    const tree = await render();
    expect(hosts(tree.root, 'exercises-search')).toHaveLength(1);
    expect(textOf(host(tree.root, 'exercises-result-count'))).toBe('Loading…');
    expect(tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'Loading exercises').length).toBeGreaterThan(0);
    await press(tree.root, 'exercises-filter');
    expect(hosts(tree.root, 'exercise-filter-skeleton')).toHaveLength(6);
  });

  it('page-1 error: ErrorAlert "Exercises unavailable" + Retry in the results area; the toolbar stays', async () => {
    listExercisesPage.mockRejectedValue(new Error('Request failed with status code 500'));
    const tree = await render();
    expect(hosts(tree.root, 'exercises-search')).toHaveLength(1);
    const alert = host(tree.root, 'exercises-error');
    expect(texts(alert)).toEqual(expect.arrayContaining(['Exercises unavailable', 'Request failed with status code 500']));
    listExercisesPage.mockResolvedValue({ items: ITEMS, pagination: { total_pages: 1 } });
    await press(tree.root, 'exercises-error-retry');
    expect(cardIds(tree.root)).toHaveLength(4);
  });

  it('no match with a filter + a search: the 64 tile, "Nothing matches … and "{q}".", Clear filters + Search all exercises', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    await press(tree.root, 'exercise-filter-muscle-Chest');
    await press(tree.root, 'exercise-filter-show');
    listExercisesPage.mockResolvedValue({ items: [ITEMS[2]], pagination: { total_pages: 1 } });
    await searchFor(tree, 'squat');
    const empty = host(tree.root, 'exercises-no-match');
    expect(texts(empty)).toEqual(['No exercises found', 'Nothing matches Chest and "squat".', 'Clear filters', 'Search all exercises']);
    expect(flat(host(tree.root, 'exercises-no-match-tile'))).toMatchObject({ width: 64, height: 64 });
    // A selected muscle the new search lacks still shows, at 0.
    await press(tree.root, 'exercises-filter');
    expect(host(tree.root, 'exercise-filter-muscle-Chest').props.accessibilityLabel).toBe('Chest, no exercises');
    act(() => sheet(tree.root).props.onClose());
    await press(tree.root, 'exercises-search-all');
    expect(searchInput(tree.root).props.value).toBe('squat');
    expect(cardIds(tree.root)).toEqual([3]);
  });

  it('Clear filters clears the filters and the search', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    await press(tree.root, 'exercise-filter-muscle-Chest');
    listExercisesPage.mockResolvedValue({ items: [ITEMS[2]], pagination: { total_pages: 1 } });
    await searchFor(tree, 'squat');
    listExercisesPage.mockResolvedValue({ items: ITEMS, pagination: { total_pages: 1 } });
    await press(tree.root, 'exercises-clear-filters');
    expect(searchInput(tree.root).props.value).toBe('');
    expect(cardIds(tree.root)).toHaveLength(4);
  });

  it('only a search: "Try a different search term.", Clear filters only; empty catalog: no actions', async () => {
    const tree = await render();
    listExercisesPage.mockResolvedValue({ items: [], pagination: { total_pages: 1 } });
    await searchFor(tree, 'zzz');
    expect(texts(host(tree.root, 'exercises-no-match'))).toEqual(['No exercises found', 'Try a different search term.', 'Clear filters']);
    clearExerciseListCache();
    const empty = await render();
    expect(texts(host(empty.root, 'exercises-no-match'))).toEqual(['No exercises found', 'Try a different search term.']);
  });
});

describe('T-62 focus moves', () => {
  // Host refs resolve to { testID } so the focus target can be checked.
  async function renderWithNodes() {
    let tree;
    await act(async () => {
      tree = create(<ExercisesScreen />, { createNodeMock: (element) => ({ testID: element.props.testID }) });
    });
    mounted.push(tree);
    return tree;
  }
  // The jest View mock is a class: a ref's current carries the host props.
  const focusedIds = () => focusNode.mock.calls.map(([ref]) => ref?.current?.props?.testID);

  it('removing a chip focuses the next chip, else the search field', async () => {
    jest.useFakeTimers();
    try {
      const tree = await renderWithNodes();
      await press(tree.root, 'exercises-filter');
      await press(tree.root, 'exercise-filter-muscle-Chest');
      await press(tree.root, 'exercise-filter-equipment-1');
      act(() => sheet(tree.root).props.onClose());
      act(() => jest.runOnlyPendingTimers());
      focusNode.mockClear();
      await press(tree.root, 'exercises-active-chip-remove-muscle');
      act(() => jest.runOnlyPendingTimers());
      expect(focusedIds()).toEqual(['exercises-active-chip-remove-equipment']);
      focusNode.mockClear();
      await press(tree.root, 'exercises-active-chip-remove-equipment');
      act(() => jest.runOnlyPendingTimers());
      expect(focusedIds()).toEqual(['exercises-search']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('the sheet gets the Filter button as its focus-return target (useSheetFocus)', async () => {
    const tree = await renderWithNodes();
    await press(tree.root, 'exercises-filter');
    expect(tree.root.findByType(ExerciseFilterSheet).props.returnRef.current.props.testID).toBe('exercises-filter');
  });
});

describe('T-62 ≥ 1024: the always-visible filter panel', () => {
  const panel = (root) => host(root, 'exercises-filter-panel');
  const listRows = (root) => root.find((node) => node.props.testID === 'exercises-list' && typeof node.type !== 'string' && Array.isArray(node.props.data)).props.data.filter((row) => row.type === 'row');

  // DECLARED change (reviewer, web parity): the panel's height is the row
  // beside the results, was window − 48 beside the whole page.
  // DECLARED change (final device audit, 27 Oct 2026): the top 24 and the
  // height cap moved from the card (marginTop 24 + maxHeight '100%', which
  // overran the row by 24 and ignored the bottom inset) to the panel's frame
  // (padding 24 top, 24 + inset bottom; the card shrinks inside it).
  it('1024–1279: 256 wide card (radius 24, surface, hairline, padding 16 10), top 24, as tall as the results row at most; no Filter button', async () => {
    mockWidth = 1194;
    const tree = await render();
    expect(flat(panel(tree.root))).toMatchObject({
      width: 256,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderColor: colors.hairline,
      borderWidth: 1,
      paddingVertical: 16,
      paddingHorizontal: 10,
      flexShrink: 1,
    });
    expect(flat(panel(tree.root))).not.toHaveProperty('marginTop');
    expect(flat(panel(tree.root))).not.toHaveProperty('maxHeight');
    expect(flat(host(tree.root, 'exercises-filter-panel-frame'))).toMatchObject({ paddingTop: 24, paddingBottom: 24 });
    expect(hosts(tree.root, 'exercises-filter')).toHaveLength(0);
    // No title, no ×, no footer inside the panel; the list scrolls inside it.
    expect(panel(tree.root).findAll((node) => node.props.testID === 'app-modal-close')).toHaveLength(0);
    expect(panel(tree.root).findAll((node) => node.props.testID === 'exercise-filter-show')).toHaveLength(0);
    expect(hosts(tree.root, 'exercises-filter-panel-scroll')).toHaveLength(1);
    // The results grid beside it: 2 columns.
    expect(listRows(tree.root)[0].cards).toHaveLength(2);
  });

  // Reviewer (web parity): web keeps the title, toolbar and active line ABOVE
  // a [256 | 1fr] grid, so the panel sits beside the RESULTS only.
  it('the title, toolbar and active line sit above a [panel | results] row; the list holds only results', async () => {
    mockWidth = 1194;
    const tree = await render();
    const row = host(tree.root, 'exercises-panel-row');
    expect(row).toBeTruthy();
    const inRow = (id) => row.findAll((node) => node.props.testID === id && typeof node.type === 'string').length > 0;
    expect(inRow('exercises-filter-panel')).toBe(true);
    expect(row.findAll((node) => node.props.testID === 'exercises-list').length).toBeGreaterThan(0);
    ['exercises-title', 'exercises-toolbar', 'exercises-active-line'].forEach((id) => {
      expect(hosts(tree.root, id).length).toBeGreaterThan(0);
      expect(inRow(id)).toBe(false);
    });
    const data = tree.root.find((node) => node.props.testID === 'exercises-list' && Array.isArray(node.props.data)).props.data;
    expect(data.some((item) => ['header', 'bar', 'line'].includes(item.type))).toBe(false);
    expect(flat(row)).toMatchObject({ flexDirection: 'row', flex: 1 });
  });

  it('below 1024 (and at large text) the list keeps the header, toolbar and line as its rows', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(hosts(tree.root, 'exercises-panel-row')).toHaveLength(0);
    const data = tree.root.find((node) => node.props.testID === 'exercises-list' && Array.isArray(node.props.data)).props.data;
    expect(data.slice(0, 3).map((item) => item.type)).toEqual(['header', 'bar', 'line']);
  });

  it('≥ 1280: 280 wide, 3 columns', async () => {
    mockWidth = 1366;
    const tree = await render();
    expect(flat(panel(tree.root)).width).toBe(280);
    expect(listRows(tree.root)[0].cards).toHaveLength(3);
  });

  it('panel metrics: rows 44 / radius 14, name 15/500, find 44 on surface-well, heading 15/600 primary; a tap applies at once', async () => {
    mockWidth = 1194;
    const tree = await render();
    const chest = host(tree.root, 'exercise-filter-muscle-Chest');
    expect(flat(chest)).toMatchObject({ minHeight: 44, borderRadius: 14 });
    const name = chest.findAll((node) => node.type === 'Text' && textOf(node) === 'Chest')[0];
    expect(flat(name)).toMatchObject({ ...font(500), fontSize: 15 });
    expect(flat(host(tree.root, 'exercise-filter-find'))).toMatchObject({ minHeight: 44, backgroundColor: colors.surfaceWell });
    const heading = panel(tree.root).findAll((node) => node.type === 'Text' && textOf(node) === 'Muscle group')[0];
    expect(flat(heading)).toMatchObject({ ...font(600), fontSize: 15, color: colors.textPrimary });
    await press(tree.root, 'exercise-filter-muscle-Chest');
    expect(cardIds(tree.root)).toEqual([1, 2]);
    expect(host(tree.root, 'exercise-filter-muscle-Chest').props.accessibilityState).toEqual({ checked: true });
  });

  it('variant A in the panel: the "Muscle group" heading still shows; no Equipment', async () => {
    mockWidth = 1194;
    listEquipmentTypes.mockRejectedValue(new Error('boom'));
    const tree = await render();
    expect(texts(host(tree.root, 'exercise-filter-section-muscle'))[0]).toBe('Muscle group');
    expect(hosts(tree.root, 'exercise-filter-section-equipment')).toHaveLength(0);
  });

  it('large text (font scale ≥ 1.5) at ≥ 1024: no panel; the Filter button + dialog instead', async () => {
    mockWidth = 1194;
    mockFontScale = 1.5;
    const tree = await render();
    expect(hosts(tree.root, 'exercises-filter-panel')).toHaveLength(0);
    await press(tree.root, 'exercises-filter');
    expect(sheet(tree.root).props.isOpen).toBe(true);
  });

  it('1.4 at ≥ 1024 keeps the panel', async () => {
    mockWidth = 1194;
    mockFontScale = 1.4;
    const tree = await render();
    expect(hosts(tree.root, 'exercises-filter-panel')).toHaveLength(1);
  });
});

describe('T-62 sheet / dialog: the find field is pinned; footer heights', () => {
  const inScroll = (root, id) =>
    root.findAllByType(require('react-native').ScrollView).some((scroll) => scroll.findAll((node) => node.props.testID === id).length > 0);

  it.each([390, 834])('%i: the find field sits in the pinned header, outside the scroll; the rows scroll', async (width) => {
    mockWidth = width;
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    const pinned = host(tree.root, 'app-modal-pinned-header');
    expect(pinned.findAll((node) => node.props.testID === 'exercise-filter-find' && typeof node.type === 'string')).toHaveLength(1);
    expect(inScroll(tree.root, 'exercise-filter-find')).toBe(false);
    expect(inScroll(tree.root, 'exercise-filter-muscle-Chest')).toBe(true);
  });

  it('phone footer: the gold 52 (kit default, no override); tablet dialog: gold 56', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    let show = tree.root.findByProps({ testID: 'exercise-filter-show' });
    expect(show.props).toMatchObject({ size: 'default', variant: 'primary' });
    expect(StyleSheet.flatten(show.props.style) ?? {}).not.toHaveProperty('minHeight');
    expect(flat(host(tree.root, 'exercise-filter-show')).minHeight).toBe(52);

    mockWidth = 834;
    const tablet = await render();
    await press(tablet.root, 'exercises-filter');
    show = tablet.root.findAllByProps({ testID: 'exercise-filter-show' }).find((node) => typeof node.type !== 'string' && node.props.title);
    expect(show.props.size).toBe('default');
    expect(StyleSheet.flatten(show.props.style)).toMatchObject({ minHeight: 56 });
  });
});

// Dated 27 Oct 2026 (RN-SPEC-exercises audit b3; UX R3 MUST 5 + 6, T-62 §4).
describe('T-62 audit b3: the rows survive a no-match search; muscles seeded from /muscle-groups', () => {
  const allMuscleRows = (root) =>
    root.findAll((node) => typeof node.type === 'string' && /^exercise-filter-muscle-[^-]+$/.test(node.props.testID ?? '') && node.props.testID !== 'exercise-filter-muscle-all').map((node) => node.props.testID.replace('exercise-filter-muscle-', ''));

  it('ONE GET /muscle-groups per screen load; a fresh no-match keeps every muscle row (muted, 0) and the Equipment section', async () => {
    listMuscleGroups.mockResolvedValue([{ id: 1, name: 'Chest' }, { id: 2, name: 'Calves' }]);
    const tree = await render();
    expect(listMuscleGroups).toHaveBeenCalledTimes(1);
    listExercisesPage.mockResolvedValue({ items: [], pagination: { total_pages: 1 } });
    await searchFor(tree, 'zzz');
    expect(listMuscleGroups).toHaveBeenCalledTimes(1);
    await press(tree.root, 'exercises-filter');
    expect(allMuscleRows(tree.root).sort()).toEqual(['Calves', 'Chest', 'Legs', 'Other']);
    expect(host(tree.root, 'exercise-filter-muscle-Calves').props.accessibilityLabel).toBe('Calves, no exercises');
    expect(textOf(host(tree.root, 'exercise-filter-muscle-Chest-count'))).toBe('0');
    expect(host(tree.root, 'exercise-filter-section-equipment')).toBeTruthy();
    expect(host(tree.root, 'exercise-filter-equipment-1')).toBeTruthy();
    expect(textOf(host(tree.root, 'exercise-filter-find-placeholder'))).toBe('Find a muscle or equipment');
  });

  it('a failed /muscle-groups is fail-soft: the rows are the ones seen', async () => {
    listMuscleGroups.mockRejectedValue(new Error('down'));
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    expect(allMuscleRows(tree.root).sort()).toEqual(['Chest', 'Legs', 'Other']);
  });

  it('the find placeholder is one line and ends in an ellipsis (copy unchanged)', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    const placeholder = host(tree.root, 'exercise-filter-find-placeholder');
    expect(placeholder.props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' });
    expect(placeholder.props.importantForAccessibility).toBe('no');
    expect(flat(placeholder).color).toBe(colors.textFaint);
    await act(async () => host(tree.root, 'exercise-filter-find').props.onChangeText('ch'));
    expect(hosts(tree.root, 'exercise-filter-find-placeholder')).toHaveLength(0);
  });
});

// PM line (pending FE merge into RN-SPEC-exercises, PM-confirmed 27 Oct 2026): while the Exercises list is LOADING
// the sheet / dialog footer says "Loading…" (never "Show 0 exercises") and every row count is "—" (never 0).
describe.each([390, 834])('T-62 loading footer and counts (%ipx)', (width) => {
  beforeEach(() => {
    mockWidth = width;
  });
  const showTitle = (root) => root.findAll((node) => node.props.testID === 'exercise-filter-show' && typeof node.type !== 'string' && node.props.title)[0]?.props.title;
  const counts = (root) =>
    root.findAll((node) => typeof node.type === 'string' && /^exercise-filter-(muscle|equipment)-.+-count$/.test(node.props.testID ?? '')).map(textOf);

  it('first load (nothing in yet): the footer says "Loading…"', async () => {
    listExercisesPage.mockImplementation(() => new Promise(() => {}));
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    expect(showTitle(tree.root)).toBe('Loading…');
  });

  it('page 1 in, the rest still loading: "Loading…" and every count "—"; then the real count', async () => {
    let finish;
    listExercisesPage.mockImplementation((page) =>
      page === 1
        ? Promise.resolve({ items: ITEMS.slice(0, 2), pagination: { total_pages: 2 } })
        : new Promise((resolve) => {
            finish = () => resolve({ items: ITEMS.slice(2), pagination: { total_pages: 2 } });
          }),
    );
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    expect(showTitle(tree.root)).toBe('Loading…');
    const shown = counts(tree.root);
    expect(shown.length).toBeGreaterThan(0);
    shown.forEach((text) => expect(text).toBe('—'));
    await act(async () => finish());
    expect(showTitle(tree.root)).toMatch(/^Show 4.exercises$/);
    expect(counts(tree.root)).not.toContain('—');
  });
});

// Final device audit (27 Oct 2026), T-62 bugs found on the Android tablet /
// iPhone builds.
describe('T-62 final audit: panel insets + keyboard, the search field, the sheet with the keyboard', () => {
  const frame = (root) => host(root, 'exercises-filter-panel-frame');
  const panel = (root) => host(root, 'exercises-filter-panel');

  it('panel (≥ 1024): its frame keeps the card 24 above the bottom safe-area inset, so the last rows can be reached', async () => {
    mockWidth = 1280;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    const tree = await render();
    // The frame fills the results row; the card hugs its content and shrinks
    // (its rows scroll) when the row is shorter.
    expect(flat(frame(tree.root))).toMatchObject({ alignSelf: 'stretch', paddingTop: 24, paddingBottom: 24 + 48 });
    expect(flat(panel(tree.root))).toMatchObject({ flexShrink: 1 });
    expect(flat(host(tree.root, 'exercises-filter-panel-scroll'))).toMatchObject({ flexShrink: 1 });
    // The screen's panel margins sit on the frame.
    expect(flat(frame(tree.root))).toMatchObject({ marginLeft: 20, marginRight: 4 });
  });

  // DECLARED (reviewer LOW): the panel uses the keyboard's OVERLAP with the
  // window (was its full height).
  it('panel: the keyboard overlap replaces the bottom inset, so the card (find field + its own list) ends 24 above the keyboard', async () => {
    mockWidth = 1280;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    mockKeyboard = 320;
    mockOverlap = 320;
    const tree = await render();
    expect(flat(frame(tree.root)).paddingBottom).toBe(24 + 320);
    // The find field stays at the top of the card, outside the list's scroll.
    const scroll = host(tree.root, 'exercises-filter-panel-scroll');
    expect(scroll.findAll((node) => node.props.testID === 'exercise-filter-find')).toHaveLength(0);
    expect(hosts(panel(tree.root), 'exercise-filter-find')).toHaveLength(1);
    expect(flat(host(tree.root, 'exercise-filter-find-box')).flexShrink ?? 0).toBe(0);
  });

  it('panel: an open keyboard that does not overlap the window (floating / short window) does not shrink it', async () => {
    mockWidth = 1280;
    mockInsets = { top: 24, bottom: 48, left: 0, right: 0 };
    mockKeyboard = 320;
    mockOverlap = 0;
    const tree = await render();
    expect(flat(frame(tree.root)).paddingBottom).toBe(24 + 48);
  });

  it('panel: the card never shrinks below the find field + one row (minHeight 128)', async () => {
    mockWidth = 1280;
    const tree = await render();
    expect(flat(panel(tree.root)).minHeight).toBe(128);
  });

  it.each([
    [390, 1],
    [834, 1],
    [1280, 1],
    [834, 2],
  ])('search field at %i (font %f): the pill is the box, the text starts past the icon, the input style never changes', async (width, fontScale) => {
    mockWidth = width;
    mockFontScale = fontScale;
    const tree = await render();
    const box = flat(host(tree.root, 'exercises-search-box'));
    const glyph = flat(host(tree.root, 'exercises-search-icon'));
    // The text box starts at the box's left padding (inside its 1 border);
    // the 18 icon sits at 18 from the outer edge: ≥ 8 clear of it.
    expect(box).toMatchObject({ borderRadius: 999, borderWidth: 1, backgroundColor: colors.surface, paddingLeft: 46 });
    expect(box.borderWidth + box.paddingLeft).toBeGreaterThanOrEqual(glyph.left + 18 + 8);
    // Android resets an EditText's padding when its background is re-set (the
    // focus ring did that: the text then started under the icon). The input
    // draws no chrome and pads nothing horizontally, and its style is the
    // same focused or not.
    const input = () => host(tree.root, 'exercises-search');
    const before = flat(input());
    expect(before.paddingLeft ?? 0).toBe(0);
    expect(before.paddingRight ?? 0).toBe(0);
    expect(before).not.toHaveProperty('borderWidth');
    expect(before).not.toHaveProperty('backgroundColor');
    expect(before).not.toHaveProperty('boxShadow');
    act(() => searchInput(tree.root).props.onFocus());
    expect(flat(input())).toEqual(before);
    // The focus ring is drawn by the box instead, and goes on blur.
    expect(flat(host(tree.root, 'exercises-search-box'))).toMatchObject({ borderColor: colors.gold });
    expect(flat(host(tree.root, 'exercises-search-box')).boxShadow).toEqual(expect.stringContaining(colors.goldFocus));
    act(() => searchInput(tree.root).props.onBlur());
    expect(flat(host(tree.root, 'exercises-search-box'))).toMatchObject({ borderColor: colors.hairlineStrong });
    expect(flat(host(tree.root, 'exercises-search-box'))).not.toHaveProperty('boxShadow');
  });

  it('search field: a tap on the pill outside the text box (the icon, the edges) still focuses the field', async () => {
    const tree = await render();
    const field = tree.root.find((node) => node.props.testID === 'exercises-search' && typeof node.type !== 'string');
    const box = pressable(tree.root, 'exercises-search-box');
    expect(box.props.accessible).toBe(false);
    const focus = jest.fn();
    jest.spyOn(field.instance, 'focus').mockImplementation(focus);
    act(() => box.props.onPress());
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('search field: 52 tall on the phone, 56 at 768–1279', async () => {
    let tree = await render();
    expect(flat(host(tree.root, 'exercises-search-box')).minHeight).toBe(52);
    mockWidth = 834;
    tree = await render();
    expect(flat(host(tree.root, 'exercises-search-box')).minHeight).toBe(56);
  });

  it('iPhone sheet, keyboard up: lifted above it, the pinned find field stays over the list (opaque, on top), the rows scroll', async () => {
    mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    mockKeyboard = 336;
    // UX native final audit 27 Oct 2026, ruling 12: AppModal lifts by the
    // keyboard OVERLAP (on an iPhone it equals the height).
    mockOverlap = 336;
    await act(async () => {
      tree.update(<ExercisesScreen />);
    });
    expect(flat(host(tree.root, 'app-modal-overlay')).paddingBottom).toBe(336);
    const header = host(tree.root, 'app-modal-header');
    expect(flat(header)).toMatchObject({ zIndex: 1, backgroundColor: colors.surfaceRaised });
    expect(hosts(header, 'app-modal-pinned-header')).toHaveLength(1);
    const scroll = tree.root.findAllByType(require('react-native').ScrollView).find((node) => node.findAll((child) => child.props.testID === 'exercise-filter-muscle-Chest').length > 0);
    expect(scroll).toBeDefined();
    expect(scroll.findAll((node) => node.props.testID === 'exercise-filter-find')).toHaveLength(0);
    // Ruling 12 (B250): the "Show n" footer stays fixed under the list, not in it.
    expect(hosts(tree.root, 'exercise-filter-show').length).toBeGreaterThan(0);
    expect(scroll.findAll((node) => node.props.testID === 'exercise-filter-show')).toHaveLength(0);
  });
});

// v2 fix (PM decision (a), 27 Oct 2026; web's sticky panel): on a device
// (Android 1280 landscape, iPad landscape) the keyboard covered the panel's
// card below the find field, because the title, toolbar and active line sat
// above the [panel | results] row. While the PANEL's find field is focused
// AND the keyboard overlaps the window, that header block collapses (height
// 0, still mounted, hidden from screen readers; a screen-reader-only H1
// stands in), so the panel sits at the top 24 of the content area. Blur or a hidden keyboard restore
// it; a floating keyboard (overlap 0) never collapses it.
describe('T-62 panel find field + keyboard: the page header collapses', () => {
  const block = (root) => host(root, 'exercises-panel-header');
  const panelFind = (root) => host(host(root, 'exercises-filter-panel'), 'exercise-filter-find');
  const collapsed = (root) => (flat(block(root)) ?? {}).height === 0;
  const hiddenFromA11y = (target) => {
    for (let node = target; node; node = node.parent) {
      if (node.props.importantForAccessibility === 'no-hide-descendants' || node.props.accessibilityElementsHidden) return true;
    }
    return false;
  };
  // Host Text headers reading "Exercises" that a screen reader can reach.
  const a11yHeaders = (root) =>
    root.findAll((node) => node.type === 'Text' && node.props.accessibilityRole === 'header' && textOf(node) === 'Exercises' && !hiddenFromA11y(node));
  const focusPanelFind = (root) => act(() => panelFind(root).props.onFocus({}));
  const blurPanelFind = (root) => act(() => panelFind(root).props.onBlur({}));
  const rerender = async (tree) => {
    await act(async () => {
      tree.update(<ExercisesScreen />);
    });
  };

  it('focus with the keyboard overlapping → the header block is collapsed and the row is the top block; the block leaves the accessibility tree', async () => {
    mockWidth = 1280;
    const tree = await render();
    expect(collapsed(tree.root)).toBe(false);
    focusPanelFind(tree.root);
    mockOverlap = 320;
    await rerender(tree);
    expect(collapsed(tree.root)).toBe(true);
    expect(flat(block(tree.root))).toMatchObject({ height: 0, overflow: 'hidden' });
    // The header block, then the row: nothing else takes height above it
    // (the screen-reader heading is absolute, see below).
    // (host → its View element → the content column)
    const content = block(tree.root).parent.parent;
    const inFlow = content.children.filter((node) => (flat(node) ?? {}).position !== 'absolute');
    expect(inFlow.map((node) => node.props.testID)).toEqual(['exercises-panel-header', 'exercises-panel-row']);
    // The whole collapsed block leaves the accessibility tree (device, 27 Oct:
    // TalkBack dropped the H1 inside the height-0 box anyway).
    expect(hiddenFromA11y(host(tree.root, 'exercises-title'))).toBe(true);
    expect(hiddenFromA11y(host(tree.root, 'exercises-toolbar'))).toBe(true);
    expect(hiddenFromA11y(host(tree.root, 'exercises-active-line'))).toBe(true);
    // The panel keeps its keyboard frame (24 + overlap).
    expect(flat(host(tree.root, 'exercises-filter-panel-frame')).paddingBottom).toBe(24 + 320);
  });

  // v2 fix (device check a90f405, 27 Oct 2026; PM GO): with the header
  // collapsed TalkBack found no "Exercises" heading (only the rail tab), so a
  // screen-reader-only H1 sits OUTSIDE the collapsed box while collapsed: not
  // visible, absolute (takes no room, the panel keeps its clearance).
  it('collapsed → exactly ONE reachable "Exercises" header, the screen-reader-only one; expanded → ONE, the visible title', async () => {
    mockWidth = 1280;
    mockOverlap = 320;
    const tree = await render();
    expect(a11yHeaders(tree.root).map((node) => node.props.testID)).toEqual(['exercises-title']);
    expect(hosts(tree.root, 'exercises-title-a11y')).toHaveLength(0);
    focusPanelFind(tree.root);
    expect(collapsed(tree.root)).toBe(true);
    expect(a11yHeaders(tree.root).map((node) => node.props.testID)).toEqual(['exercises-title-a11y']);
    const srOnly = host(tree.root, 'exercises-title-a11y');
    expect(srOnly.props.accessibilityRole).toBe('header');
    // Outside the collapsed box.
    let node = srOnly;
    while (node && node !== block(tree.root)) node = node.parent;
    expect(node).toBe(null);
    expect(flat(srOnly)).toMatchObject({ position: 'absolute', width: 1, height: 1, overflow: 'hidden', color: 'transparent' });
    blurPanelFind(tree.root);
    expect(a11yHeaders(tree.root).map((node) => node.props.testID)).toEqual(['exercises-title']);
    expect(hosts(tree.root, 'exercises-title-a11y')).toHaveLength(0);
  });

  // The optional reset test (reviewer, a90f405): the panel unmounts without a
  // blur on a rotation or a large-text change; coming back, the header is not
  // collapsed, though the keyboard frame still overlaps.
  it.each([
    ['rotation to portrait', () => { mockWidth = 800; }],
    ['large text', () => { mockFontScale = 1.5; }],
  ])('%s while collapsed, then back → restored, one visible H1', async (_label, leave) => {
    mockWidth = 1280;
    mockOverlap = 320;
    const tree = await render();
    focusPanelFind(tree.root);
    expect(collapsed(tree.root)).toBe(true);
    leave();
    await rerender(tree);
    expect(hosts(tree.root, 'exercises-panel-header')).toHaveLength(0);
    mockWidth = 1280;
    mockFontScale = 1;
    await rerender(tree);
    expect(collapsed(tree.root)).toBe(false);
    expect(a11yHeaders(tree.root).map((node) => node.props.testID)).toEqual(['exercises-title']);
  });

  it('blur → restored', async () => {
    mockWidth = 1280;
    mockOverlap = 320;
    const tree = await render();
    focusPanelFind(tree.root);
    expect(collapsed(tree.root)).toBe(true);
    blurPanelFind(tree.root);
    expect(collapsed(tree.root)).toBe(false);
    expect(flat(block(tree.root)) ?? {}).not.toHaveProperty('overflow');
    expect(hiddenFromA11y(host(tree.root, 'exercises-title'))).toBe(false);
  });

  it('keyboard hides (overlap 0) while still focused → restored', async () => {
    mockWidth = 1194;
    mockOverlap = 300;
    const tree = await render();
    focusPanelFind(tree.root);
    expect(collapsed(tree.root)).toBe(true);
    mockOverlap = 0;
    await rerender(tree);
    expect(collapsed(tree.root)).toBe(false);
  });

  it('focus with overlap 0 (floating / undocked keyboard) → NOT collapsed', async () => {
    mockWidth = 1280;
    mockKeyboard = 320;
    mockOverlap = 0;
    const tree = await render();
    focusPanelFind(tree.root);
    expect(collapsed(tree.root)).toBe(false);
  });

  it('the toolbar search field with the keyboard up never collapses it', async () => {
    mockWidth = 1280;
    mockOverlap = 320;
    const tree = await render();
    act(() => searchInput(tree.root).props.onFocus?.({}));
    expect(collapsed(tree.root)).toBe(false);
  });

  it.each([390, 834])('%i (sheet / dialog): unaffected — the header, toolbar and line stay list rows', async (width) => {
    mockWidth = width;
    mockOverlap = 320;
    mockKeyboard = 320;
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    const find = host(host(tree.root, 'app-modal-pinned-header'), 'exercise-filter-find');
    act(() => find.props.onFocus?.({}));
    await rerender(tree);
    expect(hosts(tree.root, 'exercises-panel-header')).toHaveLength(0);
    const data = tree.root.find((node) => node.props.testID === 'exercises-list' && Array.isArray(node.props.data)).props.data;
    expect(data.slice(0, 3).map((item) => item.type)).toEqual(['header', 'bar', 'line']);
  });

  it('large text at ≥ 1024 (button + dialog): unaffected', async () => {
    mockWidth = 1280;
    mockFontScale = 1.5;
    mockOverlap = 320;
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    const find = host(host(tree.root, 'app-modal-pinned-header'), 'exercise-filter-find');
    act(() => find.props.onFocus?.({}));
    expect(hosts(tree.root, 'exercises-panel-header')).toHaveLength(0);
  });
});

// QA M1 (candidate 2941880): a new find query shows its results from the top.
describe('M1: a new find query scrolls the filter list to the top (no animation)', () => {
  const scrollOf = (root, pick) => root.findAll((node) => typeof node.instance?.scrollTo === 'function' && pick(node))[0].instance;
  const typeInto = (find, text) => act(() => find().props.onChangeText(text));

  it('phone sheet: each changed query (typed or cleared) jumps the sheet body to y 0; opening it does not', async () => {
    const tree = await render();
    await press(tree.root, 'exercises-filter');
    const body = scrollOf(sheet(tree.root), () => true);
    const spy = jest.spyOn(body, 'scrollTo');
    const find = () => host(tree.root, 'exercise-filter-find');
    typeInto(find, 'b');
    typeInto(find, 'be');
    typeInto(find, '');
    expect(spy.mock.calls).toEqual([[{ y: 0, animated: false }], [{ y: 0, animated: false }], [{ y: 0, animated: false }]]);
  });

  it('≥ 1024 panel: its own list scroll jumps to y 0 on a new query', async () => {
    mockWidth = 1194;
    const tree = await render();
    const list = scrollOf(tree.root, (node) => node.props.testID === 'exercises-filter-panel-scroll');
    const spy = jest.spyOn(list, 'scrollTo');
    const find = () => host(host(tree.root, 'exercises-filter-panel'), 'exercise-filter-find');
    expect(spy).not.toHaveBeenCalled();
    typeInto(find, 'tr');
    expect(spy.mock.calls).toEqual([[{ y: 0, animated: false }]]);
  });
});
