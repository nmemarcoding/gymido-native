jest.mock('../shell/ShellPage', () => ({ children }) => children);
jest.mock('../auth/authService', () => ({ logout: jest.fn(), signOutDeletedAccount: jest.fn() }));
jest.mock('../shell/shellLinks', () => ({ openShellPath: jest.fn() }));
jest.mock('./CoachingCard', () => () => null);
jest.mock('./ProfileStatTiles', () => () => null);
jest.mock('./api/profileApi', () => ({ getProfile: jest.fn(), createProfile: jest.fn(), deleteAccount: jest.fn() }));
jest.mock('../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
const mockNavigation = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), reset: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { act, create } from 'react-test-renderer';

import { signOutDeletedAccount } from '../auth/authService';
import { useAuthStore } from '../auth/authStore';
import { isAdminUser } from '../shell/shellRules';
import CreateProfileScreen from './CreateProfileScreen';
import { deleteAccountErrorMessage, matchesDeleteConfirm } from './DeleteAccountDialog';
import { createProfile, deleteAccount } from './api/profileApi';
import { resetProfileStore, setStoredProfile } from './profileStore';
import ProfileSettingsScreen from './screens/ProfileSettingsScreen';

const PROFILE = {
  first_name: 'Asad',
  last_name: 'Khan',
  height_value: 69,
  height_unit: 'ft_in',
  current_weight_value: 82.5,
  current_weight_unit: 'kg',
  goal_weight_value: 78,
  goal_weight_unit: 'kg',
  date_of_birth: null,
  sex: null,
};

// A Text's own string, nested Text children included.
function textOf(node) {
  return []
    .concat(node.props.children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : child?.props ? textOf(child) : ''))
    .join('');
}
const texts = (root) => root.findAll((node) => node.type === 'Text').map(textOf);
const pressable = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const field = (root) => root.find((node) => node.props.testID === 'delete-account-confirm' && typeof node.props.onChangeText === 'function');
const queryAll = (root, id) => root.findAll((node) => node.props.testID === id && typeof node.type === 'string');
const dialogOpen = (root) => root.findAll((node) => node.props.testID === 'delete-account-dialog').length > 0;

const mounted = [];
beforeEach(() => {
  jest.clearAllMocks();
  resetProfileStore();
  useAuthStore.setState({ user: { email: 'member@example.com', roles: [] }, claims: { sub: 'auth0|member' } });
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  mounted.push(tree);
  return tree;
}

function renderSettings() {
  setStoredProfile(PROFILE);
  return render(<ProfileSettingsScreen />);
}

function openDialog(tree) {
  act(() => pressable(tree.root, 'delete-account-open').props.onPress());
}

function type(tree, value) {
  act(() => field(tree.root).props.onChangeText(value));
}

// The Pressable inside PillButton (it carries accessibilityState).
const button = (root, id) => root.find((node) => node.props.testID === id && typeof node.props.onPress === 'function' && node.props.accessibilityState);
const submit = (tree) => button(tree.root, 'delete-account-submit');
const cancel = (tree) => button(tree.root, 'delete-account-cancel');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('P1b.1 who sees it', () => {
  it('shows the button + subline under Logout for a member (P1.3 item 5, P1b.2)', () => {
    const tree = renderSettings();
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Delete account', 'Permanently erase your account and all your data.']));
    expect(shown.indexOf('Delete account')).toBeGreaterThan(shown.indexOf('Logout'));
    const button = pressable(tree.root, 'delete-account-open');
    expect(button.props.accessibilityHint).toBe("Opens a confirmation. This can't be undone.");
    // P1b.2: 32 below Logout. v2 (declared look change): the phone column gap
    // is 14 (UX K Profile), so the wrapper pads 18 (was 12 + the 20 gap).
    const action = tree.root.find((node) => node.props.testID === 'delete-account-action' && typeof node.type === 'string');
    expect([].concat(action.props.style)).toEqual(expect.arrayContaining([{ paddingTop: 18 }]));
  });

  it('hides the button and subline for admins (P1b.1 isAdminUser: claim, role/role_code, role_id 2)', () => {
    expect(isAdminUser({ roles: [' Admin '] })).toBe(true);
    expect(isAdminUser({ role: 'admin' })).toBe(true);
    expect(isAdminUser({ role_code: 'ADMIN' })).toBe(true);
    expect(isAdminUser({ role_id: 2 })).toBe(true);
    expect(isAdminUser({ roleID: '2' })).toBe(true);
    expect(isAdminUser({ roles: ['trainer'], role_id: 3 })).toBe(false);
    expect(isAdminUser(null)).toBe(false);

    useAuthStore.setState({ user: { email: 'admin@example.com', roles: ['admin'] } });
    const tree = renderSettings();
    const shown = texts(tree.root);
    expect(shown).toContain('Logout');
    expect(shown).not.toContain('Delete account');
    expect(shown).not.toContain('Permanently erase your account and all your data.');
  });

  it('shows it to Google-only accounts too (P1b.1)', () => {
    useAuthStore.setState({ claims: { sub: 'google-oauth2|123' } });
    const tree = renderSettings();
    expect(texts(tree.root)).toContain('Delete account');
  });
});

describe('P1b.3 dialog', () => {
  it('has the member copy, no trainer bullet, no Google line, the field and both buttons', () => {
    const tree = renderSettings();
    openDialog(tree);
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining([
        'Delete your account?',
        'This permanently deletes your Gymido account and everything in it:',
        'Your workout history and personal records',
        'Your weight log and body measurements',
        'Your profile',
        'Plans you made and your plan-generator answers',
        'Your link to your trainer',
        "Plans your trainer made stay with your trainer. This can't be undone.",
        'Type DELETE to confirm',
        'Cancel',
        'Delete account',
      ])
    );
    expect(shown).not.toContain("Your clients will be disconnected from you. Plans they're using, and their history, stay with them.");
    expect(shown).not.toContain("Your Google account itself isn't affected.");
    const input = field(tree.root);
    expect(input.props.autoFocus).toBe(true);
    expect(input.props.autoCapitalize).toBe('characters');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.spellCheck).toBe(false);
    expect(input.props.autoComplete).toBe('off');
    expect(input.props.returnKeyType).toBe('done');
    expect(input.props.placeholder).toBeUndefined();
  });

  it('adds the trainer bullet last for trainers', () => {
    useAuthStore.setState({ user: { email: 'trainer@example.com', roles: ['trainer'] } });
    const tree = renderSettings();
    openDialog(tree);
    const shown = texts(tree.root);
    const trainerBullet = "Your clients will be disconnected from you. Plans they're using, and their history, stay with them.";
    expect(shown).toContain(trainerBullet);
    expect(shown.indexOf(trainerBullet)).toBeGreaterThan(shown.indexOf('Your link to your trainer'));
  });

  it('adds the Google-only line only for a non-auth0 subject (no subject = password account)', () => {
    useAuthStore.setState({ claims: { sub: 'google-oauth2|123' } });
    let tree = renderSettings();
    openDialog(tree);
    expect(texts(tree.root)).toContain("Your Google account itself isn't affected.");
    act(() => mounted.splice(0).forEach((t) => t.unmount()));

    useAuthStore.setState({ claims: null });
    tree = renderSettings();
    openDialog(tree);
    expect(texts(tree.root)).not.toContain("Your Google account itself isn't affected.");
  });

  it('keeps Delete disabled until the trimmed field equals DELETE in any case, live', () => {
    expect(matchesDeleteConfirm('  delete ')).toBe(true);
    expect(matchesDeleteConfirm('DeLeTe')).toBe(true);
    expect(matchesDeleteConfirm('DELET')).toBe(false);
    expect(matchesDeleteConfirm('DELETE!')).toBe(false);

    const tree = renderSettings();
    openDialog(tree);
    expect(submit(tree).props.accessibilityState.disabled).toBe(true);
    type(tree, 'DEL');
    expect(submit(tree).props.accessibilityState.disabled).toBe(true);
    type(tree, '  delete ');
    expect(submit(tree).props.accessibilityState.disabled).toBe(false);
    type(tree, 'deleted');
    expect(submit(tree).props.accessibilityState.disabled).toBe(true);
  });

  it('does not send on Return before the field matches', async () => {
    const tree = renderSettings();
    openDialog(tree);
    type(tree, 'nope');
    await act(async () => field(tree.root).props.onSubmitEditing());
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('Cancel closes in idle, and reopening starts empty (field, error, state)', async () => {
    deleteAccount.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    const tree = renderSettings();
    openDialog(tree);
    type(tree, 'DELETE');
    await act(async () => submit(tree).props.onPress());
    expect(texts(tree.root)).toContain("Couldn't delete your account");
    act(() => cancel(tree).props.onPress());
    expect(tree.root.find((node) => node.props.testID === 'delete-account-dialog' && 'isOpen' in node.props).props.isOpen).toBe(false);
    openDialog(tree);
    expect(field(tree.root).props.value).toBe('');
    expect(texts(tree.root)).not.toContain("Couldn't delete your account");
    expect(submit(tree).props.accessibilityState.disabled).toBe(true);
  });
});

describe('P1b.4 Create-profile variant', () => {
  // v2 Phase 2 B1 (ND2): on a phone it sits in the sticky CTA bar, 6 under "Create profile".
  it('sits under the Create profile CTA (phone: in the sticky bar, 6 below) with the short subline', () => {
    const tree = render(<CreateProfileScreen />);
    const shown = texts(tree.root);
    expect(shown).toEqual(expect.arrayContaining(['Delete account', "Don't want to continue? Permanently erase your sign-in."]));
    expect(shown.indexOf('Delete account')).toBeGreaterThan(shown.indexOf('Create profile'));
    const bar = tree.root.find((node) => node.props.testID === 'profile-cta-bar' && typeof node.type === 'string');
    const action = bar.find((node) => node.props.testID === 'delete-account-action' && typeof node.type === 'string');
    expect([].concat(action.props.style)).toEqual(expect.arrayContaining([{ marginTop: 6 }]));
  });

  it('is hidden for admins on Create profile', () => {
    useAuthStore.setState({ user: { email: 'admin@example.com', roles: [], role_id: 2 } });
    const tree = render(<CreateProfileScreen />);
    expect(texts(tree.root)).not.toContain('Delete account');
  });

  it('has the short dialog body: no bullets, no trainer lines; the Google line when it applies', () => {
    useAuthStore.setState({ user: { email: 'trainer@example.com', roles: ['trainer'] }, claims: { sub: 'google-oauth2|9' } });
    const tree = render(<CreateProfileScreen />);
    openDialog(tree);
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining([
        'Delete your account?',
        "This permanently deletes your Gymido account and your sign-in. This can't be undone.",
        "Your Google account itself isn't affected.",
        'Type DELETE to confirm',
      ])
    );
    expect(shown).not.toContain('This permanently deletes your Gymido account and everything in it:');
    expect(shown).not.toContain('Your profile');
    expect(shown).not.toContain("Your clients will be disconnected from you. Plans they're using, and their history, stay with them.");
    expect(shown.some((line) => line.startsWith('Plans your trainer made'))).toBe(false);
  });

  it('is disabled (opacity 60) while the profile is being submitted', async () => {
    const pending = deferred();
    createProfile.mockReturnValueOnce(pending.promise);
    const tree = render(<CreateProfileScreen />);
    const set = (id, value) => act(() => tree.root.find((node) => node.props.testID === id && node.props.onChangeText).props.onChangeText(value));
    set('profile-first_name', 'Asad');
    set('profile-last_name', 'Khan');
    set('profile-height_feet', '5');
    set('profile-current_weight_value', '82');
    set('profile-goal_weight_value', '78');
    // Not awaited: the request stays pending.
    act(() => {
      pressable(tree.root, 'profile-submit').props.onPress();
    });
    expect(createProfile).toHaveBeenCalled();
    const button = tree.root.find((node) => node.props.testID === 'delete-account-open' && node.props.onPress);
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    await act(async () => {
      pending.reject({ response: { status: 422, data: {} } });
    });
    expect(tree.root.find((node) => node.props.testID === 'delete-account-open' && node.props.onPress).props.disabled).toBe(false);
  });
});

describe('P1b.5 states', () => {
  it('sending: "Deleting…" + spinner, Delete and Cancel disabled, field read-only, busy body, close blocked, one request', async () => {
    const pending = deferred();
    deleteAccount.mockReturnValueOnce(pending.promise);
    const tree = renderSettings();
    openDialog(tree);
    type(tree, 'DELETE');
    act(() => {
      submit(tree).props.onPress();
    });
    expect(texts(tree.root)).toContain('Deleting…');
    expect(submit(tree).props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(cancel(tree).props.accessibilityState.disabled).toBe(true);
    expect(field(tree.root).props.readOnly).toBe(true);
    expect(tree.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityState?.busy === true).length).toBeGreaterThan(0);
    // Scrim / Android back go through the modal's onRequestClose.
    const modal = tree.root.find((node) => node.props.testID === 'delete-account-dialog' && 'isOpen' in node.props);
    act(() => modal.props.onClose());
    act(() => cancel(tree).props.onPress());
    expect(dialogOpen(tree.root) && modal.props.isOpen).toBe(true);
    // Presses while sending (button or Return) are ignored.
    act(() => {
      submit(tree).props.onPress();
      field(tree.root).props.onSubmitEditing();
    });
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
  });

  it('error: the alert below the field, typed text kept, Delete and Cancel enabled, closes', async () => {
    deleteAccount.mockRejectedValueOnce({ response: { status: 400, data: { message: 'You cannot delete your own account' } } });
    const tree = renderSettings();
    openDialog(tree);
    type(tree, 'delete');
    await act(async () => submit(tree).props.onPress());
    expect(texts(tree.root)).toEqual(expect.arrayContaining(["Couldn't delete your account", 'You cannot delete your own account']));
    expect(texts(tree.root)).not.toContain('Retry');
    expect(queryAll(tree.root, 'delete-account-error')).toHaveLength(1);
    expect(field(tree.root).props.value).toBe('delete');
    expect(field(tree.root).props.readOnly).toBe(false);
    expect(submit(tree).props.accessibilityState.disabled).toBe(false);
    expect(cancel(tree).props.accessibilityState.disabled).toBe(false);
    expect(signOutDeletedAccount).not.toHaveBeenCalled();
  });

  it('error text: network / ≥500 / server message / fallback', () => {
    expect(deleteAccountErrorMessage({ isAxiosError: true, message: 'Network Error' })).toBe('Check your connection and try again.');
    expect(deleteAccountErrorMessage({ response: { status: 503, data: { message: 'Upstream down' } } })).toBe('Please try again.');
    expect(deleteAccountErrorMessage({ response: { status: 500, data: {} } })).toBe('Please try again.');
    expect(deleteAccountErrorMessage({ response: { status: 400, data: { message: 'You cannot delete your own account' } } })).toBe(
      'You cannot delete your own account'
    );
    expect(deleteAccountErrorMessage({ response: { status: 404, data: { message: '   ' } } })).toBe('Please try again.');
    expect(deleteAccountErrorMessage({ response: { status: 401, data: {} } })).toBe('Please try again.');
  });

  it('error text: a 401 with a message shows it; a failed token fetch is not network (FE ac21d959)', () => {
    expect(deleteAccountErrorMessage({ response: { status: 401, data: { message: 'Session ended' } } })).toBe('Session ended');
    expect(deleteAccountErrorMessage(new Error('No credentials found'))).toBe('Please try again.');
    expect(deleteAccountErrorMessage({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 0ms exceeded' })).toBe(
      'Check your connection and try again.'
    );
  });

  it('network error shows "Check your connection and try again." in the dialog', async () => {
    deleteAccount.mockRejectedValueOnce({ isAxiosError: true, message: 'Network Error' });
    const tree = renderSettings();
    openDialog(tree);
    type(tree, 'DELETE');
    await act(async () => field(tree.root).props.onSubmitEditing());
    expect(texts(tree.root)).toEqual(expect.arrayContaining(["Couldn't delete your account", 'Check your connection and try again.']));
  });

  it('deleted: the status row replaces the body, no footer, close blocked, sign-out at once (P1b.6)', async () => {
    deleteAccount.mockResolvedValueOnce();
    const tree = renderSettings();
    openDialog(tree);
    type(tree, 'DELETE');
    await act(async () => submit(tree).props.onPress());
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(signOutDeletedAccount).toHaveBeenCalledTimes(1);
    const shown = texts(tree.root);
    expect(shown).toContain('Account deleted. Signing you out…');
    expect(shown).not.toContain('Type DELETE to confirm');
    expect(shown).not.toContain('Cancel');
    expect(tree.root.findAll((node) => node.props.testID === 'delete-account-submit')).toHaveLength(0);
    const row = tree.root.find((node) => node.props.testID === 'delete-account-deleted' && typeof node.type === 'string');
    expect(row.props.role).toBe('status');
    const modal = tree.root.find((node) => node.props.testID === 'delete-account-dialog' && 'isOpen' in node.props);
    act(() => modal.props.onClose());
    expect(modal.props.isOpen).toBe(true);
  });
});
