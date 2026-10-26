import { create } from 'zustand';

import { getStatus } from '../../shared/api/apiError';
import { AuthStatus, useAuthStore } from '../auth/authStore';
import { getProfile } from './api/profileApi';

// The shared profile store of RN-SPEC-app-shell §3.2, used by Profile P1/P2:
// statuses idle / loading / loaded / missing / error.
export const ProfileStatus = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  loaded: 'loaded',
  missing: 'missing',
  error: 'error',
});

const INITIAL = Object.freeze({ profile: null, profileStatus: ProfileStatus.idle, profileError: null });

export const useProfileStore = create(() => ({ ...INITIAL }));

// GET /profile. A 404, or a 200 without a profile, is `missing`.
export async function fetchProfile() {
  useProfileStore.setState({ profileStatus: ProfileStatus.loading, profileError: null });
  try {
    const body = await getProfile();
    const profile = body?.profile ?? null;
    useProfileStore.setState({ profile, profileStatus: profile ? ProfileStatus.loaded : ProfileStatus.missing });
  } catch (error) {
    if (getStatus(error) === 404) {
      useProfileStore.setState({ profile: null, profileStatus: ProfileStatus.missing });
    } else {
      useProfileStore.setState({ profileStatus: ProfileStatus.error, profileError: error });
    }
  }
}

export function setStoredProfile(profile) {
  useProfileStore.setState({ profile, profileStatus: ProfileStatus.loaded, profileError: null });
}

export function resetProfileStore() {
  useProfileStore.setState({ ...INITIAL });
}

// A new session never sees the last one's profile; a created profile is
// fetched again on the next read.
useAuthStore.subscribe((state, previous) => {
  const signedOut = previous.status === AuthStatus.signedIn && state.status !== AuthStatus.signedIn;
  const created = previous.profileMissing && !state.profileMissing;
  if (signedOut || created) {
    resetProfileStore();
  }
});

// T-34 F1 / T-24 (RN-SPEC-progress PR1.2, RN-SPEC-home H1.7, 25 Oct 2026):
// a saved weight log (the 201 body) becomes the profile's current weight +
// unit, with no refetch. null (leave the store alone) without a profile or
// without both saved fields.
export function profileAfterWeightLog(profile, saved) {
  const log = saved?.weight_log;
  if (!profile || log?.weight_value == null || !log?.weight_unit) {
    return null;
  }
  return { ...profile, current_weight_value: log.weight_value, current_weight_unit: log.weight_unit };
}

// Patches the store from a saved weight log, before the caller's reload.
export function applySavedWeightLog(saved) {
  const patched = profileAfterWeightLog(useProfileStore.getState().profile, saved);
  if (patched) {
    setStoredProfile(patched);
  }
}
