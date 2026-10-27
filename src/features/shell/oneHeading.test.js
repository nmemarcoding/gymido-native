// RN-SPEC-app-shell §6.1, dated change 27 Oct 2026 (audit b1 X1): every state
// of a page (loaded, loading, error, not found) has EXACTLY ONE page heading.
// The coaching / trainer pages draw their own hero title once loaded (the
// shell header is then untitled); a state without it keeps the header
// "Coaching". The shell page here is ShellPage's own wiring (the hero-title
// registry + the real AppHeader) without the scroll / safe-area frame.

let mockPath = '/trainers/8';
let mockParams = {};
let mockWidth = 390;
const mockNavigation = { push: jest.fn(), navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}) };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1000, scale: 2, fontScale: 1 }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'route-1', name: 'Route', params: mockParams }),
  useIsFocused: () => true,
  useFocusEffect: jest.fn(),
  CommonActions: { reset: jest.fn() },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()), removeItem: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../shared/components/GradientFill', () => () => null);
jest.mock('../../shared/components/BlurLayer', () => () => null);
jest.mock('../../shared/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('../notifications/bellPolling', () => ({ mountBell: jest.fn() }));
jest.mock('../notifications/NotificationBell', () => () => null);
jest.mock('./ModeSwitch', () => () => null);
jest.mock('./shellLinks', () => ({ openShellPath: jest.fn(), handOffToWorkout: jest.fn() }));
jest.mock('../trainer/clients/clientLinks', () => ({ openClientDetail: jest.fn(), openAssignPlan: jest.fn() }));
jest.mock('../trainer/TrainerOnly', () => ({ children }) => children);
jest.mock('../trainer/plans/loadExerciseCatalog', () => ({ wait: () => Promise.resolve() }));
jest.mock('../trainer/plans/components/ExercisePickerSheet', () => () => null);
jest.mock('react-native-draggable-flatlist', () => {
  const { Fragment: F } = require('react');
  return {
    NestableDraggableFlatList: ({ data, renderItem, keyExtractor }) =>
      data.map((item) => <F key={keyExtractor(item)}>{renderItem({ item, drag: jest.fn(), isActive: false })}</F>),
  };
});
jest.mock('./ShellPage', () => {
  const { View } = require('react-native');
  const AppHeader = require('./AppHeader').default;
  const { HeroTitleProvider, useHeroTitleRegistry } = require('./heroTitle');
  return function MockShellPage({ children }) {
    const { registry, heroTitleShown } = useHeroTitleRegistry();
    return (
      <View>
        <AppHeader path={mockPath} mode="member" heroTitleShown={heroTitleShown} />
        <HeroTitleProvider value={registry}>{children}</HeroTitleProvider>
      </View>
    );
  };
});

import { act, create } from 'react-test-renderer';

import { apiClient } from '../../shared/api/client';
import ClientDetailScreen from '../trainer/clients/screens/ClientDetailScreen';
import PlanScreen from '../trainer/plans/screens/PlanScreen';
import TrainerDetailScreen from '../trainers/screens/TrainerDetailScreen';

const ok = (value) => Promise.resolve({ data: { data: value } });
const fail = (status) => Promise.reject({ response: { status, data: { message: 'Server says no' } } });
const pending = () => new Promise(() => {});

// url → value | (() => promise); anything else is an empty list.
let routes = [];
function setRoutes(list) {
  routes = list;
  apiClient.get.mockImplementation((url) => {
    const hit = routes.find(([pattern]) => (typeof pattern === 'string' ? url === pattern : pattern.test(url)));
    if (!hit) {
      return ok({ items: [] });
    }
    return typeof hit[1] === 'function' ? hit[1]() : ok(hit[1]);
  });
}

const mounted = [];
async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});

const textOf = (node) =>
  []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
// The page-level headings: the shell header's title + the page's top-level
// title. Section headings inside the loaded page are H2s (role header too in
// RN), so the loaded check names the one page title instead of counting them.
const headings = (tree) =>
  tree.root.findAll((node) => node.type === 'Text' && node.props.accessibilityRole === 'header').map(textOf);

const TRAINER = { user_id: 8, display_name: 'Sara Lopez', email: 'sara@example.com', bio: 'Strength coach.' };
const CLIENT_PROFILE = { first_name: 'Ana', last_name: 'Diaz', current_weight_value: 64, current_weight_unit: 'kg' };
const PLAN = { id: 9, name: 'Strength block', is_active: true, days_per_week: 3, created_by_user_id: 1 };

const PAGES = [
  {
    name: 'Trainer detail (/trainers/:id)',
    path: '/trainers/8',
    params: { trainerUserId: '8' },
    Screen: TrainerDetailScreen,
    hero: 'Sara Lopez',
    states: {
      loading: [[/^\/trainers\/8$/, pending]],
      error: [[/^\/trainers\/8$/, () => fail(500)]],
      'not found': [[/^\/trainers\/8$/, () => fail(404)]],
      loaded: [[/^\/trainers\/8$/, { trainer: TRAINER }]],
    },
  },
  {
    name: 'Client detail (/trainer/clients/:id)',
    path: '/trainer/clients/7',
    params: { clientUserId: 7 },
    Screen: ClientDetailScreen,
    hero: 'Ana Diaz',
    // Web parity (review f403f6f): client detail keeps ONE h1 "Client" in
    // loading / not found / error (§6.1 + §C4.2); the shell stays untitled.
    stateHeading: 'Client',
    states: {
      loading: [[/^\/trainer\/clients\/7\/profile$/, pending]],
      error: [[/^\/trainer\/clients\/7\/profile$/, () => fail(500)]],
      'not found': [[/^\/trainer\/clients\/7\/profile$/, () => fail(404)]],
      loaded: [[/^\/trainer\/clients\/7\/profile$/, { profile: CLIENT_PROFILE }]],
    },
  },
  {
    name: 'Trainer plan builder (/trainer/plans/:id)',
    path: '/trainer/plans/9',
    params: { planId: 9 },
    Screen: PlanScreen,
    hero: 'Strength block',
    states: {
      loading: [[/^\/trainer\/plans\/9$/, pending]],
      error: [[/^\/trainer\/plans\/9$/, () => fail(500)]],
      'not found': [[/^\/trainer\/plans\/9$/, () => fail(404)]],
      loaded: [
        [/^\/trainer\/plans\/9$/, { plan: PLAN }],
        [/^\/plans\/9$/, () => fail(404)],
      ],
    },
  },
];

describe.each([390, 834])('§6.1 one heading per page state (width %i)', (width) => {
  beforeEach(() => {
    mockWidth = width;
  });

  describe.each(PAGES)('$name', ({ path, params, Screen, hero, states, stateHeading = 'Coaching' }) => {
    beforeEach(() => {
      mockPath = path;
      mockParams = params;
    });

    it.each(['loading', 'error', 'not found'])('%s: exactly one heading (the page state title, else the header "Coaching")', async (state) => {
      setRoutes(states[state]);
      const tree = await render(<Screen />);
      expect(headings(tree)).toEqual([stateHeading]);
    });

    it('loaded: the hero title is the one page heading; the header has none', async () => {
      setRoutes(states.loaded);
      const tree = await render(<Screen />);
      const shown = headings(tree);
      // The header renders first: a header title would be shown[0]. (A later
      // "Coaching" is the client page's own section heading, not the header.)
      expect(shown[0]).toBe(hero);
      expect(shown.filter((text) => text === hero)).toHaveLength(1);
    });
  });
});

describe('the header falls back again when the hero title goes away', () => {
  it('a hero title registered → no header title; unregistered → "Coaching" again', async () => {
    mockPath = '/trainer/clients';
    const { Text } = require('react-native');
    const { HeroTitleMark } = require('./heroTitle');
    const MockShellPage = require('./ShellPage');
    const page = (show) => (
      <MockShellPage>
        {show ? (
          <>
            <HeroTitleMark />
            <Text accessibilityRole="header">Clients</Text>
          </>
        ) : null}
      </MockShellPage>
    );
    const tree = await render(page(true));
    expect(headings(tree)).toEqual(['Clients']);
    await act(async () => {
      tree.update(page(false));
    });
    expect(headings(tree)).toEqual(['Coaching']);
  });

  it('outside the coaching / trainer paths the mark changes nothing (the builder is shared with member plans)', async () => {
    mockPath = '/progress';
    const { HeroTitleMark } = require('./heroTitle');
    const MockShellPage = require('./ShellPage');
    const tree = await render(<MockShellPage>{null}</MockShellPage>);
    expect(headings(tree)).toEqual(['Progress']);
    await act(async () => {
      tree.update(
        <MockShellPage>
          <HeroTitleMark />
        </MockShellPage>
      );
    });
    expect(headings(tree)).toEqual(['Progress']);
  });
});
