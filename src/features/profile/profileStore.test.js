jest.mock('./api/profileApi', () => ({ getProfile: jest.fn() }));

import { AuthStatus, useAuthStore } from '../auth/authStore';
import { getProfile } from './api/profileApi';
import { ProfileStatus, applySavedWeightLog, fetchProfile, resetProfileStore, setStoredProfile, useProfileStore } from './profileStore';

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

it('patches the current weight + unit from a saved weight log, with no request (T-24 / T-34 F1)', () => {
  setStoredProfile({ first_name: 'QA', current_weight_value: 80, current_weight_unit: 'kg', goal_weight_unit: 'kg' });
  applySavedWeightLog({ weight_log: { id: 9, weight_value: 170, weight_unit: 'lb' } });
  expect(useProfileStore.getState().profile).toEqual({ first_name: 'QA', current_weight_value: 170, current_weight_unit: 'lb', goal_weight_unit: 'kg' });
  expect(getProfile).not.toHaveBeenCalled();
});

it('leaves the store alone without a profile or a complete saved log', () => {
  applySavedWeightLog({ weight_log: { weight_value: 170, weight_unit: 'lb' } });
  expect(useProfileStore.getState().profile).toBeNull();
  setStoredProfile({ current_weight_value: 80, current_weight_unit: 'kg' });
  applySavedWeightLog({ weight_log: { weight_value: 170 } });
  applySavedWeightLog(undefined);
  expect(useProfileStore.getState().profile).toEqual({ current_weight_value: 80, current_weight_unit: 'kg' });
});
