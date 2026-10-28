import { act, create } from 'react-test-renderer';

import { copyToMyPlans, isGeneratorAvailable, listMyPlans } from './api/myPlansApi';
import EditPlanDetailsModal from '../trainer/plans/components/EditPlanDetailsModal';
import CopyToMyPlansCard from './components/CopyToMyPlansCard';
import MyPlansScreen from './MyPlansScreen';

const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'MyPlans-1', name: 'MyPlans', params: {} }),
  CommonActions: { reset: jest.fn() },
}));
jest.mock('../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});
// The generator button also needs its route in the build; pin it here so
// the test covers the button logic whatever screens the build ships.
jest.mock('./myPlanRoutes', () => ({
  myPlanRoutes: { MyPlans: 'MyPlans', MyPlanCreate: 'MyPlanCreate', MyPlan: 'MyPlan', PlanGenerator: 'PlanGenerator' },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockCopyWrites = { root: null, updatePlan: jest.fn(), deletePlan: jest.fn() };
jest.mock('../trainer/plans/api/plansApi', () => ({
  listPlanCategories: jest.fn(() => Promise.resolve([])),
  listDifficultyLevels: jest.fn(() => Promise.resolve([])),
  createPlanWrites: (root) => {
    mockCopyWrites.root = root;
    return mockCopyWrites;
  },
}));
jest.mock('./api/myPlansApi', () => ({
  listMyPlans: jest.fn(),
  isGeneratorAvailable: jest.fn(),
  copyToMyPlans: jest.fn(),
}));
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'),
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));

const texts = (tree) =>
  tree.root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => [].concat(node.props.children).filter((part) => typeof part !== 'object').join(''));
const byTestId = (tree, id) => tree.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string');

async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  isGeneratorAvailable.mockResolvedValue(false);
});

describe('M1 My plans (§M1)', () => {
  it('lists plans in server order with the Inactive pill and opens M3', async () => {
    listMyPlans.mockResolvedValue({
      items: [
        { id: 1, name: 'Old', is_active: false, category: { name: 'Strength' }, days_per_week: 3 },
        { id: 2, name: 'New', is_active: true },
      ],
      currentPage: 1,
      totalPages: 1,
      totalRecords: 2,
    });
    const tree = await render(<MyPlansScreen />);
    const shown = texts(tree);
    // DECLARED (T-65, PHONE-NAV spec §3): was '← All plans' (gold text link); the back pill draws a chevron + 'All plans'.
    expect(shown).toEqual(expect.arrayContaining(['All plans', 'My plans', 'Strength', 'Inactive', '3\u00a0days / week', 'Training plan', 'Plan']));
    expect(shown.filter((text) => text === 'Inactive')).toHaveLength(1);
    expect(shown).not.toContain('Library');
    expect(shown).not.toContain('Build me a plan');
    expect(listMyPlans).toHaveBeenCalledWith(1);
    await act(async () => byTestId(tree, 'my-plan-card-open-2')[0].props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlan', { planId: 2 });
  });

  it('shows the on-hold box and no Create on a 403', async () => {
    listMyPlans.mockRejectedValue({ response: { status: 403, data: { message: 'Your own plans are unavailable while you have a trainer' } } });
    isGeneratorAvailable.mockResolvedValue(true);
    const tree = await render(<MyPlansScreen />);
    const shown = texts(tree);
    expect(shown).toEqual(
      expect.arrayContaining(['Your plans are on hold', 'Your own plans are unavailable while you have a trainer'])
    );
    expect(shown).not.toContain('Create a plan');
    expect(shown).not.toContain('Build me a plan');
  });

  it('shows the empty state with both buttons, and the generator button when available', async () => {
    listMyPlans.mockResolvedValue({ items: [], currentPage: 1, totalPages: 1, totalRecords: 0 });
    isGeneratorAvailable.mockResolvedValue(true);
    const tree = await render(<MyPlansScreen />);
    const shown = texts(tree);
    expect(shown).toEqual(expect.arrayContaining(['No plans yet', 'Browse the catalog', 'Build me a plan']));
    await act(async () => byTestId(tree, 'my-plans-browse')[0].props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('PlansLibrary');
  });

  it('shows the error with Retry that reloads the same page', async () => {
    listMyPlans.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Boom' } } });
    const tree = await render(<MyPlansScreen />);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Could not load your plans', 'Boom', 'Retry']));
    listMyPlans.mockResolvedValueOnce({ items: [], currentPage: 1, totalPages: 1, totalRecords: 0 });
    const retry = tree.root.findAll((node) => node.props.title === 'Retry' && typeof node.type !== 'string')[0];
    await act(async () => retry.props.onPress());
    expect(listMyPlans).toHaveBeenLastCalledWith(1);
    expect(texts(tree)).toContain('No plans yet');
  });
});

// DECLARED (T-78, RN-SPEC-TRAINER-PLANS C10 supersedes C9): "copies and opens M3 with the name-the-copy
// flag", "never opens M3 without a plan id", "does not navigate when the card unmounted during the copy"
// and "shows the 404 copy" pressed the button and expected the POST at once. Now the button opens
// "Name your copy" (no request); Save runs the POST (+ a PATCH of the copy); the same outcomes follow.
describe('M5 copy card (§M5, T-78: created only on Save)', () => {
  const PLAN = { id: 12, name: 'Upper / Lower', days_per_week: 4 };
  const dialog = (tree) => tree.root.findAll((node) => node.type === EditPlanDetailsModal && node.props.copy)[0];
  async function open(tree) {
    await act(async () => byTestId(tree, 'copy-to-my-plans-button')[0].props.onPress());
  }
  async function save(tree, changes = {}) {
    let result;
    await act(async () => {
      result = await dialog(tree).props.onSubmit(changes);
    });
    return result;
  }
  // Fake timers: the dialog's focus timer must not outlive a test.
  afterEach(() => jest.useRealTimers());
  beforeEach(() => {
    jest.useFakeTimers();
    mockCopyWrites.updatePlan.mockReset();
    mockCopyWrites.deletePlan.mockReset();
    mockCopyWrites.root = null;
  });

  it('the button opens "Name your copy" for this plan; no request until Save; a dismiss sends nothing', async () => {
    const tree = await render(<CopyToMyPlansCard planId="12" plan={PLAN} dayCount={4} />);
    expect(dialog(tree)).toBeUndefined();
    await open(tree);
    expect(dialog(tree).props).toMatchObject({ isOpen: true, plan: PLAN, dayCount: 4 });
    expect(copyToMyPlans).not.toHaveBeenCalled();
    act(() => dialog(tree).props.onClose());
    expect(dialog(tree).props.isOpen).toBe(false);
    expect(copyToMyPlans).not.toHaveBeenCalled();
  });

  it('Save copies and opens M3 (no name-the-copy flag); a change PATCHes the COPY', async () => {
    copyToMyPlans.mockResolvedValue({ id: 77 });
    mockCopyWrites.updatePlan.mockResolvedValue({ id: 77 });
    const tree = await render(<CopyToMyPlansCard planId="12" plan={PLAN} dayCount={4} />);
    await open(tree);
    await save(tree, { name: 'Mine' });
    expect(copyToMyPlans).toHaveBeenCalledWith('12');
    expect(mockCopyWrites.root).toBe('/my-custom-plans/77');
    expect(mockCopyWrites.updatePlan).toHaveBeenCalledWith({ name: 'Mine' });
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlan', { planId: 77 });
  });

  it('a failed PATCH deletes the copy at once and keeps the dialog open', async () => {
    copyToMyPlans.mockResolvedValue({ id: 77 });
    mockCopyWrites.updatePlan.mockRejectedValue({ response: { status: 422, data: { errors: { name: ['Too long.'] } } } });
    mockCopyWrites.deletePlan.mockResolvedValue({});
    const tree = await render(<CopyToMyPlansCard planId="12" plan={PLAN} dayCount={4} />);
    await open(tree);
    expect(await save(tree, { name: 'X'.repeat(300) })).toEqual({ name: 'Too long.' });
    expect(mockCopyWrites.deletePlan).toHaveBeenCalledTimes(1);
    expect(dialog(tree).props.isOpen).toBe(true);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('never opens M3 without a plan id; opens My plans instead (E7)', async () => {
    copyToMyPlans.mockResolvedValue(undefined);
    const tree = await render(<CopyToMyPlansCard planId="12" plan={PLAN} dayCount={4} />);
    await open(tree);
    await save(tree);
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlans');
  });

  it('does not navigate when the card unmounted during the save', async () => {
    let resolve;
    copyToMyPlans.mockReturnValue(new Promise((done) => (resolve = done)));
    const tree = await render(<CopyToMyPlansCard planId="12" plan={PLAN} dayCount={4} />);
    await open(tree);
    act(() => {
      dialog(tree).props.onSubmit({});
    });
    act(() => tree.unmount());
    await act(async () => resolve({ id: 5 }));
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('a failed POST creates nothing: the dialog closes, the 404 copy shows and the button is enabled again', async () => {
    copyToMyPlans.mockRejectedValue({ response: { status: 404, data: { message: 'Not found' } } });
    const tree = await render(<CopyToMyPlansCard planId="12" plan={PLAN} dayCount={4} />);
    await open(tree);
    await save(tree);
    expect(dialog(tree).props.isOpen).toBe(false);
    expect(texts(tree)).toContain('This plan can’t be copied.');
    expect(byTestId(tree, 'copy-to-my-plans-button')[0].props.disabled).toBe(false);
    expect(mockCopyWrites.updatePlan).not.toHaveBeenCalled();
  });
});
