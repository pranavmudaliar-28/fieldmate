import type { Role } from '@fieldmate/shared';

/**
 * Each role's home is the first tab of its group. The `(tabs)` segment is a
 * route group, so it never shows in a URL — it is here because the group's
 * index now lives inside it.
 */
export type HomeRoute = '/(admin)/(tabs)' | '/(manager)/(tabs)' | '/(worker)/(tabs)';

export function homeRouteFor(role: Role): HomeRoute {
  switch (role) {
    case 'ADMIN':
      return '/(admin)/(tabs)';
    case 'MANAGER':
      return '/(manager)/(tabs)';
    case 'FIELD_WORKER':
      return '/(worker)/(tabs)';
  }
}

/**
 * Admins hold every manager power, so they may enter the manager screens too.
 * The API enforces this as well; the app only avoids showing a dead end.
 */
export function canEnterRouteGroup(role: Role, group: Role): boolean {
  if (role === group) return true;
  return role === 'ADMIN' && group === 'MANAGER';
}
