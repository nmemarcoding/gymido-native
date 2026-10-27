import { Linking, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import { addToast } from '../../shared/components/toastStore';
import { acceptTrainerRequest, endCoaching, getMyTrainer, listPendingTrainerRequests, rejectTrainerRequest } from './api/myTrainerApi';
import TrainerHubScreen, { goldAction, initialsOf, statusPill } from './TrainerHubScreen';

const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockIsTrainer = false;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../shell/shellRules', () => ({ isTrainerUser: () => mockIsTrainer }));
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: {} }) }));
jest.mock('../../shared/components/BlurLayer', () => () => null);
jest.mock('../../shared/components/GradientFill', () => () => null);
jest.mock('../../shared/components/toastStore', () => ({ ToastTone: { success: 'success', error: 'error' }, addToast: jest.fn() }));
jest.mock('./api/myTrainerApi', () => ({
  acceptTrainerRequest: jest.fn(),
  endCoaching: jest.fn(),
  getMyTrainer: jest.fn(),
  listPendingTrainerRequests: jest.fn(),
  rejectTrainerRequest: jest.fn(),
}));

const { openShellPath } = require('../shell/shellLinks');

const invitation = { id: 5, status: 'pending', requested_by: 'trainer', trainer: { display_name: 'Alex Kim' } };
const outgoing = { id: 6, status: 'pending', requested_by: 'client', trainer: { display_name: 'Sara Lopez' } };
const activeMine = {
  relationship: { status: 'active', trainer_user_id: 9 },
  trainer: { display_name: 'Sara Lopez', email: 'sara@example.com', bio: 'Strength coach.' },
};
const noCoach = { relationship: null, trainer: null };

const texts = (root) =>
  root.findAll((node) => node.type === 'Text').map((node) => [].concat(node.props.children).filter((c) => typeof c !== 'object').join(''));
const comp = (root, id) => root.find((node) => node.props.testID === id && typeof node.type !== 'string' && node.props.title);
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');

function setWidth(width) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale: 1 });
}

const mounted = [];
async function render() {
  let tree;
  await act(async () => {
    tree = create(<TrainerHubScreen />);
  });
  mounted.push(tree);
  return tree;
}

beforeEach(() => {
  setWidth(390);
  mockIsTrainer = false;
  getMyTrainer.mockResolvedValue(noCoach);
  listPendingTrainerRequests.mockResolvedValue([invitation, outgoing]);
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
  jest.clearAllMocks();
});

describe('helpers', () => {
  it('initials, status pills and the one gold action', () => {
    expect(initialsOf('Alex Kim')).toBe('AK');
    expect(initialsOf('sara')).toBe('SA');
    expect(initialsOf('')).toBe('');
    expect(statusPill('pending')).toEqual({ label: 'Pending', tone: 'warning' });
    expect(statusPill('ACTIVE')).toEqual({ label: 'Active', tone: 'active' });
    expect(statusPill('ended')).toEqual({ label: 'Ended', tone: 'neutral' });
    const hub = (invitations, hasActiveTrainer) => ({ invitations, hasActiveTrainer });
    expect(goldAction({ hub: hub([1], true), trainer: { email: 'x' }, isTrainer: true })).toBe('accept');
    expect(goldAction({ hub: hub([], true), trainer: { email: 'x' }, isTrainer: true })).toBe('contact');
    expect(goldAction({ hub: hub([], true), trainer: {}, isTrainer: true })).toBe('switch');
    expect(goldAction({ hub: hub([], false), trainer: null, isTrainer: false })).toBe('browse');
  });
});

describe('My trainer v2 look (C5), phone', () => {
  it('loading, then the no-coach state with invitations on top', async () => {
    getMyTrainer.mockReturnValue(new Promise(() => {}));
    const tree = await render();
    expect(texts(tree.root)).toContain('Loading your trainer');
  });

  it('error: the ErrorAlert with Retry, which reloads', async () => {
    getMyTrainer.mockRejectedValueOnce({ response: { data: { message: 'Down' } } });
    const tree = await render();
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Could not load your trainer', 'Down']));
    await act(async () => tree.root.find((node) => node.props.title === 'Retry' && node.props.onPress).props.onPress());
    expect(getMyTrainer).toHaveBeenCalledTimes(2);
    expect(texts(tree.root)).toContain('Invitations (1)');
  });

  it('no coach + invitation + request: order, copy, one gold action (Accept), paired cards', async () => {
    const tree = await render();
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining([
        'Invitations (1)',
        'AK',
        'Alex Kim',
        'wants to coach you',
        'You don’t have a trainer',
        'Your requests',
        'Sara Lopez',
        'Pending',
        'Find a trainer',
        'Browse trainers',
        'Want to coach others?',
        'Become a trainer',
      ])
    );
    expect(shown.indexOf('Invitations (1)')).toBeLessThan(shown.indexOf('Find a trainer'));
    expect(comp(tree.root, 'trainer-hub-accept-5').props.variant).toBe('primary');
    expect(comp(tree.root, 'trainer-hub-decline-5').props.variant).toBe('secondary');
    expect(comp(tree.root, 'trainer-hub-browse').props.variant).toBe('secondary');
    expect(comp(tree.root, 'trainer-hub-become').props.variant).toBe('secondary');
    expect(comp(tree.root, 'trainer-hub-accept-5').props.accessibilityLabel).toBe('Accept Alex Kim');
    expect(comp(tree.root, 'trainer-hub-decline-5').props.accessibilityLabel).toBe('Decline Alex Kim');
    expect(host(tree.root, 'trainer-hub-empty')).toHaveLength(1);
  });

  it('without invitations "Browse trainers" is the gold action', async () => {
    listPendingTrainerRequests.mockResolvedValue([]);
    const tree = await render();
    expect(comp(tree.root, 'trainer-hub-browse').props.variant).toBe('primary');
    expect(texts(tree.root)).not.toContain('Your requests');
  });

  it('Accept: toast, then a reload; busy disables every Accept / Decline', async () => {
    let finish;
    acceptTrainerRequest.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const tree = await render();
    await act(async () => {
      comp(tree.root, 'trainer-hub-accept-5').props.onPress();
    });
    expect(comp(tree.root, 'trainer-hub-accept-5').props.disabled).toBe(true);
    expect(comp(tree.root, 'trainer-hub-decline-5').props.disabled).toBe(true);
    await act(async () => finish());
    expect(addToast).toHaveBeenCalledWith('success', 'Trainer accepted', 'They can now assign you plans and follow your progress.');
    expect(getMyTrainer).toHaveBeenCalledTimes(2);
  });

  it('Accept failure 404: the toast copy', async () => {
    acceptTrainerRequest.mockRejectedValue({ response: { status: 404 } });
    const tree = await render();
    await act(async () => comp(tree.root, 'trainer-hub-accept-5').props.onPress());
    expect(addToast).toHaveBeenCalledWith('error', 'Could not accept', 'That request is no longer available.');
  });

  it('Decline: "Request declined"', async () => {
    rejectTrainerRequest.mockResolvedValue({});
    const tree = await render();
    await act(async () => comp(tree.root, 'trainer-hub-decline-5').props.onPress());
    expect(addToast).toHaveBeenCalledWith('success', 'Request declined');
  });

  it('Browse trainers and Become a trainer push their routes', async () => {
    const tree = await render();
    act(() => comp(tree.root, 'trainer-hub-browse').props.onPress());
    act(() => comp(tree.root, 'trainer-hub-become').props.onPress());
    expect(mockNavigation.push.mock.calls).toEqual([['Trainers'], ['TrainerApply']]);
  });

  it('active coach: the trainer card with Active pill, gold Contact, End coaching, View plans / progress links', async () => {
    getMyTrainer.mockResolvedValue(activeMine);
    listPendingTrainerRequests.mockResolvedValue([]);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const tree = await render();
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining(['Your trainer', 'Sara Lopez', 'sara@example.com', 'Active', 'Strength coach.', 'Contact', 'End coaching', 'View plans', 'View progress'])
    );
    expect(shown).not.toContain('Find a trainer');
    expect(comp(tree.root, 'trainer-hub-contact').props.variant).toBe('primary');
    // UX §8.3: the 18 px mail icon, in the button's text colour.
    const icon = comp(tree.root, 'trainer-hub-contact').props.icon({ color: '#0A0B0F' });
    expect(icon.props).toMatchObject({ name: 'mail', size: 18, color: '#0A0B0F' });
    await act(async () => {
      await comp(tree.root, 'trainer-hub-contact').props.onPress();
    });
    expect(openURL).toHaveBeenCalledWith('mailto:sara@example.com');
    act(() => pressable(tree.root, 'trainer-hub-view-plans').props.onPress());
    act(() => pressable(tree.root, 'trainer-hub-view-progress').props.onPress());
    expect(openShellPath.mock.calls).toEqual([['/plans'], ['/progress']]);
    openURL.mockRestore();
  });

  it('active coach + invitation: the hint; Accept stays gold and enabled, Contact goes glass', async () => {
    getMyTrainer.mockResolvedValue(activeMine);
    listPendingTrainerRequests.mockResolvedValue([invitation]);
    const tree = await render();
    expect(texts(tree.root)).toContain('You already have a trainer. End your current coaching before accepting one of these.');
    expect(comp(tree.root, 'trainer-hub-accept-5').props).toMatchObject({ variant: 'primary', disabled: false });
    expect(comp(tree.root, 'trainer-hub-contact').props.variant).toBe('secondary');
  });

  it('End coaching opens the confirm; success toasts, closes and reloads', async () => {
    getMyTrainer.mockResolvedValue(activeMine);
    listPendingTrainerRequests.mockResolvedValue([]);
    endCoaching.mockResolvedValue({});
    const tree = await render();
    act(() => comp(tree.root, 'trainer-hub-end').props.onPress());
    const dialog = tree.root.find((node) => node.props.testID === 'trainer-hub-end-dialog' && node.props.onConfirm);
    expect(dialog.props.isOpen).toBe(true);
    await act(async () => dialog.props.onConfirm());
    expect(addToast).toHaveBeenCalledWith('success', 'Coaching ended', 'Your plan, schedule and history are all kept — you just manage them yourself now.');
    expect(getMyTrainer).toHaveBeenCalledTimes(2);
  });

  it('trainer role: Trainer mode card first with the gold Switch; no Find / Become cards', async () => {
    mockIsTrainer = true;
    listPendingTrainerRequests.mockResolvedValue([]);
    const tree = await render();
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Trainer mode', 'You are already a trainer', 'View plans', 'View progress']));
    expect(shown).not.toContain('Find a trainer');
    expect(shown).not.toContain('Want to coach others?');
    expect(comp(tree.root, 'trainer-hub-switch').props.variant).toBe('primary');
    act(() => comp(tree.root, 'trainer-hub-switch').props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/trainer');
  });

  it('the Pending pill is the warning StatusPill', async () => {
    const tree = await render();
    const pill = tree.root.find((node) => node.props.testID === 'trainer-hub-request-status-6' && node.props.tone);
    expect(pill.props).toMatchObject({ label: 'Pending', tone: 'warning' });
  });
});

describe('My trainer v2 look (C5), tablet', () => {
  beforeEach(() => setWidth(834));

  it('active coach: 104 avatar, 52 name, links side by side', async () => {
    getMyTrainer.mockResolvedValue(activeMine);
    listPendingTrainerRequests.mockResolvedValue([outgoing]);
    const tree = await render();
    const avatar = host(tree.root, 'trainer-hub-avatar')[0];
    expect(Object.assign({}, ...[].concat(avatar.props.style).flat().filter(Boolean)).width).toBe(104);
    const name = tree.root.find((node) => node.type === 'Text' && node.props.children === 'Sara Lopez' && node.props.numberOfLines === 2);
    expect(Object.assign({}, ...[].concat(name.props.style).flat().filter(Boolean)).fontSize).toBe(52);
    // The requests list is a full-width card on tablets (no pairing).
    expect(host(tree.root, 'trainer-hub-empty')).toHaveLength(0);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['Your requests', 'Pending']));
  });

  it('no coach: the kit EmptyState, not the compact phone card', async () => {
    const tree = await render();
    expect(host(tree.root, 'trainer-hub-empty')).toHaveLength(0);
    expect(texts(tree.root)).toContain('You don’t have a trainer');
  });
});
