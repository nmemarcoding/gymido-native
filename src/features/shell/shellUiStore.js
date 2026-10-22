import { create } from 'zustand';

import { useAuthStore } from '../auth/authStore';
import { setWorkspace } from '../workspace/workspacePreference';

// Shell-wide UI state: the notification panel (open flag + the bell's window
// frame for the tablet anchor) and the workout session flag that hides the
// tab bar (app-shell spec §6.3, set only by the Workout screen).
export const useShellUiStore = create((set) => ({
  panelOpen: false,
  bellFrame: null,
  isSessionActive: false,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setBellFrame: (bellFrame) => set({ bellFrame }),
  setSessionActive: (isSessionActive) => set({ isSessionActive }),
}));

export function closePanel() {
  useShellUiStore.getState().setPanelOpen(false);
}

// §6.2: save the preference (the store mirrors it for every render).
export function saveWorkspacePreference(mode) {
  useAuthStore.setState({ workspace: mode });
  setWorkspace(mode).catch(() => {});
}
