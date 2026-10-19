import { Redirect } from 'expo-router';
import { SplashView } from '../src/components/SplashView';
import { SPLASH_MIN_MS, SessionGate } from '../src/features/auth/SessionGate';
import { useAuth } from '../src/features/auth/auth-context';
import { homeRouteFor } from '../src/features/auth/home-route';
import { useMinimumDuration } from '../src/hooks/use-minimum-duration';

/** Entry route: sends the user to Login or to their role's home screen. */
export default function Index() {
  const { status, user } = useAuth();
  const splashShown = useMinimumDuration(SPLASH_MIN_MS);

  if (status !== 'signedIn' || !user) return <SessionGate />;
  // A stored session is confirmed in moments; hold the splash so it is not a flicker.
  if (!splashShown) return <SplashView />;

  return <Redirect href={homeRouteFor(user.role)} />;
}
