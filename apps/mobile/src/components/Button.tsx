import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'lg' | 'md';
  loading?: boolean;
  disabled?: boolean;
  /** Explains to screen readers why the button is disabled. */
  disabledReason?: string;
  fullWidth?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  disabledReason,
  fullWidth = true,
  testID,
  style,
}: ButtonProps) {
  const isInactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      {...(disabledReason && disabled ? { accessibilityHint: disabledReason } : {})}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.large : styles.medium,
        fullWidth && styles.fullWidth,
        variantStyles[variant].container,
        pressed && !isInactive && variantStyles[variant].pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || variant === 'destructive' ? colors.onPrimary : colors.primary
          }
        />
      ) : (
        <View style={styles.content}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={[styles.label, variantStyles[variant].label, disabled && styles.disabledLabel]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  large: { height: layout.buttonHeightLarge },
  medium: { height: layout.buttonHeightMedium },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...typography.button },
  disabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  disabledLabel: { color: colors.textDisabled },
});

const variantStyles: Record<
  ButtonVariant,
  { container: ViewStyle; pressed: ViewStyle; label: { color: string } }
> = {
  primary: {
    container: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed },
    label: { color: colors.onPrimary },
  },
  secondary: {
    container: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
    pressed: { backgroundColor: colors.surfaceMuted },
    label: { color: colors.primary },
  },
  destructive: {
    container: { backgroundColor: colors.error },
    pressed: { opacity: 0.85 },
    label: { color: colors.onPrimary },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.surfaceMuted },
    label: { color: colors.primary },
  },
};
