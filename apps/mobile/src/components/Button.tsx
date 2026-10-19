import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  motion,
  radius,
  spacing,
  typography,
  type IconName,
} from '../constants/theme';
import { Icon } from './Icon';

/**
 * `primary` is ink. `signal` is the hi-vis yellow and is reserved for the
 * worker's next journey step — one per screen at most, so it always means
 * "this is what you do next". `ink` is kept as a name for `primary`.
 */
export type ButtonVariant =
  | 'primary'
  | 'signal'
  | 'ink'
  | 'secondary'
  | 'tonal'
  | 'destructive'
  | 'destructiveOutline'
  | 'destructiveGhost'
  | 'ghost';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'lg' | 'md';
  /** Sits before the label. Decorative: the label already says what it does. */
  icon?: IconName;
  /** Sits after the label, for a button that moves the task forward. */
  trailingIcon?: IconName;
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
  icon,
  trailingIcon,
  loading = false,
  disabled = false,
  disabledReason,
  fullWidth = true,
  testID,
  style,
}: ButtonProps) {
  const isInactive = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: motion.press,
      useNativeDriver: true,
    }).start();
  };

  const appearance = variantStyles[variant];
  const isGhost = variant === 'ghost' || variant === 'destructiveGhost';
  const iconSize = size === 'lg' ? 20 : 18;
  const iconColor = disabled ? colors.textDisabled : appearance.label.color;

  return (
    <Animated.View
      style={[fullWidth ? styles.fullWidth : styles.hugContent, { transform: [{ scale }] }, style]}
    >
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        disabled={isInactive}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isInactive, busy: loading }}
        {...(disabledReason && disabled ? { accessibilityHint: disabledReason } : {})}
        style={({ pressed }) => [
          styles.base,
          size === 'lg' ? styles.large : styles.medium,
          appearance.container,
          pressed && !isInactive && appearance.pressed,
          disabled && !isGhost && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={appearance.label.color} />
        ) : (
          <View style={styles.content}>
            {icon ? <Icon name={icon} size={iconSize} color={iconColor} /> : null}
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={[
                size === 'lg' ? typography.button : typography.buttonMedium,
                appearance.label,
                disabled && styles.disabledLabel,
              ]}
            >
              {label}
            </Text>
            {trailingIcon ? <Icon name={trailingIcon} size={iconSize} color={iconColor} /> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.action,
    paddingHorizontal: spacing.mdPlus,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  large: { minHeight: layout.buttonHeightLarge },
  medium: { minHeight: layout.buttonHeightMedium },
  fullWidth: { alignSelf: 'stretch' },
  hugContent: { alignSelf: 'flex-start' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disabled: { backgroundColor: colors.border, borderColor: colors.border },
  disabledLabel: { color: colors.textDisabled, textDecorationLine: 'none' },
});

type Appearance = {
  container: ViewStyle;
  pressed: ViewStyle;
  label: TextStyle & { color: string };
};

const variantStyles: Record<ButtonVariant, Appearance> = {
  primary: {
    container: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed },
    label: { color: colors.onPrimary },
  },
  ink: {
    container: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed },
    label: { color: colors.onPrimary },
  },
  /** The worker's next step: yellow with ink on top. */
  signal: {
    container: { backgroundColor: colors.accent },
    pressed: { backgroundColor: colors.accentPressed },
    label: { color: colors.onAccent },
  },
  secondary: {
    container: { backgroundColor: colors.surface, borderColor: colors.primary },
    pressed: { backgroundColor: colors.surfaceMuted },
    label: { color: colors.primary },
  },
  tonal: {
    container: { backgroundColor: colors.surfaceMuted },
    pressed: { backgroundColor: colors.border },
    label: { color: colors.primary },
  },
  destructive: {
    container: { backgroundColor: colors.error },
    pressed: { opacity: 0.85 },
    label: { color: colors.onPrimary },
  },
  destructiveOutline: {
    container: { backgroundColor: colors.surface, borderColor: colors.error },
    pressed: { backgroundColor: colors.errorTint },
    label: { color: colors.errorText },
  },
  /** A text link: underlined so it reads as tappable without a box. */
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.surfaceMuted },
    label: { color: colors.primary, textDecorationLine: 'underline' },
  },
  /** A destructive way out that must not compete with the next step. */
  destructiveGhost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.errorTint },
    label: { color: colors.errorText, textDecorationLine: 'underline' },
  },
};
