import { AccessibilityInfo, Platform } from 'react-native';
import { act, create } from 'react-test-renderer';

import { AuthStatus, useAuthStore } from '../../auth/authStore';
import { listExercisesPage } from '../api/exercisesApi';
import { clearExerciseListCache, getCachedList } from '../exerciseListCache';
import ExercisesScreen from './ExercisesScreen';

const mockListeners = {};
const mockNavigation = {
  push: jest.fn(),
  addListener: jest.fn((event, callback) => {
    mockListeners[event] = callback;
    return () => {};
  }),
};
let mockRouteParams = {};

jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => ({ key: 'Exercises-1', name: 'Exercises', params: mockRouteParams }),
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

beforeEach(() => {
  clearExerciseListCache();
  mockRouteParams = {};
});

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

describe('§E1.1a session cache and return (T-12 F3)', () => {
  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
  const leaveAndReturn = async () => {
    await act(async () => {
      mockListeners.blur();
      mockListeners.focus();
    });
  };

  it('caches a complete list, shows it at once on return, and swaps in the reload only when it is whole', async () => {
    listExercisesPage.mockImplementation((n) => Promise.resolve(page([ex(n)], 2)));
    const tree = await render();
    expect(getCachedList('')).toEqual([ex(1), ex(2)]);

    const first = deferred();
    listExercisesPage.mockClear();
    listExercisesPage.mockImplementation((n) => (n === 1 ? first.promise : Promise.resolve(page([ex(5)], 2))));
    await leaveAndReturn();
    expect(listExercisesPage).toHaveBeenCalledWith(1, '');
    let shown = texts(tree.root);
    expect(shown).not.toContain('Loading exercises');
    expect(shown).toEqual(expect.arrayContaining(['Ex 1', 'Ex 2']));

    await act(async () => {
      first.resolve(page([ex(4)], 2));
    });
    shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Ex 4', 'Ex 5']));
    expect(shown).not.toContain('Ex 1');
    expect(getCachedList('')).toEqual([ex(4), ex(5)]);
  });

  it('keeps the cached list with no error or alert when the quiet reload fails', async () => {
    listExercisesPage.mockImplementation((n) => Promise.resolve(page([ex(n)], 2)));
    const tree = await render();
    listExercisesPage.mockImplementation((n) => (n === 1 ? Promise.resolve(page([ex(9)], 2)) : Promise.reject(failure)));
    await leaveAndReturn();
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Ex 1', 'Ex 2']));
    expect(shown).not.toContain("Some exercises didn't load");
    expect(shown).not.toContain('Exercises unavailable');
    expect(shown).not.toContain('Ex 9');
  });

  it('never caches page 1 alone', async () => {
    listExercisesPage.mockImplementation((n) => (n === 1 ? Promise.resolve(page([ex(1)], 2)) : Promise.reject(failure)));
    await render();
    expect(getCachedList('')).toBeNull();
  });

  it('starts fresh on a new entry (tab press or link), from the cache', async () => {
    listExercisesPage.mockImplementation((n) => Promise.resolve(page([ex(n)], 1)));
    const tree = await render();
    const input = () => tree.root.find((node) => node.props.placeholder === 'Search exercises' && node.props.onChangeText);
    act(() => input().props.onChangeText('row'));
    await act(async () => {
      input().props.onSubmitEditing();
    });
    expect(listExercisesPage).toHaveBeenLastCalledWith(1, 'row');
    listExercisesPage.mockClear();
    mockRouteParams = { entry: 1 };
    await act(async () => {
      tree.update(<ExercisesScreen />);
    });
    expect(input().props.value).toBe('');
    expect(listExercisesPage).toHaveBeenCalledWith(1, '');
    expect(texts(tree.root)).not.toContain('Loading exercises');
  });

  it('a return with no cache but a list on screen reloads quietly (review M2)', async () => {
    listExercisesPage.mockImplementation((n) => (n === 1 ? Promise.resolve(page([ex(1)], 2)) : Promise.reject(failure)));
    const tree = await render();
    expect(getCachedList('')).toBeNull();

    const first = deferred();
    listExercisesPage.mockImplementation((n) => (n === 1 ? first.promise : Promise.resolve(page([ex(2)], 2))));
    await leaveAndReturn();
    expect(texts(tree.root)).not.toContain('Loading exercises');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Ex 1']));

    await act(async () => {
      first.resolve(page([ex(1)], 2));
    });
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Ex 1', 'Ex 2']));
    expect(shown).not.toContain("Some exercises didn't load");
    expect(getCachedList('')).toEqual([ex(1), ex(2)]);
  });

  it('keeps what is shown when that quiet reload fails on page 1 (review M2)', async () => {
    listExercisesPage.mockImplementation((n) => (n === 1 ? Promise.resolve(page([ex(1)], 2)) : Promise.reject(failure)));
    const tree = await render();
    listExercisesPage.mockRejectedValue(failure);
    await leaveAndReturn();
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Ex 1', "Some exercises didn't load"]));
    expect(shown).not.toContain('Exercises unavailable');
    expect(shown).not.toContain('Loading exercises');
  });

  it('is cleared on sign-out', async () => {
    useAuthStore.setState({ status: AuthStatus.signedIn });
    listExercisesPage.mockImplementation((n) => Promise.resolve(page([ex(n)], 1)));
    await render();
    expect(getCachedList('')).toEqual([ex(1)]);
    act(() => useAuthStore.setState({ status: AuthStatus.signedOut }));
    expect(getCachedList('')).toBeNull();
  });
});

describe('§E1.2 step 1: a search reload keeps the list (T-12 F2)', () => {
  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
  const input = (tree) => tree.root.find((node) => node.props.placeholder === 'Search exercises' && node.props.onChangeText);
  const spinners = (tree) => tree.root.findAll((node) => node.props.testID === 'exercises-search-spinner' && typeof node.type === 'string');
  async function searchFor(tree, text) {
    act(() => input(tree).props.onChangeText(text));
    await act(async () => {
      input(tree).props.onSubmitEditing();
    });
  }

  it('keeps bar, list and filter with a spinner, announces once, then page 1 replaces the list', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    listExercisesPage.mockImplementation(() => Promise.resolve(page([ex(1)], 1)));
    const tree = await render();
    expect(spinners(tree)).toHaveLength(0);
    const rowPage = deferred();
    listExercisesPage.mockImplementation(() => rowPage.promise);
    await searchFor(tree, 'row');
    let shown = texts(tree.root);
    expect(shown).not.toContain('Loading exercises');
    expect(shown).toContain('Ex 1');
    expect(spinners(tree)).toHaveLength(1);
    expect(input(tree).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ paddingRight: 44 })]));
    expect(announce.mock.calls.filter((call) => call[0] === 'Searching…')).toHaveLength(1);
    expect(tree.root.find((node) => node.props.testID === 'exercises-list' && node.props.accessibilityState).props.accessibilityState).toEqual({ busy: true });

    await act(async () => {
      rowPage.resolve(page([ex(7)], 1));
    });
    shown = texts(tree.root);
    expect(shown).toContain('Ex 7');
    expect(shown).not.toContain('Ex 1');
    expect(spinners(tree)).toHaveLength(0);
  });

  it('hides the iOS clear button while a search loads (T-12 F2, the × sat on the spinner)', async () => {
    listExercisesPage.mockImplementation(() => Promise.resolve(page([ex(1)], 1)));
    const tree = await render();
    const idle = Platform.OS === 'ios' ? 'while-editing' : 'never';
    expect(input(tree).props.clearButtonMode).toBe(idle);
    const rowPage = deferred();
    listExercisesPage.mockImplementation(() => rowPage.promise);
    await searchFor(tree, 'row');
    expect(spinners(tree)).toHaveLength(1);
    expect(input(tree).props.clearButtonMode).toBe('never');
    await act(async () => {
      rowPage.resolve(page([ex(7)], 1));
    });
    expect(spinners(tree)).toHaveLength(0);
    expect(input(tree).props.clearButtonMode).toBe(idle);
  });

  it("drops the old search's partial alert when a new search starts (review M1)", async () => {
    listExercisesPage.mockImplementation((n) => (n === 1 ? Promise.resolve(page([ex(1)], 2)) : Promise.reject(failure)));
    const tree = await render();
    expect(texts(tree.root)).toContain("Some exercises didn't load");
    const pending = deferred();
    listExercisesPage.mockImplementation(() => pending.promise);
    await searchFor(tree, 'row');
    expect(texts(tree.root)).not.toContain("Some exercises didn't load");
    expect(tree.root.findAll((node) => node.props.title === 'Retry')).toHaveLength(0);
  });

  it('lets the newest search win', async () => {
    listExercisesPage.mockImplementation(() => Promise.resolve(page([ex(1)], 1)));
    const tree = await render();
    const older = deferred();
    const newer = deferred();
    listExercisesPage.mockImplementation((n, search) => (search === 'a' ? older.promise : newer.promise));
    await searchFor(tree, 'a');
    await searchFor(tree, 'b');
    await act(async () => {
      newer.resolve(page([ex(8)], 1));
    });
    await act(async () => {
      older.resolve(page([ex(9)], 1));
    });
    const shown = texts(tree.root);
    expect(shown).toContain('Ex 8');
    expect(shown).not.toContain('Ex 9');
    expect(spinners(tree)).toHaveLength(0);
  });

  it('shows the full error screen when page 1 of the search fails', async () => {
    listExercisesPage.mockImplementation(() => Promise.resolve(page([ex(1)], 1)));
    const tree = await render();
    listExercisesPage.mockRejectedValue(failure);
    await searchFor(tree, 'row');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Exercises unavailable', 'Request failed with status code 500']));
    expect(spinners(tree)).toHaveLength(0);
  });

  it('shows a cached search at once with no spinner', async () => {
    listExercisesPage.mockImplementation((n, search) => Promise.resolve(page([search === 'row' ? ex(5) : ex(1)], 1)));
    const tree = await render();
    await searchFor(tree, 'row');
    await searchFor(tree, '');
    const pending = deferred();
    listExercisesPage.mockImplementation(() => pending.promise);
    await searchFor(tree, 'row');
    expect(texts(tree.root)).toContain('Ex 5');
    expect(spinners(tree)).toHaveLength(0);
  });

  it('keeps the full-screen Loader for the first load', async () => {
    listExercisesPage.mockImplementation(() => new Promise(() => {}));
    const tree = await render();
    expect(texts(tree.root)).toContain('Loading exercises');
    expect(spinners(tree)).toHaveLength(0);
  });
});
