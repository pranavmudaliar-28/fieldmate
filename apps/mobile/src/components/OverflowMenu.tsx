import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  radius,
  spacing,
  typography,
  type IconName,
} from '../constants/theme';
import { Icon } from './Icon';

export type OverflowAction = {
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Read out when the action is disabled, so the rule is never hidden. */
  disabledReason?: string;
  testID?: string;
};

export type OverflowMenuProps = {
  visible: boolean;
  onClose: () => void;
  actions: OverflowAction[];
  testID?: string;
};

/**
 * The secondary actions for a screen. Replaces cramming up to five buttons
 * into one action bar row — docs/04 §5 specified this and it was never built.
 */
export function OverflowMenu({ visible, onClose, actions, testID }: OverflowMenuProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <SafeAreaView edges={['top']} style={styles.anchor}>
          {/* Stops a tap inside the card from closing the menu. */}
          <Pressable style={styles.menu} testID={testID} accessibilityViewIsModal>
            {actions.map((action, index) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                disabled={action.disabled}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{ disabled: Boolean(action.disabled) }}
                {...(action.disabled && action.disabledReason
                  ? { accessibilityHint: action.disabledReason }
                  : {})}
                testID={action.testID}
                style={({ pressed }) => [
                  styles.item,
                  index > 0 && styles.itemDivided,
                  pressed && !action.disabled && styles.itemPressed,
                ]}
              >
                <Icon
                  name={action.icon}
                  size={20}
                  color={
                    action.disabled
                      ? colors.textDisabled
                      : action.destructive
                        ? colors.errorText
                        : colors.textPrimary
                  }
                />
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                  style={[
                    styles.label,
                    action.destructive && styles.labelDestructive,
                    action.disabled && styles.labelDisabled,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  anchor: { alignItems: 'flex-end', paddingHorizontal: layout.screenPadding },
  menu: {
    marginTop: 64,
    minWidth: 232,
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    padding: spacing.sm,
    ...elevation.overlay,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.smPlus,
    borderRadius: radius.control,
  },
  itemDivided: { marginTop: spacing.xs },
  itemPressed: { backgroundColor: colors.surfaceMuted },
  label: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
  labelDestructive: { color: colors.errorText },
  labelDisabled: { color: colors.textDisabled },
});
