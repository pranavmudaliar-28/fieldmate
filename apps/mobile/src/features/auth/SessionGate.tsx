import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { SplashView } from '../../components/SplashView';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../constants/theme';
import { useMinimumDuration } from '../../hooks/use-minimum-duration';
import { useAuth } from './auth-context';

/**
 * How long the launch screen stays up at the least, counted from app start.
 * Long enough to read the name, short enough never to feel like a wait.
 */
export const SPLASH_MIN_MS = 1200;

/**
 * Shown while the stored session is being checked, and when that check could
 * not run because the device is offline (docs/04 §6).
 */
export function SessionGate() {
  const { status, bootstrapError, retryBootstrap } = useAuth();
  const splashShown = useMinimumDuration(SPLASH_MIN_MS);

  if (status === 'signedOut') {
    return splashShown ? <Redirect href="/(auth)/login" /> : <SplashView />;
  }

  if (status === 'bootstrapFailed') {
    return (
      <View style={styles.container} testID="session-bootstrap-error">
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.title}
          accessibilityRole="header"
        >
          You&apos;re offline
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.message}>
          {bootstrapError ?? 'We could not check your session.'}
        </Text>
        <Button label="Try again" onPress={retryBootstrap} fullWidth={false} />
      </View>
    );
  }

  // Carries on from the native splash, so launch reads as one screen.
  return <SplashView />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: layout.screenPadding,
    backgroundColor: colors.background,
  },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
