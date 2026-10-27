import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { endCoaching, getClientPlan, getClientProfile, getClientProgress, getClientWorkoutHistory, listActiveClients, listClientAssignments, listPendingRequests } from './api/clientsApi';
import ClientsListScreen, { selectedClientId } from './screens/ClientsListScreen';

// T-55 tablet Clients master/detail (TabletClients board; tablet-strategy §6;
// RN-SPEC-TRAINER-CLIENTS dated rule, web ?client=): the selection lives in
// the route params, so it is KEPT across "Change plan" → Back and across a
// remount/reload of the Clients screen. Phones keep the v1 push.

const mockRoute = { key: 'clients-1', name: 'TrainerClients', params: undefined };
const mockNavigation = {
  push: jest.fn(),
  navigate: jest.fn(),
  addListener: jest.fn(() => () => {}),
  setParams: jest.fn((params) => {
    mockRoute.params = { ...mockRoute.params, ...params };
  }),
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('../TrainerOnly', () => ({ children }) => children);
jest.mock('./clientLinks', () => ({ openClientDetail: jest.fn(), openAssignPlan: jest.fn() }));
jest.mock('./api/clientsApi', () => ({
  listActiveClients: jest.fn(),
  listPendingRequests: jest.fn(),
  searchMembers: jest.fn(),
  inviteClient: jest.fn(),
  endCoaching: jest.fn(),
  getClientPlan: jest.fn(),
  getClientProfile: jest.fn(),
  getClientProgress: jest.fn(),
  getClientWorkoutHistory: jest.fn(),
  listClientAssignments: jest.fn(),
  getClientWorkout: jest.fn(),
  listClientWeightLogs: jest.fn(),
}));
jest.mock('../../../shared/components/toastStore', () => ({ ToastTone: { success: 'success', error: 'error' }, addToast: jest.fn() }));

const { openAssignPlan, openClientDetail } = require('./clientLinks');

const CLIENTS = [
  { id: 1, client_user_id: 11, client: { first_name: 'Alex', last_name: 'Kim' } },
  { id: 2, client_user_id: 22, client: { first_name: 'Maya', last_name: 'Reed' } },
];

function setWindow(width, height) {
  useWindowDimensions.mockReturnValue({ width, height, scale: 2, fontScale: 1 });
}

async function render() {
  let tree;
  await act(async () => {
    tree = create(<ClientsListScreen />);
  });
  return tree;
}

const host = (tree, id) => tree.root.findAll((node) => node.props?.testID === id && typeof node.type === 'string');
const row = (tree, userId) =>
  tree.root.find((node) => node.props?.testID === `clients-row-${userId}` && typeof node.props.onPress === 'function' && typeof node.type !== 'string');
const rowPressable = (tree, userId) =>
  tree.root.find((node) => node.props?.testID === `clients-row-${userId}` && typeof node.props.style === 'function');
const paneUser = () => getClientPlan.mock.calls.at(-1)?.[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute.params = undefined;
  listActiveClients.mockResolvedValue(CLIENTS);
  listPendingRequests.mockResolvedValue([]);
  getClientPlan.mockResolvedValue({ enrollment: { plan: { name: 'Upper / Lower Split' } } });
  getClientProfile.mockResolvedValue({ first_name: 'Alex', last_name: 'Kim' });
  getClientProgress.mockResolvedValue(null);
  getClientWorkoutHistory.mockResolvedValue({ items: [] });
  listClientAssignments.mockResolvedValue([]);
  setWindow(834, 1194);
});

describe('tablet: list 320 + the detail pane', () => {
  it('draws the 320 list and the pane; with no selection the first client shows (as drawn)', async () => {
    const tree = await render();
    expect(host(tree, 'clients-master-detail')).toHaveLength(1);
    expect(StyleSheet.flatten(host(tree, 'clients-master')[0].props.style).width).toBe(320);
    expect(StyleSheet.flatten(host(tree, 'clients-detail-pane')[0].props.style)).toMatchObject({ flex: 1, minWidth: 0 });
    expect(paneUser()).toBe('11');
    expect(rowPressable(tree, 11).props.accessibilityState).toEqual({ selected: true });
    expect(rowPressable(tree, 22).props.accessibilityState).toEqual({ selected: false });
  });

  it('the pane is the C2 content without the page chrome ("← All clients" is beside it)', async () => {
    const tree = await render();
    expect(host(tree, 'client-detail-pane-content')).toHaveLength(1);
    expect(tree.root.findAll((node) => node.props?.testID === 'client-all-clients')).toHaveLength(0);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Alex Kim')).toBe(true);
  });

  it('a row press selects the client in the route params (no push) and loads it in the pane', async () => {
    const tree = await render();
    await act(async () => row(tree, 22).props.onPress());
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ selected: '22' });
    expect(openClientDetail).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await act(async () => tree.update(<ClientsListScreen />));
    expect(paneUser()).toBe('22');
    expect(rowPressable(tree, 22).props.accessibilityState).toEqual({ selected: true });
  });

  it('works in landscape too (1194 × 834)', async () => {
    setWindow(1194, 834);
    const tree = await render();
    expect(host(tree, 'clients-master-detail')).toHaveLength(1);
  });

  it('the selected row is marked with the gold tint and ring', async () => {
    const tree = await render();
    const style = StyleSheet.flatten(rowPressable(tree, 11).props.style({ pressed: false }));
    expect(style).toMatchObject({ backgroundColor: 'rgba(255, 194, 26, 0.14)', borderColor: 'rgba(255, 194, 26, 0.35)' });
    expect(StyleSheet.flatten(rowPressable(tree, 22).props.style({ pressed: false })).borderColor).toBeUndefined();
  });
});

describe('the selection is KEPT (route params, web ?client=)', () => {
  it('"Change plan" → Back: the same client is still selected', async () => {
    mockRoute.params = { selected: '22' };
    let tree = await render();
    const change = tree.root.find((node) => node.props?.testID === 'client-assign-plan' && typeof node.props.onPress === 'function' && typeof node.type !== 'string');
    act(() => change.props.onPress());
    expect(openAssignPlan).toHaveBeenCalledWith('22');
    // The Plans tab takes over (the Clients screen leaves), then Back returns
    // to the same TrainerClients route: a fresh mount with its params.
    act(() => tree.unmount());
    getClientPlan.mockClear();
    tree = await render();
    expect(mockRoute.params).toEqual({ selected: '22' });
    expect(paneUser()).toBe('22');
    expect(rowPressable(tree, 22).props.accessibilityState).toEqual({ selected: true });
  });

  it('a remount/reload of the Clients screen restores the selection', async () => {
    let tree = await render();
    await act(async () => row(tree, 22).props.onPress());
    act(() => tree.unmount());
    getClientPlan.mockClear();
    tree = await render();
    expect(paneUser()).toBe('22');
    expect(rowPressable(tree, 22).props.accessibilityState.selected).toBe(true);
  });

  it('end coaching from the pane keeps the v1 push to the list (⚠C-5 unchanged)', async () => {
    endCoaching.mockResolvedValue({});
    const tree = await render();
    const end = tree.root.find((node) => node.props?.testID === 'client-end-coaching' && typeof node.type !== 'string' && typeof node.props.onPress === 'function');
    act(() => end.props.onPress());
    const dialog = tree.root.find((node) => node.props?.testID === 'end-coaching-dialog' && typeof node.props.onConfirm === 'function');
    await act(async () => dialog.props.onConfirm());
    expect(endCoaching).toHaveBeenCalledWith('11');
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerClients');
  });
});

describe('phones (< 768): unchanged', () => {
  it('no pane; a row pushes C2', async () => {
    setWindow(390, 844);
    const tree = await render();
    expect(host(tree, 'clients-master-detail')).toHaveLength(0);
    expect(host(tree, 'clients-detail-pane')).toHaveLength(0);
    expect(getClientPlan).not.toHaveBeenCalled();
    act(() => row(tree, 22).props.onPress());
    expect(openClientDetail).toHaveBeenCalledWith(22);
    expect(mockNavigation.setParams).not.toHaveBeenCalled();
  });

  it('a selection left from the tablet layout is ignored (no push on resize)', async () => {
    mockRoute.params = { selected: '22' };
    setWindow(744, 1133);
    const tree = await render();
    expect(host(tree, 'clients-detail-pane')).toHaveLength(0);
    expect(openClientDetail).not.toHaveBeenCalled();
    expect(rowPressable(tree, 22).props.accessibilityState).toBeUndefined();
  });
});

describe('selectedClientId', () => {
  it('the param wins (as a string), else the first client, else none', () => {
    expect(selectedClientId('22', CLIENTS)).toBe('22');
    expect(selectedClientId(22, CLIENTS)).toBe('22');
    expect(selectedClientId(undefined, CLIENTS)).toBe('11');
    expect(selectedClientId('', CLIENTS)).toBe('11');
    expect(selectedClientId(undefined, [])).toBeNull();
  });
});
