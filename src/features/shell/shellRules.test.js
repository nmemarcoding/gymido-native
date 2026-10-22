import { Workspace } from '../workspace/workspace';
import {
  MEMBER_TABS,
  TRAINER_TABS,
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
  it('follows the first-match table', () => {
    expect(getHeaderTitle('/')).toBe('Dashboard');
    expect(getHeaderTitle('/workout')).toBe('');
    expect(getHeaderTitle('/exercises/3')).toBe('Library');
    expect(getHeaderTitle('/plansX')).toBe('Library');
    expect(getHeaderTitle('/profile/edit')).toBe('Settings');
    expect(getHeaderTitle('/trainers/9')).toBe('Coaching');
    expect(getHeaderTitle('/trainer/plans/4')).toBe('Coaching');
    expect(getHeaderTitle('/somewhere')).toBe('Workout');
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
  it('has 6 member and 4 trainer tabs in order', () => {
    expect(getTabs(Workspace.member).map((t) => t.label)).toEqual([
      'Workout',
      'Exercises',
      'Library',
      'Progress',
      'Trainer',
      'Settings',
    ]);
    expect(getTabs(Workspace.trainer).map((t) => t.label)).toEqual(['Dashboard', 'Clients', 'Plans', 'Profile']);
  });

  it('activates by path or path prefix, Dashboard exact only', () => {
    const [dashboard, clients, plans] = TRAINER_TABS;
    expect(isNavItemActive(dashboard, '/trainer')).toBe(true);
    expect(isNavItemActive(dashboard, '/trainer/plans')).toBe(false);
    expect(isNavItemActive(plans, '/trainer/plans/5')).toBe(true);
    expect(isNavItemActive(clients, '/trainer/clientsX')).toBe(false);
  });

  it('leaves no tab active on Home (⚠S1)', () => {
    expect(MEMBER_TABS.some((tab) => isNavItemActive(tab, '/'))).toBe(false);
  });

  it('shows the phone workspace switch only on the profile pages for trainers', () => {
    expect(showsMobileModeSwitch({ user: trainer, path: '/profile' })).toBe(true);
    expect(showsMobileModeSwitch({ user: trainer, path: '/trainer/profile' })).toBe(true);
    expect(showsMobileModeSwitch({ user: trainer, path: '/profile/edit' })).toBe(false);
    expect(showsMobileModeSwitch({ user: member, path: '/profile' })).toBe(false);
  });
});
