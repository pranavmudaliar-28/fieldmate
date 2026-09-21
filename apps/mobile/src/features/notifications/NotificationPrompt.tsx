import type { Role } from '@fieldmate/shared';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  radius,
  spacing,
  toneColors,
  typography,
} from '../../constants/theme';
import { usePushNotifications } from './usePushNotifications';

const EXPLANATION: Record<Role, string> = {
  ADMIN: 'Get notified when tasks are completed.',
  MANAGER: 'Get notified when tasks are completed.',
  FIELD_WORKER: 'Get notified when tasks are assigned to you.',
};

const DENIED_MESSAGE =
  'Notifications are off. Turn them on in Settings to hear about task updates.';

/**
 * Dashboard prompt for notifications (docs/04 §7). The app works without them,
 * so both states can be dismissed.
 */
export function NotificationPrompt({ role }: { role: Role }) {
  const { permission, enable } = usePushNotifications(role);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || permission === 'granted' || permission === 'unsupported') return null;

  const denied = permission === 'denied';

  return (
    <View style={styles.card} testID="notification-prompt">
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.text}>
        {denied ? DENIED_MESSAGE : EXPLANATION[role]}
      </Text>
      <View style={styles.actions}>
        <Button
          label="Not now"
          variant="ghost"
          size="md"
          fullWidth={false}
          onPress={() => setDismissed(true)}
          testID="notification-dismiss"
        />
        <Button
          label={denied ? 'Open Settings' : 'Turn on'}
          variant="secondary"
          size="md"
          fullWidth={false}
          testID="notification-enable"
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
    backgroundColor: toneColors.info.tint,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  text: { ...typography.secondary, color: toneColors.info.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});

export { DENIED_MESSAGE, EXPLANATION };
