import { act, create } from 'react-test-renderer';

import { listExercisesPage } from '../api/exercisesApi';
import ExercisesScreen from './ExercisesScreen';

const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };

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
jest.mock('../components/MuscleGroupSheet', () => () => null);

const ex = (id) => ({ id, name: `Ex ${id}`, primary_muscle_group: { name: 'Chest' } });
const page = (items, totalPages) => ({ items, pagination: { total_pages: totalPages } });
const failure = new Error('Request failed with status code 500');

const texts = (root) =>
  root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
const retryButton = (root) => root.find((node) => node.props.title === 'Retry' && typeof node.props.onPress === 'function');

const mounted = [];
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

describe('§E1.2 step 4: a later page fails (T-16)', () => {
  it('keeps page 1 with the alert, and Retry re-fetches pages 2…N only', async () => {
    listExercisesPage.mockImplementation((n) => (n === 1 ? Promise.resolve(page([ex(1)], 3)) : n === 2 ? Promise.reject(failure) : Promise.resolve(page([ex(n)], 3))));
    const tree = await render();
    let shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(["Some exercises didn't load", 'Request failed with status code 500', 'Ex 1']));
    expect(shown).not.toContain('Exercises unavailable');
    expect(shown).not.toContain('Ex 3');

    listExercisesPage.mockClear();
    listExercisesPage.mockImplementation((n) => Promise.resolve(page([ex(n)], 3)));
    await act(async () => {
      retryButton(tree.root).props.onPress();
    });
    expect(listExercisesPage.mock.calls).toEqual([
      [2, ''],
      [3, ''],
    ]);
    shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Ex 1', 'Ex 2', 'Ex 3']));
    expect(shown).not.toContain("Some exercises didn't load");
  });

  it('shows the alert again when the retry fails', async () => {
    listExercisesPage.mockImplementation((n) => (n === 1 ? Promise.resolve(page([ex(1)], 2)) : Promise.reject(failure)));
    const tree = await render();
    await act(async () => {
      retryButton(tree.root).props.onPress();
    });
    expect(texts(tree.root)).toEqual(expect.arrayContaining(["Some exercises didn't load", 'Ex 1']));
  });

  it('still replaces the screen when page 1 fails (⚠E-4)', async () => {
    listExercisesPage.mockRejectedValue(failure);
    const tree = await render();
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Exercises unavailable', 'Request failed with status code 500']));
    expect(tree.root.findAll((node) => node.props.title === 'Retry')).toHaveLength(0);
  });
});
