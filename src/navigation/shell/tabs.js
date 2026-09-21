import { routes } from '../routes';

// Six member tabs in web order (RN-SPEC-plans §1.3). Admins get "Settings" too:
// the owner ruled out admin UI on mobile, so the web's "Admin" tab isn't built.
// Only Library has a specified icon. The rest are STUBS (empty icon slot)
// until docs/RN-SPEC-app-shell.md arrives.
export const MEMBER_TABS = Object.freeze([
  { name: routes.WorkoutTab, label: 'Workout', sidebarLabel: 'Workout' },
  { name: routes.ExercisesTab, label: 'Exercises', sidebarLabel: 'Exercises' },
  { name: routes.LibraryTab, label: 'Library', sidebarLabel: 'Plans', icon: 'library' },
  { name: routes.ProgressTab, label: 'Progress', sidebarLabel: 'Progress' },
  { name: routes.TrainerTab, label: 'Trainer', sidebarLabel: 'Trainer' },
  { name: routes.SettingsTab, label: 'Settings', sidebarLabel: 'Settings' },
]);

// Walks up from any screen to the member tab navigator.
export function findTabNavigation(navigation) {
  let current = navigation;
  while (current) {
    if (current.getState?.()?.routeNames?.includes(routes.LibraryTab)) {
      return current;
    }
    current = current.getParent?.();
  }
  return null;
}
