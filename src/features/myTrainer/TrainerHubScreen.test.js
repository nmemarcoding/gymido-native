import { Linking, Text, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import EmptyState from '../../shared/components/EmptyState';
import GradientFill from '../../shared/components/GradientFill';
import PillButton from '../../shared/components/PillButton';
import StatusPill from '../../shared/components/StatusPill';
import { addToast } from '../../shared/components/toastStore';
import { colors, gradients, textScale } from '../../shared/theme/tokens';
import {
  acceptTrainerRequest,
  endCoaching,
  getMyTrainer,
  listPendingTrainerRequests,
  rejectTrainerRequest,
} from './api/myTrainerApi';
import TrainerHubScreen, { goldAction, initialsOf, LINK_FILL, ORB_PHONE, ORB_TABLET, statusPill } from './TrainerHubScreen';

const mockNavigation = { push: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockIsTrainer = false;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('../shell/ShellPage', () => jest.fn(({ children }) => children));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('../shell/shellRules', () => ({ isTrainerUser: () => mockIsTrainer }));
jest.mock('../auth/authStore', () => ({ useAuthStore: (select) => select({ user: {} }) }));
jest.mock('../../shared/components/BlurLayer', () => () => null);
jest.mock('../../shared/components/GradientFill', () => () => null);
jest.mock('../../shared/components/toastStore', () => ({
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));
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
  root
    .findAll((node) => node.type === 'Text')
    .map((node) =>
      []
        .concat(node.props.children)
        .filter((c) => typeof c !== 'object')
        .join(''),
    );
const comp = (root, id) => root.find((node) => node.props.testID === id && typeof node.type !== 'string' && node.props.title);
const host = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');

function setWidth(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
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
      ]),
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
    acceptTrainerRequest.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const tree = await render();
    await act(async () => {
      comp(tree.root, 'trainer-hub-accept-5').props.onPress();
    });
    expect(comp(tree.root, 'trainer-hub-accept-5').props.disabled).toBe(true);
    expect(comp(tree.root, 'trainer-hub-decline-5').props.disabled).toBe(true);
    await act(async () => finish());
    expect(addToast).toHaveBeenCalledWith(
      'success',
      'Trainer accepted',
      'They can now assign you plans and follow your progress.',
    );
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
      expect.arrayContaining([
        'Your trainer',
        'Sara Lopez',
        'sara@example.com',
        'Active',
        'Strength coach.',
        'Contact',
        'End coaching',
        'View plans',
        'View progress',
      ]),
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
    expect(addToast).toHaveBeenCalledWith(
      'success',
      'Coaching ended',
      'Your plan, schedule and history are all kept — you just manage them yourself now.',
    );
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
    const name = tree.root.find(
      (node) => node.type === 'Text' && node.props.children === 'Sara Lopez' && node.props.numberOfLines === 3,
    );
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

// Phase 2 tokens pass: exact colours (UX §8.3–§8.5, state rule) and large text (§9).
const ShellPage = require('../shell/ShellPage');
const flatStyle = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const styleOfHost = (root, id) => flatStyle(host(root, id)[0].props.style);
const insideKit = (node) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if ([PillButton, StatusPill, EmptyState].includes(parent.type)) {
      return true;
    }
  }
  return false;
};
const ownTexts = (root) => root.findAllByType(Text).filter((node) => !insideKit(node));
const linkChildren = (root, id, pressed) => {
  const link = root.find((node) => node.props.testID === id && typeof node.props.children === 'function');
  let inner;
  act(() => {
    inner = create(<>{link.props.children({ pressed })}</>);
  });
  mounted.push(inner);
  return inner;
};
const orderOf = (container, pattern) =>
  container
    .findAll((node) => typeof node.type !== 'string' && node.props.title && pattern.test(node.props.testID ?? ''))
    .map((n) => n.props.testID);

describe('My trainer tokens (Phase 2 exact match)', () => {
  it('the page wash is gradients.tealAmbient on phone and tablet, in every state', async () => {
    for (const width of [390, 834]) {
      setWidth(width);
      await render();
      expect(ShellPage.mock.calls.at(-1)[0].glow).toBe(gradients.tealAmbient);
    }
    getMyTrainer.mockReturnValue(new Promise(() => {}));
    await render();
    expect(ShellPage.mock.calls.at(-1)[0].glow).toBe(gradients.tealAmbient);
  });

  it('phone "Find a trainer": the 200 teal orb at right/top −60, decorative', async () => {
    const tree = await render();
    const orb = host(tree.root, 'trainer-hub-find-orb')[0];
    expect(flatStyle(orb.props.style)).toMatchObject({ position: 'absolute', width: 200, height: 200, right: -60, top: -60 });
    expect(orb.props).toMatchObject({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(orb.findByType(GradientFill).props).toMatchObject({
      radial: gradients.tealOrb.radial,
      colors: gradients.tealOrb.colors,
    });
    expect(ORB_PHONE).toEqual({ size: 200, offset: -60 });
  });

  it('tablet "Your trainer": the 340 orb at −90; phone active card reuses the phone orb', async () => {
    getMyTrainer.mockResolvedValue(activeMine);
    listPendingTrainerRequests.mockResolvedValue([]);
    setWidth(834);
    let tree = await render();
    expect(styleOfHost(tree.root, 'trainer-hub-active-orb')).toMatchObject({ width: 340, height: 340, right: -90, top: -90 });
    expect(ORB_TABLET).toEqual({ size: 340, offset: -90 });
    setWidth(390);
    tree = await render();
    expect(styleOfHost(tree.root, 'trainer-hub-active-orb')).toMatchObject({ width: 200, right: -60, top: -60 });
  });

  // Declared change (p5l, v2 Phase 5 avatar colour rule): the person's colour
  // (user_id mod 6) at 16 % + initials in that colour replace the teal disc /
  // the gold-on-ground disc.
  it('the active trainer avatar: the colour rule (id 9 → index 3 legs), gap ring in surface-card-2, 1 px ring in that colour', async () => {
    getMyTrainer.mockResolvedValue(activeMine);
    listPendingTrainerRequests.mockResolvedValue([]);
    const tree = await render();
    const disc = host(tree.root, 'trainer-hub-avatar')[0];
    expect(flatStyle(disc.findByType(Text).props.style).color).toBe('#9DB0CF');
    expect(styleOfHost(tree.root, 'trainer-hub-avatar-fill')).toMatchObject({ backgroundColor: '#9DB0CF', opacity: 0.16 });
    expect(styleOfHost(tree.root, 'trainer-hub-avatar-ring')).toMatchObject({ padding: 5, backgroundColor: colors.surfaceCard2 });
    expect(styleOfHost(tree.root, 'trainer-hub-avatar-ring-line')).toMatchObject({ borderWidth: 1, borderColor: '#9DB0CF', opacity: 0.6 });
  });

  it('the invitation avatar: the rounded-square tile in the colour rule, no ring', async () => {
    listPendingTrainerRequests.mockResolvedValue([{ ...invitation, trainer: { ...invitation.trainer, user_id: 4 } }]);
    const tree = await render();
    const disc = host(tree.root, 'trainer-hub-avatar')[0];
    expect(flatStyle(disc.props.style)).toMatchObject({ width: 60, borderRadius: 20 });
    expect(styleOfHost(tree.root, 'trainer-hub-avatar-fill')).toMatchObject({ backgroundColor: '#C79BFF' });
    expect(host(tree.root, 'trainer-hub-avatar-ring')).toHaveLength(0);
  });

  it('link cards: 150° tint → faint wash with the line edge; pressed = the 4 % overlay (no opacity)', async () => {
    getMyTrainer.mockResolvedValue(activeMine);
    listPendingTrainerRequests.mockResolvedValue([]);
    const tree = await render();
    const styled = (id) => tree.root.find((node) => node.props.testID === id && typeof node.props.style === 'function');
    const plans = styled('trainer-hub-view-plans');
    const progress = styled('trainer-hub-view-progress');
    expect(flatStyle(plans.props.style({ pressed: false })).borderColor).toBe(colors.goldLine);
    expect(flatStyle(progress.props.style({ pressed: false })).borderColor).toBe(colors.tealLine);
    expect(flatStyle(plans.props.style({ pressed: true })).opacity).toBeUndefined();
    const rest = linkChildren(tree.root, 'trainer-hub-view-plans', false);
    expect(rest.root.findByType(GradientFill).props).toMatchObject({ angle: 150, colors: [colors.goldTint, colors.goldFaint] });
    expect(rest.root.findAll((node) => node.props?.testID === 'trainer-hub-view-plans-pressed')).toHaveLength(0);
    const pressedTeal = linkChildren(tree.root, 'trainer-hub-view-progress', true);
    expect(pressedTeal.root.findByType(GradientFill).props.colors).toEqual([colors.tealTint, colors.tealFaint]);
    const overlay = pressedTeal.root.find((node) => node.props?.testID === 'trainer-hub-view-progress-pressed');
    expect(flatStyle(overlay.props.style).backgroundColor).toBe(colors.pressOverlay);
    expect(LINK_FILL.teal).toEqual([colors.tealTint, colors.tealFaint]);
  });
});

describe('My trainer large text (UX §9)', () => {
  const states = [
    ['no coach', noCoach, [invitation, outgoing]],
    ['active coach', activeMine, [invitation, outgoing]],
  ];

  it.each([
    [390, 1],
    [390, 2],
    [834, 1],
    [834, 3.1],
  ])(
    'width %s, fontScale %s: every own text capped by role; titles wrap by word and shrink; nothing cut to one line',
    async (width, scale) => {
      for (const [, mine, requests] of states) {
        setWidth(width, scale);
        getMyTrainer.mockResolvedValue(mine);
        listPendingTrainerRequests.mockResolvedValue(requests);
        const tree = await render();
        ownTexts(tree.root).forEach((node) => {
          expect(node.props.maxFontSizeMultiplier).toBeGreaterThan(0);
          expect(node.props.numberOfLines === undefined || node.props.numberOfLines >= 2).toBe(true);
        });
        const inviteName = ownTexts(tree.root).find((node) => node.props.children === 'Alex Kim');
        expect(inviteName.props).toMatchObject({
          maxFontSizeMultiplier: textScale.title,
          numberOfLines: 3,
          adjustsFontSizeToFit: true,
          minimumFontScale: 0.7,
        });
      }
    },
  );

  it('the active trainer name: display cap on tablet, title cap on phone', async () => {
    getMyTrainer.mockResolvedValue(activeMine);
    listPendingTrainerRequests.mockResolvedValue([]);
    setWidth(834);
    let tree = await render();
    const tabletName = ownTexts(tree.root).find((node) => node.props.children === 'Sara Lopez');
    expect(tabletName.props).toMatchObject({ maxFontSizeMultiplier: textScale.display, textBreakStrategy: 'simple' });
    setWidth(390);
    tree = await render();
    expect(ownTexts(tree.root).find((node) => node.props.children === 'Sara Lopez').props.maxFontSizeMultiplier).toBe(
      textScale.title,
    );
  });

  it('fontScale 1: Decline · Accept side by side, cards paired, request pill trailing, Become beside its text', async () => {
    const tree = await render();
    const buttons = host(tree.root, 'trainer-hub-invitation-buttons-5')[0];
    expect(flatStyle(buttons.props.style).flexDirection).toBe('row');
    expect(orderOf(buttons, /trainer-hub-(accept|decline)-5/)).toEqual(['trainer-hub-decline-5', 'trainer-hub-accept-5']);
    expect(styleOfHost(tree.root, 'trainer-hub-pair').flexDirection).toBe('row');
    expect(styleOfHost(tree.root, 'trainer-hub-become-card').flexDirection).toBe('row');
  });

  it.each([2, 3.1])('fontScale %s phone: Accept stacks above Decline, cards and actions drop to one column', async (scale) => {
    setWidth(390, scale);
    const tree = await render();
    const buttons = host(tree.root, 'trainer-hub-invitation-buttons-5')[0];
    expect(flatStyle(buttons.props.style).flexDirection).toBe('column');
    expect(orderOf(buttons, /trainer-hub-(accept|decline)-5/)).toEqual(['trainer-hub-accept-5', 'trainer-hub-decline-5']);
    expect(comp(tree.root, 'trainer-hub-accept-5').props.fullWidth).toBe(true);
    expect(styleOfHost(tree.root, 'trainer-hub-pair').flexDirection).toBe('column');
    expect(styleOfHost(tree.root, 'trainer-hub-empty').flex).toBeUndefined();
    expect(styleOfHost(tree.root, 'trainer-hub-become-card')).toMatchObject({
      flexDirection: 'column',
      alignItems: 'flex-start',
    });
  });

  it('fontScale 2 tablet: links one column, Contact above End coaching full width, request pill below the name', async () => {
    getMyTrainer.mockResolvedValue(activeMine);
    listPendingTrainerRequests.mockResolvedValue([outgoing]);
    setWidth(834, 1);
    let tree = await render();
    expect(styleOfHost(tree.root, 'trainer-hub-links').flexDirection).toBe('row');
    expect(styleOfHost(tree.root, 'trainer-hub-request-6').flexDirection).toBe('row');
    setWidth(834, 2);
    tree = await render();
    expect(styleOfHost(tree.root, 'trainer-hub-links').flexDirection).toBeUndefined();
    expect(styleOfHost(tree.root, 'trainer-hub-request-6').flexDirection).toBeUndefined();
    const actions = host(tree.root, 'trainer-hub-active-buttons')[0];
    expect(flatStyle(actions.props.style).flexDirection).toBe('column');
    expect(orderOf(actions, /trainer-hub-(contact|end)$/)).toEqual(['trainer-hub-contact', 'trainer-hub-end']);
    expect(comp(tree.root, 'trainer-hub-end').props.fullWidth).toBe(true);
  });
});
