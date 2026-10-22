import { routes } from '../../navigation/routes';

// App-shell spec §3.4: every native screen maps to exactly one web path, and
// each sits in one tab's stack. `root` is the screen a tab press resets to.

export const ShellTab = Object.freeze({
  Home: 'HomeTab',
  Workout: 'WorkoutTab',
  Exercises: 'ExercisesTab',
  Library: 'LibraryTab',
  Progress: 'ProgressTab',
  Trainer: 'TrainerTab',
  Settings: 'SettingsTab',
  Notifications: 'NotificationsTab',
  TDashboard: 'TDashboard',
  TClients: 'TClients',
  TPlans: 'TPlans',
  TProfile: 'TProfile',
});

// Screen name → [tab, path(params)].
const SCREENS = {
  [routes.Home]: [ShellTab.Home, () => '/'],
  [routes.Workout]: [ShellTab.Workout, () => '/workout'],
  [routes.Exercises]: [ShellTab.Exercises, () => '/exercises'],
  [routes.PlansLibrary]: [ShellTab.Library, () => '/plans'],
  [routes.Progress]: [ShellTab.Progress, () => '/progress'],
  [routes.MyTrainer]: [ShellTab.Trainer, () => '/my-trainer'],
  [routes.Settings]: [ShellTab.Settings, () => '/profile'],
  [routes.Notifications]: [ShellTab.Notifications, () => '/notifications'],
  [routes.TrainerDashboard]: [ShellTab.TDashboard, () => '/trainer'],
  [routes.TrainerClients]: [ShellTab.TClients, () => '/trainer/clients'],
  [routes.TrainerClient]: [ShellTab.TClients, (params) => `/trainer/clients/${params?.clientUserId ?? ''}`],
  [routes.TrainerPlans]: [ShellTab.TPlans, () => '/trainer/plans'],
  [routes.TrainerPlanCreate]: [ShellTab.TPlans, () => '/trainer/plans/new'],
  [routes.TrainerPlan]: [ShellTab.TPlans, (params) => `/trainer/plans/${params?.planId ?? ''}`],
  [routes.TrainerProfile]: [ShellTab.TProfile, () => '/trainer/profile'],
};

export const TAB_ROOTS = Object.freeze({
  [ShellTab.Home]: routes.Home,
  [ShellTab.Workout]: routes.Workout,
  [ShellTab.Exercises]: routes.Exercises,
  [ShellTab.Library]: routes.PlansLibrary,
  [ShellTab.Progress]: routes.Progress,
  [ShellTab.Trainer]: routes.MyTrainer,
  [ShellTab.Settings]: routes.Settings,
  [ShellTab.Notifications]: routes.Notifications,
  [ShellTab.TDashboard]: routes.TrainerDashboard,
  [ShellTab.TClients]: routes.TrainerClients,
  [ShellTab.TPlans]: routes.TrainerPlans,
  [ShellTab.TProfile]: routes.TrainerProfile,
});

export function isShellScreen(name) {
  return name in SCREENS;
}

export function getScreenPath(name, params) {
  const entry = SCREENS[name];
  return entry ? entry[1](params) : '/';
}

export function getScreenTab(name) {
  return SCREENS[name]?.[0] ?? null;
}

// The navigate() arguments that open a screen inside its tab from anywhere.
export function shellTarget(name, params) {
  return [routes.AppShell, { screen: getScreenTab(name), params: { screen: name, params } }];
}

// The focused leaf route of a navigation state.
export function getFocusedLeaf(state) {
  let current = state;
  let route = null;
  while (current?.routes) {
    route = current.routes[current.index ?? 0];
    current = route?.state;
  }
  return route;
}

// Paths of the tabs' web routes, so the tab bar can open one by path.
export const TAB_FOR_PATH = Object.freeze({
  '/': ShellTab.Home,
  '/workout': ShellTab.Workout,
  '/exercises': ShellTab.Exercises,
  '/plans': ShellTab.Library,
  '/progress': ShellTab.Progress,
  '/my-trainer': ShellTab.Trainer,
  '/profile': ShellTab.Settings,
  '/notifications': ShellTab.Notifications,
  '/trainer': ShellTab.TDashboard,
  '/trainer/clients': ShellTab.TClients,
  '/trainer/plans': ShellTab.TPlans,
  '/trainer/profile': ShellTab.TProfile,
});
