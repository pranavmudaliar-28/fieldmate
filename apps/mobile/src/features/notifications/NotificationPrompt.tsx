import type { Role } from '@fieldmate/shared';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  typography,
} from '../../constants/theme';
import { usePushNotifications } from './usePushNotifications';

const EXPLANATION: Record<Role, string> = {
  ADMIN: 'Know the moment work is submitted for review or handed back.',
  MANAGER: 'Know the moment work is submitted for review or handed back.',
  FIELD_WORKER: 'Know the moment your manager assigns you a task or asks for changes.',
};

const DENIED_MESSAGE =
  'Notifications are off. Turn them on in Settings to hear about task updates.';

/**
 * Dashboard prompt for notifications. The app works without them, so both
 * states can be dismissed.
 */
export function NotificationPrompt({ role }: { role: Role }) {
  const { permission, enable } = usePushNotifications(role);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || permission === 'granted' || permission === 'unsupported') return null;

  const denied = permission === 'denied';

  return (
    <View style={styles.card} testID="notification-prompt">
      <View style={styles.top}>
        <View style={styles.mark}>
          <Icon name="notifications-outline" size={24} color={colors.onAccent} />
        </View>
        <View style={styles.text}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.title}
            accessibilityRole="header"
          >
            {denied ? 'Notifications are off' : 'Turn on notifications'}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
            {denied ? DENIED_MESSAGE : EXPLANATION[role]}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label="Not now"
          variant="tonal"
          size="md"
          onPress={() => setDismissed(true)}
          testID="notification-dismiss"
          style={styles.action}
        />
        <Button
          label={denied ? 'Open Settings' : 'Turn on'}
          size="md"
          testID="notification-enable"
          style={styles.actionMain}
          onPress={() => {
            if (denied) {
              void Linking.openSettings();
              return;
            }
            void enable();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.md,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', gap: spacing.smPlus },
  mark: {
    width: 52,
    height: 52,
    borderRadius: radius.action,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  body: { ...typography.secondary, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.smPlus },
  action: { flex: 1 },
  actionMain: { flex: 1.6 },
});

export { DENIED_MESSAGE, EXPLANATION };
