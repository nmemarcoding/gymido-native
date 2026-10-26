jest.mock('../../shell/ShellPage', () => ({ children }) => children);
jest.mock('../TrainerOnly', () => ({ children }) => children);
jest.mock('../../../shared/hooks/useFocusRemountKey', () => ({ useFocusRemountKey: () => 0 }));
jest.mock('../../../shared/api/client', () => ({ apiClient: { put: jest.fn() } }));
jest.mock('./api/trainerProfileApi', () => ({ updateTrainerProfile: jest.fn() }));
jest.mock('../../auth/authService', () => ({ logout: jest.fn() }));
jest.mock('../../../shared/components/toastStore', () => ({
  ToastTone: { success: 'success', error: 'error' },
  addToast: jest.fn(),
}));

import { act, create } from 'react-test-renderer';

import { apiClient } from '../../../shared/api/client';
import { logout } from '../../auth/authService';
import { addToast } from '../../../shared/components/toastStore';
import { updateTrainerProfile } from './api/trainerProfileApi';
import TrainerProfileScreen from './screens/TrainerProfileScreen';
import {
  SAVE_ERROR_FALLBACK,
  buildTrainerProfilePayload,
  initialTrainerProfileValues,
  trainerProfileSaveError,
} from './trainerProfileForm';

const texts = (root) =>
  root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
const input = (root, id) => root.find((node) => node.type === 'TextInput' && node.props.testID === id);
const saveButton = (root) =>
  root.find((node) => node.props.testID === 'trainer-profile-save' && typeof node.props.onPress === 'function');

const mounted = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((tree) => tree.unmount()));
});
beforeEach(() => jest.clearAllMocks());

function render() {
  let tree;
  act(() => {
    tree = create(<TrainerProfileScreen />);
  });
  mounted.push(tree);
  return tree;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('trainerProfileForm', () => {
  it('starts blank (⚠TP-1)', () => {
    expect(initialTrainerProfileValues()).toEqual({ display_name: '', bio: '' });
  });

  it('trims both keys and always sends them (⚠TP-3)', () => {
    expect(buildTrainerProfilePayload({ display_name: '  Coach K ', bio: '\n Lifting \n' })).toEqual({
      display_name: 'Coach K',
      bio: 'Lifting',
    });
    expect(buildTrainerProfilePayload({ display_name: '   ', bio: '' })).toEqual({ display_name: '', bio: '' });
  });

  it('uses the server message only on 422', () => {
    const e422 = { response: { status: 422, data: { message: 'The display name is too long.' } } };
    expect(trainerProfileSaveError(e422)).toBe('The display name is too long.');
    const e422Fields = { response: { status: 422, data: { errors: { bio: ['Bio is invalid.'] } } } };
    expect(trainerProfileSaveError(e422Fields)).toBe('Bio is invalid.');
    expect(trainerProfileSaveError({ response: { status: 500, data: { message: 'Boom' } } })).toBe(SAVE_ERROR_FALLBACK);
    expect(trainerProfileSaveError({ message: 'Network Error' })).toBe(SAVE_ERROR_FALLBACK);
  });
});

describe('updateTrainerProfile', () => {
  it('PUTs /trainer/profile', async () => {
    const { updateTrainerProfile: real } = jest.requireActual('./api/trainerProfileApi');
    apiClient.put.mockResolvedValue({ data: { data: { profile: {} } } });
    await real({ display_name: 'A', bio: 'B' });
    expect(apiClient.put).toHaveBeenCalledWith('/trainer/profile', { display_name: 'A', bio: 'B' });
  });
});

describe('TrainerProfileScreen', () => {
  it('renders the copy, blank fields and the caps without any request', () => {
    const tree = render();
    const shown = texts(tree.root);
    [
      'Coaching',
      'Trainer profile',
      'How you appear to members browsing for a trainer.',
      'Saving this makes you discoverable under Find a trainer. Members see your name and bio there.',
      'Display name',
      'Shown instead of your email.',
      'Bio',
      'Save profile',
    ].forEach((copy) => expect(shown).toContain(copy));
    expect(shown).not.toContain('Saved.');
    const name = input(tree.root, 'trainer-profile-display-name');
    const bio = input(tree.root, 'trainer-profile-bio');
    expect(name.props.value).toBe('');
    expect(name.props.placeholder).toBe('Coach K');
    expect(name.props.maxLength).toBe(255);
    expect(bio.props.value).toBe('');
    expect(bio.props.placeholder).toBe('What you coach, and how you work with clients.');
    expect(bio.props.maxLength).toBe(2000);
    expect(bio.props.multiline).toBe(true);
    expect(bio.props.numberOfLines).toBe(6);
    expect(updateTrainerProfile).not.toHaveBeenCalled();
  });

  it('saves trimmed values, disables fields while saving, ignores a double submit, then shows Saved. + toast', async () => {
    const pending = deferred();
    updateTrainerProfile.mockReturnValue(pending.promise);
    const tree = render();
    act(() => input(tree.root, 'trainer-profile-display-name').props.onChangeText('  Coach K  '));
    act(() => input(tree.root, 'trainer-profile-bio').props.onChangeText(' Strength \n'));
    act(() => {
      saveButton(tree.root).props.onPress();
      input(tree.root, 'trainer-profile-display-name').props.onSubmitEditing();
    });
    expect(updateTrainerProfile).toHaveBeenCalledTimes(1);
    expect(updateTrainerProfile).toHaveBeenCalledWith({ display_name: 'Coach K', bio: 'Strength' });
    expect(input(tree.root, 'trainer-profile-display-name').props.editable).toBe(false);
    expect(input(tree.root, 'trainer-profile-bio').props.editable).toBe(false);

    await act(async () => pending.resolve({}));
    expect(texts(tree.root)).toContain('Saved.');
    expect(addToast).toHaveBeenCalledWith('success', 'Profile saved', 'Members can now find you under Find a trainer.');
    // Values are kept.
    expect(input(tree.root, 'trainer-profile-display-name').props.value).toBe('  Coach K  ');
    expect(input(tree.root, 'trainer-profile-display-name').props.editable).toBe(true);

    act(() => input(tree.root, 'trainer-profile-bio').props.onChangeText(' Strength \nx'));
    expect(texts(tree.root)).not.toContain('Saved.');
  });

  it('sends empty strings when nothing is typed (⚠TP-2 / ⚠TP-3)', async () => {
    updateTrainerProfile.mockResolvedValue({});
    const tree = render();
    await act(async () => saveButton(tree.root).props.onPress());
    expect(updateTrainerProfile).toHaveBeenCalledWith({ display_name: '', bio: '' });
  });

  it('shows the 422 server message under "Could not save" and keeps values', async () => {
    updateTrainerProfile.mockRejectedValue({ response: { status: 422, data: { message: 'Bio is too long.' } } });
    const tree = render();
    act(() => input(tree.root, 'trainer-profile-display-name').props.onChangeText('Coach K'));
    await act(async () => saveButton(tree.root).props.onPress());
    const shown = texts(tree.root);
    expect(shown).toContain('Could not save');
    expect(shown).toContain('Bio is too long.');
    expect(shown).not.toContain('Saved.');
    expect(addToast).not.toHaveBeenCalled();
    expect(input(tree.root, 'trainer-profile-display-name').props.value).toBe('Coach K');
  });

  it('shows the generic copy for other failures, with no Retry, and clears it on the next save', async () => {
    updateTrainerProfile.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Boom' } } });
    const tree = render();
    await act(async () => saveButton(tree.root).props.onPress());
    expect(texts(tree.root)).toContain('We could not save your profile. Please try again.');
    expect(texts(tree.root)).not.toContain('Retry');

    updateTrainerProfile.mockResolvedValueOnce({});
    await act(async () => saveButton(tree.root).props.onPress());
    expect(texts(tree.root)).not.toContain('Could not save');
    expect(texts(tree.root)).toContain('Saved.');
  });

  it('ends with the P1 #4 Logout after Save profile; it logs out with no confirmation, even while saving (T-44)', async () => {
    const pending = deferred();
    updateTrainerProfile.mockReturnValue(pending.promise);
    const tree = render();
    const shown = texts(tree.root);
    expect(shown.indexOf('Logout')).toBeGreaterThan(shown.indexOf('Save profile'));
    const logoutButton = () => tree.root.find((node) => node.props.testID === 'trainer-profile-sign-out' && node.props.onPress);
    expect(logoutButton().props.accessibilityRole).toBe('button');
    expect(logoutButton().props.accessibilityLabel).toBe('Logout');
    act(() => {
      saveButton(tree.root).props.onPress();
    });
    expect(logoutButton().props.disabled).toBeFalsy();
    act(() => logoutButton().props.onPress());
    expect(logout).toHaveBeenCalledTimes(1);
    expect(texts(tree.root)).not.toContain('Are you sure?');
    await act(async () => pending.resolve({}));
  });
});
