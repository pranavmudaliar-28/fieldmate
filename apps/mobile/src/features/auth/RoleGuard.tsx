import type { Role } from '@fieldmate/shared';
import { Redirect, Stack } from 'expo-router';
import { colors } from '../../constants/theme';
import { SessionGate } from './SessionGate';
import { useAuth } from './auth-context';
import { canEnterRouteGroup, homeRouteFor } from './home-route';

/**
 * Route-group guard: only a role allowed in this area may enter. The app's own
 * check is a convenience; the API enforces permissions on every request.
 */
export function RoleGuard({ role }: { role: Role }) {
  const { status, user } = useAuth();

  if (status !== 'signedIn' || !user) return <SessionGate />;
  if (!canEnterRouteGroup(user.role, role)) return <Redirect href={homeRouteFor(user.role)} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
