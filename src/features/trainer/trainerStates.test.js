import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import EmptyState from '../../shared/components/EmptyState';
import ErrorAlert from '../../shared/components/ErrorAlert';
import Loader from '../../shared/components/Loader';
import StateSlot, { STATE_COLUMN_MAX } from '../../shared/components/StateSlot';
import {
  getClientPlan,
  getClientProfile,
  getClientProgress,
  getClientWorkout,
  getClientWorkoutHistory,
  listActiveClients,
  listClientAssignments,
  listClientWeightLogs,
  listPendingRequests,
  searchMembers,
} from './clients/api/clientsApi';
import InviteClientModal from './clients/components/InviteClientModal';
import WeightHistoryModal from './clients/components/WeightHistoryModal';
import WorkoutDetailModal from './clients/components/WorkoutDetailModal';
import ClientDetailScreen from './clients/screens/ClientDetailScreen';
import ClientsListScreen from './clients/screens/ClientsListScreen';
import { listTrainerPlans } from './plans/api/plansApi';
import PlansListScreen from './plans/screens/PlansListScreen';
import TrainerDashboardScreen from './TrainerDashboardScreen';

// RN-SPEC-v2-phase2 Group D, Trainer states rows 1-18 (row 13 = the shipped
// 4.1.0 exact-email invite states): copy, kind, Retry presence and the
// tablet/web placement (whole-page states in the centred 640 column).

const mockNavigation = { push: jest.fn(), navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'route-1', name: 'TrainerRoute', params: { clientUserId: 7 } }),
  useFocusEffect: jest.fn(),
  CommonActions: { reset: jest.fn() },
}));
jest.mock('../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../shell/ShellPage', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./TrainerOnly', () => ({ children }) => children);
jest.mock('./clients/clientLinks', () => ({ openClientDetail: jest.fn(), openAssignPlan: jest.fn() }));
jest.mock('./clients/api/clientsApi', () => ({
  listActiveClients: jest.fn(),
  listPendingRequests: jest.fn(),
  acceptRequest: jest.fn(),
  rejectRequest: jest.fn(),
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
  assignPlan: jest.fn(),
}));
// v2 phase 6 (p6n): Client detail reads the profile (+ client_email) through
// clientDetailApi; it follows the mocked getClientProfile here.
jest.mock('./clients/clientDetailApi', () => ({
  getClientProfileAndEmail: jest.fn(async (id) => ({ profile: await require('./clients/api/clientsApi').getClientProfile(id), clientEmail: null })),
}));
jest.mock('./plans/api/plansApi', () => ({ listTrainerPlans: jest.fn() }));
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'),
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));

const SERVER = 'Error message from the server';
const serverError = () => ({ response: { status: 500, data: { message: SERVER } } });
const texts = (tree) =>
  tree.root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => [].concat(node.props.children).filter((part) => typeof part !== 'object').join(''));
const retryButtons = (tree) => tree.root.findAll((node) => node.props.title === 'Retry' && typeof node.type !== 'string');

async function render(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

// The state card sits directly inside the centred 640 column (StateSlot's View).
function slotOf(node) {
  let parent = node.parent;
  while (parent && parent.type !== StateSlot) {
    if (parent.props.testID !== 'state-slot') {
      return null;
    }
    parent = parent.parent;
  }
  return parent;
}
const inSlot = (node) => Boolean(slotOf(node));
// The state card sits directly inside the centred 640 column.
function expectInSlot(tree, Kind, props) {
  const card = tree.root.findAll((node) => node.type === Kind && Object.entries(props).every(([k, v]) => node.props[k] === v))[0];
  expect(card).toBeTruthy();
  expect(inSlot(card)).toBe(true);
  const slot = StyleSheet.flatten(slotOf(card).findAll((node) => node.props.testID === 'state-slot')[0].props.style);
  expect(slot).toEqual(expect.objectContaining({ width: '100%', maxWidth: STATE_COLUMN_MAX, alignSelf: 'center' }));
  return card;
}

function pending() {
  return new Promise(() => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  listActiveClients.mockResolvedValue([]);
  listPendingRequests.mockResolvedValue([]);
});

describe('Trainer dashboard (rows 1-2)', () => {
  it('loading: the "Loading your dashboard" Loader in the column', async () => {
    listActiveClients.mockReturnValue(pending());
    const tree = await render(<TrainerDashboardScreen />);
    expectInSlot(tree, Loader, { label: 'Loading your dashboard' });
  });

  it('row 1: ErrorAlert + Retry with the server text; Retry reloads', async () => {
    listActiveClients.mockRejectedValueOnce(serverError());
    const tree = await render(<TrainerDashboardScreen />);
    const alert = expectInSlot(tree, ErrorAlert, { title: 'Could not load your dashboard' });
    expect(alert.props.description).toBe(SERVER);
    expect(retryButtons(tree)).toHaveLength(1);
    await act(async () => alert.props.onRetry());
    expect(listActiveClients).toHaveBeenCalledTimes(2);
    expect(texts(tree)).toContain('No clients yet');
  });

  it('row 2: the section EmptyState keeps the section width (not the page column)', async () => {
    const tree = await render(<TrainerDashboardScreen />);
    const empty = tree.root.findAllByType(EmptyState).find((node) => node.props.title === 'No clients yet');
    expect(empty.props.message).toBe('Invite someone to coach, or wait for a member to ask you.');
    expect(empty.props.actionLabel).toBeUndefined();
    expect(inSlot(empty)).toBe(false);
  });
});

describe('Clients (rows 3-4)', () => {
  it('loading: "Loading your clients" in the column', async () => {
    listActiveClients.mockReturnValue(pending());
    const tree = await render(<ClientsListScreen />);
    expectInSlot(tree, Loader, { label: 'Loading your clients' });
  });

  it('row 3: ErrorAlert + Retry; Retry reloads', async () => {
    listActiveClients.mockRejectedValueOnce(serverError());
    const tree = await render(<ClientsListScreen />);
    const alert = expectInSlot(tree, ErrorAlert, { title: 'Could not load your clients' });
    expect(alert.props.description).toBe(SERVER);
    await act(async () => alert.props.onRetry());
    expect(listActiveClients).toHaveBeenCalledTimes(2);
  });

  it('row 4: EmptyState with the code\'s secondary "Invite a client" (the header keeps the one gold)', async () => {
    const tree = await render(<ClientsListScreen />);
    const empty = expectInSlot(tree, EmptyState, { title: 'No clients yet' });
    expect(empty.props.message).toBe('Invite a member to coach, or wait for someone to ask you.');
    expect(empty.props.actionLabel).toBe('Invite a client');
    await act(async () => empty.props.onAction());
    expect(tree.root.findByType(InviteClientModal).props.isOpen).toBe(true);
    // v2 phase 6 (declared): the header's one gold is the 44 "+" IconButton (active), labelled "Invite a client".
    const golds = tree.root.findAll((node) => node.props.accessibilityLabel === 'Invite a client' && node.props.active === true && typeof node.type !== 'string');
    expect(golds.filter((node) => node.props.testID === 'clients-invite')).toHaveLength(1);
  });
});

describe('Client detail (rows 5-10)', () => {
  function loadClient({ plan = null, profile = null, history = { items: [] }, assignments = [] } = {}) {
    getClientPlan.mockResolvedValue(plan);
    getClientProfile.mockResolvedValue(profile);
    getClientProgress.mockResolvedValue(null);
    getClientWorkoutHistory.mockResolvedValue(history);
    listClientAssignments.mockResolvedValue(assignments);
  }

  it('loading: "Loading client" in the column', async () => {
    loadClient();
    getClientPlan.mockReturnValue(pending());
    const tree = await render(<ClientDetailScreen />);
    expectInSlot(tree, Loader, { label: 'Loading client' });
  });

  it('row 5: ErrorAlert + Retry; Retry reloads all five', async () => {
    loadClient();
    getClientPlan.mockRejectedValueOnce(serverError());
    const tree = await render(<ClientDetailScreen />);
    const alert = expectInSlot(tree, ErrorAlert, { title: 'Could not load this client' });
    expect(alert.props.description).toBe(SERVER);
    await act(async () => alert.props.onRetry());
    expect(getClientPlan).toHaveBeenCalledTimes(2);
    expect(texts(tree)).toContain('Client details');
  });

  it('row 6: a 404 = "Not your client" with the code\'s secondary "Back to clients"', async () => {
    loadClient();
    getClientPlan.mockRejectedValueOnce({ response: { status: 404, data: {} } });
    const tree = await render(<ClientDetailScreen />);
    const empty = expectInSlot(tree, EmptyState, { title: 'Not your client' });
    expect(empty.props.message).toBe('This person isn’t one of your active clients. The relationship may have ended.');
    expect(empty.props.actionLabel).toBe('Back to clients');
    await act(async () => empty.props.onAction());
    expect(mockNavigation.push).toHaveBeenCalledWith('TrainerClients');
    expect(retryButtons(tree)).toHaveLength(0);
  });

  it('rows 7-10: the four section EmptyStates keep their section width', async () => {
    loadClient();
    const tree = await render(<ClientDetailScreen />);
    const empties = tree.root.findAllByType(EmptyState).map((node) => [node.props.title, node.props.message, inSlot(node)]);
    expect(empties).toEqual([
      ['No profile yet', 'This client hasn’t completed their profile, so there are no body details to show.', false],
      ['No active plan', 'This client isn’t enrolled in a plan. Assign one to get them started.', false],
      ['No workouts yet', 'Their sessions will appear here once they train.', false],
      ['Nothing assigned yet', 'Plans you assign to this client show up here.', false],
    ]);
  });
});

describe('Trainer plans (rows 11-12)', () => {
  it('loading: "Loading plans" in the column', async () => {
    listTrainerPlans.mockReturnValue(pending());
    const tree = await render(<PlansListScreen />);
    expectInSlot(tree, Loader, { label: 'Loading plans' });
  });

  it('row 11: ErrorAlert + Retry; Retry re-requests', async () => {
    listTrainerPlans.mockRejectedValueOnce(serverError());
    listTrainerPlans.mockResolvedValue({ items: [], currentPage: 1, totalPages: 1, totalRecords: 0 });
    const tree = await render(<PlansListScreen />);
    const alert = expectInSlot(tree, ErrorAlert, { title: 'Could not load plans' });
    expect(alert.props.description).toBe(SERVER);
    await act(async () => alert.props.onRetry());
    expect(listTrainerPlans).toHaveBeenCalledTimes(2);
    expect(texts(tree)).toContain('No plans yet');
  });

  it('row 12: EmptyState "No plans yet", no action', async () => {
    listTrainerPlans.mockResolvedValue({ items: [], currentPage: 1, totalPages: 1, totalRecords: 0 });
    const tree = await render(<PlansListScreen />);
    const empty = expectInSlot(tree, EmptyState, { title: 'No plans yet' });
    expect(empty.props.message).toBe('Create a private plan to build one for your clients.');
    expect(empty.props.actionLabel).toBeUndefined();
  });
});

describe('Invite a client (row 13 = the 4.1.0 states)', () => {
  it('row 13 replaced: the helper, never the old copy; 0 found = the "No member found" polite live EmptyState', async () => {
    jest.useFakeTimers();
    try {
      searchMembers.mockResolvedValue([]);
      const tree = await render(<InviteClientModal isOpen onClose={jest.fn()} onInvited={jest.fn()} />);
      expect(texts(tree)).toEqual(expect.arrayContaining(['Enter their full email address.']));
      for (const old of ['Search for a member', 'Type at least 3 characters of their email address to find them.', 'No members found']) {
        expect(texts(tree)).not.toContain(old);
      }
      const input = tree.root.find((node) => node.type === 'TextInput' && node.props.testID === 'invite-search');
      await act(async () => input.props.onChangeText('nobody@example.com'));
      await act(async () => jest.advanceTimersByTime(400));
      const empty = tree.root.findByType(EmptyState);
      expect(empty.props).toEqual(
        expect.objectContaining({
          live: true,
          title: 'No member found',
          message: "Check the spelling. If they're new to Gymido, ask them to sign up first.",
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Invite a client, search failed (row 14)', () => {
  it('ErrorAlert "Could not search" + Retry; Retry searches the same email again', async () => {
    jest.useFakeTimers();
    try {
      searchMembers.mockRejectedValueOnce(serverError());
      searchMembers.mockResolvedValue([]);
      const tree = await render(<InviteClientModal isOpen onClose={jest.fn()} onInvited={jest.fn()} />);
      const input = tree.root.find((node) => node.type === 'TextInput' && node.props.testID === 'invite-search');
      await act(async () => input.props.onChangeText('client@example.com'));
      await act(async () => jest.advanceTimersByTime(400));
      const alert = tree.root.findByType(ErrorAlert);
      expect([alert.props.title, alert.props.description]).toEqual(['Could not search', SERVER]);
      expect(retryButtons(tree)).toHaveLength(1);
      await act(async () => alert.props.onRetry());
      expect(searchMembers).toHaveBeenLastCalledWith('client@example.com');
      expect(searchMembers).toHaveBeenCalledTimes(2);
      expect(tree.root.findAllByType(ErrorAlert)).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Trainer modals (rows 15-18)', () => {
  it('row 15: workout ErrorAlert without Retry', async () => {
    getClientWorkout.mockRejectedValue(serverError());
    const tree = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />);
    const alert = tree.root.findByType(ErrorAlert);
    expect(alert.props.title).toBe('Could not load this workout');
    expect(alert.props.onRetry).toBeUndefined();
    expect(retryButtons(tree)).toHaveLength(0);
  });

  it('row 16: "No exercises logged"', async () => {
    getClientWorkout.mockResolvedValue({ id: 3, status: 'completed', exercises: [] });
    const tree = await render(<WorkoutDetailModal clientUserId={7} workoutId={3} onClose={jest.fn()} />);
    const empty = tree.root.findByType(EmptyState);
    expect([empty.props.title, empty.props.message]).toEqual(['No exercises logged', 'They started this workout but didn’t log any exercises.']);
  });

  it('row 17: weight history ErrorAlert without Retry', async () => {
    listClientWeightLogs.mockRejectedValue(serverError());
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={null} onClose={jest.fn()} />);
    const alert = tree.root.findByType(ErrorAlert);
    expect(alert.props.title).toBe('Could not load weight history');
    expect(alert.props.onRetry).toBeUndefined();
  });

  it('row 18: "No weight logs yet"', async () => {
    listClientWeightLogs.mockResolvedValue([]);
    const tree = await render(<WeightHistoryModal isOpen clientUserId={7} profile={null} onClose={jest.fn()} />);
    const titles = tree.root.findAllByType(EmptyState).map((node) => [node.props.title, node.props.message]);
    expect(titles).toContainEqual(['No weight logs yet', 'This client hasn’t recorded a weigh-in, so there is no trend to show.']);
  });
});
