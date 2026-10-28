import { routes } from '../../navigation/routes';

// App-shell spec §3.4: every native screen maps to exactly one web path, and
// each sits in one tab's stack. `root` is the screen a tab press resets to.

export const ShellTab = Object.freeze({
  Today: 'TodayTab',
  Plans: 'PlansTab',
  Exercises: 'ExercisesTab',
  Progress: 'ProgressTab',
  Profile: 'ProfileTab',
  Notifications: 'NotificationsTab',
  TToday: 'TToday',
  TClients: 'TClients',
  TPlans: 'TPlans',
  TProfile: 'TProfile',
});

// Screen name → [tab stack, path(params)]. 5-tab nav (23 Oct): Workout lives
// only in the Today stack, the trainer hub in the Profile stack.
const SCREENS = {
  [routes.Home]: [ShellTab.Today, () => '/'],
  [routes.Workout]: [ShellTab.Today, () => '/workout'],
  [routes.PlansLibrary]: [ShellTab.Plans, () => '/plans'],
  [routes.PlanDetail]: [ShellTab.Plans, (params) => `/plans/${params?.planId ?? ''}`],
  [routes.MyPlans]: [ShellTab.Plans, () => '/plans/mine'],
  [routes.MyPlanCreate]: [ShellTab.Plans, () => '/plans/mine/new'],
  [routes.MyPlan]: [ShellTab.Plans, (params) => `/plans/mine/${params?.planId ?? ''}`],
  [routes.PlanGenerator]: [ShellTab.Plans, () => '/plans/generate'],
  [routes.PlanGeneratorPreview]: [ShellTab.Plans, () => '/plans/generate/preview'],
  [routes.Exercises]: [ShellTab.Exercises, () => '/exercises'],
  // Lives on the Plans or Exercises stack; its path makes Exercises the active tab (⚠X-7).
  [routes.ExerciseDetail]: [ShellTab.Exercises, (params) => `/exercises/${params?.exerciseId ?? ''}`],
  [routes.Progress]: [ShellTab.Progress, () => '/progress'],
  [routes.Settings]: [ShellTab.Profile, () => '/profile'],
  [routes.EditProfile]: [ShellTab.Profile, () => '/profile/edit'],
  [routes.MyTrainer]: [ShellTab.Profile, () => '/my-trainer'],
  [routes.Trainers]: [ShellTab.Profile, () => '/trainers'],
  [routes.TrainerDetail]: [ShellTab.Profile, (params) => `/trainers/${params?.trainerUserId ?? ''}`],
  [routes.TrainerApply]: [ShellTab.Profile, () => '/trainer/apply'],
  [routes.Notifications]: [ShellTab.Notifications, () => '/notifications'],
  [routes.TrainerDashboard]: [ShellTab.TToday, () => '/trainer'],
  [routes.TrainerClients]: [ShellTab.TClients, () => '/trainer/clients'],
  [routes.TrainerClient]: [ShellTab.TClients, (params) => `/trainer/clients/${params?.clientUserId ?? ''}`],
  [routes.TrainerPlans]: [ShellTab.TPlans, () => '/trainer/plans'],
  [routes.TrainerPlanCreate]: [ShellTab.TPlans, () => '/trainer/plans/new'],
  [routes.TrainerPlan]: [ShellTab.TPlans, (params) => `/trainer/plans/${params?.planId ?? ''}`],
  [routes.TrainerProfile]: [ShellTab.TProfile, () => '/trainer/profile'],
};

// Every shell screen name (the route table above), for checks that walk it.
export const SHELL_SCREENS = Object.freeze(Object.keys(SCREENS));

export const TAB_ROOTS = Object.freeze({
  [ShellTab.Today]: routes.Home,
  [ShellTab.Plans]: routes.PlansLibrary,
  [ShellTab.Exercises]: routes.Exercises,
  [ShellTab.Progress]: routes.Progress,
  [ShellTab.Profile]: routes.Settings,
  [ShellTab.Notifications]: routes.Notifications,
  [ShellTab.TToday]: routes.TrainerDashboard,
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

// Web paths the shell opens by path: a tab root, or a screen pushed on its
// tab's root (Workout on Home, the trainer hub on Profile).
export const SCREEN_FOR_PATH = Object.freeze({
  '/': routes.Home,
  '/workout': routes.Workout,
  '/plans': routes.PlansLibrary,
  '/exercises': routes.Exercises,
  '/progress': routes.Progress,
  '/profile': routes.Settings,
  '/my-trainer': routes.MyTrainer,
  '/trainers': routes.Trainers,
  '/trainer/apply': routes.TrainerApply,
  '/profile/edit': routes.EditProfile,
  '/plans/mine': routes.MyPlans,
  '/plans/mine/new': routes.MyPlanCreate,
  '/plans/generate': routes.PlanGenerator,
  '/notifications': routes.Notifications,
  '/trainer': routes.TrainerDashboard,
  '/trainer/clients': routes.TrainerClients,
  '/trainer/plans': routes.TrainerPlans,
  '/trainer/profile': routes.TrainerProfile,
});
