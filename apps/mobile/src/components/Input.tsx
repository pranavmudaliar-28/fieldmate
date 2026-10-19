import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  fontFamily,
  layout,
  radius,
  spacing,
  typography,
  type IconName,
} from '../constants/theme';
import { Icon } from './Icon';

export type InputProps = TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  /** Adds a show/hide toggle for passwords. */
  secure?: boolean;
  /** Decorative mark at the start of the field (mail, lock, search). */
  icon?: IconName;
  /** Shows "n / max" under the field once `maxLength` is set. */
  showCount?: boolean;
  /** A small control inside the field's right edge, e.g. "Generate". */
  accessory?: ReactNode;
  testID?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    helper,
    required = false,
    secure = false,
    icon,
    showCount = false,
    accessory,
    testID,
    style,
    ...inputProps
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const invalid = Boolean(error);
  const counter =
    showCount && inputProps.maxLength !== undefined
      ? `${(inputProps.value ?? '').length} / ${inputProps.maxLength}`
      : null;

  return (
    <View style={styles.container}>
      {/* No asterisk: required is the norm, so the rare optional field says so instead. */}
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
        {label}
      </Text>

      {/* The ring is a parent rather than a shadow, so it looks the same on
          both platforms and never turns into a drop shadow on Android. */}
      <View style={[styles.ring, focused && !invalid && styles.ringFocused]}>
        <View
          style={[
            styles.field,
            // A multi-line field must fill its row, or the caret sits centred.
            inputProps.multiline ? styles.fieldMultiline : null,
            focused && styles.fieldFocused,
            invalid && styles.fieldError,
          ]}
        >
          {icon ? (
            <View style={styles.leading}>
              <Icon name={icon} size={20} color={colors.textSecondary} />
            </View>
          ) : null}
          <TextInput
            ref={ref}
            testID={testID}
            // The caller's style is merged, never replaced: dropping flex here
            // collapsed multi-line fields so they could not be tapped.
            style={[styles.input, inputProps.multiline && styles.inputMultiline, style]}
            placeholderTextColor={colors.textTertiary}
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            accessibilityLabel={label}
            accessibilityState={{ disabled: inputProps.editable === false }}
            aria-required={required}
            aria-invalid={invalid}
            secureTextEntry={secure && !revealed}
            onFocus={(e) => {
              setFocused(true);
              inputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              inputProps.onBlur?.(e);
            }}
            {...inputProps}
          />
          {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
          {secure ? (
            <Pressable
              onPress={() => setRevealed((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
              hitSlop={12}
              style={styles.toggle}
            >
              <Icon
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.textPrimary}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {error || helper || counter ? (
        <View style={styles.footer}>
          {error ? (
            <View style={styles.message} accessibilityRole="alert">
              {/* Errors are an icon and text, never a red border alone. */}
              <Icon name="alert-circle-outline" size={16} color={colors.errorText} />
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.error}>
                {error}
              </Text>
            </View>
          ) : (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.helper}>
              {helper ?? ''}
            </Text>
          )}
          {counter ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.counter}>
              {counter}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const RING_WIDTH = 4;

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.secondaryStrong, color: colors.textPrimary },
  ring: {
    padding: RING_WIDTH,
    margin: -RING_WIDTH,
    borderRadius: radius.control + RING_WIDTH,
    backgroundColor: 'transparent',
  },
  ringFocused: { backgroundColor: 'rgba(255, 194, 26, 0.45)' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.inputHeight,
    borderWidth: 1.5,
    borderColor: colors.controlBorder,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  fieldMultiline: { alignItems: 'stretch' },
  fieldFocused: { borderColor: colors.primary, borderWidth: 2 },
  fieldError: { borderColor: colors.error, borderWidth: 2 },
  leading: { marginRight: 10, justifyContent: 'center' },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.smPlus,
  },
  inputMultiline: { textAlignVertical: 'top' },
  toggle: { minWidth: 48, minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' },
  accessory: { marginLeft: spacing.sm, marginRight: -spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  message: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  error: {
    ...typography.secondary,
    fontFamily: fontFamily.medium,
    color: colors.errorText,
    flex: 1,
  },
  helper: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  counter: { ...typography.mono, color: colors.textTertiary },
});
