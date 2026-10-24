import { act, create } from 'react-test-renderer';

import { copyToMyPlans, isGeneratorAvailable, listMyPlans } from './api/myPlansApi';
import CopyToMyPlansCard from './components/CopyToMyPlansCard';
import MyPlansEntryCard from './components/MyPlansEntryCard';
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
jest.mock('./api/myPlansApi', () => ({
  listMyPlans: jest.fn(),
  isGeneratorAvailable: jest.fn(),
  copyToMyPlans: jest.fn(),
}));
jest.mock('../../shared/components/toastStore', () => ({
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
    expect(shown).toEqual(expect.arrayContaining(['← All plans', 'My plans', 'Strength', 'Inactive', '3 days / week', 'Training plan', 'Plan']));
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

describe('M4 card (§M4)', () => {
  it('reads both texts and pushes M1', async () => {
    const tree = await render(<MyPlansEntryCard />);
    const card = byTestId(tree, 'my-plans-entry')[0];
    expect(card.props.accessibilityLabel).toBe('My plans. Build your own, or copy one from the catalog to change it.');
    await act(async () => card.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlans');
  });
});

describe('M5 copy card (§M5)', () => {
  it('copies and opens M3 with the name-the-copy flag', async () => {
    copyToMyPlans.mockResolvedValue({ id: 77 });
    const tree = await render(<CopyToMyPlansCard planId="12" />);
    await act(async () => byTestId(tree, 'copy-to-my-plans-button')[0].props.onPress());
    expect(copyToMyPlans).toHaveBeenCalledWith('12');
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlan', { planId: 77, nameTheCopy: true });
  });

  it('never opens M3 without a plan id; opens My plans instead (E7)', async () => {
    copyToMyPlans.mockResolvedValue(undefined);
    const tree = await render(<CopyToMyPlansCard planId="12" />);
    await act(async () => byTestId(tree, 'copy-to-my-plans-button')[0].props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
    expect(mockNavigation.push).toHaveBeenCalledWith('MyPlans');
  });

  it('does not navigate when the card unmounted during the copy', async () => {
    let resolve;
    copyToMyPlans.mockReturnValue(new Promise((done) => (resolve = done)));
    const tree = await render(<CopyToMyPlansCard planId="12" />);
    act(() => {
      byTestId(tree, 'copy-to-my-plans-button')[0].props.onPress();
    });
    act(() => tree.unmount());
    await act(async () => resolve({ id: 5 }));
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('shows the 404 copy and re-enables the button', async () => {
    copyToMyPlans.mockRejectedValue({ response: { status: 404, data: { message: 'Not found' } } });
    const tree = await render(<CopyToMyPlansCard planId="12" />);
    await act(async () => byTestId(tree, 'copy-to-my-plans-button')[0].props.onPress());
    expect(texts(tree)).toContain('This plan can’t be copied.');
    expect(byTestId(tree, 'copy-to-my-plans-button')[0].props.disabled).toBe(false);
  });
});
