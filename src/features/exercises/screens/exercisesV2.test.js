import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import ExerciseImage from '../../../shared/components/ExerciseImage';
import { colors, muscleText } from '../../../shared/theme/tokens';
import { listExercisesPage } from '../api/exercisesApi';
import { clearExerciseListCache } from '../exerciseListCache';
import { flatGridRows } from '../exercisesCatalog';
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
jest.mock('../api/exercisesApi', () => ({ listExercisesPage: jest.fn(), listEquipmentTypes: jest.fn(() => Promise.resolve([])), listMuscleGroups: jest.fn(() => Promise.resolve([])) }));
jest.mock('../../shell/AppHeader', () => () => null);
jest.mock('../../shell/TabletRail', () => () => null); // T-55 replaced DesktopSidebar (merge resolution)
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
const cardIds = (root) => root.findAll((node) => typeof node.type === 'string' && /^exercise-card-\d+$/.test(node.props.testID ?? '')).map((node) => node.props.testID);

describe('catalog helpers (ND-2 / ND-3)', () => {
  it('flatGridRows keeps the v1 group order with no headers', () => {
    const rows = flatGridRows([{ key: 'A', exercises: [1, 2, 3] }, { key: 'B', exercises: [4] }], 2);
    expect(rows.map((row) => row.type)).toEqual(['row', 'row']);
    expect(rows.map((row) => row.cards)).toEqual([[1, 2], [3, 4]]);
    expect(rows[0].firstInGroup).toBe(true);
  });
});

describe('Exercises (UX G, phone)', () => {
  it('flat grid in v1 order (Back, Chest, Other), no group headers', async () => {
    const tree = await render();
    expect(cardIds(tree.root)).toEqual(['exercise-card-2', 'exercise-card-1', 'exercise-card-3', 'exercise-card-4']);
    expect(tree.root.findAll((node) => node.type === 'Text' && textOf(node) === 'BACK')).toHaveLength(0);
  });

  // DECLARED (T-62, 27 Oct 2026): the chip row tests ("All" + raw groups +
  // the trailing "All muscle groups ▾" chip, and the chip that opens the
  // §E2 sheet) are replaced by exercisesFilter.test.js (the Filter button).

  // DECLARED (final device audit, 27 Oct 2026): the pill (52, radius,
  // surface, padding-left 46) is drawn by the search box, not the TextInput
  // (Android re-set the input's padding when its focus ring changed it).
  it('search: the 52 pill on surface, the 18 svg icon, faint placeholder', async () => {
    const tree = await render();
    const input = host(tree.root, 'exercises-search');
    expect(flat(host(tree.root, 'exercises-search-box'))).toMatchObject({ minHeight: 52, borderRadius: 999, backgroundColor: colors.surface, paddingLeft: 46 });
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
});

describe('Exercises (tablet)', () => {
  // DECLARED (T-62): the search was 320 wide; it is now flex 1 beside the Filter button.
  it('H1 "Exercises" 40, search flex 1 (T-62 toolbar), 150 image, 3 columns', async () => {
    mockWidth = 834;
    const tree = await render();
    expect(flat(host(tree.root, 'exercises-title')).fontSize).toBe(40);
    expect(flat(host(tree.root, 'exercises-search-box'))).toMatchObject({ flex: 1, minWidth: 0 });
    expect(StyleSheet.flatten(tree.root.findAllByType(ExerciseImage)[1].props.style).height).toBe(150);
  });
});

// DECLARED (T-62): the §E2 "Muscle group" tile sheet (MuscleGroupSheet) is
// retired with its tests; the filter sheet / dialog is covered in
// exercisesFilter.test.js.
