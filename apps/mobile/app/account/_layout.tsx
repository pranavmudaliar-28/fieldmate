import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { SessionGate } from '../../src/features/auth/SessionGate';
import { useAuth } from '../../src/features/auth/auth-context';

/** The signed-in user's own account settings, the same for every role. */
export default function AccountLayout() {
  const { status, user } = useAuth();
  if (status !== 'signedIn' || !user) return <SessionGate />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
