import type { Role } from '@fieldmate/shared';

export type HomeRoute = '/(admin)' | '/(manager)' | '/(worker)';

/** Where each role lands after signing in (docs/07 §2). */
export function homeRouteFor(role: Role): HomeRoute {
  switch (role) {
    case 'ADMIN':
      return '/(admin)';
    case 'MANAGER':
      return '/(manager)';
    case 'FIELD_WORKER':
      return '/(worker)';
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
