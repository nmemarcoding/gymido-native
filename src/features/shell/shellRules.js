import { rolesInclude } from '../auth/roles';
import { Workspace } from '../workspace/workspace';

// The app-shell rules of RN-SPEC-app-shell, keyed by each screen's web path
// (its identity: §3.4 maps every native screen to exactly one path).

// §6.1 (5-tab nav, 23 Oct): first match wins; '/' is exact, every other
// entry is startsWith.
const TITLES = [
  ['/workout', 'Workout'],
  ['/exercises', 'Exercises'],
  ['/plans', 'Plans'],
  ['/progress', 'Progress'],
  ['/notifications', 'Notifications'],
  ['/profile', 'Profile'],
  ['/my-trainer', 'Coaching'],
  ['/trainers', 'Coaching'],
  ['/trainer', 'Coaching'],
];

// During a workout session the Workout header is untitled (session override).
// "/" is untitled too: Today's own greeting is the page heading (v2, web parity).
export function getHeaderTitle(path, isSessionActive = false) {
  if (path === '/') {
    return '';
  }
  if (isSessionActive && path.startsWith('/workout')) {
    return '';
  }
  const match = TITLES.find(([prefix]) => path.startsWith(prefix));
  return match ? match[1] : 'Workout';
}

// §6.1 back links: the exact path only, never during a session.
const BACK_LINKS = Object.freeze({
  '/workout': { label: '← Today', path: '/' },
  '/my-trainer': { label: '← Profile', path: '/profile' },
  // Dated change (23 Oct 2026): the Trainers list only; /trainers/:id has none.
  '/trainers': { label: '← Coaching', path: '/my-trainer' },
});

export function getHeaderBackLink(path, isSessionActive = false) {
  if (isSessionActive && path.startsWith('/workout')) {
    return null;
  }
  return BACK_LINKS[path] ?? null;
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

// §2 isAdminUser. [O1] keeps it out of the shell; RN-SPEC-profile P1b.1
// (T-43, 26 Oct 2026) uses it only to hide Delete account.
export function isAdminUser(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return (
    rolesInclude(
      roles.map((role) => String(role).trim()),
      'admin'
    ) ||
    String(user?.role || user?.role_code || '').trim().toLowerCase() === 'admin' ||
    Number(user?.role_id ?? user?.roleID ?? NaN) === 2
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

// §6.3 tab sets (5-tab nav, 23 Oct). `exact` tabs match only their own path;
// `extra` prefixes also light the tab (Today owns /workout, Profile owns the
// trainer area).
export const TRAINER_TABS = Object.freeze([
  { key: 'TToday', label: 'Today', path: '/trainer', icon: 'dashboard', exact: true },
  { key: 'TClients', label: 'Clients', path: '/trainer/clients', icon: 'users' },
  { key: 'TPlans', label: 'Plans', path: '/trainer/plans', icon: 'plans' },
  { key: 'TProfile', label: 'Profile', path: '/trainer/profile', icon: 'profile' },
]);

export const MEMBER_TABS = Object.freeze([
  { key: 'Today', label: 'Today', path: '/', icon: 'workout', exact: true, extra: ['/workout'] },
  { key: 'Plans', label: 'Plans', path: '/plans', icon: 'library' },
  { key: 'Exercises', label: 'Exercises', path: '/exercises', icon: 'exercises' },
  { key: 'Progress', label: 'Progress', path: '/progress', icon: 'progress' },
  { key: 'Profile', label: 'Profile', path: '/profile', icon: 'profile', extra: ['/my-trainer', '/trainers', '/trainer/apply'] },
]);

export function getTabs(mode) {
  return mode === Workspace.trainer ? TRAINER_TABS : MEMBER_TABS;
}

// §6.3 / §6.4 active rule: the item's own path (exact for the Today tabs),
// or any of its extra prefixes.
function matches(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isNavItemActive(item, path) {
  const own = item.exact ? path === item.path : matches(path, item.path);
  return own || (item.extra ?? []).some((prefix) => matches(path, prefix));
}

// §6.4: the sidebar mirrors the tab bar, icons included. [O1] "Profile" for everyone.
export const MEMBER_SIDEBAR = MEMBER_TABS;
export const TRAINER_SIDEBAR = TRAINER_TABS;

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
