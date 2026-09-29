import { create } from 'zustand';

// RN-SPEC-app-shell §6.3: the tab bar hides while a workout session is active.
// Only the Workout screen sets this (true while focused with a session id,
// false on blur). The Workout spec isn't built yet, so it stays false.
export const useWorkoutSessionStore = create(() => ({
  isSessionActive: false,
}));
