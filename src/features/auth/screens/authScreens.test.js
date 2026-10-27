// RN-SPEC-v2-phase2 Group A: Welcome (A1), Sign-in failed (A2), Account
// unavailable (A3) on phone and tablet.
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});
let mockWindow = { width: 390, height: 844 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ ...mockWindow, scale: 3, fontScale: 1 }),
}));
jest.mock('../authService', () => ({
  login: jest.fn(),
  signup: jest.fn(),
  logout: jest.fn(),
  retryLastAttempt: jest.fn(),
  takeAccountDeletedNotice: jest.fn(() => false),
}));

import { AccessibilityInfo, StyleSheet } from 'react-native';
import { Circle } from 'react-native-svg';
import { act, create } from 'react-test-renderer';

import ErrorAlert from '../../../shared/components/ErrorAlert';
import PillButton from '../../../shared/components/PillButton';
import Screen from '../../../shared/components/Screen';
import { colors, gradients } from '../../../shared/theme/tokens';
import { login, logout, retryLastAttempt, signup } from '../authService';
import { AuthStatus, useAuthStore } from '../authStore';
import { GTile, WelcomeRings, boardTop, isTabletWidth } from '../components/AuthArt';
import AccountUnavailableScreen, { TITLE } from './AccountUnavailableScreen';
import SignInFailedScreen from './SignInFailedScreen';
import WelcomeScreen, { PHONE, TABLET, welcomeArt } from './WelcomeScreen';

const PHONE_WINDOW = { width: 390, height: 844 };
const TABLET_PORTRAIT = { width: 834, height: 1194 };
const TABLET_LANDSCAPE = { width: 1194, height: 834 };

function render(element) {
  let tree;
  act(() => {
    tree = create(element, { createNodeMock: (el) => ({ testID: el.props.testID }) });
  });
  return tree;
}
const host = (tree, id) => tree.root.find((node) => node.props.testID === id && typeof node.type === 'string');
const hasId = (tree, id) => tree.root.findAll((node) => node.props.testID === id).length > 0;
const button = (tree, id) => tree.root.find((node) => node.type === PillButton && node.props.testID === id);
const flat = (node) => StyleSheet.flatten(node.props.style);
const texts = (tree) =>
  tree.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
const glowOf = (tree) => tree.root.find((node) => node.type === Screen).props.glow;

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let focusSpy;
let announceSpy;
beforeEach(() => {
  jest.useFakeTimers();
  mockWindow = PHONE_WINDOW;
  jest.clearAllMocks();
  useAuthStore.setState({ status: AuthStatus.signedOut, signInError: null, lastAttempt: 'login' });
  focusSpy = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  jest.spyOn(require('react-native'), 'findNodeHandle', 'get').mockReturnValue((ref) => ref?.testID ?? ref?.props?.testID ?? null);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('AuthArt helpers', () => {
  it('tablet = width ≥ 768 in both orientations', () => {
    expect(isTabletWidth(767)).toBe(false);
    expect(isTabletWidth(768)).toBe(true);
    expect(isTabletWidth(TABLET_LANDSCAPE.width)).toBe(true);
  });

  it('boardTop maps a board offset to the window under the inset, never below the minimum', () => {
    expect(boardTop(180, 844, 844, 47)).toBe(133);
    expect(boardTop(180, 844, 600, 47)).toBe(81);
    expect(boardTop(10, 844, 600, 47)).toBe(24);
    expect(boardTop(10, 844, 600, 47, 0)).toBe(0);
  });

  it('GTile: solid gold, §7.1 radius, on-gold Geist "G" at half the size, hidden from readers', () => {
    const tree = render(<GTile size={64} />);
    const tile = host(tree, 'g-tile');
    expect(flat(tile)).toMatchObject({ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.gold });
    expect(tile.props.importantForAccessibility).toBe('no-hide-descendants');
    const glyph = tree.root.find((node) => node.type === 'Text');
    expect(flat(glyph)).toMatchObject({ fontSize: 32, color: colors.onGold, fontFamily: 'Geist-Bold' });
    expect(flat(glyph).fontWeight).toBeUndefined();
    expect(flat(host(render(<GTile size={44} />), 'g-tile')).borderRadius).toBe(14);
  });

  it('WelcomeRings: explicit Svg size, gold outer and teal inner arcs, decorative', () => {
    const tree = render(<WelcomeRings size={240} />);
    const svg = tree.root.find((node) => node.props.viewBox === '0 0 300 300');
    expect(svg.props).toMatchObject({ width: 240, height: 240 });
    const strokes = tree.root.findAll((node) => node.type === Circle && node.props.strokeDashoffset !== undefined).map((node) => node.props.stroke);
    expect(strokes).toEqual([colors.gold, colors.teal]);
    expect(host(tree, 'welcome-art').props.accessibilityElementsHidden).toBe(true);
  });
});

describe('A1 Welcome', () => {
  it('phone: glow, ring art, 44 tile, "Gymido" heading and two 60 CTA buttons (gold Log in, glass Sign up)', () => {
    const tree = render(<WelcomeScreen />);
    expect(glowOf(tree)).toBe(gradients.welcomeGlow);
    expect(hasId(tree, 'welcome-art')).toBe(true);
    expect(flat(host(tree, 'g-tile')).width).toBe(PHONE.tile);
    const title = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(title.props.children).toBe('Gymido');
    expect(flat(title)).toMatchObject({ fontSize: 44, lineHeight: 48, color: colors.textPrimary });
    expect(button(tree, 'welcome-log-in').props).toMatchObject({ title: 'Log in', size: 'cta', variant: 'primary', disabled: false, fullWidth: true });
    expect(button(tree, 'welcome-sign-up').props).toMatchObject({ title: 'Sign up', size: 'cta', variant: 'secondary', disabled: false });
    // No other links (Forgot password / Terms belong to Auth0).
    expect(texts(tree).filter((text) => !['G', 'Gymido', 'Log in', 'Sign up'].includes(text))).toEqual([]);
  });

  it('Log in opens Auth0 login; both buttons are disabled (0.5) while the sheet is open; no double launch', async () => {
    const pending = deferred();
    login.mockReturnValue(pending.promise);
    const tree = render(<WelcomeScreen />);
    act(() => {
      button(tree, 'welcome-log-in').props.onPress();
    });
    act(() => {
      button(tree, 'welcome-log-in').props.onPress();
      button(tree, 'welcome-sign-up').props.onPress();
    });
    expect(login).toHaveBeenCalledTimes(1);
    expect(signup).not.toHaveBeenCalled();
    expect(button(tree, 'welcome-log-in').props.disabled).toBe(true);
    expect(button(tree, 'welcome-sign-up').props.disabled).toBe(true);
    expect(button(tree, 'welcome-log-in').props.loading).toBeUndefined();
    const pressable = tree.root.find((node) => node.props.testID === 'welcome-log-in' && node.props.accessibilityState);
    expect(pressable.props.accessibilityState.disabled).toBe(true);
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(button(tree, 'welcome-log-in').props.disabled).toBe(false);
  });

  it('Sign up opens Auth0 with the sign-up hint (signup)', async () => {
    signup.mockResolvedValue();
    const tree = render(<WelcomeScreen />);
    await act(async () => {
      await button(tree, 'welcome-sign-up').props.onPress();
    });
    expect(signup).toHaveBeenCalledTimes(1);
    expect(login).not.toHaveBeenCalled();
  });

  it('buttons stay disabled while the store is authenticating (sheet opened elsewhere)', () => {
    useAuthStore.setState({ status: AuthStatus.authenticating });
    const tree = render(<WelcomeScreen />);
    expect(button(tree, 'welcome-log-in').props.disabled).toBe(true);
    act(() => {
      button(tree, 'welcome-log-in').props.onPress();
    });
    expect(login).not.toHaveBeenCalled();
  });

  it('pressed: the kit pressed fills (gold deep on Log in)', () => {
    const tree = render(<WelcomeScreen />);
    const pressable = tree.root.find((node) => node.props.testID === 'welcome-log-in' && typeof node.props.style === 'function');
    expect(StyleSheet.flatten(pressable.props.style({ pressed: true })).backgroundColor).toBe(colors.goldDeep);
  });

  it('tablet portrait: the ring art scaled (no photos), 64 tile, 84 title, 64 buttons in a centred 480 column', () => {
    mockWindow = TABLET_PORTRAIT;
    const tree = render(<WelcomeScreen />);
    expect(flat(host(tree, 'g-tile')).width).toBe(TABLET.tile);
    const title = tree.root.find((node) => node.type === 'Text' && node.props.accessibilityRole === 'header');
    expect(flat(title)).toMatchObject({ fontSize: 84, lineHeight: 84 });
    expect(flat(host(tree, 'welcome-column'))).toMatchObject({ maxWidth: 480, alignSelf: 'center' });
    expect(flat(button(tree, 'welcome-log-in')).minHeight).toBe(64);
    const art = tree.root.find((node) => node.props.viewBox === '0 0 300 300');
    expect(art.props.width).toBe(TABLET.art);
    expect(tree.root.findAll((node) => node.type === 'Image')).toHaveLength(0);
  });

  it('tablet landscape: same centred 480 column; the art shrinks to stay clear of the title', () => {
    mockWindow = TABLET_LANDSCAPE;
    const tree = render(<WelcomeScreen />);
    expect(flat(host(tree, 'welcome-column'))).toMatchObject({ maxWidth: 480, alignSelf: 'center' });
    const art = welcomeArt({ tablet: true, ...TABLET_LANDSCAPE, insets: { top: 24, bottom: 20 } });
    expect(art.size).toBeLessThan(TABLET.art);
    expect(art.top + art.size).toBeLessThanOrEqual(834 - 24 - 20 - TABLET.bottom - TABLET.block);
  });

  it('phone: the art keeps the board place (150 of 844) and its 300 size on a 844 window', () => {
    expect(welcomeArt({ tablet: false, ...PHONE_WINDOW, insets: { top: 47, bottom: 34 } })).toEqual({ top: 103, size: 300 });
    // A short phone: smaller art (568: 187), never under the 160 minimum.
    expect(welcomeArt({ tablet: false, width: 320, height: 568, insets: { top: 20, bottom: 0 } }).size).toBe(187);
    expect(welcomeArt({ tablet: false, width: 320, height: 480, insets: { top: 20, bottom: 0 } }).size).toBe(160);
  });
});

describe('A2 Sign-in failed', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: AuthStatus.signInFailed, signInError: 'Access denied' });
  });

  it('phone: icon tile, eyebrow, title, body, the alert with the Auth0 message and a gold 60 Try again', () => {
    const tree = render(<SignInFailedScreen />);
    expect(glowOf(tree)).toBe(gradients.signInFailedGlow);
    expect(flat(host(tree, 'sign-in-failed-icon')).backgroundColor).toBe(colors.dangerDotTintStrong);
    expect(texts(tree)).toEqual(['Sign-in', 'Sign-in failed', 'Auth0 rejected the login request.', 'Something went wrong', 'Access denied', 'Try again']);
    const alert = tree.root.find((node) => node.type === ErrorAlert);
    expect(alert.props).toMatchObject({ title: 'Something went wrong', description: 'Access denied' });
    expect(host(tree, 'sign-in-failed-alert').props.accessibilityRole).toBe('alert');
    expect(flat(host(tree, 'sign-in-failed-alert'))).toMatchObject({ backgroundColor: colors.surface, borderColor: colors.dangerDotBorderSoft });
    expect(button(tree, 'sign-in-failed-try-again').props).toMatchObject({ size: 'cta', variant: 'primary', fullWidth: true, disabled: false });
  });

  it('announces the alert on mount, then focuses the title', () => {
    render(<SignInFailedScreen />);
    expect(announceSpy).toHaveBeenCalledWith('Something went wrong. Access denied');
    expect(focusSpy).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(300));
    expect(focusSpy).toHaveBeenCalledWith('sign-in-failed-title');
  });

  it('an empty or missing message hides the second line; the title always shows', () => {
    for (const signInError of ['', '   ', null]) {
      useAuthStore.setState({ signInError });
      const tree = render(<SignInFailedScreen />);
      expect(tree.root.find((node) => node.type === ErrorAlert).props.description).toBeUndefined();
      expect(texts(tree)).toEqual(['Sign-in', 'Sign-in failed', 'Auth0 rejected the login request.', 'Something went wrong', 'Try again']);
    }
  });

  it('Try again restarts the Auth0 login once; disabled 0.5 (no spinner) while the sheet opens', async () => {
    const pending = deferred();
    retryLastAttempt.mockReturnValue(pending.promise);
    const tree = render(<SignInFailedScreen />);
    act(() => {
      button(tree, 'sign-in-failed-try-again').props.onPress();
    });
    act(() => {
      button(tree, 'sign-in-failed-try-again').props.onPress();
    });
    expect(retryLastAttempt).toHaveBeenCalledTimes(1);
    expect(button(tree, 'sign-in-failed-try-again').props.disabled).toBe(true);
    expect(button(tree, 'sign-in-failed-try-again').props.loading).toBeUndefined();
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(button(tree, 'sign-in-failed-try-again').props.disabled).toBe(false);
  });

  it('tablet (portrait and landscape): the 600 raised card, padlock ring art, inline gold Try again', () => {
    for (const window of [TABLET_PORTRAIT, TABLET_LANDSCAPE]) {
      mockWindow = window;
      const tree = render(<SignInFailedScreen />);
      expect(glowOf(tree)).toBe(gradients.signInFailedGlowTablet);
      expect(flat(host(tree, 'sign-in-failed-card')).maxWidth).toBe(600);
      expect(hasId(tree, 'sign-in-failed-art')).toBe(true);
      expect(hasId(tree, 'sign-in-failed-icon')).toBe(false);
      const title = host(tree, 'sign-in-failed-title');
      expect(flat(title)).toMatchObject({ fontSize: 54, lineHeight: 56 });
      const tryAgain = button(tree, 'sign-in-failed-try-again');
      expect(tryAgain.props.fullWidth).toBe(false);
      expect(flat(tryAgain)).toMatchObject({ alignSelf: 'flex-start', paddingHorizontal: 40 });
      expect(texts(tree)).toContain('Access denied');
    }
  });
});

describe('A3 Account unavailable', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: AuthStatus.accountUnavailable });
  });

  it('phone: gold icon tile, eyebrow, title, the code copy and the gold 60 Sign out', () => {
    const tree = render(<AccountUnavailableScreen />);
    expect(glowOf(tree)).toBe(gradients.accountGlow);
    expect(flat(host(tree, 'account-unavailable-icon')).backgroundColor).toBe(colors.goldTint);
    expect(texts(tree)).toEqual([
      'Account',
      "We couldn't open your account",
      "You signed in, but this login isn't connected to a Gymido account. If you normally sign in with an email and password, sign out and use that instead.",
      'Sign out',
    ]);
    expect(host(tree, 'account-unavailable-title').props.accessibilityRole).toBe('header');
    expect(button(tree, 'account-unavailable-sign-out').props).toMatchObject({ size: 'cta', variant: 'primary', fullWidth: true, disabled: false });
    // No Retry: Sign out is the only action.
    expect(tree.root.findAll((node) => node.type === PillButton)).toHaveLength(1);
  });

  it('PM parity: announces the title once and gives Sign out the initial focus', () => {
    render(<AccountUnavailableScreen />);
    expect(announceSpy).toHaveBeenCalledTimes(1);
    expect(announceSpy).toHaveBeenCalledWith(TITLE);
    act(() => jest.advanceTimersByTime(300));
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledWith('account-unavailable-sign-out');
  });

  it('PM parity: Sign out runs the logout once and is disabled while signing out (no double call)', async () => {
    const pending = deferred();
    logout.mockReturnValue(pending.promise);
    const tree = render(<AccountUnavailableScreen />);
    act(() => {
      button(tree, 'account-unavailable-sign-out').props.onPress();
    });
    act(() => {
      button(tree, 'account-unavailable-sign-out').props.onPress();
    });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(button(tree, 'account-unavailable-sign-out').props.disabled).toBe(true);
    const pressable = tree.root.find((node) => node.props.testID === 'account-unavailable-sign-out' && node.props.accessibilityState);
    expect(pressable.props.accessibilityState.disabled).toBe(true);
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(button(tree, 'account-unavailable-sign-out').props.disabled).toBe(false);
  });

  it('a failed logout re-enables Sign out', async () => {
    logout.mockRejectedValue(new Error('x'));
    const tree = render(<AccountUnavailableScreen />);
    await act(async () => {
      await button(tree, 'account-unavailable-sign-out').props.onPress().catch(() => {});
    });
    expect(button(tree, 'account-unavailable-sign-out').props.disabled).toBe(false);
  });

  it('tablet (portrait and landscape): the 620 card with the art and the GOLD Sign out (ND2), inline', () => {
    for (const window of [TABLET_PORTRAIT, TABLET_LANDSCAPE]) {
      mockWindow = window;
      const tree = render(<AccountUnavailableScreen />);
      expect(glowOf(tree)).toBe(gradients.accountGlowTablet);
      expect(flat(host(tree, 'account-unavailable-card')).maxWidth).toBe(620);
      expect(hasId(tree, 'account-unavailable-art')).toBe(true);
      expect(flat(host(tree, 'account-unavailable-title'))).toMatchObject({ fontSize: 46, lineHeight: 50 });
      const signOut = button(tree, 'account-unavailable-sign-out');
      expect(signOut.props).toMatchObject({ variant: 'primary', size: 'cta', fullWidth: false });
      expect(flat(signOut)).toMatchObject({ alignSelf: 'flex-start', paddingHorizontal: 40 });
    }
  });
});
