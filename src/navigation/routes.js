// Route names in one place so screens never navigate with string literals.
export const routes = Object.freeze({
  Welcome: 'Welcome',
  SessionLoading: 'SessionLoading',
  SignInFailed: 'SignInFailed',
  AccountUnavailable: 'AccountUnavailable',
  Home: 'Home',
  TrainerDashboard: 'TrainerDashboard',
  Onboarding: 'Onboarding',
  Settings: 'Settings',
  // Member tabs, rendered by the Home route (RN-SPEC-plans §1.3, §9).
  WorkoutTab: 'WorkoutTab',
  ExercisesTab: 'ExercisesTab',
  LibraryTab: 'LibraryTab',
  ProgressTab: 'ProgressTab',
  TrainerTab: 'TrainerTab',
  SettingsTab: 'SettingsTab',
  // Library tab stack.
  PlansList: 'PlansList',
  PlanDetail: 'PlanDetail',
});

// Screens that exist only while signed in.
export const signedInRouteNames = new Set([
  routes.Home,
  routes.TrainerDashboard,
  routes.Onboarding,
  routes.Settings,
]);
