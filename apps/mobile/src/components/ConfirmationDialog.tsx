import { Modal, StyleSheet, Text, View } from 'react-native';
import { MAX_FONT_SIZE_MULTIPLIER, colors, radius, spacing, typography } from '../constants/theme';
import { Button } from './Button';

export type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Destructive dialogs must be dismissed with an explicit choice.
      onRequestClose={destructive ? () => {} : onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog} accessibilityViewIsModal accessibilityRole="alert">
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.title}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.message}>
            {message}
          </Text>
          <View style={styles.actions}>
            <Button
              label={cancelLabel}
              variant="secondary"
              size="md"
              onPress={onCancel}
              disabled={loading}
              fullWidth={false}
              style={styles.action}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              size="md"
              onPress={onConfirm}
              loading={loading}
              fullWidth={false}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  message: { ...typography.body, color: colors.textSecondary },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  action: { minWidth: 120 },
});
