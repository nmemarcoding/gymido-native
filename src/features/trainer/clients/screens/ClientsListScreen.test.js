import { AccessibilityInfo, StyleSheet, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import Chip from '../../../../shared/components/Chip';
import EmptyState from '../../../../shared/components/EmptyState';
import IconButton from '../../../../shared/components/IconButton';
import StatusPill from '../../../../shared/components/StatusPill';
import { colors, textScale } from '../../../../shared/theme/tokens';
import { listActiveClients, listPendingRequests } from '../api/clientsApi';
import { openClientDetail } from '../clientLinks';
import ClientAvatar from '../components/ClientAvatar';
import { StatusLine, WeekRing } from '../components/ClientsUi';
import InviteClientModal from '../components/InviteClientModal';
import ClientDetailContent from './ClientDetailContent';
import ClientsListScreen, { LIST_PANE_WIDTH } from './ClientsListScreen';

// RN-SPEC-v2-phase6 §2 Clients (UX N): search, ND-8 filters, ND-9 invited
// rows, BE data feature-detected, tablet master/detail, large text.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ push: jest.fn() }) }));
jest.mock('../../../shell/ShellPage', () => ({ children }) => children);
jest.mock('../../TrainerOnly', () => ({ children }) => children);
jest.mock('../clientLinks', () => ({ openClientDetail: jest.fn(), openAssignPlan: jest.fn() }));
jest.mock('../components/InviteClientModal', () => jest.fn(() => null));
jest.mock('./ClientDetailContent', () => jest.fn(() => null));
jest.mock('../api/clientsApi', () => ({ listActiveClients: jest.fn(), listPendingRequests: jest.fn() }));

const PLAN = { enrollment_id: 1, workout_plan_id: 9, name: 'Upper / Lower Split' };
const activity = (overrides) => ({ current_plan: PLAN, week: { planned: 4, done: 3, missed: 0, days: [] }, last_completed_at: null, ...overrides });
const alex = { id: 1, client_user_id: 11, status: 'active', client: { first_name: 'Alex', last_name: 'Kim' } };
const sara = { id: 2, client_user_id: 12, status: 'active', client: { first_name: 'Sara', last_name: 'Lopez' } };
const tom = { id: 3, client_user_id: 13, status: 'active', client: { first_name: 'Tom', last_name: 'Nguyen' } };
const invite = { id: 60, client_user_id: 30, status: 'pending', requested_by: 'trainer', client: null, invitee: { first_name: 'Jordan', last_name: 'Park' } };
const incoming = { id: 61, client_user_id: 31, status: 'pending', requested_by: 'client', client: { first_name: 'Maya', last_name: 'Reed' } };

const texts = (tree) =>
  tree.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).filter((part) => typeof part !== 'object').join(''));
const byTestID = (tree, testID) => tree.root.findAll((node) => node.props.testID === testID && typeof node.type !== 'string')[0];
const host = (tree, testID) => tree.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string')[0];
const chipLabels = (tree) => tree.root.findAllByType(Chip).map((chip) => [chip.props.label, chip.props.selected]);

function setWindow(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
}

async function render() {
  let tree;
  await act(async () => {
    tree = create(<ClientsListScreen />);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  setWindow(390);
  listActiveClients.mockResolvedValue([alex, sara]);
  listPendingRequests.mockResolvedValue([invite, incoming]);
});

describe('Clients, phone', () => {
  it('header: "Clients" + sub, the 44 gold "+" IconButton labelled "Invite a client" opens the invite dialog', async () => {
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Clients', 'Everyone you actively coach.']));
    const plus = tree.root.findByType(IconButton);
    expect([plus.props.testID, plus.props.accessibilityLabel, plus.props.active]).toEqual(['clients-invite', 'Invite a client', true]);
    await act(async () => plus.props.onPress());
    expect(InviteClientModal.mock.calls.at(-1)[0].isOpen).toBe(true);
    await act(async () => InviteClientModal.mock.calls.at(-1)[0].onClose());
    expect(InviteClientModal.mock.calls.at(-1)[0].isOpen).toBe(false);
  });

  it('the search pill: labelled, placeholder "Search clients", gold edge + focus ring on focus', async () => {
    const tree = await render();
    const input = host(tree, 'clients-search');
    expect([input.props.placeholder, input.props.accessibilityLabel]).toEqual(['Search clients', 'Search clients']);
    const box = () => StyleSheet.flatten(host(tree, 'clients-search-box').props.style);
    expect(box().borderRadius).toBe(999);
    await act(async () => input.props.onFocus());
    expect(box()).toEqual(expect.objectContaining({ borderColor: colors.gold, outlineColor: colors.goldFocus }));
    await act(async () => input.props.onBlur());
    expect(box().borderColor).toBe(colors.choiceBorder);
  });

  it('without BE data: chips All / Active (no counts, no Missed); rows name + "View →"; invited row under All', async () => {
    const tree = await render();
    expect(chipLabels(tree)).toEqual([
      ['All', true],
      ['Active', false],
    ]);
    expect(texts(tree).filter((text) => text === 'View →')).toHaveLength(2);
    expect(tree.root.findAllByType(WeekRing)).toHaveLength(0);
    // ND-9: not tappable, the invitee name, the gold "Pending" pill; incoming requests are not listed here.
    const invited = host(tree, 'clients-invited-60');
    expect(invited.props.onPress).toBeUndefined();
    expect(texts(tree)).toContain('Jordan Park');
    expect(texts(tree)).not.toContain('Maya Reed');
    expect(tree.root.findAllByType(StatusPill).map((pill) => [pill.props.label, pill.props.tone])).toEqual([['Pending', 'gold']]);
  });

  it('a row tap pushes Client detail with the row activity', async () => {
    const tree = await render();
    await act(async () => byTestID(tree, 'clients-row-11').props.onPress());
    expect(openClientDetail).toHaveBeenCalledWith(11, undefined);
  });

  it('Active filter hides invited rows; All brings them back', async () => {
    const tree = await render();
    await act(async () => byTestID(tree, 'clients-filter-active').props.onPress());
    expect(host(tree, 'clients-invited-60')).toBeUndefined();
    expect(chipLabels(tree)).toEqual([
      ['All', false],
      ['Active', true],
    ]);
    await act(async () => byTestID(tree, 'clients-filter-all').props.onPress());
    expect(host(tree, 'clients-invited-60')).toBeTruthy();
  });

  it('search by name; no match → "No clients found" (polite live)', async () => {
    const tree = await render();
    await act(async () => host(tree, 'clients-search').props.onChangeText('sara'));
    expect(host(tree, 'clients-row-12')).toBeTruthy();
    expect(host(tree, 'clients-row-11')).toBeUndefined();
    await act(async () => host(tree, 'clients-search').props.onChangeText('zzz'));
    const empty = tree.root.findByType(EmptyState);
    expect([empty.props.title, empty.props.message, empty.props.live]).toEqual(['No clients found', 'Try a different name or filter.', true]);
  });

  it('with BE data: counted chips incl. Missed; plan name, ring + "3/4", amber Missed / inactivity lines, "No plan yet"', async () => {
    const days = new Date(Date.now() - 9 * 86400000).toISOString();
    listActiveClients.mockResolvedValue([
      { ...alex, client_activity: activity() },
      { ...sara, client_activity: activity({ week: { planned: 4, done: 0, missed: 2, days: [] } }) },
      { ...tom, client_activity: activity({ week: { planned: 3, done: 0, missed: 0, days: [] }, last_completed_at: days }) },
      { id: 4, client_user_id: 14, status: 'active', client: { first_name: 'Diego', last_name: 'Cruz' }, client_activity: activity({ current_plan: null, week: { planned: 0, done: 0, missed: 0, days: [] } }) },
    ]);
    const tree = await render();
    expect(chipLabels(tree)).toEqual([
      ['All · 5', true],
      ['Active · 3', false],
      ['Missed · 1', false],
    ]);
    expect(byTestID(tree, 'clients-filter-active').props.accessibilityLabel).toBe('Active, 3 clients');
    expect(texts(tree)).toEqual(expect.arrayContaining(['Upper / Lower Split', '3/4', '0/4', '0/3', 'No plan yet']));
    expect(tree.root.findAllByType(StatusLine).map((line) => [line.props.tone, line.props.text])).toEqual([
      ['warning', 'Missed 2 this week'],
      ['warning', 'No workout in 9 days'],
    ]);
    expect(tree.root.findAllByType(WeekRing)).toHaveLength(3);
    expect(texts(tree)).not.toContain('View →');
    expect(byTestID(tree, 'clients-row-11').props.accessibilityLabel).toBe('Alex Kim, Upper / Lower Split, On track, 3 of 4 this week');
    // ND-6 search matches the plan name.
    await act(async () => host(tree, 'clients-search').props.onChangeText('upper'));
    expect(host(tree, 'clients-row-14')).toBeUndefined();
    await act(async () => host(tree, 'clients-search').props.onChangeText(''));
    await act(async () => byTestID(tree, 'clients-filter-missed').props.onPress());
    expect(host(tree, 'clients-row-12')).toBeTruthy();
    expect(host(tree, 'clients-row-11')).toBeUndefined();
  });

  it('avatars: initials and the person colour rule on every row', async () => {
    const tree = await render();
    expect(tree.root.findAllByType(ClientAvatar).map((a) => [a.props.userId, a.props.initials])).toEqual([
      [11, 'AK'],
      [12, 'SL'],
      [30, 'JP'],
    ]);
  });

  it('only invitations (0 clients): the list shows the invited rows, not the empty page', async () => {
    listActiveClients.mockResolvedValue([]);
    const tree = await render();
    expect(host(tree, 'clients-invited-60')).toBeTruthy();
    expect(tree.root.findAllByType(EmptyState)).toHaveLength(0);
  });
});

describe('Clients, tablet master/detail', () => {
  beforeEach(() => {
    setWindow(1194);
  });

  it('the 320 list beside the pane; the first client is preselected; a tap updates the pane + announces', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    listActiveClients.mockResolvedValue([alex, { ...sara, client_activity: activity() }]);
    const tree = await render();
    const pane = () => tree.root.findByType(ClientDetailContent);
    expect(StyleSheet.flatten(host(tree, 'clients-list-pane').props.style).width).toBe(LIST_PANE_WIDTH);
    expect([pane().props.clientUserId, pane().props.layout]).toEqual([11, 'pane']);
    expect(byTestID(tree, 'clients-row-11').props.selected).toBe(true);
    const selectedStyle = StyleSheet.flatten(host(tree, 'clients-row-11').props.style);
    expect(selectedStyle).toEqual(expect.objectContaining({ borderColor: colors.goldStrong, backgroundColor: colors.goldFaint }));
    await act(async () => byTestID(tree, 'clients-row-12').props.onPress());
    expect(openClientDetail).not.toHaveBeenCalled();
    expect([pane().props.clientUserId, pane().props.clientActivity]).toEqual([12, activity()]);
    expect(announce).toHaveBeenCalledWith('Showing Sara Lopez');
    expect(byTestID(tree, 'clients-row-11').props.selected).toBe(false);
    announce.mockRestore();
  });

  it('ending coaching in the pane reloads the list', async () => {
    const tree = await render();
    await act(async () => tree.root.findByType(ClientDetailContent).props.onEnded());
    expect(listActiveClients).toHaveBeenCalledTimes(2);
  });

  it('a filter with no client: the pane shows the list EmptyState copy', async () => {
    const tree = await render();
    await act(async () => host(tree, 'clients-search').props.onChangeText('jordan'));
    expect(tree.root.findAllByType(ClientDetailContent)).toHaveLength(0);
    expect(tree.root.findAllByType(EmptyState).map((e) => e.props.title)).toEqual(['No clients found']);
  });
});

describe('Clients, large text (§9)', () => {
  it.each([1, 2, 3.1])('fontScale %s: chips + rows wrap, names cap at 2.0 and keep 2 lines; tablet stacks past 1.3', async (fontScale) => {
    setWindow(1024, fontScale);
    const tree = await render();
    const name = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Alex Kim')[0];
    expect([name.props.maxFontSizeMultiplier, name.props.numberOfLines]).toEqual([textScale.body, 2]);
    expect(StyleSheet.flatten(host(tree, 'clients-row-11').props.style).flexWrap).toBe('wrap');
    const pane = StyleSheet.flatten(host(tree, 'clients-list-pane').props.style);
    expect(pane.width).toBe(fontScale > textScale.reflowAbove ? '100%' : LIST_PANE_WIDTH);
  });
});
