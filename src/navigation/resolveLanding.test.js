import { resolveLanding } from './resolveLanding';
import { routes } from './routes';

describe('resolveLanding', () => {
  it('sends /auth/me failures to Account unavailable before any other rule', () => {
    expect(
      resolveLanding({
        meErrored: true,
        pendingDestination: { name: routes.Settings },
        profileMissing: true,
        roles: ['trainer'],
        workspace: 'trainer',
      })
    ).toEqual({ name: routes.AccountUnavailable });
  });

  it('restores a pending destination before the profile gate', () => {
    const pendingDestination = { name: routes.Settings, params: { from: 'test' } };
    expect(resolveLanding({ pendingDestination, profileMissing: true })).toBe(pendingDestination);
  });

  it('ignores a pending destination outside the signed-in app', () => {
    expect(resolveLanding({ pendingDestination: { name: routes.Welcome } })).toEqual({ name: routes.Home });
  });

  it('sends users without a profile to onboarding', () => {
    expect(resolveLanding({ profileMissing: true, roles: ['trainer'], workspace: 'trainer' })).toEqual({
      name: routes.Onboarding,
    });
  });

  it('lands admins on Home even when they are also trainers in the trainer workspace', () => {
    expect(resolveLanding({ roles: ['Admin', 'trainer'], workspace: 'trainer' })).toEqual({ name: routes.Home });
  });

  it('lands trainers in the trainer workspace on the trainer dashboard', () => {
    expect(resolveLanding({ roles: ['TRAINER'], workspace: 'trainer' })).toEqual({
      name: routes.TrainerDashboard,
    });
  });

  it('lands trainers who switched to the member workspace on Home', () => {
    expect(resolveLanding({ roles: ['trainer'], workspace: 'member' })).toEqual({ name: routes.Home });
  });

  it('lands members on Home', () => {
    expect(resolveLanding({})).toEqual({ name: routes.Home });
  });
});
