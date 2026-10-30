import { useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import EmptyState from '../../../shared/components/EmptyState';
import ErrorAlert from '../../../shared/components/ErrorAlert';
import { useAuthStore } from '../../auth/authStore';
import { listCatalogPlans, listTrainerPlans } from './api/plansApi';
import PlanCard from './components/PlanCard';
import { PLANS_SUBTITLE, matchesPlanName, splitPlans } from './plansListFormat';
import PlansListScreen, { BROWSE_SUBTITLE, assigneeLabel } from './screens/PlansListScreen';

const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockParams = {};

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'TrainerPlans-1', name: 'TrainerPlans', params: mockParams }),
}));
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../shell/ShellPage', () => (props) => props.children);
jest.mock('../TrainerOnly', () => ({ children }) => children);
jest.mock('../clients/clientLinks', () => ({ openClientSelection: jest.fn() }));
jest.mock('../clients/api/clientsApi', () => ({ assignPlan: jest.fn() }));
jest.mock('./api/plansApi', () => ({ listTrainerPlans: jest.fn(), listCatalogPlans: jest.fn() }));

const MINE = { id: 31, name: 'Sara Strength Block', days_per_week: 3, category: { name: 'Strength' } };
const PUBLIC_A = { id: 1, name: 'Upper / Lower Split', days_per_week: 4, category: { name: 'Strength' } };
const PUBLIC_B = { id: 2, name: 'Push / Pull / Legs', days_per_week: 6, category: null };
const POOL = [PUBLIC_A, MINE, PUBLIC_B];

const texts = (root) =>
  root
    .findAll((node) => node.type === 'Text')
    .map((node) =>
      []
        .concat(node.props.children)
        .filter((c) => typeof c !== 'object')
        .join(''),
    );
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string')[0];
const comp = (root, id) => root.find((node) => node.props.testID === id && typeof node.type !== 'string');
const cardIds = (section) => section.findAllByType(PlanCard).map((node) => node.props.plan.id);

const mounted = [];
async function render() {
  let tree;
  await act(async () => {
    tree = create(<PlansListScreen />);
  });
  mounted.push(tree);
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  useWindowDimensions.mockReturnValue({ width: 390, height: 900, scale: 2, fontScale: 1 });
  useAuthStore.setState({ user: { roles: ['trainer'] } });
  listTrainerPlans.mockResolvedValue(POOL);
  listCatalogPlans.mockResolvedValue([PUBLIC_A, PUBLIC_B]);
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  useAuthStore.setState({ user: null });
});

describe('T-121 H1 helpers', () => {
  it('splitPlans: pool plans missing from the catalog are mine; admin or no catalog = one list', () => {
    expect(splitPlans({ pool: POOL, catalog: [PUBLIC_A, PUBLIC_B] })).toEqual({ split: true, own: [MINE], catalog: [PUBLIC_A, PUBLIC_B] });
    // ids compare as strings (the wire may mix).
    expect(splitPlans({ pool: [{ id: '1' }], catalog: [{ id: 1 }] }).own).toEqual([]);
    expect(splitPlans({ pool: POOL, catalog: [PUBLIC_A], admin: true })).toEqual({ split: false, own: [], catalog: POOL });
    expect(splitPlans({ pool: POOL, catalog: null }).split).toBe(false);
  });

  it('matchesPlanName: trimmed, case-insensitive; empty matches all', () => {
    expect(matchesPlanName(PUBLIC_A, '  upper ')).toBe(true);
    expect(matchesPlanName(PUBLIC_A, 'legs')).toBe(false);
    expect(matchesPlanName({ name: null }, '')).toBe(true);
  });

  it('the one-line copy; M10 assignee label falls back to "client #id"', () => {
    expect(BROWSE_SUBTITLE).toBe(PLANS_SUBTITLE);
    expect(PLANS_SUBTITLE).toBe('Your plans and the public catalog. Copy a catalog plan to change it.');
    expect(assigneeLabel('42', 'Sara Lopez')).toBe('Sara Lopez');
    expect(assigneeLabel('42', '  ')).toBe('client #42');
    expect(assigneeLabel('42')).toBe('client #42');
  });
});

describe('T-121 H1 Trainer Plans', () => {
  it('"Your plans" first (Private chip before the category), then "Catalog"; headings are headers', async () => {
    const tree = await render();
    const own = host(tree.root, 'plans-section-own');
    const catalog = host(tree.root, 'plans-section-catalog');
    expect(cardIds(own)).toEqual([31]);
    expect(cardIds(catalog)).toEqual([1, 2]);
    const order = tree.root.findAll((node) => typeof node.type === 'string' && ['plans-section-own', 'plans-section-catalog'].includes(node.props.testID));
    expect(order.map((node) => node.props.testID)).toEqual(['plans-section-own', 'plans-section-catalog']);
    expect(host(tree.root, 'plan-card-private-31')).toBeTruthy();
    expect(host(tree.root, 'plan-card-private-1')).toBeUndefined();
    const chips = host(tree.root, 'plan-card-31').findAll((node) => typeof node.type === 'string' && /^plan-card-(private|category)-31$/.test(node.props.testID));
    expect(chips.map((node) => node.props.testID)).toEqual(['plan-card-private-31', 'plan-card-category-31']);
    const headers = tree.root.findAll((node) => node.type === 'Text' && node.props.accessibilityRole === 'header').map((node) => node.props.children);
    expect(headers).toEqual(expect.arrayContaining(['Your plans', 'Catalog']));
    expect(texts(tree.root)).toContain(PLANS_SUBTITLE);
    // The dashed Create tile ends "Your plans" (web).
    expect(own.findAll((node) => node.props.testID === 'plans-create-tile').length).toBeGreaterThan(0);
  });

  it('the whole card opens the plan; View stays the screen-reader control', async () => {
    const tree = await render();
    const card = comp(tree.root, 'plan-card-2');
    expect(card.props.accessible).toBe(false);
    await act(async () => card.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerPlan', { planId: 2 });
    expect(comp(tree.root, 'plan-card-view-2').props.accessibilityLabel).toBe('View Push / Pull / Legs');
  });

  it('assign mode: the same two sections, Assign on every card; the client name when it rode along (M10)', async () => {
    mockParams = { assignTo: '42', assignName: 'Sara Lopez' };
    const tree = await render();
    expect(cardIds(host(tree.root, 'plans-section-own'))).toEqual([31]);
    expect(cardIds(host(tree.root, 'plans-section-catalog'))).toEqual([1, 2]);
    [31, 1, 2].forEach((id) => expect(comp(tree.root, `plan-card-assign-${id}`)).toBeTruthy());
    expect(texts(tree.root)).toContain('Pick a plan to assign to Sara Lopez.');
    expect(comp(tree.root, 'plans-back-to-client').props.label).toBe('← Back to Sara Lopez');
  });

  it('search filters both sections by name; a section with no match steps aside', async () => {
    const tree = await render();
    const search = host(tree.root, 'plans-search');
    expect([search.props.accessibilityLabel, search.props.placeholder]).toEqual(['Search plans', 'Search plans']);
    await act(async () => search.props.onChangeText('PUSH'));
    expect(host(tree.root, 'plans-section-own')).toBeUndefined();
    expect(cardIds(host(tree.root, 'plans-section-catalog'))).toEqual([2]);
    await act(async () => host(tree.root, 'plans-search').props.onChangeText('sara'));
    expect(host(tree.root, 'plans-section-catalog')).toBeUndefined();
    expect(cardIds(host(tree.root, 'plans-section-own'))).toEqual([31]);
    // No tile while searching.
    expect(tree.root.findAll((node) => node.props.testID === 'plans-create-tile')).toHaveLength(0);
  });

  it('no match: "No plans found" / "Try a different name." (polite), sections hidden, search kept', async () => {
    const tree = await render();
    await act(async () => host(tree.root, 'plans-search').props.onChangeText('zzz'));
    const empty = tree.root.findByType(EmptyState);
    expect([empty.props.title, empty.props.message, empty.props.live]).toEqual(['No plans found', 'Try a different name.', true]);
    expect(host(tree.root, 'plans-section-own')).toBeUndefined();
    expect(host(tree.root, 'plans-section-catalog')).toBeUndefined();
    expect(host(tree.root, 'plans-search')).toBeTruthy();
  });

  it('no plans of your own: the ruled empty state with a glass Create, the header keeps the gold one', async () => {
    listTrainerPlans.mockResolvedValue([PUBLIC_A, PUBLIC_B]);
    const tree = await render();
    const empty = host(tree.root, 'plans-section-own').findAll((node) => node.type === EmptyState)[0];
    expect([empty.props.title, empty.props.message, empty.props.actionLabel]).toEqual([
      'No plans of your own yet',
      'Create a private plan to build one for your clients.',
      'Create a plan',
    ]);
    await act(async () => empty.props.onAction());
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerPlanCreate');
    expect(comp(tree.root, 'plans-create').props.variant).toBe('primary');
  });

  it('a catalog that fails to load = error + Retry, never a guessed split', async () => {
    listCatalogPlans.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Boom' } } });
    const tree = await render();
    const alert = tree.root.findByType(ErrorAlert);
    expect([alert.props.title, alert.props.description]).toEqual(['Could not load plans', 'Boom']);
    expect(tree.root.findAllByType(PlanCard)).toHaveLength(0);
    await act(async () => alert.props.onRetry());
    expect(listCatalogPlans).toHaveBeenCalledTimes(2);
    expect(host(tree.root, 'plans-section-own')).toBeTruthy();
  });

  it('admin + trainer: one list, no sections, no catalog call (the split can\'t work for admins)', async () => {
    useAuthStore.setState({ user: { roles: ['trainer', 'admin'] } });
    const tree = await render();
    expect(listCatalogPlans).not.toHaveBeenCalled();
    expect(host(tree.root, 'plans-section-own')).toBeUndefined();
    expect(host(tree.root, 'plans-section-catalog')).toBeUndefined();
    expect(cardIds(host(tree.root, 'plans-grid'))).toEqual([1, 31, 2]);
    expect(tree.root.findAll((node) => node.props.testID?.startsWith?.('plan-card-private-'))).toHaveLength(0);
  });
});
