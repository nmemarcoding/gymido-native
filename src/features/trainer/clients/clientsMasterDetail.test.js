import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { endCoaching, getClientPlan, getClientProfile, getClientProgress, getClientWorkoutHistory, listActiveClients, listClientAssignments, listPendingRequests } from './api/clientsApi';
import Loader from '../../../shared/components/Loader';
import { colors } from '../../../shared/theme/tokens';
import ClientsListScreen, { LIST_PANE_WIDTH, selectedClientId } from './screens/ClientsListScreen';

// T-55 tablet Clients master/detail (TabletClients board; tablet-strategy §6;
// RN-SPEC-TRAINER-CLIENTS dated rule, web ?client=): the selection lives in
// the route params, so it is KEPT across "Change plan" → Back and across a
// remount/reload of the Clients screen. Phones keep the v1 push.
// t55m (merged onto Phase 6, whose Clients screens win): P6's structure and
// look; the param is `client` (RN-SPEC-TRAINER-CLIENTS 07c6d708:
// `navigation.setParams({ client })`); the pane ids are P6's numbers. Every
// changed assertion is declared in ~/gymido-mobile-work/v2/t55m-report.md.

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
jest.mock('./clientDetailApi', () => ({
  getClientProfileAndEmail: jest.fn(async (id) => ({ profile: await require('./api/clientsApi').getClientProfile(id), clientEmail: null })),
}));
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
jest.mock('../../../shared/components/toastStore', () => ({ ...jest.requireActual('../../../shared/components/toastStore'), ToastTone: { success: 'success', error: 'error' }, addToast: jest.fn() }));

const { openAssignPlan, openClientDetail } = require('./clientLinks');

const CLIENTS = [
  { id: 1, client_user_id: 11, client: { first_name: 'Alex', last_name: 'Kim' } },
  { id: 2, client_user_id: 22, client: { first_name: 'Maya', last_name: 'Reed' } },
];

function setWindow(width, height) {
  useWindowDimensions.mockReturnValue({ width, height, scale: 2, fontScale: 1 });
}

// Refs resolve to their testID (as in profileScreens.test.js) so the focus
// move can be asserted.
async function render() {
  let tree;
  await act(async () => {
    tree = create(<ClientsListScreen />, { createNodeMock: (element) => ({ testID: element.props.testID }) });
  });
  return tree;
}

const host = (tree, id) => tree.root.findAll((node) => node.props?.testID === id && typeof node.type === 'string');
const row = (tree, userId) =>
  tree.root.find((node) => node.props?.testID === `clients-row-${userId}` && typeof node.props.onPress === 'function' && typeof node.type !== 'string');
const rowPressable = (tree, userId) => host(tree, `clients-row-${userId}`)[0];
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
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  jest.spyOn(require('react-native'), 'findNodeHandle', 'get').mockReturnValue((ref) => ref?.testID ?? ref?.props?.testID ?? null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('tablet: list 320 + the detail pane', () => {
  it('draws the 320 list and the pane; with no selection the first client shows (as drawn)', async () => {
    const tree = await render();
    expect(host(tree, 'clients-master-detail')).toHaveLength(1);
    expect(StyleSheet.flatten(host(tree, 'clients-list-pane')[0].props.style).width).toBe(LIST_PANE_WIDTH);
    expect(LIST_PANE_WIDTH).toBe(320);
    expect(StyleSheet.flatten(host(tree, 'clients-detail-pane')[0].props.style)).toMatchObject({ flex: 1, minWidth: 0 });
    expect(paneUser()).toBe(11);
    expect(rowPressable(tree, 11).props.accessibilityState).toEqual({ selected: true });
    expect(rowPressable(tree, 22).props.accessibilityState).toEqual({ selected: false });
  });

  it('the pane is the C2 content without the page chrome ("← All clients" is beside it)', async () => {
    const tree = await render();
    const pane = tree.root.findAll((node) => node.props?.layout === 'pane' && node.props?.clientUserId === 11);
    expect(pane.length).toBeGreaterThan(0);
    expect(tree.root.findAll((node) => node.props?.testID === 'client-all-clients')).toHaveLength(0);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Alex Kim')).toBe(true);
  });

  it('a row press selects the client in the route params (no push) and loads it in the pane', async () => {
    const tree = await render();
    await act(async () => row(tree, 22).props.onPress());
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ client: '22' });
    expect(openClientDetail).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await act(async () => tree.update(<ClientsListScreen />));
    expect(paneUser()).toBe(22);
    expect(rowPressable(tree, 22).props.accessibilityState).toEqual({ selected: true });
  });

  it('works in landscape too (1194 × 834)', async () => {
    setWindow(1194, 834);
    const tree = await render();
    expect(host(tree, 'clients-master-detail')).toHaveLength(1);
  });

  it('the selected row is marked with the gold tint and ring (P6: goldFaint + 1.5 goldStrong)', async () => {
    const tree = await render();
    const style = StyleSheet.flatten(rowPressable(tree, 11).props.style);
    expect(style).toMatchObject({ backgroundColor: colors.goldFaint, borderColor: colors.goldStrong, borderWidth: 1.5 });
    expect(StyleSheet.flatten(rowPressable(tree, 22).props.style).borderColor).toBeUndefined();
  });
});

describe('the selection is KEPT (route params, web ?client=)', () => {
  it('"Change plan" → Back: the same client is still selected', async () => {
    mockRoute.params = { client: '22' };
    let tree = await render();
    const change = tree.root.find((node) => node.props?.testID === 'client-assign-plan' && typeof node.props.onPress === 'function' && typeof node.type !== 'string');
    act(() => change.props.onPress());
    expect(openAssignPlan).toHaveBeenCalledWith(22);
    // The Plans tab takes over (the Clients screen leaves), then Back returns
    // to the same TrainerClients route: a fresh mount with its params.
    act(() => tree.unmount());
    getClientPlan.mockClear();
    tree = await render();
    expect(mockRoute.params).toEqual({ client: '22' });
    expect(paneUser()).toBe(22);
    expect(rowPressable(tree, 22).props.accessibilityState).toEqual({ selected: true });
  });

  it('a remount/reload of the Clients screen restores the selection', async () => {
    let tree = await render();
    await act(async () => row(tree, 22).props.onPress());
    act(() => tree.unmount());
    getClientPlan.mockClear();
    tree = await render();
    expect(paneUser()).toBe(22);
    expect(rowPressable(tree, 22).props.accessibilityState.selected).toBe(true);
  });

  it('a kept client no longer in the list falls back to the first shown row', async () => {
    mockRoute.params = { client: '99' };
    const tree = await render();
    expect(paneUser()).toBe(11);
    expect(rowPressable(tree, 11).props.accessibilityState).toEqual({ selected: true });
  });

  it('a list refresh (Invite → invited) re-selects the kept client', async () => {
    mockRoute.params = { client: '22' };
    const tree = await render();
    const invite = tree.root.find((node) => typeof node.props?.onInvited === 'function');
    await act(async () => invite.props.onInvited());
    expect(listActiveClients).toHaveBeenCalledTimes(2);
    expect(paneUser()).toBe(22);
    expect(rowPressable(tree, 22).props.accessibilityState).toEqual({ selected: true });
  });

  it('end coaching from the pane: the selection is cleared, the list refreshes quietly in place, focus on the new row', async () => {
    endCoaching.mockResolvedValue({});
    mockRoute.params = { client: '11' };
    const tree = await render();
    const end = tree.root.find((node) => node.props?.testID === 'client-end-coaching' && typeof node.type !== 'string' && typeof node.props.onPress === 'function');
    act(() => end.props.onPress());
    const dialog = tree.root.find((node) => node.props?.testID === 'end-coaching-dialog' && typeof node.props.onConfirm === 'function');
    let finish;
    listActiveClients.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    await act(async () => dialog.props.onConfirm());
    expect(endCoaching).toHaveBeenCalledWith(11);
    // P6 + 07c6d708: no push in the pane (the list is beside it); the param clears.
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.setParams).toHaveBeenCalledWith({ client: undefined });
    // Quiet: no loader while the list refreshes; the rows stay.
    expect(tree.root.findAllByType(Loader)).toHaveLength(0);
    expect(rowPressable(tree, 22)).toBeDefined();
    await act(async () => finish([CLIENTS[1]]));
    expect(rowPressable(tree, 22).props.accessibilityState).toEqual({ selected: true });
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith('clients-row-22');
  });

  it('end coaching with the last client: focus moves to the "Clients" heading', async () => {
    endCoaching.mockResolvedValue({});
    listActiveClients.mockResolvedValueOnce([CLIENTS[0]]).mockResolvedValueOnce([]);
    const tree = await render();
    act(() => tree.root.find((node) => node.props?.testID === 'client-end-coaching' && typeof node.type !== 'string' && typeof node.props.onPress === 'function').props.onPress());
    const dialog = tree.root.find((node) => node.props?.testID === 'end-coaching-dialog' && typeof node.props.onConfirm === 'function');
    await act(async () => dialog.props.onConfirm());
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith('clients-heading');
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
    expect(openClientDetail).toHaveBeenCalledWith(22, undefined);
    expect(mockNavigation.setParams).not.toHaveBeenCalled();
  });

  it('a selection left from the tablet layout is ignored (no push on resize)', async () => {
    mockRoute.params = { client: '22' };
    setWindow(744, 1133);
    const tree = await render();
    expect(host(tree, 'clients-detail-pane')).toHaveLength(0);
    expect(openClientDetail).not.toHaveBeenCalled();
    expect(rowPressable(tree, 22).props.accessibilityState?.selected).toBeUndefined();
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
