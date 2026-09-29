import { rolesInclude } from '../../features/auth/roles';
import { Workspace } from '../../features/workspace/workspace';
import { routes } from '../routes';

// Pure rules from RN-SPEC-app-shell §3, §5, §6.1, §6.3 and §6.4. Every native
// screen maps to exactly one web path; the chrome (header title, tab set,
// active tab, sidebar) is computed from that path with the web rules.

// Route name → web path. PlanDetail carries its id.
const ROUTE_PATHS = {
  [routes.HomeTab]: '/',
  [routes.WorkoutTab]: '/workout',
  [routes.ExercisesTab]: '/exercises',
  [routes.PlansList]: '/plans',
  // Before its stack mounts, the Library tab route itself stands for its root.
  [routes.LibraryTab]: '/plans',
  [routes.ProgressTab]: '/progress',
  [routes.TrainerTab]: '/my-trainer',
  [routes.SettingsTab]: '/profile',
  [routes.TrainerDashboardTab]: '/trainer',
  [routes.TrainerClientsTab]: '/trainer/clients',
  [routes.TrainerPlansTab]: '/trainer/plans',
  [routes.TrainerProfileTab]: '/trainer/profile',
};

export function pathForRoute(route) {
  if (!route) {
    return '/';
  }
  if (route.name === routes.PlanDetail) {
    return `/plans/${route.params?.planId ?? ''}`;
  }
  return ROUTE_PATHS[route.name] ?? '/';
}

// The focused leaf route of a (possibly nested) navigation state.
export function focusedRoute(state) {
  let route = state?.routes?.[state.index ?? 0];
  while (route?.state?.routes) {
    route = route.state.routes[route.state.index ?? 0];
  }
  return route;
}

// §2 role predicate. [O1] isAdminUser is deliberately not implemented.
export function isTrainerUser(user) {
  return rolesInclude(Array.isArray(user?.roles) ? user.roles.map((role) => String(role).trim()) : [], 'trainer');
}

// §5.
export function isTrainerWorkspace(path) {
  return !(path === '/trainer/apply' || path.startsWith('/trainer/apply/')) && (path === '/trainer' || path.startsWith('/trainer/'));
}

export function resolveMode(user, path, storedPreference) {
  if (!isTrainerUser(user)) {
    return Workspace.member;
  }
  if (isTrainerWorkspace(path)) {
    return Workspace.trainer;
  }
  return storedPreference === Workspace.trainer ? Workspace.trainer : Workspace.member;
}

// §6.1 title rules: first match wins; '/' exact, the rest startsWith.
const TITLE_RULES = [
  ['/workout', ''],
  ['/exercises', 'Library'],
  ['/plans', 'Library'],
  ['/progress', 'Progress'],
  ['/notifications', 'Notifications'],
  ['/profile', 'Settings'],
  ['/my-trainer', 'Coaching'],
  ['/trainers', 'Coaching'],
  ['/trainer', 'Coaching'],
];

export function headerTitleFor(path) {
  if (path === '/') {
    return 'Dashboard';
  }
  const match = TITLE_RULES.find(([prefix]) => path.startsWith(prefix));
  return match ? match[1] : 'Workout';
}

export function isCompactHeader(path, query = '') {
  return path.startsWith('/exercises') || path.startsWith('/plans/') || (path.startsWith('/workout') && query.includes('active=1'));
}

// §6.3 tab sets. The trainer Dashboard tab matches exactly.
export const MEMBER_TABS = Object.freeze([
  { route: routes.WorkoutTab, path: '/workout', label: 'Workout', icon: 'workout' },
  { route: routes.ExercisesTab, path: '/exercises', label: 'Exercises', icon: 'exercises' },
  { route: routes.LibraryTab, path: '/plans', label: 'Library', icon: 'library' },
  { route: routes.ProgressTab, path: '/progress', label: 'Progress', icon: 'progress' },
  { route: routes.TrainerTab, path: '/my-trainer', label: 'Trainer', icon: 'trainer' },
  { route: routes.SettingsTab, path: '/profile', label: 'Settings', icon: 'settings' },
]);

export const TRAINER_TABS = Object.freeze([
  { route: routes.TrainerDashboardTab, path: '/trainer', label: 'Dashboard', icon: 'dashboard', exact: true },
  { route: routes.TrainerClientsTab, path: '/trainer/clients', label: 'Clients', icon: 'users' },
  { route: routes.TrainerPlansTab, path: '/trainer/plans', label: 'Plans', icon: 'plans' },
  { route: routes.TrainerProfileTab, path: '/trainer/profile', label: 'Profile', icon: 'profile' },
]);

export function tabsForMode(mode) {
  return mode === Workspace.trainer ? TRAINER_TABS : MEMBER_TABS;
}

// §6.3/§6.4 active rule.
export function isActivePath(currentPath, itemPath, exact = false) {
  if (exact) {
    return currentPath === itemPath;
  }
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

// §6.4 sidebar items. [O1] no "Admin dashboard"; "Profile" for everyone.
export const MEMBER_SIDEBAR = Object.freeze([
  { route: routes.HomeTab, path: '/', label: 'Home', exact: true },
  { route: routes.LibraryTab, path: '/plans', label: 'Plans' },
  { route: routes.ExercisesTab, path: '/exercises', label: 'Exercises' },
  { route: routes.WorkoutTab, path: '/workout', label: 'Workout' },
  { route: routes.ProgressTab, path: '/progress', label: 'Progress' },
  { route: routes.TrainerTab, path: '/my-trainer', label: 'Trainer' },
  { route: routes.SettingsTab, path: '/profile', label: 'Profile' },
]);

export const TRAINER_SIDEBAR = Object.freeze([
  { route: routes.TrainerDashboardTab, path: '/trainer', label: 'Dashboard', exact: true },
  { route: routes.TrainerClientsTab, path: '/trainer/clients', label: 'Clients' },
  { route: routes.TrainerPlansTab, path: '/trainer/plans', label: 'Workout Plans' },
  { route: routes.TrainerProfileTab, path: '/trainer/profile', label: 'Trainer Profile' },
]);

// §6.5: the phone Workspace block shows only on these paths ([O1] no /admin/profile).
export function showsMobileModeSwitch(path) {
  return path === '/profile' || path === '/trainer/profile';
}
