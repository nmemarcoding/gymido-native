// v2 Phase 5 §2 (UX K): Profile, its stat tiles, Coaching card, the password
// / delete dialogs and Edit profile, on phone and tablet and at large text.
jest.mock('../shell/ShellPage', () => ({ children, glow }) => {
  const { View } = require('react-native');
  return <View testID="shell-page" glow={glow}>{children}</View>;
});
jest.mock('../auth/authService', () => ({ logout: jest.fn(), signOutDeletedAccount: jest.fn() }));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./api/profileApi', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  deleteAccount: jest.fn(),
}));
jest.mock('../home/api/homeApi', () => ({ getDashboard: jest.fn() }));
jest.mock('../myTrainer/api/myTrainerApi', () => ({ getMyTrainer: jest.fn(), listPendingTrainerRequests: jest.fn() }));
jest.mock('../myTrainer/myTrainerFormat', () => ({ coachingStatus: jest.fn(() => 'No trainer yet') }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
const mockNavigation = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1194, scale: 2, fontScale: mockFontScale }),
}));

import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { routes } from '../../navigation/routes';
import ErrorAlert from '../../shared/components/ErrorAlert';
import Skeleton from '../../shared/components/Skeleton';
import { colors, gradients, radii } from '../../shared/theme/tokens';
import { useAuthStore } from '../auth/authStore';
import { getDashboard } from '../home/api/homeApi';
import { getMyTrainer, listPendingTrainerRequests } from '../myTrainer/api/myTrainerApi';
import { openShellPath } from '../shell/shellLinks';
import { sendPasswordResetEmail } from './api/profileApi';
import ChangePasswordModal from './ChangePasswordModal';
import CoachingCard from './CoachingCard';
import DeleteAccountAction from './DeleteAccountAction';
import DeleteAccountDialog from './DeleteAccountDialog';
import { clearResetCooldown } from './passwordReset';
import ProfileAvatar from './ProfileAvatar';
import ProfileIcon, { PROFILE_ICON_NAMES } from './ProfileIcon';
import ProfileStatTiles from './ProfileStatTiles';
import { resetProfileStore, setStoredProfile } from './profileStore';
import EditProfileScreen, { EDIT_PROFILE_GLOW_TABLET } from './screens/EditProfileScreen';
import ProfileSettingsScreen, { PROFILE_GLOW, PROFILE_GLOW_TABLET } from './screens/ProfileSettingsScreen';
import { StatsStatus, profileStatTiles, statTileLabel, weightTileValue } from './statTiles';

const PROFILE = {
  first_name: 'Asad',
  last_name: 'Khan',
  height_value: 180,
  height_unit: 'cm',
  current_weight_value: 82.5,
  current_weight_unit: 'kg',
  goal_weight_value: 78,
  goal_weight_unit: 'lb',
  date_of_birth: null,
  sex: null,
};

const flat = (style) => StyleSheet.flatten(style) ?? {};
const host = (root, id) => root.find((node) => node.props.testID === id && typeof node.type === 'string');
const hosts = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const texts = (root) =>
  root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const mounted = [];
function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}
async function renderAsync(element) {
  let tree;
  await act(async () => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}

// Pressable style / children functions: render them in a given state.
function pressedChildren(node, pressed) {
  const kids = typeof node.props.children === 'function' ? node.props.children({ pressed }) : node.props.children;
  return kids;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWidth = 390;
  mockFontScale = 1;
  resetProfileStore();
  clearResetCooldown();
  useAuthStore.setState({ user: { email: 'asad@example.com' }, claims: { sub: 'auth0|1' } });
  getDashboard.mockResolvedValue({ quick_stats: { completed_workouts_total: 37 } });
  getMyTrainer.mockResolvedValue(null);
  listPendingTrainerRequests.mockResolvedValue([]);
});

afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

describe('stat tiles (K N1): pure rules', () => {
  it('ready: Workouts = the dashboard done-total; now / goal in each value\'s own unit', () => {
    const tiles = profileStatTiles({ profile: PROFILE, dashboard: { quick_stats: { completed_workouts_total: 1234 } }, status: StatsStatus.ready });
    expect(tiles.map((tile) => [tile.id, tile.value, tile.label])).toEqual([
      ['workouts', '1,234', 'Workouts'],
      ['now', '82.5', 'kg now'],
      ['goal', '78', 'lb goal'],
    ]);
    expect(tiles.map(statTileLabel)).toEqual(['1,234 Workouts', '82.5 kg now', '78 lb goal']);
  });

  // p5fix (review M3, web parity): a missing total is "—", no longer "0".
  it('ready without a total reads "—" (web: never a made-up 0)', () => {
    expect(profileStatTiles({ profile: PROFILE, dashboard: {}, status: StatsStatus.ready })[0].value).toBe('—');
  });

  it('loading: the Workouts tile is loading; error: "—", announced as unavailable', () => {
    const loading = profileStatTiles({ profile: PROFILE, dashboard: null, status: StatsStatus.loading })[0];
    expect(loading).toMatchObject({ loading: true, value: '—' });
    expect(statTileLabel(loading)).toBe('Workouts, loading');
    const error = profileStatTiles({ profile: PROFILE, dashboard: null, status: StatsStatus.error })[0];
    expect(error).toMatchObject({ loading: false, unavailable: true, value: '—' });
    expect(statTileLabel(error)).toBe('Workouts, unavailable');
  });

  // p5fix (review M4, web parity): a goal without a unit is labelled "Goal",
  // no longer borrowing the current unit ("lb goal").
  it('a missing goal shows "—" labelled "Goal", read as not set; no conversion', () => {
    const tiles = profileStatTiles({
      profile: { ...PROFILE, goal_weight_value: null, goal_weight_unit: null, current_weight_unit: 'lb', current_weight_value: 181.44 },
      dashboard: {},
      status: StatsStatus.ready,
    });
    expect(tiles[1]).toMatchObject({ value: '181.4', label: 'lb now' });
    expect(tiles[2]).toMatchObject({ value: '—', label: 'Goal' });
    expect(statTileLabel(tiles[2])).toBe('Goal, not set');
  });

  it('weightTileValue: one decimal at most, "—" for blank/NaN', () => {
    expect([weightTileValue(78), weightTileValue(82.25), weightTileValue(''), weightTileValue(undefined), weightTileValue('x')]).toEqual([
      '78',
      '82.3',
      '—',
      '—',
      '—',
    ]);
  });
});

describe('ProfileStatTiles', () => {
  it('loading: the skeleton in the Workouts tile only, weights already shown', () => {
    getDashboard.mockReturnValue(new Promise(() => {}));
    const tree = render(<ProfileStatTiles profile={PROFILE} />);
    expect(tree.root.findAllByType(Skeleton)).toHaveLength(1);
    expect(host(tree.root, 'profile-stat-workouts').props.accessibilityLabel).toBe('Workouts, loading');
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['82.5', 'kg now', '78', 'lb goal']));
  });

  it('success: the count, 3 equal columns gap 8, tiles radius 20 surface + hairline, tabular numbers', async () => {
    const tree = await renderAsync(<ProfileStatTiles profile={PROFILE} />);
    expect(texts(tree.root)).toEqual(expect.arrayContaining(['37', 'Workouts']));
    expect(flat(host(tree.root, 'profile-stats').props.style)).toMatchObject({ flexDirection: 'row', gap: 8 });
    const tile = flat(host(tree.root, 'profile-stat-now').props.style);
    expect(tile).toMatchObject({ flex: 1, borderRadius: radii.lg, backgroundColor: colors.surface, borderColor: colors.hairline, paddingVertical: 14, paddingHorizontal: 12 });
    const value = tree.root.findAll((node) => node.type === 'Text' && node.props.children === '37')[0];
    expect(flat(value.props.style)).toMatchObject({ fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] });
  });

  // Audit b1 X4 (RN-SPEC-profile, 27 Oct 2026): a failed GET /dashboard is
  // never a silent "—": the Workouts tile is replaced by an ErrorAlert above
  // the tiles; the now / goal tiles stay below it (2 columns).
  it.each([1, 2])('error (text %s): "Workouts unavailable" + "Please try again." + Retry above the now / goal tiles; no Workouts tile', async (scale) => {
    mockFontScale = scale;
    getDashboard.mockRejectedValue(new Error('boom'));
    const tree = await renderAsync(<ProfileStatTiles profile={PROFILE} />);
    const alert = tree.root.findByType(ErrorAlert);
    expect(alert.props).toMatchObject({ title: 'Workouts unavailable', description: 'Please try again.' });
    expect(hosts(tree.root, 'profile-stat-workouts')).toHaveLength(0);
    expect(hosts(tree.root, 'profile-stat-now')).toHaveLength(1);
    expect(hosts(tree.root, 'profile-stat-goal')).toHaveLength(1);
    const shown = texts(tree.root);
    expect(shown.indexOf('Workouts unavailable')).toBeLessThan(shown.indexOf('82.5'));
    expect(shown).not.toContain('—');
  });

  it('error Retry re-runs only GET /dashboard; success brings the Workouts tile back', async () => {
    getDashboard.mockRejectedValueOnce(new Error('boom'));
    const tree = await renderAsync(<ProfileStatTiles profile={PROFILE} />);
    expect(getDashboard).toHaveBeenCalledTimes(1);
    await act(async () => {
      tree.root.findByType(ErrorAlert).props.onRetry();
    });
    expect(getDashboard).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType(ErrorAlert)).toHaveLength(0);
    expect(texts(host(tree.root, 'profile-stat-workouts'))).toEqual(['37', 'Workouts']);
  });

  it('while the Retry runs the alert stays with its Retry busy', async () => {
    getDashboard.mockRejectedValueOnce(new Error('boom'));
    const tree = await renderAsync(<ProfileStatTiles profile={PROFILE} />);
    getDashboard.mockReturnValueOnce(new Promise(() => {}));
    act(() => tree.root.findByType(ErrorAlert).props.onRetry());
    expect(tree.root.findByType(ErrorAlert).props.retrying).toBe(true);
  });

  it('inCard (tablet hero): fill-subtle tiles, no edge, padding 14 8', async () => {
    const tree = await renderAsync(<ProfileStatTiles profile={PROFILE} inCard />);
    expect(flat(host(tree.root, 'profile-stat-goal').props.style)).toMatchObject({ backgroundColor: colors.fillWell, borderColor: 'transparent', paddingHorizontal: 8 });
  });

  it.each([
    [1, 'row'],
    [2, 'stacked'],
    [3.1, 'stacked'],
  ])('large text %s: %s', async (scale, shape) => {
    mockFontScale = scale;
    const tree = await renderAsync(<ProfileStatTiles profile={PROFILE} />);
    const outer = flat(host(tree.root, 'profile-stats').props.style);
    if (shape === 'row') {
      expect(outer.flexDirection).toBe('row');
    } else {
      // §9 rule 4: label → value rows in one card.
      expect(outer.flexDirection).toBeUndefined();
      expect(flat(host(tree.root, 'profile-stat-goal').props.style)).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between' });
    }
    const value = tree.root.findAll((node) => node.type === 'Text' && node.props.children === '37')[0];
    expect(value.props.maxFontSizeMultiplier).toBe(1.6);
  });
});

describe('CoachingCard (Q1 teal accents)', () => {
  it('pair (phone): teal-line edge, teal title, status after load, a link that pushes My trainer', async () => {
    const tree = await renderAsync(<CoachingCard layout="pair" />);
    const card = pressable(tree.root, 'profile-coaching-card');
    expect(card.props.accessibilityRole).toBe('link');
    expect(card.props.accessibilityLabel).toBe('Coaching, No trainer yet');
    expect(flat(card.props.style)).toMatchObject({ borderColor: colors.tealLine, borderRadius: radii.lg, padding: 14 });
    const title = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Coaching')[0];
    expect(flat(title.props.style).color).toBe(colors.teal);
    act(() => card.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith(routes.MyTrainer);
  });

  it('row (tablet): gradient card, teal tile, chevron; status 13; title text-primary', async () => {
    const tree = await renderAsync(<CoachingCard />);
    const card = pressable(tree.root, 'profile-coaching-card');
    expect(flat(card.props.style)).toMatchObject({ flexDirection: 'row', borderRadius: radii.xl });
    expect(tree.root.findAll((node) => node.props.angle === gradients.card.angle && node.props.colors === gradients.card.colors).length).toBeGreaterThan(0);
    expect(tree.root.findAll((node) => node.type === ProfileIcon && node.props.name === 'chevron')).toHaveLength(1);
    expect(tree.root.findAll((node) => node.type === ProfileIcon && node.props.name === 'coaching')[0].props.color).toBe(colors.teal);
    const title = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Coaching')[0];
    expect(flat(title.props.style).color).toBe(colors.textPrimary);
  });

  // Audit b1 X4 (RN-SPEC-profile, 27 Oct 2026): a failed GET /my-trainer or
  // pending-requests read replaces the card (every variant) in place by an
  // ErrorAlert; Retry reloads both reads.
  it.each([
    ['pair', 'my-trainer'],
    ['row', 'my-trainer'],
    ['pair', 'pending requests'],
    ['row', 'pending requests'],
  ])('%s: a failed %s read → "Coaching unavailable" + "Please try again." + Retry in place of the card', async (layout, read) => {
    (read === 'my-trainer' ? getMyTrainer : listPendingTrainerRequests).mockRejectedValueOnce(new Error('x'));
    const tree = await renderAsync(<CoachingCard layout={layout} />);
    expect(hosts(tree.root, 'profile-coaching-card')).toHaveLength(0);
    const alert = tree.root.findByType(ErrorAlert);
    expect(alert.props).toMatchObject({ title: 'Coaching unavailable', description: 'Please try again.' });
    await act(async () => {
      alert.props.onRetry();
    });
    expect(getMyTrainer).toHaveBeenCalledTimes(2);
    expect(listPendingTrainerRequests).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType(ErrorAlert)).toHaveLength(0);
    expect(pressable(tree.root, 'profile-coaching-card').props.accessibilityLabel).toBe('Coaching, No trainer yet');
  });

  it('pressed: the 4 % overlay (state rule)', async () => {
    const tree = await renderAsync(<CoachingCard layout="pair" />);
    const card = pressable(tree.root, 'profile-coaching-card');
    const shown = render(<>{pressedChildren(card, true)}</>);
    expect(shown.root.findAll((node) => node.props?.testID === 'profile-coaching-card-pressed')).not.toHaveLength(0);
  });

  it.each([1, 2, 3.1])('large text %s: the status is one line up to 1.3×, then wraps', async (scale) => {
    mockFontScale = scale;
    const tree = await renderAsync(<CoachingCard layout="pair" />);
    const status = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'No trainer yet')[0];
    expect(status.props.numberOfLines).toBe(scale > 1.3 ? undefined : 1);
    expect(status.props.maxFontSizeMultiplier).toBe(2);
  });
});

describe('ProfileAvatar and ProfileIcon', () => {
  it('own avatar: gradient-gold from the first render, on-gold initials, phone ring 4 ground + gold-line', () => {
    const tree = render(<ProfileAvatar initials="AK" size={84} testID="a" />);
    expect(tree.root.findAll((node) => node.props.colors === gradients.goldAvatar.colors)).not.toHaveLength(0);
    const initials = tree.root.findAll((node) => node.type === 'Text')[0];
    expect(flat(initials.props.style)).toMatchObject({ fontSize: 30, color: colors.onGold });
    expect(initials.props.maxFontSizeMultiplier).toBe(1);
    const ring = tree.root.findAll((node) => typeof node.type === 'string' && flat(node.props.style).borderColor === colors.goldLine);
    expect(flat(ring[0].props.style)).toMatchObject({ padding: 4, backgroundColor: colors.ground, borderWidth: 1 });
    expect(host(tree.root, 'a').props.accessibilityElementsHidden).toBe(true);
  });

  it('tablet 120: ring 5 surface + gold-strong; Edit 88: no ring', () => {
    const tablet = render(<ProfileAvatar initials="AK" size={120} />);
    expect(tablet.root.findAll((node) => typeof node.type === 'string' && flat(node.props.style).borderColor === colors.goldStrong)).not.toHaveLength(0);
    const edit = render(<ProfileAvatar initials="AK" size={88} />);
    expect(edit.root.findAll((node) => typeof node.type === 'string' && flat(node.props.style).borderWidth === 1)).toHaveLength(0);
  });

  it('every icon draws an explicitly sized Svg; unknown names draw an empty box', () => {
    PROFILE_ICON_NAMES.forEach((name) => {
      const tree = render(<ProfileIcon name={name} size={17} color={colors.textPrimary} testID="icon" />);
      const svg = tree.root.findAll((node) => node.props.testID === 'icon' && node.props.width !== undefined)[0];
      expect([svg.props.width, svg.props.height]).toEqual([17, 17]);
    });
    expect(() => render(<ProfileIcon name="nope" />)).not.toThrow();
  });
});

describe('Profile (phone, UX K Profile)', () => {
  it('order: identity, stat tiles, Coaching · Add weight pair, Account, Workout, Logout, Delete account', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    expect(tree.root.findByProps({ testID: 'shell-page' }).props.glow).toBe(PROFILE_GLOW);
    const shown = texts(tree.root);
    const order = ['Asad Khan', '37', 'Coaching', 'Add weight log manually', 'Account', 'Personal Information', 'Workout', 'Speak rest alerts', 'Logout', 'Delete account'];
    const positions = order.map((text) => shown.indexOf(text));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // The weight action left the Account list for the pair card.
    expect(hosts(tree.root, 'settings-row-weight')).toHaveLength(1);
    expect(flat(host(tree.root, 'settings-pair').props.style)).toMatchObject({ flexDirection: 'row', gap: 8 });
  });

  it('identity: 84 own avatar, 26/30 name header, Manage glass pill 36 (44 hit) → Edit profile', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    expect(tree.root.findByType(ProfileAvatar).props.size).toBe(84);
    const name = host(tree.root, 'settings-display-name');
    expect(name.props.accessibilityRole).toBe('header');
    expect(flat(name.props.style)).toMatchObject({ fontSize: 26, lineHeight: 30 });
    const manage = pressable(tree.root, 'settings-manage');
    expect(flat(manage.props.style)).toMatchObject({ minHeight: 36, borderRadius: radii.full, backgroundColor: colors.fillGlass, borderColor: colors.hairlineStrong });
    expect(manage.props.hitSlop).toEqual({ top: 4, bottom: 4 });
    act(() => manage.props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith(routes.EditProfile);
  });

  it('Add weight card: gold-line edge + gold title, goes to the Progress tab (⚠P-3)', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    const card = pressable(tree.root, 'settings-row-weight');
    expect(flat(card.props.style)).toMatchObject({ borderColor: colors.goldLine, borderRadius: radii.lg });
    act(() => card.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/progress');
  });

  it('Account rows: min 56, 34 fill-glass tile, board icons, chevron; pressed = 4 % overlay', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    const row = pressable(tree.root, 'settings-row-personal');
    expect(flat(row.props.style)).toMatchObject({ minHeight: 56, paddingHorizontal: 16, paddingVertical: 10 });
    const icons = tree.root.findAll((node) => node.type === ProfileIcon).map((node) => node.props.name);
    expect(icons).toEqual(expect.arrayContaining(['person', 'measure', 'units', 'lock', 'speaker', 'vibrate', 'chevron']));
    const shown = render(<>{pressedChildren(row, true)}</>);
    expect(shown.root.findAll((node) => node.props?.testID === 'settings-row-personal-pressed')).not.toHaveLength(0);
    const rest = render(<>{pressedChildren(row, false)}</>);
    expect(rest.root.findAll((node) => node.props?.testID === 'settings-row-personal-pressed')).toHaveLength(0);
  });

  it('Workout tiles: speak gold-tint, vibrate teal-tint (Q1)', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    expect(tree.root.findAll((node) => node.type === ProfileIcon && node.props.name === 'speaker')[0].props.color).toBe(colors.gold);
    expect(tree.root.findAll((node) => node.type === ProfileIcon && node.props.name === 'vibrate')[0].props.color).toBe(colors.teal);
  });

  it('Logout: danger-ghost pill 52 (danger-line, danger-faint, danger-text 15/600), pressed overlay, no confirmation', async () => {
    const { logout } = require('../auth/authService');
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    const button = pressable(tree.root, 'settings-sign-out');
    expect(flat(button.props.style)).toMatchObject({ minHeight: 52, borderRadius: radii.full, borderColor: colors.dangerLine, backgroundColor: colors.dangerFaint });
    const label = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Logout')[0];
    expect(flat(label.props.style)).toMatchObject({ fontSize: 15, color: colors.dangerText });
    const shown = render(<>{pressedChildren(button, true)}</>);
    expect(shown.root.findAll((node) => node.props?.testID === 'settings-sign-out-pressed')).not.toHaveLength(0);
    act(() => button.props.onPress());
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('Google-only: the static Password row, no chevron, no press', async () => {
    useAuthStore.setState({ claims: { sub: 'google-oauth2|1' } });
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    const row = host(tree.root, 'settings-password-info');
    expect(row.props.accessibilityRole).toBe('text');
    expect(row.findAll((node) => node.type === ProfileIcon && node.props.name === 'chevron')).toHaveLength(0);
    expect(row.findAll((node) => typeof node.props.onPress === 'function')).toHaveLength(0);
  });

  it('admins: no Delete account block', async () => {
    useAuthStore.setState({ user: { email: 'a@b.c', role: 'admin' } });
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    expect(hosts(tree.root, 'delete-account-action')).toHaveLength(0);
  });

  it.each([1, 2, 3.1])('large text %s: name title rule, pair stacks past 1.3, row values wrap', async (scale) => {
    mockFontScale = scale;
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    expect(host(tree.root, 'settings-display-name').props).toMatchObject({ maxFontSizeMultiplier: 1.6, numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    expect(flat(host(tree.root, 'settings-pair').props.style).flexDirection).toBe(scale > 1.3 ? 'column' : 'row');
    const value = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Name, DOB, sex')[0];
    expect(value.props.numberOfLines).toBe(scale > 1.3 ? undefined : 1);
    expect(value.props.maxFontSizeMultiplier).toBe(2);
    // Nothing holding text has a fixed height.
    // (The avatar circle is fixed by design: circles keep their size, §9 rule 3.)
    const avatar = new Set(tree.root.findByType(ProfileAvatar).findAll(() => true));
    const fixed = tree.root.findAll(
      (node) => node.type === 'View' && !avatar.has(node) && flat(node.props.style).height && node.findAll((child) => child.type === 'Text').length > 0,
    );
    expect(fixed).toHaveLength(0);
  });
});

describe('Profile (tablet, UX K Tablet: Profile)', () => {
  beforeEach(() => {
    mockWidth = 834;
  });

  it('two columns 300 | 1fr: hero identity (120 avatar, Manage 48 stretched, tiles in the card), Coaching row card; lists right', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    expect(tree.root.findByProps({ testID: 'shell-page' }).props.glow).toBe(PROFILE_GLOW_TABLET);
    expect(flat(host(tree.root, 'settings-tablet').props.style)).toMatchObject({ flexDirection: 'row', gap: 20 });
    expect(flat(host(tree.root, 'settings-identity').props.style)).toMatchObject({ borderRadius: radii.xxxl, paddingTop: 30 });
    expect(tree.root.findByType(ProfileAvatar).props.size).toBe(120);
    expect(flat(pressable(tree.root, 'settings-manage').props.style)).toMatchObject({ alignSelf: 'stretch', minHeight: 48 });
    expect(tree.root.findByType(ProfileStatTiles).props.inCard).toBe(true);
    expect(tree.root.findByType(CoachingCard).props.layout).toBe('row');
  });

  it('Add weight log manually is the last Account row (gold tile); Workout rows have no tiles; rows min 64', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    const weight = pressable(tree.root, 'settings-row-weight');
    expect(flat(weight.props.style)).toMatchObject({ minHeight: 64, paddingHorizontal: 18 });
    expect(tree.root.findAll((node) => node.type === ProfileIcon && node.props.name === 'plus')[0].props.color).toBe(colors.gold);
    expect(tree.root.findAll((node) => node.type === ProfileIcon && (node.props.name === 'speaker' || node.props.name === 'vibrate'))).toHaveLength(0);
    act(() => weight.props.onPress());
    expect(openShellPath).toHaveBeenCalledWith('/progress');
  });

  it('Logout auto width left-aligned (padding 28); Delete account left-aligned under it', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    expect(flat(pressable(tree.root, 'settings-sign-out').props.style)).toMatchObject({ alignSelf: 'flex-start', paddingHorizontal: 28 });
    expect(tree.root.findByType(DeleteAccountAction).props.align).toBe('start');
    expect(flat(host(tree.root, 'delete-account-action').props.style)).toMatchObject({ alignItems: 'flex-start', paddingTop: 14 });
  });

  it.each([1, 2, 3.1])('large text %s: the grid becomes one column past 1.3', async (scale) => {
    mockFontScale = scale;
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    expect(flat(host(tree.root, 'settings-tablet').props.style).flexDirection).toBe(scale > 1.3 ? 'column' : 'row');
  });
});

describe('DeleteAccountAction look', () => {
  it('danger text 14/600, pressed danger-faint, disabled 0.5, align start', () => {
    const tree = render(<DeleteAccountAction disabled align="start" />);
    const button = tree.root.find((node) => node.props.testID === 'delete-account-open' && typeof node.props.style === 'function');
    expect(flat(button.props.style({ pressed: false }))).toMatchObject({ minHeight: 44, minWidth: 44, opacity: 0.5 });
    expect(flat(host(tree.root, 'delete-account-action').props.style).alignItems).toBe('flex-start');
    const label = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Delete account')[0];
    expect(flat(label.props.style)).toMatchObject({ fontSize: 14, color: colors.dangerText });
    const enabled = render(<DeleteAccountAction />);
    const live = enabled.root.find((node) => node.props.testID === 'delete-account-open' && typeof node.props.style === 'function');
    expect(flat(live.props.style({ pressed: true })).backgroundColor).toBe(colors.dangerFaint);
  });
});

describe('Delete account dialog look', () => {
  const dialog = (props) => <DeleteAccountDialog isOpen onClose={jest.fn()} onDeleted={jest.fn()} {...props} />;

  it('phone: the bullets in a fill-subtle well, 6 px muted dots, Delete 60 over Cancel 52', () => {
    const tree = render(dialog({ isTrainer: true }));
    expect(flat(host(tree.root, 'delete-account-bullets').props.style)).toMatchObject({ backgroundColor: colors.fillWell, borderRadius: radii.lg });
    const submit = tree.root.find((node) => node.props.testID === 'delete-account-submit' && node.props.size);
    const cancel = tree.root.find((node) => node.props.testID === 'delete-account-cancel' && node.props.size);
    expect([submit.props.size, cancel.props.size]).toEqual(['cta', 'default']);
    expect(hosts(tree.root, 'app-modal-close')).toHaveLength(0);
  });

  it('tablet: no Close, plain 15/24 list, both buttons 60', () => {
    mockWidth = 834;
    const tree = render(dialog());
    expect(hosts(tree.root, 'app-modal-close')).toHaveLength(0);
    expect(flat(host(tree.root, 'delete-account-bullets').props.style).backgroundColor).toBeUndefined();
    const bullet = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Your profile')[0];
    expect(flat(bullet.props.style)).toMatchObject({ fontSize: 15, lineHeight: 24, color: colors.textStrong2 });
    const sizes = ['delete-account-submit', 'delete-account-cancel'].map((id) => tree.root.find((node) => node.props.testID === id && node.props.size).props.size);
    expect(sizes).toEqual(['cta', 'cta']);
  });

  it('the confirm field is the well variant, tracked 0.12em', () => {
    const tree = render(dialog());
    const field = tree.root.find((node) => node.props.testID === 'delete-account-confirm' && node.props.variant);
    expect(field.props.variant).toBe('well');
    expect(flat(field.props.style)).toMatchObject({ fontSize: 16, letterSpacing: 1.92 });
  });
});

describe('Reset password dialog look', () => {
  const modal = () => <ChangePasswordModal visible onClose={jest.fn()} email="asad@example.com" />;

  it('520 at ≥ 768 (md), no Close; Send 60 gold, Cancel 52 on phones', () => {
    const tree = render(modal());
    const sheet = tree.root.find((node) => node.props.testID === 'change-password-modal' && node.props.size);
    expect([sheet.props.size, sheet.props.hideClose]).toEqual(['md', true]);
    expect(tree.root.find((node) => node.props.testID === 'change-password-submit' && node.props.size).props.size).toBe('cta');
    expect(tree.root.find((node) => node.props.testID === 'change-password-cancel' && node.props.size).props.size).toBe('default');
    const body = host(tree.root, 'change-password-body');
    expect(flat(body.props.style)).toMatchObject({ fontSize: 15, lineHeight: 22, color: colors.textSecondary });
  });

  it('tablet: both 60; sent = the green block (tint, line, 40 disc), "Email sent" success', async () => {
    mockWidth = 834;
    sendPasswordResetEmail.mockResolvedValue({});
    const tree = render(modal());
    expect(tree.root.find((node) => node.props.testID === 'change-password-cancel' && node.props.size).props.size).toBe('cta');
    await act(async () => {
      await tree.root.find((node) => node.props.testID === 'change-password-submit' && node.props.onPress).props.onPress();
    });
    const block = host(tree.root, 'change-password-sent');
    expect(flat(block.props.style)).toMatchObject({ backgroundColor: colors.successTint, borderColor: colors.successLine, borderRadius: radii.xl });
    expect(flat(host(tree.root, 'change-password-sent-disc').props.style)).toMatchObject({ width: 40, height: 40, backgroundColor: colors.success });
    const title = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Email sent')[0];
    expect(flat(title.props.style).color).toBe(colors.success);
    expect(tree.root.find((node) => node.props.testID === 'change-password-resend' && node.props.size).props.size).toBe('cta');
  });
});

describe('Edit profile (UX K Edit profile / Tablet: Edit profile)', () => {
  const field = (root, id) => root.find((node) => node.props.testID === id && node.props.onChangeText);

  it('phone: 88 avatar header, segmented height unit (cm · ft/in · in) switching to Feet + Inches', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<EditProfileScreen />);
    expect(tree.root.findByProps({ testID: 'shell-page' }).props.glow).toBe(false);
    expect(tree.root.findByType(ProfileAvatar).props).toMatchObject({ size: 88, initials: 'AK' });
    const unit = tree.root.find((node) => node.props.testID === 'edit-profile-height-unit' && node.props.segments);
    expect(unit.props.segments.map((segment) => segment.value)).toEqual(['cm', 'ft_in', 'in']);
    expect(unit.props.accessibilityLabel).toBe('Height unit');
    expect(field(tree.root, 'edit-profile-height_value').props.accessibilityLabel).toBe('Height');
    act(() => unit.props.onChange('ft_in'));
    expect(field(tree.root, 'edit-profile-height_feet')).toBeTruthy();
    expect(field(tree.root, 'edit-profile-height_inches')).toBeTruthy();
    expect(tree.root.find((node) => node.props.testID === 'edit-profile-save' && 'disabled' in node.props).props.disabled).toBe(false);
  });

  it('phone: each weight is a card with its unit select inside the field (named per field)', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<EditProfileScreen />);
    expect(flat(host(tree.root, 'edit-profile-current_weight_value-card').props.style)).toMatchObject({ borderRadius: radii.xl, padding: 14, backgroundColor: colors.surface });
    const input = field(tree.root, 'edit-profile-current_weight_value');
    expect(flat(input.props.style)).toMatchObject({ fontSize: 24, fontVariant: ['tabular-nums'], paddingRight: 64 });
    const select = tree.root.find((node) => node.props.testID === 'edit-profile-goal_weight_unit' && node.props.options);
    expect(select.props.accessibilityLabel).toBe('Goal weight unit');
    act(() => select.props.onChange('kg'));
    expect(texts(tree.root)).toContain('In kg.');
  });

  it('phone actions: Cancel 60 + Save changes flex 1 (60); Save disabled while pristine', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<EditProfileScreen />);
    expect(flat(host(tree.root, 'edit-profile-actions').props.style)).toMatchObject({ flexDirection: 'row' });
    const save = tree.root.find((node) => node.props.testID === 'edit-profile-save' && 'disabled' in node.props);
    expect([save.props.size, save.props.disabled]).toEqual(['cta', true]);
    act(() => pressable(tree.root, 'edit-profile-cancel').props.onPress());
    expect(mockNavigation.push).toHaveBeenCalledWith(routes.Settings);
  });

  it('tablet: the gradient form card (radius 28, padding 28), well fields, Height unit Select 140, weight unit Selects 92', async () => {
    mockWidth = 834;
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<EditProfileScreen />);
    expect(tree.root.findByProps({ testID: 'shell-page' }).props.glow).toBe(EDIT_PROFILE_GLOW_TABLET);
    expect(flat(host(tree.root, 'edit-profile-card').props.style)).toMatchObject({ borderRadius: radii.xxl, padding: 28, gap: 20 });
    expect(tree.root.findAllByType(ProfileAvatar)).toHaveLength(0);
    expect(tree.root.find((node) => node.props.testID === 'edit-profile-first_name' && node.props.variant).props.variant).toBe('well');
    const heightUnit = tree.root.find((node) => node.props.testID === 'edit-profile-height-unit' && node.props.options);
    expect(heightUnit.props.label).toBe('Height unit');
    const weightUnit = tree.root.find((node) => node.props.testID === 'edit-profile-current_weight_unit' && node.props.options);
    expect([weightUnit.props.label, weightUnit.props.accessibilityLabel]).toEqual(['Unit', 'Current weight unit']);
    expect(flat(host(tree.root, 'edit-profile-actions').props.style)).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end' });
    act(() => heightUnit.props.onChange('ft_in'));
    expect(field(tree.root, 'edit-profile-height_feet')).toBeTruthy();
  });

  it.each([
    [390, 1],
    [390, 2],
    [390, 3.1],
    [834, 1],
    [834, 3.1],
  ])('large text (width %s, scale %s): title rule; pairs and actions stack past 1.3', async (width, scale) => {
    mockWidth = width;
    mockFontScale = scale;
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<EditProfileScreen />);
    const title = tree.root.findAll((node) => node.type === 'Text' && node.props.children === 'Edit profile')[0];
    expect(title.props).toMatchObject({ maxFontSizeMultiplier: 1.6, numberOfLines: 3, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    const actions = flat(host(tree.root, 'edit-profile-actions').props.style);
    expect(actions.flexDirection).toBe(scale > 1.3 ? 'column-reverse' : 'row');
  });
});

// p5fix (review native-phase5-b65f8fc M3 / M4 / M5, UX K D2; RN-SPEC-profile
// §P1.2 web rules, PM 27 Oct).
describe('p5fix: stat tiles web parity (M3 / M4)', () => {
  it('M3: a MISSING Workouts total shows "—" (never a made-up 0); a real 0 shows "0"', () => {
    for (const dashboard of [{}, { quick_stats: {} }, { quick_stats: { completed_workouts_total: null } }, null]) {
      const tile = profileStatTiles({ profile: PROFILE, dashboard, status: StatsStatus.ready })[0];
      expect([tile.value, tile.loading, tile.unavailable]).toEqual(['—', false, false]);
    }
    expect(profileStatTiles({ profile: PROFILE, dashboard: { quick_stats: { completed_workouts_total: 0 } }, status: StatsStatus.ready })[0].value).toBe('0');
  });

  it('M3: ProfileStatTiles renders "—" for a dashboard without the total, the skeleton only while loading', async () => {
    getDashboard.mockResolvedValue({ quick_stats: {} });
    const tree = await renderAsync(<ProfileStatTiles profile={PROFILE} />);
    expect(tree.root.findAllByType(Skeleton)).toHaveLength(0);
    expect(texts(host(tree.root, 'profile-stat-workouts'))).toEqual(['—', 'Workouts']);
  });

  it('M4: "{unit} now" / "{unit} goal" with the RAW unit; just "Now" / "Goal" when that value has no unit (no fallback)', () => {
    const raw = profileStatTiles({ profile: { ...PROFILE, current_weight_unit: 'lb', goal_weight_unit: 'kg' }, dashboard: {}, status: StatsStatus.ready });
    expect(raw.slice(1).map((tile) => tile.label)).toEqual(['lb now', 'kg goal']);
    const none = profileStatTiles({
      profile: { ...PROFILE, current_weight_unit: null, goal_weight_unit: null, goal_weight_value: null },
      dashboard: {},
      status: StatsStatus.ready,
    });
    expect(none.slice(1).map((tile) => [tile.label, tile.value])).toEqual([
      ['Now', '82.5'],
      ['Goal', '—'],
    ]);
    expect(statTileLabel(none[2])).toBe('Goal, not set');
    // A goal without a unit never borrows the current unit.
    const goalOnly = profileStatTiles({ profile: { ...PROFILE, goal_weight_unit: '' }, dashboard: {}, status: StatsStatus.ready });
    expect(goalOnly[2]).toMatchObject({ label: 'Goal', value: '78' });
  });

  it('M4: values keep at most one decimal, no conversion, and the unit is ONLY in the label', () => {
    const tiles = profileStatTiles({
      profile: { ...PROFILE, current_weight_value: 181.44, current_weight_unit: 'lb', goal_weight_value: 80.06, goal_weight_unit: 'kg' },
      dashboard: {},
      status: StatsStatus.ready,
    });
    expect(tiles.slice(1).map((tile) => tile.value)).toEqual(['181.4', '80.1']);
    expect(tiles.slice(1).every((tile) => !/kg|lb/.test(tile.value))).toBe(true);
  });
});

describe('p5fix: Edit profile weight unit chip (M5) and Sex options (D2)', () => {
  const unitSelect = (root, key) => root.find((node) => node.props.testID === `edit-profile-${key}` && node.props.options);

  it.each([390, 834])('M5 (width %s): the in-field unit chip is a ≥ 44 × 44 target (the effective box)', async (width) => {
    mockWidth = width;
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<EditProfileScreen />);
    if (width >= 768) {
      // Tablet: the unit is a full 52 kit Select, not the chip.
      expect(unitSelect(tree.root, 'current_weight_unit').props.boxStyle).toBeUndefined();
      return;
    }
    for (const key of ['current_weight_unit', 'goal_weight_unit']) {
      const box = flat(unitSelect(tree.root, key).props.boxStyle);
      expect(box.minHeight).toBeGreaterThanOrEqual(44);
      expect(box.minWidth).toBeGreaterThanOrEqual(44);
      // The pressable itself carries no smaller fixed height.
      expect(box.height).toBeUndefined();
    }
  });

  it('D2: "Not set" (null) first, then Male / Female / Other, then "Prefer not to say" ONCE', async () => {
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<EditProfileScreen />);
    const sex = unitSelect(tree.root, 'sex');
    expect(sex.props.options.map((option) => [option.value, option.label])).toEqual([
      ['', 'Not set'],
      ['male', 'Male'],
      ['female', 'Female'],
      ['other', 'Other'],
      ['prefer_not_to_say', 'Prefer not to say'],
    ]);
    expect(sex.props.options.filter((option) => option.label === 'Prefer not to say')).toHaveLength(1);
  });

  it.each([
    ['', null],
    ['prefer_not_to_say', 'prefer_not_to_say'],
    ['female', 'female'],
  ])('D2: choosing %p sends sex %p', async (choice, sent) => {
    const { updateProfile } = require('./api/profileApi');
    setStoredProfile({ ...PROFILE, sex: choice === '' ? 'male' : null });
    updateProfile.mockResolvedValue({ ...PROFILE, sex: sent });
    const tree = await renderAsync(<EditProfileScreen />);
    act(() => unitSelect(tree.root, 'sex').props.onChange(choice));
    const save = tree.root.find((node) => node.props.testID === 'edit-profile-save' && 'disabled' in node.props);
    expect(save.props.disabled).toBe(false);
    await act(async () => {
      await save.props.onPress();
    });
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ sex: sent }));
  });
});

// p5fix (review LOW "untested"): a save after an in-field unit change sends
// the new unit with the value as typed (no conversion).
describe('p5fix: in-field unit change then save', () => {
  it('phone: switching the current weight unit to lb sends current_weight_unit "lb" and the same value', async () => {
    const { updateProfile } = require('./api/profileApi');
    setStoredProfile(PROFILE);
    updateProfile.mockResolvedValue({ ...PROFILE, current_weight_unit: 'lb' });
    const tree = await renderAsync(<EditProfileScreen />);
    const select = tree.root.find((node) => node.props.testID === 'edit-profile-current_weight_unit' && node.props.options);
    act(() => select.props.onChange('lb'));
    const save = tree.root.find((node) => node.props.testID === 'edit-profile-save' && 'disabled' in node.props);
    await act(async () => {
      await save.props.onPress();
    });
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ current_weight_unit: 'lb', current_weight_value: 82.5 }));
  });
});

// Audit b1 X4 (RN-SPEC-profile, 27 Oct 2026): a failed SIDE read never fails
// the page; the full-page error is only for the primary GET /profile.
describe('audit b1 X4: Profile side reads fail in place', () => {
  it.each([390, 834])('width %s: both side reads fail → two inline alerts; identity, lists, Logout stay; no page error', async (width) => {
    mockWidth = width;
    getDashboard.mockRejectedValue(new Error('500'));
    getMyTrainer.mockRejectedValue(new Error('500'));
    setStoredProfile(PROFILE);
    const tree = await renderAsync(<ProfileSettingsScreen />);
    expect(tree.root.findAllByType(ErrorAlert).map((alert) => alert.props.title).sort()).toEqual(['Coaching unavailable', 'Workouts unavailable']);
    expect(hosts(tree.root, 'settings-error')).toHaveLength(0);
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Asad Khan', '82.5', '78', 'Account', 'Workout', 'Logout']));
  });
});
