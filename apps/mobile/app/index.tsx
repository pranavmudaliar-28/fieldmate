import { Redirect } from 'expo-router';
import { SessionGate } from '../src/features/auth/SessionGate';
import { useAuth } from '../src/features/auth/auth-context';
import { homeRouteFor } from '../src/features/auth/home-route';

/** Entry route: sends the user to Login or to their role's home screen. */
export default function Index() {
  const { status, user } = useAuth();

  if (status !== 'signedIn' || !user) return <SessionGate />;

  return <Redirect href={homeRouteFor(user.role)} />;
}
