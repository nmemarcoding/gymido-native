jest.mock('./auth0Client', () => ({
  AUTH_SCOPE: 'openid',
  auth0: {
    webAuth: { authorize: jest.fn(), clearSession: jest.fn() },
    credentialsManager: { clearCredentials: jest.fn(), getCredentials: jest.fn(), saveCredentials: jest.fn() },
  },
}));
jest.mock('./api/authApi', () => ({ getMe: jest.fn() }));
jest.mock('../profile/api/profileApi', () => ({ getProfile: jest.fn() }));
jest.mock('../workspace/workspacePreference', () => ({ loadWorkspace: jest.fn(), setWorkspace: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('../../shared/components/Screen', () => ({ children }) => children);
// Welcome reads the safe-area insets (v2 Phase 2 A1 layout); no provider here.
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { act, create } from 'react-test-renderer';

import { ToastTone, useToastStore } from '../../shared/components/toastStore';
import { ProfileStatus, setStoredProfile, useProfileStore } from '../profile/profileStore';
import { auth0 } from './auth0Client';
import { signOutDeletedAccount, takeAccountDeletedNotice } from './authService';
import { AuthStatus, useAuthStore } from './authStore';
import WelcomeScreen from './screens/WelcomeScreen';

const SIGNED_IN = {
  status: AuthStatus.signedIn,
  user: { email: 'member@example.com', roles: [] },
  claims: { sub: 'auth0|member' },
  profileMissing: false,
  pendingDestination: { name: 'Plans' },
};

beforeEach(() => {
  jest.clearAllMocks();
  takeAccountDeletedNotice();
  useToastStore.setState({ toasts: [] });
  useAuthStore.setState(SIGNED_IN);
  setStoredProfile({ first_name: 'Asad' });
});

function expectSignedOut() {
  const state = useAuthStore.getState();
  expect(state.status).toBe(AuthStatus.signedOut);
  expect(state.user).toBeNull();
  expect(state.claims).toBeNull();
  expect(state.pendingDestination).toBeNull();
  // The per-user stores reset on sign-out, as with a normal logout.
  expect(useProfileStore.getState().profile).toBeNull();
  expect(useProfileStore.getState().profileStatus).toBe(ProfileStatus.idle);
}

describe('P1b.6 sign-out after DELETE /profile', () => {
  it('clears the auth store, the Auth0 session and the stored credentials', async () => {
    auth0.webAuth.clearSession.mockResolvedValueOnce();
    await signOutDeletedAccount();
    expectSignedOut();
    expect(auth0.webAuth.clearSession).toHaveBeenCalledTimes(1);
    expect(auth0.credentialsManager.clearCredentials).toHaveBeenCalled();
    // The last clear comes after clearSession (app-shell §2 order).
    const lastClear = Math.max(...auth0.credentialsManager.clearCredentials.mock.invocationCallOrder);
    expect(lastClear).toBeGreaterThan(auth0.webAuth.clearSession.mock.invocationCallOrder[0]);
  });

  it('still clears the credentials when clearSession fails', async () => {
    auth0.webAuth.clearSession.mockRejectedValueOnce(new Error('a0.session.failed'));
    await signOutDeletedAccount();
    expectSignedOut();
    expect(auth0.credentialsManager.clearCredentials).toHaveBeenCalled();
  });

  it('still clears the credentials when the iOS sign-out sheet is cancelled', async () => {
    auth0.webAuth.clearSession.mockRejectedValueOnce(Object.assign(new Error('User cancelled'), { type: 'USER_CANCELLED' }));
    await signOutDeletedAccount();
    expectSignedOut();
    expect(auth0.credentialsManager.clearCredentials).toHaveBeenCalled();
  });

  it('retries the credential clear when the first one fails', async () => {
    auth0.credentialsManager.clearCredentials.mockRejectedValueOnce(new Error('keychain busy'));
    await signOutDeletedAccount();
    expectSignedOut();
    expect(auth0.credentialsManager.clearCredentials).toHaveBeenCalledTimes(2);
  });
});

describe('P1b.6 Welcome notice (native only)', () => {
  function renderWelcome() {
    let tree;
    act(() => {
      tree = create(<WelcomeScreen />);
    });
    return tree;
  }

  it('shows the 6 s info toast once after a deleted-account sign-out', async () => {
    jest.useFakeTimers();
    try {
      await signOutDeletedAccount();
      const tree = renderWelcome();
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({ tone: ToastTone.info, title: 'Your account has been deleted', message: 'Thanks for training with Gymido.' }),
      ]);
      act(() => jest.advanceTimersByTime(5999));
      expect(useToastStore.getState().toasts).toHaveLength(1);
      act(() => jest.advanceTimersByTime(1));
      expect(useToastStore.getState().toasts).toHaveLength(0);
      act(() => tree.unmount());
      // In memory, one time: the next Welcome has no notice.
      const again = renderWelcome();
      expect(useToastStore.getState().toasts).toHaveLength(0);
      act(() => again.unmount());
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows no notice after a normal sign-out', () => {
    const tree = renderWelcome();
    expect(useToastStore.getState().toasts).toHaveLength(0);
    act(() => tree.unmount());
  });
});
