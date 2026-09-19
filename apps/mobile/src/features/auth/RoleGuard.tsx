import type { Role } from '@fieldmate/shared';
import { Redirect, Stack } from 'expo-router';
import { colors } from '../../constants/theme';
import { SessionGate } from './SessionGate';
import { useAuth } from './auth-context';

/**
 * Route-group guard: only the matching role may enter. The app's own check is a
 * convenience; the API enforces permissions on every request.
 */
export function RoleGuard({ role }: { role: Role }) {
  const { status, user } = useAuth();

  if (status !== 'signedIn' || !user) return <SessionGate />;
  if (user.role !== role) {
    return <Redirect href={user.role === 'MANAGER' ? '/(manager)' : '/(worker)'} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
