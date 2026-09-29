import { resolveLanding } from './resolveLanding';
import { routes } from './routes';

describe('resolveLanding', () => {
  it('sends /auth/me failures to Account unavailable before any other rule', () => {
    expect(
      resolveLanding({
        meErrored: true,
        pendingDestination: { name: routes.Home },
        profileMissing: true,
        roles: ['trainer'],
        workspace: 'trainer',
      })
    ).toEqual({ name: routes.AccountUnavailable });
  });

  it('restores a pending destination before the profile gate', () => {
    const pendingDestination = { name: routes.Home, params: { from: 'test' } };
    expect(resolveLanding({ pendingDestination, profileMissing: true })).toBe(pendingDestination);
  });

  // The standalone Settings route was deleted (unreachable in the app); a
  // destination recorded under that name by an older build must not strand the
  // user on a route that no longer exists.
  it('ignores a pending destination for the deleted Settings route', () => {
    expect(resolveLanding({ pendingDestination: { name: 'Settings' } })).toEqual({ name: routes.Home });
  });

  it('ignores a pending destination outside the signed-in app', () => {
    expect(resolveLanding({ pendingDestination: { name: routes.Welcome } })).toEqual({ name: routes.Home });
  });

  it('sends users without a profile to onboarding', () => {
    expect(resolveLanding({ profileMissing: true, roles: ['trainer'], workspace: 'trainer' })).toEqual({
      name: routes.Onboarding,
    });
  });

  it('lands admins on Home (no admin branch, O1)', () => {
    expect(resolveLanding({ roles: ['Admin', 'trainer'], workspace: 'trainer' })).toEqual({ name: routes.Home });
  });

  it('lands trainers on Home; the shell Landing rule then applies Trainer mode (§3.3)', () => {
    expect(resolveLanding({ roles: ['TRAINER'], workspace: 'trainer' })).toEqual({ name: routes.Home });
  });

  it('lands trainers who switched to the member workspace on Home', () => {
    expect(resolveLanding({ roles: ['trainer'], workspace: 'member' })).toEqual({ name: routes.Home });
  });

  it('lands members on Home', () => {
    expect(resolveLanding({})).toEqual({ name: routes.Home });
  });
});
