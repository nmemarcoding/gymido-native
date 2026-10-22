import { rolesInclude } from '../auth/roles';
import { Workspace } from '../workspace/workspace';

// The app-shell rules of RN-SPEC-app-shell, keyed by each screen's web path
// (its identity: §3.4 maps every native screen to exactly one path).

// §6.1: first match wins; '/' is exact, every other entry is startsWith.
const TITLES = [
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

export function getHeaderTitle(path) {
  if (path === '/') {
    return 'Dashboard';
  }
  const match = TITLES.find(([prefix]) => path.startsWith(prefix));
  return match ? match[1] : 'Workout';
}

export function isCompactHeader(path, query = '') {
  return (
    path.startsWith('/exercises') ||
    path.startsWith('/plans/') ||
    (path.startsWith('/workout') && query.includes('active=1'))
  );
}

// §2 role predicate: trimmed, case-insensitive, no fallback.
export function isTrainerUser(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return rolesInclude(
    roles.map((role) => String(role).trim()),
    'trainer'
  );
}

// §5: /trainer and /trainer/* force Trainer mode, except /trainer/apply.
export function isTrainerWorkspace(path) {
  if (path === '/trainer/apply' || path.startsWith('/trainer/apply/')) {
    return false;
  }
  return path === '/trainer' || path.startsWith('/trainer/');
}

export function resolveMode({ user, path, storedPreference }) {
  if (!isTrainerUser(user)) {
    return Workspace.member;
  }
  if (isTrainerWorkspace(path)) {
    return Workspace.trainer;
  }
  return storedPreference === Workspace.trainer ? Workspace.trainer : Workspace.member;
}

// §6.3 tab sets. `exact` tabs match only their own path.
export const TRAINER_TABS = Object.freeze([
  { key: 'TDashboard', label: 'Dashboard', path: '/trainer', icon: 'dashboard', exact: true },
  { key: 'TClients', label: 'Clients', path: '/trainer/clients', icon: 'users' },
  { key: 'TPlans', label: 'Plans', path: '/trainer/plans', icon: 'plans' },
  { key: 'TProfile', label: 'Profile', path: '/trainer/profile', icon: 'profile' },
]);

export const MEMBER_TABS = Object.freeze([
  { key: 'Workout', label: 'Workout', path: '/workout', icon: 'workout' },
  { key: 'Exercises', label: 'Exercises', path: '/exercises', icon: 'exercises' },
  { key: 'Library', label: 'Library', path: '/plans', icon: 'library' },
  { key: 'Progress', label: 'Progress', path: '/progress', icon: 'progress' },
  { key: 'Trainer', label: 'Trainer', path: '/my-trainer', icon: 'trainer' },
  { key: 'Settings', label: 'Settings', path: '/profile', icon: 'settings' },
]);

export function getTabs(mode) {
  return mode === Workspace.trainer ? TRAINER_TABS : MEMBER_TABS;
}

// §6.3 / §6.4 active rule.
export function isNavItemActive(item, path) {
  if (item.exact) {
    return path === item.path;
  }
  return path === item.path || path.startsWith(`${item.path}/`);
}

// §6.4 sidebar (no icons). [O1] "Profile" for everyone.
export const MEMBER_SIDEBAR = Object.freeze([
  { label: 'Home', path: '/', exact: true },
  { label: 'Plans', path: '/plans' },
  { label: 'Exercises', path: '/exercises' },
  { label: 'Workout', path: '/workout' },
  { label: 'Progress', path: '/progress' },
  { label: 'Trainer', path: '/my-trainer' },
  { label: 'Profile', path: '/profile' },
]);

export const TRAINER_SIDEBAR = Object.freeze([
  { label: 'Dashboard', path: '/trainer', exact: true },
  { label: 'Clients', path: '/trainer/clients' },
  { label: 'Workout Plans', path: '/trainer/plans' },
  { label: 'Trainer Profile', path: '/trainer/profile' },
]);

export const SIDEBAR_INTRO = Object.freeze({
  [Workspace.member]: {
    eyebrow: 'Workout App',
    title: 'Stay on track',
    body: 'Quick access to your daily workout tools.',
  },
  [Workspace.trainer]: {
    eyebrow: 'Coaching',
    title: 'Coach your clients',
    body: 'Manage clients, plans, and your trainer profile.',
  },
});

export function getSidebarItems(mode) {
  return mode === Workspace.trainer ? TRAINER_SIDEBAR : MEMBER_SIDEBAR;
}

// §6.5: phone-only workspace switch on the two profile pages.
export function showsMobileModeSwitch({ user, path }) {
  return isTrainerUser(user) && (path === '/profile' || path === '/trainer/profile');
}

// §6.2: where each workspace's switch lands (a push, ⚠S14).
export const WORKSPACE_HOME = Object.freeze({
  [Workspace.member]: '/',
  [Workspace.trainer]: '/trainer',
});
