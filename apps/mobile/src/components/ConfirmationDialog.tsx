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
  type IconName,
  type Tone,
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
  /** The mark above the title; defaults to a warning or a question. */
  icon?: IconName;
  /** Colours the mark, e.g. success for approve. Destructive is always error. */
  tone?: Tone;
  /** Shown on the confirm button, before its label. */
  confirmIcon?: IconName;
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
  icon,
  tone,
  confirmIcon,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const emblemTone = destructive ? toneColors.error : tone ? toneColors[tone] : null;
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
          <View
            style={[styles.emblem, { backgroundColor: emblemTone?.tint ?? colors.surfaceMuted }]}
          >
            <Icon
              name={icon ?? (destructive ? 'warning-outline' : 'help-circle-outline')}
              size={24}
              color={emblemTone?.text ?? colors.textPrimary}
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
          {/* Stacked, the decision on top: two side-by-side labels truncate
              long before the text scale limit. */}
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              {...(confirmIcon ? { icon: confirmIcon } : {})}
            />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={loading} />
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
    padding: spacing.mdPlus,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.dialog,
    padding: spacing.lg,
    gap: spacing.smPlus,
    ...elevation.overlay,
  },
  emblem: {
    width: 48,
    height: 48,
    borderRadius: radius.action,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.sectionTitle,
    fontFamily: typography.display.fontFamily,
    color: colors.textPrimary,
  },
  message: { ...typography.body, color: colors.textSecondary },
  actions: { gap: 10, marginTop: spacing.sm },
});
