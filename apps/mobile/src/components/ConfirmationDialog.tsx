import { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  radius,
  spacing,
  toneColors,
  typography,
} from '../constants/theme';
import { Button } from './Button';
import { Icon } from './Icon';

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
  const titleRef = useRef<Text>(null);

  // Opening a dialog moves screen-reader focus to its title (docs/04 §8).
  useEffect(() => {
    if (!visible) return;
    const handle = findNodeHandle(titleRef.current);
    if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [visible]);

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
          <View style={[styles.emblem, destructive ? styles.emblemDanger : styles.emblemNeutral]}>
            <Icon
              name={destructive ? 'warning-outline' : 'help-circle-outline'}
              size={22}
              color={destructive ? toneColors.error.text : colors.textPrimary}
            />
          </View>
          <Text
            ref={titleRef}
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
              style={styles.action}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              size="md"
              onPress={onConfirm}
              loading={loading}
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
    borderRadius: radius.sheet,
    padding: spacing.lg,
    gap: spacing.sm,
    ...elevation.overlay,
  },
  emblem: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emblemDanger: { backgroundColor: toneColors.error.tint },
  emblemNeutral: { backgroundColor: colors.surfaceMuted },
  title: { ...typography.display, color: colors.textPrimary },
  message: { ...typography.body, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.smPlus, marginTop: spacing.smPlus },
  action: { flex: 1 },
});
