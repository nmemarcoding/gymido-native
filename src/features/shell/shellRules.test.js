import { Workspace } from '../workspace/workspace';
import {
  MEMBER_TABS,
  TRAINER_TABS,
  getHeaderBackLink,
  getHeaderTitle,
  getTabs,
  isCompactHeader,
  isNavItemActive,
  isTrainerUser,
  isTrainerWorkspace,
  resolveMode,
  showsMobileModeSwitch,
} from './shellRules';

const trainer = { roles: [' Trainer '] };
const member = { roles: ['member'] };

describe('getHeaderTitle (§6.1)', () => {
  it('follows the first-match table (5-tab nav)', () => {
    expect(getHeaderTitle('/')).toBe('');
    // DECLARED change (UX verdict P3-1, faf7f85): was expect(getHeaderTitle('/workout')).toBe('Workout'). The Workout
    // hub draws its own "← Today" + 52 H1 (UX G / U5), so the shell header there shows just the bell (one header).
    expect(getHeaderTitle('/workout')).toBe('');
    expect(getHeaderTitle('/exercises/3')).toBe('Exercises');
    expect(getHeaderTitle('/plansX')).toBe('Plans');
    expect(getHeaderTitle('/profile/edit')).toBe('Profile');
    expect(getHeaderTitle('/my-trainer')).toBe('Coaching');
    // DECLARED change (UX final audit X1, 27 Oct 2026): was toBe('Coaching') for '/trainers/9' and
    // '/trainer/plans/4'. Those pages draw their own hero title, so the shell header shows none (one title per page).
    expect(getHeaderTitle('/trainers/9')).toBe('');
    expect(getHeaderTitle('/trainer/plans/4')).toBe('');
    expect(getHeaderTitle('/somewhere')).toBe('Workout');
  });

  it('X1 one title per page: untitled on every coaching / trainer page that draws its own hero title', () => {
    ['/trainers', '/trainers/9', '/trainer/apply', '/trainer', '/trainer/clients', '/trainer/clients/5', '/trainer/plans', '/trainer/plans/new', '/trainer/plans/4', '/trainer/profile'].forEach(
      (path) => expect([path, getHeaderTitle(path)]).toEqual([path, ''])
    );
    // The Coaching hub draws no page title of its own: the shell keeps "Coaching".
    expect(getHeaderTitle('/my-trainer')).toBe('Coaching');
    // The back links stay as drawn.
    expect(getHeaderBackLink('/trainers')).toEqual({ label: '← Coaching', path: '/my-trainer' });
  });

  it('drops the Workout title and back link during a session', () => {
    expect(getHeaderTitle('/workout', true)).toBe('');
    expect(getHeaderTitle('/plans', true)).toBe('Plans');
    // DECLARED change (P3-1): was toEqual({ label: '← Today', path: '/' }); the hub's own "← Today" (always the Today
    // root, review M1) is the only one now.
    expect(getHeaderBackLink('/workout')).toBeNull();
    expect(getHeaderBackLink('/workout', true)).toBeNull();
    expect(getHeaderBackLink('/my-trainer')).toEqual({ label: '← Profile', path: '/profile' });
    expect(getHeaderBackLink('/trainers/3')).toBeNull();
    expect(getHeaderBackLink('/plans')).toBeNull();
  });

  it('marks compact routes', () => {
    expect(isCompactHeader('/plans')).toBe(false);
    expect(isCompactHeader('/plans/3')).toBe(true);
    expect(isCompactHeader('/exercises')).toBe(true);
    expect(isCompactHeader('/workout', '')).toBe(false);
    expect(isCompactHeader('/workout', 'active=1')).toBe(true);
  });
});

describe('workspace mode (§5)', () => {
  it('reads the trainer claim trimmed and case-insensitive', () => {
    expect(isTrainerUser(trainer)).toBe(true);
    expect(isTrainerUser(member)).toBe(false);
    expect(isTrainerUser({})).toBe(false);
  });

  it('forces Trainer on /trainer paths except /trainer/apply', () => {
    expect(isTrainerWorkspace('/trainer')).toBe(true);
    expect(isTrainerWorkspace('/trainer/plans/2')).toBe(true);
    expect(isTrainerWorkspace('/trainer/apply')).toBe(false);
    expect(isTrainerWorkspace('/trainers')).toBe(false);
  });

  it('resolves members, forced routes, then the preference', () => {
    expect(resolveMode({ user: member, path: '/trainer', storedPreference: 'trainer' })).toBe(Workspace.member);
    expect(resolveMode({ user: trainer, path: '/trainer/clients', storedPreference: 'member' })).toBe(Workspace.trainer);
    expect(resolveMode({ user: trainer, path: '/plans', storedPreference: 'trainer' })).toBe(Workspace.trainer);
    expect(resolveMode({ user: trainer, path: '/plans', storedPreference: 'junk' })).toBe(Workspace.member);
  });
});

describe('tabs (§6.3)', () => {
  it('has 5 member and 4 trainer tabs in order', () => {
    expect(getTabs(Workspace.member).map((t) => t.label)).toEqual(['Today', 'Plans', 'Exercises', 'Progress', 'Profile']);
    expect(getTabs(Workspace.trainer).map((t) => t.label)).toEqual(['Today', 'Clients', 'Plans', 'Profile']);
  });

  it('activates by path or path prefix, the Today tabs exact only', () => {
    const [dashboard, clients, plans] = TRAINER_TABS;
    expect(isNavItemActive(dashboard, '/trainer')).toBe(true);
    expect(isNavItemActive(dashboard, '/trainer/plans')).toBe(false);
    expect(isNavItemActive(plans, '/trainer/plans/5')).toBe(true);
    expect(isNavItemActive(clients, '/trainer/clientsX')).toBe(false);
  });

  it('lights Today on Home and Workout, Profile on the trainer area (⚠S1 retired)', () => {
    const active = (path) => MEMBER_TABS.filter((tab) => isNavItemActive(tab, path)).map((tab) => tab.label);
    expect(active('/')).toEqual(['Today']);
    expect(active('/workout')).toEqual(['Today']);
    expect(active('/plans/4')).toEqual(['Plans']);
    expect(active('/exercises/9')).toEqual(['Exercises']);
    expect(active('/my-trainer')).toEqual(['Profile']);
    expect(active('/trainers/2')).toEqual(['Profile']);
    expect(active('/trainer/apply')).toEqual(['Profile']);
    expect(active('/notifications')).toEqual([]);
  });

  it('shows the phone workspace switch only on the profile pages for trainers', () => {
    expect(showsMobileModeSwitch({ user: trainer, path: '/profile' })).toBe(true);
    expect(showsMobileModeSwitch({ user: trainer, path: '/trainer/profile' })).toBe(true);
    expect(showsMobileModeSwitch({ user: trainer, path: '/profile/edit' })).toBe(false);
    expect(showsMobileModeSwitch({ user: member, path: '/profile' })).toBe(false);
  });
});
