import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import AppModal from '../../../shared/components/AppModal';
import { colors, font } from '../../../shared/theme/tokens';
import { listEquipmentTypes, listExercisesPage } from '../api/exercisesApi';
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
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../api/exercisesApi', () => ({ listExercisesPage: jest.fn(), listEquipmentTypes: jest.fn() }));
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
const searchInput = (root) => root.find((node) => node.props.placeholder === 'Search exercises' && node.props.onChangeText);

const mounted = [];
let announce;
beforeEach(() => {
  clearExerciseListCache();
  mockWidth = 390;
  mockFontScale = 1;
  listExercisesPage.mockResolvedValue({ items: ITEMS, pagination: { total_pages: 1 } });
  listEquipmentTypes.mockResolvedValue(TYPES);
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
    expect(host(tree.root, 'exercise-filter-find').props.placeholder).toBe('Find a muscle or equipment');
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
    expect(host(tree.root, 'exercise-filter-find').props.placeholder).toBe('Find a muscle');
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
  // beside the results ('100%'), was window − 48 beside the whole page.
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
      marginTop: 24,
      maxHeight: '100%',
    });
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
