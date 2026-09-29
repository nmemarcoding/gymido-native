// Route names in one place so screens never navigate with string literals.
export const routes = Object.freeze({
  Welcome: 'Welcome',
  SessionLoading: 'SessionLoading',
  SignInFailed: 'SignInFailed',
  AccountUnavailable: 'AccountUnavailable',
  Home: 'Home',
  Onboarding: 'Onboarding',
  // App-shell tabs, rendered by the Home route (RN-SPEC-app-shell §3.4).
  HomeTab: 'HomeTab',
  WorkoutTab: 'WorkoutTab',
  ExercisesTab: 'ExercisesTab',
  LibraryTab: 'LibraryTab',
  ProgressTab: 'ProgressTab',
  TrainerTab: 'TrainerTab',
  SettingsTab: 'SettingsTab',
  TrainerDashboardTab: 'TrainerDashboardTab',
  TrainerClientsTab: 'TrainerClientsTab',
  TrainerPlansTab: 'TrainerPlansTab',
  TrainerProfileTab: 'TrainerProfileTab',
  // Library tab stack.
  PlansList: 'PlansList',
  PlanDetail: 'PlanDetail',
});

// Screens that exist only while signed in.
export const signedInRouteNames = new Set([
  routes.Home,
  routes.Onboarding,
]);
