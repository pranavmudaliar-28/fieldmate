import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../constants/theme';
import { useAuth } from './auth-context';

/**
 * Shown while the stored session is being checked, and when that check could
 * not run because the device is offline (docs/04 §6).
 */
export function SessionGate() {
  const { status, bootstrapError, retryBootstrap } = useAuth();

  if (status === 'signedOut') return <Redirect href="/(auth)/login" />;

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

  return (
    <View style={styles.container} testID="session-loading">
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading" />
    </View>
  );
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
