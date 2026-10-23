jest.mock('./api/profileApi', () => ({ getProfile: jest.fn() }));

import { AuthStatus, useAuthStore } from '../auth/authStore';
import { getProfile } from './api/profileApi';
import { ProfileStatus, fetchProfile, resetProfileStore, setStoredProfile, useProfileStore } from './profileStore';

beforeEach(() => {
  resetProfileStore();
  getProfile.mockReset();
});

it('starts idle and loads the profile', async () => {
  expect(useProfileStore.getState().profileStatus).toBe(ProfileStatus.idle);
  getProfile.mockResolvedValue({ profile: { first_name: 'A' } });
  const pending = fetchProfile();
  expect(useProfileStore.getState().profileStatus).toBe(ProfileStatus.loading);
  await pending;
  expect(useProfileStore.getState()).toMatchObject({ profileStatus: ProfileStatus.loaded, profile: { first_name: 'A' } });
});

it('maps 404 and a null profile to missing', async () => {
  getProfile.mockRejectedValue({ response: { status: 404 } });
  await fetchProfile();
  expect(useProfileStore.getState().profileStatus).toBe(ProfileStatus.missing);
  getProfile.mockResolvedValue({ profile: null });
  await fetchProfile();
  expect(useProfileStore.getState().profileStatus).toBe(ProfileStatus.missing);
});

it('keeps the transport error', async () => {
  const error = new Error('Request failed with status code 500');
  error.response = { status: 500 };
  getProfile.mockRejectedValue(error);
  await fetchProfile();
  expect(useProfileStore.getState()).toMatchObject({ profileStatus: ProfileStatus.error, profileError: error });
});

it('resets on sign-out', () => {
  useAuthStore.setState({ status: AuthStatus.signedIn });
  setStoredProfile({ first_name: 'A' });
  useAuthStore.setState({ status: AuthStatus.signedOut });
  expect(useProfileStore.getState()).toMatchObject({ profile: null, profileStatus: ProfileStatus.idle });
});
