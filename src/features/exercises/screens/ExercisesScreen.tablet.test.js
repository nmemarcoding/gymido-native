import { StyleSheet, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { listExercisesPage } from '../api/exercisesApi';
import { clearExerciseListCache } from '../exerciseListCache';
import ExercisesScreen from './ExercisesScreen';

// T-55: Exercises draws its own shell (a virtualised list with a sticky bar),
// so it uses the same TabletFrame as ShellPage: the rail at ≥ 768 in both
// orientations (the v1 DesktopSidebar is gone), the tab bar's spot below.
// T-56: the rail itself is drawn once by ShellOverlay; the frame reserves 88.
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    useNavigation: () => ({ push: jest.fn(), addListener: jest.fn(() => () => {}) }),
    useRoute: () => ({ key: 'Exercises-1', name: 'Exercises', params: {} }),
    useFocusEffect: (effect) => useEffect(effect, [effect]),
  };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) }));
jest.mock('../api/exercisesApi', () => ({ listExercisesPage: jest.fn(), listEquipmentTypes: jest.fn(() => Promise.resolve([])), listMuscleGroups: jest.fn(() => Promise.resolve([])) }));
jest.mock('../../shell/AppHeader', () => () => null);
jest.mock('../../shell/ModeSwitch', () => () => null);
jest.mock('../../shell/TabletRail', () => {
  const { View } = require('react-native');
  return function MockRail() {
    return <View testID="tablet-rail" />;
  };
});
jest.mock('../../../shared/components/BlurLayer', () => () => null);
jest.mock('../../../shared/components/RemoteImage', () => () => null);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const mounted = [];
beforeEach(() => {
  clearExerciseListCache();
  listExercisesPage.mockResolvedValue({ items: [{ id: 1, name: 'Ex 1', primary_muscle_group: { name: 'Chest' } }], pagination: { total_pages: 1 } });
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});

async function render(width, height) {
  useWindowDimensions.mockReturnValue({ width, height, scale: 2, fontScale: 1 });
  let tree;
  await act(async () => {
    tree = create(<ExercisesScreen />);
  });
  mounted.push(tree);
  return tree;
}

const host = (tree, id) => tree.root.findAll((node) => node.props?.testID === id && typeof node.type === 'string');

describe('Exercises in the tablet shell', () => {
  it.each([
    [834, 1194],
    [1194, 834],
    [1366, 1024],
  ])('%i × %i: room for the overlay rail, beside the list; the frame takes the top inset', async (width, height) => {
    const tree = await render(width, height);
    expect(host(tree, 'tablet-rail')).toHaveLength(0);
    expect(StyleSheet.flatten(host(tree, 'tablet-frame')[0].props.style).paddingLeft).toBe(88);
    expect(host(tree, 'desktop-sidebar')).toHaveLength(0);
    const list = tree.root.find((node) => node.props?.testID === 'exercises-list' && typeof node.type !== 'string');
    expect(list.findAll((node) => node.props?.testID === 'tablet-rail')).toHaveLength(0);
    expect(StyleSheet.flatten(host(tree, 'exercises-screen')[0].props.style).paddingTop).toBe(0);
    expect(StyleSheet.flatten(host(tree, 'tablet-frame-column')[0].props.style).paddingTop).toBe(24);
  });

  it('phone: no rail; the screen keeps the top inset', async () => {
    const tree = await render(390, 844);
    expect(host(tree, 'tablet-rail')).toHaveLength(0);
    expect(StyleSheet.flatten(host(tree, 'exercises-screen')[0].props.style).paddingTop).toBe(24);
  });
});
