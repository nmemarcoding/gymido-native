import { create } from 'zustand';

// profileStore (RN-SPEC-profile-create §7). profileStatus: idle | loading |
// loaded | missing | error. The ProfileGate reads it; creating a profile sets it.
export const useProfileStore = create(() => ({
  profile: null,
  profileStatus: 'idle',
  profileError: null,
}));

export function setProfile(profile) {
  useProfileStore.setState({ profile, profileStatus: 'loaded', profileError: null });
}
