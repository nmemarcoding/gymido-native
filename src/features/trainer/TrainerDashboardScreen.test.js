import { StyleSheet, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import GradientFill from '../../shared/components/GradientFill';
import PillButton from '../../shared/components/PillButton';
import StatusPill from '../../shared/components/StatusPill';
import { addToast } from '../../shared/components/toastStore';
import { LINE_TEXT, NAME_TEXT } from '../../shared/components/largeText';
import { colors, textScale } from '../../shared/theme/tokens';
import { openShellPath } from '../shell/shellLinks';
import { acceptRequest, listActiveClients, listPendingRequests, rejectRequest } from './clients/api/clientsApi';
import { openAssignPlan, openClientDetail } from './clients/clientLinks';
import ClientAvatar from './clients/components/ClientAvatar';
import { StatTile } from './clients/components/ClientsUi';
import TrainerDashboardScreen from './TrainerDashboardScreen';

// RN-SPEC-v2-phase6 §2 Trainer today (UX N): phone + tablet, every state and
// action, BE data feature-detected, large text at 1 / 2 / 3.1.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./TrainerOnly', () => ({ children }) => children);
jest.mock('./clients/clientLinks', () => ({ openClientDetail: jest.fn(), openAssignPlan: jest.fn() }));
jest.mock('./clients/api/clientsApi', () => ({
  listActiveClients: jest.fn(),
  listPendingRequests: jest.fn(),
  acceptRequest: jest.fn(),
  rejectRequest: jest.fn(),
}));
jest.mock('../../shared/components/toastStore', () => ({ ...jest.requireActual('../../shared/components/toastStore'),
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));

const PLAN = { enrollment_id: 1, workout_plan_id: 9, name: 'Upper / Lower Split' };
const DAYS = [
  { date: '2026-10-26', status: 'done' },
  { date: '2026-10-27', status: 'done' },
  { date: '2026-10-28', status: 'rest' },
  { date: '2026-10-29', status: 'done' },
  { date: '2026-10-30', status: 'upcoming' },
  { date: '2026-10-31', status: 'rest' },
  { date: '2026-11-01', status: 'rest' },
];
const alex = { id: 1, client_user_id: 11, status: 'active', client: { first_name: 'Alex', last_name: 'Kim' } };
const sara = { id: 2, client_user_id: 12, status: 'active', client: { first_name: 'Sara', last_name: 'Lopez' } };
const withData = (row, activity) => ({ ...row, client_activity: activity });
const alexData = withData(alex, { current_plan: PLAN, week: { planned: 4, done: 3, missed: 0, days: DAYS }, last_completed_at: null });
const saraData = withData(sara, { current_plan: PLAN, week: { planned: 3, done: 1, missed: 2, days: [] }, last_completed_at: null });
const diegoData = {
  id: 3,
  client_user_id: 13,
  status: 'active',
  client: { first_name: 'Diego', last_name: 'Cruz' },
  client_activity: { current_plan: null, week: { planned: 0, done: 0, missed: 0, days: [] }, last_completed_at: null },
};
const request = { id: 50, client_user_id: 20, status: 'pending', requested_by: 'client', client: { first_name: 'Maya', last_name: 'Reed' } };
const invite = { id: 60, client_user_id: 214, status: 'pending', requested_by: 'trainer' };
const namedInvite = { id: 61, client_user_id: 215, status: 'pending', requested_by: 'trainer', client: null, invitee: { first_name: 'Tom', last_name: 'Nguyen' } };

const texts = (tree) =>
  tree.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).filter((part) => typeof part !== 'object').join(''));
const byTestID = (tree, testID) => tree.root.findAll((node) => node.props.testID === testID && typeof node.type !== 'string')[0];
const host = (tree, testID) => tree.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string')[0];

function setWindow(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
}

const mounted = [];

async function render() {
  let tree;
  await act(async () => {
    tree = create(<TrainerDashboardScreen />);
  });
  mounted.push(tree);
  return tree;
}

// Gate flake (27 Oct): a tree left mounted kept useSheetFocus's 300 ms timer
// alive past the suite ("findNodeHandle is not a function" after teardown).
afterEach(() => {
  act(() =>
    mounted.splice(0).forEach((tree) => {
      try {
        tree.unmount();
      } catch {
        // Already unmounted by the test itself.
      }
    })
  );
});

beforeEach(() => {
  jest.clearAllMocks();
  setWindow(390);
  listActiveClients.mockResolvedValue([alex, sara]);
  listPendingRequests.mockResolvedValue([]);
});

describe('Trainer today, phone', () => {
  it('header: the teal Coaching pill, the title and sub, Clients + Plans both glass (no gold header action)', async () => {
    const tree = await render();
    expect(host(tree, 'coaching-pill')).toBeTruthy();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Coaching', 'Trainer dashboard', 'Your clients, requests, and coaching tools.']));
    const clients = byTestID(tree, 'trainer-dashboard-clients');
    const plans = byTestID(tree, 'trainer-dashboard-plans');
    expect([clients.props.variant, plans.props.variant]).toEqual(['secondary', 'secondary']);
    await act(async () => clients.props.onPress());
    await act(async () => plans.props.onPress());
    expect(openShellPath.mock.calls).toEqual([['/trainer/clients'], ['/trainer/plans']]);
  });

  // T-121 M2/M3 (declared #13/#19/#20). Was: rows name + "View →" ×2 and no StatusPill. Now no "View →"; each row
  // ends in the status chip "Active" (no week known). Still 2 tiles: Adherence + Need attention hide without data.
  it('without BE data: 2 tiles (no Adherence / Need attention), no Need attention card, rows name + the "Active" chip', async () => {
    const tree = await render();
    const tiles = tree.root.findAllByType(StatTile);
    expect(tiles.map((tile) => tile.props.label)).toEqual(['Active clients', 'Awaiting you']);
    expect(tiles[0].props.value).toBe(2);
    expect(tiles[0].props.valueColor).toBe(colors.teal);
    expect(tiles[0].props.accessibilityLabel).toBe('Active clients, 2, people you coach');
    expect(tiles[1].props.gold).toBe(false);
    expect(tiles[1].props.accessibilityLabel).toBe('Awaiting you, 0, requests to answer');
    expect(host(tree, 'dashboard-attention')).toBeUndefined();
    expect(host(tree, 'dashboard-requests')).toBeUndefined();
    expect(texts(tree).filter((text) => text === 'View →')).toHaveLength(0);
    expect(texts(tree).some((text) => /this week/.test(text))).toBe(false);
    expect(tree.root.findAllByType(StatusPill).map((pill) => [pill.props.label, pill.props.tone])).toEqual([
      ['Active', 'active'],
      ['Active', 'active'],
    ]);
  });

  it('the Active clients tile is a link to Clients; a row opens Client detail', async () => {
    const tree = await render();
    await act(async () => byTestID(tree, 'dashboard-stat-active').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/trainer/clients');
    await act(async () => byTestID(tree, 'dashboard-client-11').props.onPress());
    expect(openClientDetail).toHaveBeenCalledWith(11, undefined);
    await act(async () => byTestID(tree, 'dashboard-manage-clients').props.onPress());
    expect(openShellPath).toHaveBeenCalledTimes(2);
  });

  it('one avatar style: initials + the person colour on every row', async () => {
    const tree = await render();
    const avatars = tree.root.findAllByType(ClientAvatar);
    expect(avatars.map((avatar) => [avatar.props.userId, avatar.props.initials, avatar.props.size])).toEqual([
      [11, 'AK', 36],
      [12, 'SL', 36],
    ]);
  });

  // T-121 M2/M3 (declared #14/#21/#22). Was: tiles Active · Awaiting · "Need you" (tiles[2]); the phone weekly line
  // '3 of 4 this week · Mon Tue Thu Fri'; pills [['On track','completed']]. Now the four KPIs in web order (Adherence
  // = round(Σdone ÷ Σplanned) = 4/7 = 57 %), rows = plan line + ring "x/y", else the status chip.
  it('with BE data: the four KPIs, Need attention (missed → View, no plan → Assign), ring rows, status chip', async () => {
    listActiveClients.mockResolvedValue([alexData, saraData, diegoData]);
    const tree = await render();
    const tiles = tree.root.findAllByType(StatTile);
    expect(tiles.map((tile) => tile.props.label)).toEqual(['Active clients', 'Awaiting you', 'Adherence this week', 'Need attention']);
    expect(tiles[2].props.value).toBe('57%');
    expect(tiles[3].props.value).toBe(2);
    expect(tiles[3].props.valueColor).toBe(colors.warning);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Need attention', 'Missed 2 this week', 'No active plan', '3/4', '1/3']));
    expect(texts(tree).some((text) => /of 4 this week/.test(text))).toBe(false);
    const view = byTestID(tree, 'attention-action-12');
    const assign = byTestID(tree, 'attention-action-13');
    expect([view.props.title, view.props.accessibilityLabel]).toEqual(['View', 'View Sara Lopez']);
    expect([assign.props.title, assign.props.accessibilityLabel]).toEqual(['Assign', 'Assign a plan to Diego Cruz']);
    await act(async () => view.props.onPress());
    expect(openClientDetail).toHaveBeenCalledWith(12, saraData.client_activity);
    await act(async () => assign.props.onPress());
    // T-121 M10 (declared, addendum A3). Was: toHaveBeenCalledWith(13). The row's name rides along.
    expect(openAssignPlan).toHaveBeenCalledWith(13, 'Diego Cruz');
    await act(async () => byTestID(tree, 'dashboard-attention-all').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/trainer/clients');
    // ND-2: On track = plan + no missed; GREEN (completed tone), never teal.
    const pills = tree.root.findAllByType(StatusPill);
    // Alex + Sara have a ring; Diego (no plan this week) gets the status chip "Active".
    expect(pills.map((pill) => [pill.props.label, pill.props.tone])).toEqual([['Active', 'active']]);
  });

  it('0 need-attention with data: tile 0 in text-primary, card hidden', async () => {
    listActiveClients.mockResolvedValue([alexData]);
    const tree = await render();
    // T-121 M2 (declared #15). Was: tiles[2]. Need attention is the 4th tile (Adherence 75 % is the 3rd).
    const tile = tree.root.findAllByType(StatTile)[3];
    expect([tile.props.value, tile.props.valueColor]).toEqual([0, colors.textPrimary]);
    expect(host(tree, 'dashboard-attention')).toBeUndefined();
  });

  it('0 clients: the section EmptyState with the code copy', async () => {
    listActiveClients.mockResolvedValue([]);
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['No clients yet', 'Invite someone to coach, or wait for a member to ask you.']));
  });

  it('invitations: the dashed card, the invitee name (approved) else "Client #id", neutral "Waiting for them"', async () => {
    listPendingRequests.mockResolvedValue([invite, namedInvite]);
    const tree = await render();
    const card = host(tree, 'dashboard-invitations');
    expect(StyleSheet.flatten(card.props.style)).toEqual(expect.objectContaining({ borderStyle: 'dashed' }));
    expect(texts(tree)).toEqual(expect.arrayContaining(['Invitations you sent', 'Client #214', 'Tom Nguyen']));
    const pills = tree.root.findAllByType(StatusPill).filter((pill) => pill.props.label === 'Waiting for them');
    expect(pills.map((pill) => pill.props.tone)).toEqual(['neutral', 'neutral']);
  });

  it('no invitations: the card is hidden', async () => {
    const tree = await render();
    expect(host(tree, 'dashboard-invitations')).toBeUndefined();
  });
});

describe('Trainer today, requests', () => {
  beforeEach(() => {
    listPendingRequests.mockResolvedValue([request, invite]);
  });

  it('requests > 0: the gold Awaiting tile (gradient mounted with it) and the Requests card', async () => {
    const tree = await render();
    const awaiting = tree.root.findAllByType(StatTile)[1];
    expect([awaiting.props.gold, awaiting.props.value]).toEqual([true, 1]);
    expect(awaiting.findAllByType(GradientFill)).toHaveLength(1);
    expect(StyleSheet.flatten(host(tree, 'dashboard-requests').props.style).borderColor).toBe(colors.goldLine);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Requests to you', 'Maya Reed', 'asked you to coach them']));
    expect(byTestID(tree, 'request-accept-50').props.accessibilityLabel).toBe('Accept Maya Reed');
    expect(byTestID(tree, 'request-decline-50').props.variant).toBe('secondary');
  });

  it('Accept: success toast, reload; both buttons disabled while busy', async () => {
    let finish;
    acceptRequest.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const tree = await render();
    act(() => {
      byTestID(tree, 'request-accept-50').props.onPress();
    });
    expect(byTestID(tree, 'request-accept-50').props.disabled).toBe(true);
    expect(byTestID(tree, 'request-decline-50').props.disabled).toBe(true);
    await act(async () => finish({}));
    expect(acceptRequest).toHaveBeenCalledWith(50);
    expect(addToast).toHaveBeenCalledWith('success', 'Client accepted', 'They’re now in your client list.');
    expect(listActiveClients).toHaveBeenCalledTimes(2);
  });

  it('double tap in one frame (Accept twice, or Accept then Decline): ONE request, one toast', async () => {
    let finish;
    acceptRequest.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const tree = await render();
    const accept = byTestID(tree, 'request-accept-50').props.onPress;
    const decline = byTestID(tree, 'request-decline-50').props.onPress;
    act(() => {
      accept();
      accept();
      decline();
    });
    await act(async () => finish({}));
    expect(acceptRequest).toHaveBeenCalledTimes(1);
    expect(rejectRequest).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledTimes(1);
    rejectRequest.mockResolvedValueOnce({});
    await act(async () => byTestID(tree, 'request-decline-50').props.onPress());
    expect(rejectRequest).toHaveBeenCalledTimes(1);
  });

  it('unmount while a response is pending: it settles without touching the unmounted screen', async () => {
    let finish;
    acceptRequest.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const tree = await render();
    act(() => {
      byTestID(tree, 'request-accept-50').props.onPress();
    });
    act(() => tree.unmount());
    await act(async () => finish({}));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it.each([
    [409, { response: { status: 409, data: { message: 'Already coached' } } }, 'Already coached'],
    [404, { response: { status: 404, data: {} } }, 'That request is no longer available.'],
    [500, { response: { status: 500, data: {} } }, 'We could not accept that request. Please try again.'],
  ])('Accept error %s: "Could not accept" + the code copy, then reload', async (_, failure, message) => {
    acceptRequest.mockRejectedValue(failure);
    const tree = await render();
    await act(async () => byTestID(tree, 'request-accept-50').props.onPress());
    expect(addToast).toHaveBeenCalledWith('error', 'Could not accept', message);
    expect(listActiveClients).toHaveBeenCalledTimes(2);
  });

  it('Decline: success "Request declined"; failure "Could not decline" + server message', async () => {
    rejectRequest.mockResolvedValueOnce({});
    const tree = await render();
    await act(async () => byTestID(tree, 'request-decline-50').props.onPress());
    expect(rejectRequest).toHaveBeenCalledWith(50);
    expect(addToast).toHaveBeenCalledWith('success', 'Request declined');
    rejectRequest.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Nope' } } });
    await act(async () => byTestID(tree, 'request-decline-50').props.onPress());
    expect(addToast).toHaveBeenCalledWith('error', 'Could not decline', 'Nope');
  });
});

describe('Trainer today, tablet', () => {
  beforeEach(() => {
    setWindow(1024);
  });

  // T-121 M2 (declared #16). Was: 2 hero tiles (Active, Awaiting) only. Now the same four as the phone, with sublines.
  it('the four hero tiles with the code sublines; Need attention under them (ND-12); Requests 2-up; Your clients | Invitations', async () => {
    listActiveClients.mockResolvedValue([alexData, saraData]);
    listPendingRequests.mockResolvedValue([request, invite]);
    const tree = await render();
    const tiles = tree.root.findAllByType(StatTile);
    expect(tiles.map((tile) => [tile.props.label, tile.props.large, tile.props.sub])).toEqual([
      ['Active clients', true, 'people you coach'],
      ['Awaiting you', true, 'request to answer'],
      ['Adherence this week', true, 'workouts done vs planned'],
      ['Need attention', true, 'clients to check'],
    ]);
    const order = tree.root
      .findAll((node) => typeof node.type === 'string' && ['dashboard-attention', 'dashboard-requests', 'dashboard-invitations'].includes(node.props.testID))
      .map((node) => node.props.testID);
    expect(order).toEqual(['dashboard-attention', 'dashboard-requests', 'dashboard-invitations']);
    // Tablet rows: name + "View →" (no weekly line, as drawn).
    expect(texts(tree).some((text) => /of 4 this week/.test(text))).toBe(false);
    expect(tree.root.findAllByType(ClientAvatar).find((a) => a.props.userId === 11 && a.props.size === 44)).toBeTruthy();
    expect(host(tree, 'request-50')).toBeTruthy();
  });
});

describe('Trainer today, large text (§9)', () => {
  it.each([1, 2, 3.1])('fontScale %s: tiles reflow to rows past 1.3; button pair stacks, Accept on top', async (fontScale) => {
    setWindow(390, fontScale);
    listPendingRequests.mockResolvedValue([request]);
    const tree = await render();
    const reflow = fontScale > textScale.reflowAbove;
    tree.root.findAllByType(StatTile).forEach((tile) => expect(tile.props.row).toBe(reflow));
    const buttons = tree.root
      .findAllByType(PillButton)
      .filter((button) => /request-(accept|decline)/.test(button.props.testID ?? ''))
      .map((button) => button.props.testID);
    expect(buttons).toEqual(reflow ? ['request-accept-50', 'request-decline-50'] : ['request-decline-50', 'request-accept-50']);
    // The title keeps the title rule (cap, wrap by word, shrink one long word).
    const title = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Trainer dashboard')[0];
    expect(title.props.maxFontSizeMultiplier).toBe(textScale.title);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
  });
});

// UX final audit X7 (§1.1 long text): row names wrap by word to 2 lines then an
// ellipsis (a single long word shrinks to 0.75); the secondary line is 1 line.
describe.each([
  ['phone', 390],
  ['tablet', 834],
])('Trainer today, long text (X7), %s', (_label, width) => {
  const LONG_FIRST = 'Maximilianopolous';
  const LONG_LAST = 'Vanderbergenschmidt-Oyelaran';
  const pick = (node, role) => Object.fromEntries(Object.keys(role).map((key) => [key, node.props[key]]));
  const named = (row) => ({ ...row, client: { first_name: LONG_FIRST, last_name: LONG_LAST } });
  const nameNodes = (tree) => tree.root.findAll((node) => node.type === 'Text' && [].concat(node.props.children).join('').includes(LONG_LAST));

  it('request, client and invitation names: NAME_TEXT; their sublines: LINE_TEXT', async () => {
    setWindow(width, 3.1);
    listActiveClients.mockResolvedValue([named(alexData)]);
    listPendingRequests.mockResolvedValue([named(request), { ...namedInvite, invitee: { first_name: LONG_FIRST, last_name: LONG_LAST } }]);
    const tree = await render();
    const names = nameNodes(tree);
    expect(names.length).toBeGreaterThanOrEqual(3);
    names.forEach((node) => expect(pick(node, NAME_TEXT)).toEqual(NAME_TEXT));
    const asked = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'asked you to coach them')[0];
    expect(pick(asked, LINE_TEXT)).toEqual(LINE_TEXT);
  });
});

// T-121 M1/M2/M3 (web 2.1.10; PM Q1/Q2 29 Oct).
describe('T-121 Trainer today', () => {
  const InviteClientModal = require('./clients/components/InviteClientModal').default;
  const tileStyle = (tree, id) => StyleSheet.flatten(byTestID(tree, id).props.style);

  it.each([
    [390, 'primary'],
    [834, 'secondary'],
    [1194, 'secondary'],
    [1366, 'primary'],
  ])('M1 %ipx: "Invite a client" in the chip row (%s) after Clients · Plans; it opens the invite sheet', async (width, variant) => {
    setWindow(width);
    const tree = await render();
    const buttons = tree.root.findAllByType(PillButton).filter((button) => /^trainer-dashboard-/.test(button.props.testID ?? ''));
    expect(buttons.map((button) => button.props.title)).toEqual(['Clients', 'Plans', 'Invite a client']);
    const invite = byTestID(tree, 'trainer-dashboard-invite');
    expect([invite.props.variant, typeof invite.props.icon]).toEqual([variant, 'function']);
    expect(tree.root.findByType(InviteClientModal).props.isOpen).toBe(false);
    await act(async () => invite.props.onPress());
    expect(tree.root.findByType(InviteClientModal).props.isOpen).toBe(true);
    await act(async () => tree.root.findByType(InviteClientModal).props.onClose());
    expect(tree.root.findByType(InviteClientModal).props.isOpen).toBe(false);
  });

  it('M1: a sent invite reloads the overview', async () => {
    const tree = await render();
    const calls = listActiveClients.mock.calls.length;
    await act(async () => tree.root.findByType(InviteClientModal).props.onInvited());
    expect(listActiveClients.mock.calls.length).toBeGreaterThan(calls);
  });

  it('M2 phone: 4 tiles = 2×2, a11y names carry the sublines', async () => {
    listActiveClients.mockResolvedValue([alexData, saraData]);
    const tree = await render();
    ['dashboard-stat-active', 'dashboard-stat-awaiting', 'dashboard-stat-adherence', 'dashboard-stat-attention'].forEach((id) =>
      expect(tileStyle(tree, id)).toMatchObject({ flexBasis: '40%', flexGrow: 1 }),
    );
    expect(byTestID(tree, 'dashboard-stat-adherence').props.accessibilityLabel).toBe('Adherence this week, 57%, workouts done vs planned');
    expect(byTestID(tree, 'dashboard-stat-attention').props.accessibilityLabel).toBe('Need attention, 1, clients to check');
    expect(byTestID(tree, 'dashboard-stat-adherence').props.sub).toBeUndefined();
  });

  it('M2: nothing planned → Adherence hides, the other three keep their order (3 across)', async () => {
    listActiveClients.mockResolvedValue([diegoData]);
    const tree = await render();
    expect(tree.root.findAllByType(StatTile).map((tile) => tile.props.label)).toEqual(['Active clients', 'Awaiting you', 'Need attention']);
    expect(tileStyle(tree, 'dashboard-stat-active')).toMatchObject({ flexBasis: 0, flexGrow: 1 });
  });

  it.each([
    [834, '40%'],
    [1366, undefined],
  ])('M2 tablet %ipx: 4 tiles are 2×2 below 1280, 4 across from 1280', async (width, basis) => {
    setWindow(width);
    listActiveClients.mockResolvedValue([alexData, saraData]);
    const tree = await render();
    expect(tree.root.findAllByType(StatTile)).toHaveLength(4);
    expect(tileStyle(tree, 'dashboard-stat-adherence').flexBasis).toBe(basis);
  });

  it('M3 phone rows: plan line with the reason first ("Missed 2"), the ring + "x/y"; no "View →"', async () => {
    listActiveClients.mockResolvedValue([alexData, saraData, diegoData]);
    const tree = await render();
    const flatten = (node) => (typeof node === 'string' ? node : node && node.children ? node.children.map(flatten).join('') : '');
    expect(flatten(host(tree, 'dashboard-client-line-11'))).toBe('Upper / Lower Split');
    expect(flatten(host(tree, 'dashboard-client-line-12'))).toBe('Missed 2 · Upper / Lower Split');
    expect(flatten(host(tree, 'dashboard-client-line-13'))).toBe('No plan yet');
    expect(byTestID(tree, 'dashboard-client-12').props.accessibilityLabel).toBe('Sara Lopez, Missed 2, Upper / Lower Split, 1 of 3 this week');
    expect(byTestID(tree, 'dashboard-client-13').props.accessibilityLabel).toBe('Diego Cruz, No plan yet, Active');
    expect(texts(tree)).not.toContain('View →');
  });

  it('M3: tablet rows keep name + "View →" (web kept its ≥ 768 rows)', async () => {
    setWindow(1024);
    listActiveClients.mockResolvedValue([alexData]);
    const tree = await render();
    expect(host(tree, 'dashboard-client-line-11')).toBeUndefined();
    expect(texts(tree)).toContain('View →');
  });
});
