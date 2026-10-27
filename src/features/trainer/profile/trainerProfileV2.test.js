import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import ErrorAlert from '../../../shared/components/ErrorAlert';
import GradientFill from '../../../shared/components/GradientFill';
import { colors, gradients, radii, shadows, textScale } from '../../../shared/theme/tokens';
import { useAuthStore } from '../../auth/authStore';
import { useProfileStore } from '../../profile/profileStore';
import { updateTrainerProfile } from './api/trainerProfileApi';
import TrainerProfileScreen, { AVATAR_PHONE, AVATAR_TABLET, PROFILE_GLOW, TABLET_PROFILE_GLOW } from './screens/TrainerProfileScreen';
import { ownInitials } from './trainerProfileForm';

let mockShellProps;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../../shell/ShellPage', () => (props) => {
  mockShellProps = props;
  return props.children;
});
jest.mock('../TrainerOnly', () => ({ children }) => children);
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../../shared/api/client', () => ({ apiClient: {} }));
jest.mock('./api/trainerProfileApi', () => ({ updateTrainerProfile: jest.fn() }));
jest.mock('../../auth/authService', () => ({ logout: jest.fn() }));
jest.mock('../../../shared/components/toastStore', () => ({ ...jest.requireActual('../../../shared/components/toastStore'),
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));

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
const has = (root, id) => root.findAll((node) => node.props.testID === id).length > 0;
const comp = (root, id) => root.find((node) => node.props.testID === id && typeof node.type !== 'string');
const flat = (style) => StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style) ?? {};

function setWindow(width, fontScale = 1) {
  useWindowDimensions.mockReturnValue({ width, height: 900, scale: 2, fontScale });
}

const mounted = [];
async function render() {
  let tree;
  await act(async () => {
    tree = create(<TrainerProfileScreen />);
  });
  mounted.push(tree);
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  setWindow(390);
  useProfileStore.setState({ profile: { first_name: 'Coach', last_name: 'Nima' } });
  useAuthStore.setState({ user: { email: 'coach@example.com' } });
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

describe('ownInitials (ruling 6)', () => {
  it('first + last name; else the email local part; else "●"', () => {
    expect(ownInitials({ first_name: 'Coach', last_name: 'Nima' }, 'x@y.z')).toBe('CN');
    expect(ownInitials({ first_name: 'Coach' }, 'x@y.z')).toBe('C');
    expect(ownInitials(null, 'kim@example.com')).toBe('K');
    expect(ownInitials(null, undefined)).toBe('●');
  });
});

describe('Trainer profile, phone (TrainerProfile)', () => {
  it('teal wash, Coaching chip, hero card with the gold own-initials avatar and the h1', async () => {
    const tree = await render();
    expect(mockShellProps.glow).toBe(PROFILE_GLOW);
    expect(PROFILE_GLOW.colors).toBe(gradients.tealAmbient.colors);
    const shown = texts(tree.root);
    expect(shown.slice(0, 4)).toEqual(['Coaching', 'CN', 'Trainer profile', 'How you appear to members browsing for a trainer.']);
    const hero = flat(host(tree.root, 'trainer-profile-hero').props.style);
    expect(hero).toEqual(expect.objectContaining({ borderRadius: radii.xxl, padding: 22 }));
    expect(comp(tree.root, 'trainer-profile-hero-glow').findByType(GradientFill).props.colors).toBe(gradients.tealOrb.colors);
    const avatar = host(tree.root, 'trainer-profile-avatar');
    expect(flat(avatar.props.style)).toEqual(
      expect.objectContaining({ width: AVATAR_PHONE, height: AVATAR_PHONE, borderRadius: radii.xl, boxShadow: shadows.goldGlow }),
    );
    expect(avatar.props.accessibilityElementsHidden).toBe(true);
    expect(comp(tree.root, 'trainer-profile-avatar').findByType(GradientFill).props.colors).toBe(gradients.goldAvatar.colors);
    const initials = tree.root.findAllByType(Text).find((node) => node.props.children === 'CN');
    expect(flat(initials.props.style)).toEqual(expect.objectContaining({ color: colors.onGold, fontSize: 26 }));
    const title = tree.root.findAllByType(Text).find((node) => node.props.children === 'Trainer profile');
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('form card: surface, padding 18, radius 28; the teal-tint notice first', async () => {
    const tree = await render();
    const card = flat(host(tree.root, 'trainer-profile-card').props.style);
    expect(card).toEqual(expect.objectContaining({ padding: 18, borderRadius: radii.xxl, backgroundColor: colors.surface, borderColor: colors.hairline }));
    const notice = host(tree.root, 'trainer-profile-notice');
    expect(flat(notice.props.style)).toEqual(expect.objectContaining({ backgroundColor: colors.tealFaint, borderRadius: radii.md }));
    expect(comp(tree.root, 'trainer-profile-card').findAll((node) => node.props.testID === 'trainer-profile-notice').length).toBeGreaterThan(0);
  });

  it('Save profile 54 inline; "Saved." with a green check after success (no sticky bar)', async () => {
    updateTrainerProfile.mockResolvedValue({});
    const tree = await render();
    expect(flat(comp(tree.root, 'trainer-profile-save').props.style).minHeight).toBe(54);
    expect(has(tree.root, 'trainer-profile-saved-status')).toBe(false);
    await act(async () => comp(tree.root, 'trainer-profile-save').props.onPress());
    const status = host(tree.root, 'trainer-profile-saved-status');
    expect(status.props.accessibilityLiveRegion).toBe('polite');
    const saved = tree.root.findAllByType(Text).find((node) => node.props.children === 'Saved.');
    expect(flat(saved.props.style).color).toBe(colors.success);
  });

  it('error state: "Could not save" in the card above the fields, values kept, Save enabled', async () => {
    updateTrainerProfile.mockRejectedValue({ response: { status: 500 } });
    const tree = await render();
    await act(async () => comp(tree.root, 'trainer-profile-display-name').props.onChangeText('Coach K'));
    await act(async () => comp(tree.root, 'trainer-profile-save').props.onPress());
    const alert = tree.root.findByType(ErrorAlert);
    expect(alert.props.title).toBe('Could not save');
    expect(alert.props.onRetry).toBeUndefined();
    const order = comp(tree.root, 'trainer-profile-card').findAll(
      (node) => node.props.testID === 'trainer-profile-error' || node.props.testID === 'trainer-profile-display-name',
    );
    expect(order[0].props.testID).toBe('trainer-profile-error');
    expect(comp(tree.root, 'trainer-profile-save').props.loading).toBe(false);
  });

  it('Logout: full-width danger-tint pill, 52 tall, danger text; pressed overlay', async () => {
    const tree = await render();
    const logout = comp(tree.root, 'trainer-profile-sign-out');
    expect(flat(logout.props.style)).toEqual(
      expect.objectContaining({ minHeight: 52, borderRadius: radii.full, backgroundColor: colors.dangerFaint, borderColor: colors.dangerLine }),
    );
    expect(flat(logout.props.style).alignSelf).toBeUndefined();
    const label = tree.root.findAllByType(Text).find((node) => node.props.children === 'Logout');
    expect(flat(label.props.style).color).toBe(colors.dangerText);
    let pressed;
    act(() => {
      pressed = create(<View>{logout.props.children({ pressed: true })}</View>);
    });
    expect(flat(host(pressed.root, 'trainer-profile-sign-out-pressed').props.style).backgroundColor).toBe(colors.pressOverlay);
    act(() => pressed.unmount());
  });

  it('a later profile change updates the initials', async () => {
    const tree = await render();
    await act(async () => useProfileStore.setState({ profile: { first_name: 'Ada', last_name: 'Lovelace' } }));
    expect(texts(tree.root)).toContain('AL');
  });
});

describe('Trainer profile, tablet (TabletTrainerProfile)', () => {
  beforeEach(() => setWindow(834));

  it('620 column, title row with a 96 circle avatar, the bordered notice outside the card', async () => {
    const tree = await render();
    expect(mockShellProps.glow).toBe(TABLET_PROFILE_GLOW);
    expect(flat(host(tree.root, 'trainer-profile-column').props.style).maxWidth).toBe(620);
    expect(flat(host(tree.root, 'trainer-profile-hero').props.style).flexDirection).toBe('row');
    expect(flat(host(tree.root, 'trainer-profile-avatar').props.style)).toEqual(
      expect.objectContaining({ width: AVATAR_TABLET, borderRadius: AVATAR_TABLET / 2 }),
    );
    const notice = host(tree.root, 'trainer-profile-notice');
    expect(flat(notice.props.style)).toEqual(expect.objectContaining({ borderColor: colors.tealLine, borderRadius: radii.lgPlus }));
    expect(comp(tree.root, 'trainer-profile-card').findAll((node) => node.props.testID === 'trainer-profile-notice')).toHaveLength(0);
    const title = tree.root.findAllByType(Text).find((node) => node.props.children === 'Trainer profile');
    expect(flat(title.props.style).fontSize).toBe(52);
  });

  it('card radius 32 padding 30 with a gold corner glow; Save cta; "Saved." chip; Logout auto width', async () => {
    updateTrainerProfile.mockResolvedValue({});
    const tree = await render();
    expect(flat(host(tree.root, 'trainer-profile-card').props.style)).toEqual(expect.objectContaining({ borderRadius: radii.xxxl, padding: 30 }));
    expect(comp(tree.root, 'trainer-profile-card-glow').findByType(GradientFill).props.colors).toBe(gradients.cardCornerGlow.colors);
    expect(comp(tree.root, 'trainer-profile-save').props.size).toBe('cta');
    await act(async () => comp(tree.root, 'trainer-profile-save').props.onPress());
    expect(flat(host(tree.root, 'trainer-profile-saved-status').props.style)).toEqual(
      expect.objectContaining({ minHeight: 36, backgroundColor: colors.successTint, borderRadius: radii.full }),
    );
    expect(flat(comp(tree.root, 'trainer-profile-sign-out').props.style).alignSelf).toBe('flex-start');
  });
});

describe('Trainer profile large text (UX §9)', () => {
  it.each([
    [390, 1],
    [390, 2],
    [390, 3.1],
    [834, 3.1],
  ])('width %p fontScale %p: title capped, initials capped, actions stack above 1.3', async (width, fontScale) => {
    setWindow(width, fontScale);
    const tree = await render();
    const reflow = fontScale > textScale.reflowAbove;
    const title = tree.root.findAllByType(Text).find((node) => node.props.children === 'Trainer profile');
    expect(title.props.maxFontSizeMultiplier).toBe(textScale.display);
    expect(title.props.numberOfLines).toBe(3);
    const initials = tree.root.findAllByType(Text).find((node) => node.props.children === 'CN');
    expect(initials.props.maxFontSizeMultiplier).toBe(textScale.badge);
    expect(flat(host(tree.root, 'trainer-profile-actions').props.style).flexDirection).toBe(reflow ? 'column' : 'row');
    expect(flat(comp(tree.root, 'trainer-profile-save').props.style).alignSelf).toBe(reflow ? 'stretch' : undefined);
    const notice = tree.root
      .findAllByType(Text)
      .find((node) => node.props.children === 'Saving this makes you discoverable under Find a trainer. Members see your name and bio there.');
    expect(notice.props.maxFontSizeMultiplier).toBe(textScale.body);
    expect(notice.props.numberOfLines).toBeUndefined();
    if (width >= 768) {
      expect(flat(host(tree.root, 'trainer-profile-hero').props.style).flexDirection).toBe(reflow ? 'column' : 'row');
      expect(flat(comp(tree.root, 'trainer-profile-sign-out').props.style).alignSelf).toBe(reflow ? undefined : 'flex-start');
    }
  });
});
