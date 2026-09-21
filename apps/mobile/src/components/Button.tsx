import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  motion,
  radius,
  spacing,
  typography,
  type IconName,
} from '../constants/theme';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'ink' | 'secondary' | 'destructive' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'lg' | 'md';
  /** Sits before the label. Decorative: the label already says what it does. */
  icon?: IconName;
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

  return (
    <Animated.View
      style={[
        fullWidth ? styles.fullWidth : styles.hugContent,
        { transform: [{ scale }] },
        !isInactive && appearance.lift,
        style,
      ]}
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
          disabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={appearance.label.color} />
        ) : (
          <View style={styles.content}>
            {icon ? (
              <Icon
                name={icon}
                size={size === 'lg' ? 20 : 18}
                color={disabled ? colors.textDisabled : appearance.label.color}
              />
            ) : null}
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={[styles.label, appearance.label, disabled && styles.disabledLabel]}
            >
              {label}
            </Text>
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
  large: { height: layout.buttonHeightLarge },
  medium: { height: layout.buttonHeightMedium, borderRadius: radius.control },
  fullWidth: { alignSelf: 'stretch', borderRadius: radius.action },
  hugContent: { alignSelf: 'flex-start', borderRadius: radius.action },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...typography.button },
  disabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  disabledLabel: { color: colors.textDisabled },
});

type Appearance = {
  container: ViewStyle;
  pressed: ViewStyle;
  label: { color: string };
  /** Shadow, applied to the outer wrapper so it is not clipped by the border. */
  lift: ViewStyle;
};

const noLift: ViewStyle = {};

const variantStyles: Record<ButtonVariant, Appearance> = {
  /** The one action colour: a yellow fill with ink on top. */
  primary: {
    container: { backgroundColor: colors.accent },
    pressed: { backgroundColor: colors.accentPressed },
    label: { color: colors.onAccent },
    lift: {
      shadowColor: colors.accentPressed,
      shadowOpacity: 0.55,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
  },
  ink: {
    container: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed },
    label: { color: colors.onPrimary },
    lift: noLift,
  },
  secondary: {
    container: { backgroundColor: colors.surface, borderColor: colors.border },
    pressed: { backgroundColor: colors.surfaceMuted },
    label: { color: colors.primary },
    lift: noLift,
  },
  destructive: {
    container: { backgroundColor: colors.error },
    pressed: { opacity: 0.85 },
    label: { color: colors.onPrimary },
    lift: noLift,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.surfaceMuted },
    label: { color: colors.primary },
    lift: noLift,
  },
};
