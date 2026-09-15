export const ROLES_CLAIM = 'https://gymido.app/roles';

export function getRoles(claims) {
  const roles = claims?.[ROLES_CLAIM];
  return Array.isArray(roles) ? roles : [];
}

// Role names are compared case-insensitively.
export function rolesInclude(roles, role) {
  const target = role.toLowerCase();
  return roles.some((value) => typeof value === 'string' && value.toLowerCase() === target);
}

export function hasRole(claims, role) {
  return rolesInclude(getRoles(claims), role);
}
