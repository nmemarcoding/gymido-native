import { create } from 'zustand';

// T-65 (PHONE-NAV spec §4): what sits at the bottom of the phone screen right
// now, for the app-level toasts (outside the navigator). No other imports, so
// shared components can read it. `phoneTabBar`: ShellOverlay draws the tab bar
// (showsPhoneTabBar of the focused path; true outside the shell, as before).
// `pageDock`: the focused page's PinnedDock ({ id, height }), null = none.
export const usePhoneChromeStore = create((set) => ({
  phoneTabBar: true,
  pageDock: null,
  setPhoneTabBar: (phoneTabBar) => set({ phoneTabBar }),
  setPageDock: (pageDock) => set({ pageDock }),
  // Clears the dock only if it is still this one (a newly focused dock may have taken over).
  clearPageDock: (id) => set((state) => (state.pageDock?.id === id ? { pageDock: null } : state)),
}));
