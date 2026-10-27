import { ScrollView, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import Chip from '../../../shared/components/Chip';
import ExerciseImage from '../../../shared/components/ExerciseImage';
import { colors, muscle, muscleText, shadows } from '../../../shared/theme/tokens';
import { listExercisesPage } from '../api/exercisesApi';
import MuscleGroupSheet from '../components/MuscleGroupSheet';
import { clearExerciseListCache } from '../exerciseListCache';
import { filterChips, flatGridRows } from '../exercisesCatalog';
import ExercisesScreen from './ExercisesScreen';

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
jest.mock('../api/exercisesApi', () => ({ listExercisesPage: jest.fn() }));
jest.mock('../../shell/AppHeader', () => () => null);
jest.mock('../../shell/DesktopSidebar', () => () => null);
jest.mock('../../shell/ModeSwitch', () => () => null);
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => () => null);
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const host = (root, id) => root.find((node) => node.props.testID === id && typeof node.type === 'string');
const queryHost = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const press = (root, id) => act(() => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function').props.onPress());
const flat = (node) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);

const ITEMS = [
  { id: 1, name: 'Barbell Bench Press', primary_muscle_group: { name: 'Chest', code: 'CHEST' } },
  { id: 2, name: 'Lat Pulldown', primary_muscle_group: { name: 'Back', code: 'BACK' } },
  { id: 3, name: 'Push-up', primary_muscle_group: { name: 'Chest', code: 'CHEST' } },
  { id: 4, name: 'Plank' },
];

const mounted = [];
beforeEach(() => {
  clearExerciseListCache();
  mockWidth = 390;
  mockFontScale = 1;
  listExercisesPage.mockResolvedValue({ items: ITEMS, pagination: { total_pages: 1 } });
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});
async function render() {
  let tree;
  await act(async () => {
    tree = create(<ExercisesScreen />);
  });
  mounted.push(tree);
  return tree;
}
function renderSheet(props) {
  let tree;
  act(() => {
    tree = create(
      <MuscleGroupSheet open categories={['Back', 'Chest']} categoryCounts={{ Back: 1, Chest: 2 }} total={3} value="" onSelect={jest.fn()} onClose={jest.fn()} {...props} />
    );
  });
  mounted.push(tree);
  return tree;
}
const cardIds = (root) => root.findAll((node) => typeof node.type === 'string' && /^exercise-card-\d+$/.test(node.props.testID ?? '')).map((node) => node.props.testID);

describe('catalog helpers (ND-2 / ND-3)', () => {
  it('flatGridRows keeps the v1 group order with no headers', () => {
    const rows = flatGridRows([{ key: 'A', exercises: [1, 2, 3] }, { key: 'B', exercises: [4] }], 2);
    expect(rows.map((row) => row.type)).toEqual(['row', 'row']);
    expect(rows.map((row) => row.cards)).toEqual([[1, 2], [3, 4]]);
    expect(rows[0].firstInGroup).toBe(true);
  });
  it('filterChips: "All" + the raw groups', () => {
    expect(filterChips(['Back', 'Chest']).map((chip) => chip.label)).toEqual(['All', 'Back', 'Chest']);
  });
});

describe('Exercises (UX G, phone)', () => {
  it('flat grid in v1 order (Back, Chest, Other), no group headers', async () => {
    const tree = await render();
    expect(cardIds(tree.root)).toEqual(['exercise-card-2', 'exercise-card-1', 'exercise-card-3', 'exercise-card-4']);
    expect(tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'BACK')).toHaveLength(0);
  });

  it('chip row: "All" (on) + raw groups + the trailing "All muscle groups ▾"; a chip filters (single select)', async () => {
    const tree = await render();
    const chips = tree.root.findAllByType(Chip).map((chip) => [chip.props.label, chip.props.selected]);
    expect(chips).toEqual([['All', true], ['Back', false], ['Chest', false], ['Other', false]]);
    expect(host(tree.root, 'exercises-chips').type).toBe('RCTScrollView');
    // Review LOW: the scrolling chip row is a radiogroup too (as the reflow wrap).
    expect(host(tree.root, 'exercises-chips').props).toMatchObject({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Muscle group' });
    expect(texts(host(tree.root, 'exercises-filter'))).toEqual(['All muscle groups']);
    // Batch 3 (f): each chip is named by its visible text; no selected count anywhere.
    tree.root.findAllByType(Chip).forEach((chip) => {
      const node = host(tree.root, chip.props.testID);
      expect(node.props.accessibilityLabel).toBe(chip.props.label);
    });
    press(tree.root, 'exercises-chip-Chest');
    expect(host(tree.root, 'exercises-filter').props.accessibilityLabel).toBe('All muscle groups');
    expect(host(tree.root, 'exercises-chip-Chest').props.accessibilityState).toMatchObject({ selected: true });
    expect(cardIds(tree.root)).toEqual(['exercise-card-1', 'exercise-card-3']);
    expect(tree.root.findAllByType(Chip).filter((chip) => chip.props.selected).map((chip) => chip.props.label)).toEqual(['Chest']);
    press(tree.root, 'exercises-chip-all');
    expect(cardIds(tree.root)).toHaveLength(4);
  });

  it('the trailing chip opens the sheet', async () => {
    const tree = await render();
    expect(tree.root.findByType(MuscleGroupSheet).props.open).toBe(false);
    press(tree.root, 'exercises-filter');
    expect(tree.root.findByType(MuscleGroupSheet).props.open).toBe(true);
  });

  it('search: the 52 pill on surface, the 18 svg icon, faint placeholder', async () => {
    const tree = await render();
    const input = host(tree.root, 'exercises-search');
    expect(flat(input)).toMatchObject({ minHeight: 52, borderRadius: 999, backgroundColor: colors.surface, paddingLeft: 46 });
    expect(input.props.placeholderTextColor).toBe(colors.textFaint);
    expect(queryHost(tree.root, 'exercises-search-icon')).toHaveLength(1);
  });

  it('card: radius 24 surface, 108 image area (kit tile), the muscle chip in its text colour, name 2 lines, muscle sub-line', async () => {
    const tree = await render();
    const card = host(tree.root, 'exercise-card-1');
    expect(flat(card)).toMatchObject({ borderRadius: 24, backgroundColor: colors.surface, borderColor: colors.hairline });
    const image = tree.root.findAllByType(ExerciseImage)[1];
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({ height: 108 });
    const chip = host(tree.root, 'exercise-card-chip-1');
    expect(flat(chip).backgroundColor).toBe(colors.onPhoto);
    expect(flat(chip.findByType('Text')).color).toBe(muscleText.chest);
    const name = card.findAll((node) => node.type === 'Text' && textOf(node) === 'Barbell Bench Press')[0];
    expect(name.props.numberOfLines).toBe(2);
    expect(card.props.accessibilityLabel).toBe('Barbell Bench Press, Chest');
  });

  it('a card press opens the exercise', async () => {
    const tree = await render();
    press(tree.root, 'exercise-card-2');
    expect(mockNavigation.push).toHaveBeenCalledWith(expect.any(String), { exerciseId: '2' });
  });

  it.each([2, 3.1])('large text %s: the chips wrap (no horizontal scroll hides them); names keep 2 lines', async (scale) => {
    mockFontScale = scale;
    const tree = await render();
    const chips = host(tree.root, 'exercises-chips');
    expect(chips.type).toBe('View');
    expect(flat(chips)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(tree.root.findAllByType(ScrollView).filter((node) => node.props.testID === 'exercises-chips')).toHaveLength(0);
  });
});

describe('Exercises (tablet)', () => {
  it('H1 "Exercises" 40, search 320 wide, 150 image, 3 columns', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(flat(host(tree.root, 'exercises-title')).fontSize).toBe(40);
    expect(flat(host(tree.root, 'exercises-search-box')).width).toBe(320);
    expect(StyleSheet.flatten(tree.root.findAllByType(ExerciseImage)[1].props.style).height).toBe(150);
  });
});

describe('Muscle group sheet (v2 tiles)', () => {
  it('phone: floating inset sheet radius 32 on surface-card-2, sheet-up shadow, handle, Close glass', () => {
    const tree = renderSheet();
    expect(flat(host(tree.root, 'muscle-sheet'))).toMatchObject({ borderRadius: 32, backgroundColor: colors.surfaceCard2, boxShadow: shadows.sheetUp, marginHorizontal: 10 });
    expect(queryHost(tree.root, 'muscle-sheet-handle')).toHaveLength(1);
    expect(tree.root.findByProps({ testID: 'muscle-sheet-close' }).props).toMatchObject({ title: 'Close', variant: 'secondary' });
  });

  it('"All" selected: gold tint + check; tiles carry "{name}, {n} exercises" and the selected state', () => {
    const tree = renderSheet();
    const all = host(tree.root, 'muscle-sheet-option-all');
    expect(flat(all)).toMatchObject({ backgroundColor: colors.goldTint });
    expect(all.props.accessibilityState).toEqual({ selected: true });
    expect(queryHost(tree.root, 'muscle-sheet-all-check')).toHaveLength(1);
    // DECLARED (batch 3 (f), web parity): options are named by their visible text; was 'Chest, 2 exercises'.
    expect(host(tree.root, 'muscle-sheet-option-Chest').props.accessibilityLabel).toBe('Chest 2');
  });

  it('batch 3 (f): the sheet is "Filter by muscle group"; every option is named by its visible text ("{group} {n}", "All muscle groups {total}")', () => {
    [390, 834].forEach((width) => {
      mockWidth = width;
      const tree = renderSheet();
      expect(host(tree.root, 'muscle-sheet').props.accessibilityLabel).toBe('Filter by muscle group');
      const all = host(tree.root, 'muscle-sheet-option-all');
      expect(all.props.accessibilityLabel).toBe('All muscle groups 3');
      expect(texts(all).join(' ')).toBe('All muscle groups 3');
      const back = host(tree.root, 'muscle-sheet-option-Back');
      expect(back.props.accessibilityLabel).toBe('Back 1');
      expect(texts(back).join(' ')).toBe('Back 1');
      expect(back.props.accessibilityLabel).not.toMatch(/selected|exercises/);
    });
  });

  it('a group selected: its tile gets the muscle border + filled check; All becomes a normal tile', () => {
    const tree = renderSheet({ value: 'Chest' });
    expect(flat(host(tree.root, 'muscle-sheet-tile-Chest')).borderColor).toBe(muscle.chest);
    expect(queryHost(tree.root, 'muscle-sheet-check-Chest')).toHaveLength(1);
    expect(flat(host(tree.root, 'muscle-sheet-option-all')).backgroundColor).toBe(colors.surfaceRaised);
    expect(host(tree.root, 'muscle-sheet-option-Chest').props.accessibilityState).toEqual({ selected: true });
  });

  it('selecting a tile calls onSelect with the raw value; Close and scrim close', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const tree = renderSheet({ onSelect, onClose });
    press(tree.root, 'muscle-sheet-option-Back');
    expect(onSelect).toHaveBeenCalledWith('Back');
    press(tree.root, 'muscle-sheet-option-all');
    expect(onSelect).toHaveBeenCalledWith('');
    press(tree.root, 'muscle-sheet-scrim');
    expect(onClose).toHaveBeenCalled();
  });

  it('tablet: centred 620 card (radius 36, sheet shadow), no handle, 3 columns', () => {
    mockWidth = 834;
    const tree = renderSheet();
    expect(flat(host(tree.root, 'muscle-sheet'))).toMatchObject({ width: 620, borderRadius: 36, boxShadow: shadows.sheet });
    expect(queryHost(tree.root, 'muscle-sheet-handle')).toHaveLength(0);
    expect(flat(host(tree.root, 'muscle-sheet-option-Back')).width).toBe(`${100 / 3}%`);
  });

  it.each([1, 2, 3.1])('large text %s: title cap 1.6 + word fit; counts capped 1.3; title row stacks past 1.3', (scale) => {
    mockFontScale = scale;
    const tree = renderSheet();
    const title = tree.root.find((node) => node.type === 'Text' && textOf(node) === 'Muscle group');
    expect(title.props).toMatchObject({ maxFontSizeMultiplier: 1.6, adjustsFontSizeToFit: true });
    expect(flat(host(tree.root, 'muscle-sheet-title-row')).flexDirection).toBe(scale > 1.3 ? 'column' : 'row');
  });
});

function texts(node) {
  return node.findAll((child) => child.type === 'Text').map(textOf);
}
