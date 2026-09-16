import { ROLES_CLAIM, getRoles, hasRole, rolesInclude } from './roles';

describe('roles', () => {
  it('reads roles from the namespaced claim', () => {
    expect(getRoles({ [ROLES_CLAIM]: ['trainer'] })).toEqual(['trainer']);
  });

  it('returns no roles when the claim is missing or malformed', () => {
    expect(getRoles(null)).toEqual([]);
    expect(getRoles({})).toEqual([]);
    expect(getRoles({ [ROLES_CLAIM]: 'trainer' })).toEqual([]);
  });

  it('matches roles case-insensitively', () => {
    expect(hasRole({ [ROLES_CLAIM]: ['Trainer'] }, 'trainer')).toBe(true);
    expect(hasRole({ [ROLES_CLAIM]: ['member'] }, 'trainer')).toBe(false);
  });

  it('ignores non-string role values', () => {
    expect(rolesInclude([null, 42, 'ADMIN'], 'admin')).toBe(true);
    expect(rolesInclude([null, 42], 'admin')).toBe(false);
  });
});
