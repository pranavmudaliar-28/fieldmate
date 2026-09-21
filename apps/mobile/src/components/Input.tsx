import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../constants/theme';
import { Icon } from './Icon';

export type InputProps = TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  /** Adds a show/hide toggle for passwords. */
  secure?: boolean;
  testID?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, helper, required = false, secure = false, testID, style, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const invalid = Boolean(error);

  return (
    <View style={styles.container}>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
        {label}
        {required ? ' *' : ''}
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
          <TextInput
            ref={ref}
            testID={testID}
            // The caller's style is merged, never replaced: dropping flex here
            // collapsed multi-line fields so they could not be tapped.
            style={[styles.input, inputProps.multiline && styles.inputMultiline, style]}
            placeholderTextColor={colors.textDisabled}
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
                color={colors.textSecondary}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={styles.message} accessibilityRole="alert">
          {/* Errors are an icon and text, never a red border alone (docs/04 §8). */}
          <Icon name="alert-circle" size={15} color={colors.errorText} />
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.error}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.helper}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const RING_WIDTH = 3;

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary },
  ring: {
    padding: RING_WIDTH,
    margin: -RING_WIDTH,
    borderRadius: radius.control + RING_WIDTH,
    backgroundColor: 'transparent',
  },
  ringFocused: { backgroundColor: 'rgba(214, 242, 75, 0.55)' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.inputHeight,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  fieldMultiline: { alignItems: 'stretch' },
  fieldFocused: { borderColor: colors.primary, borderWidth: 2 },
  fieldError: { borderColor: colors.error, borderWidth: 2 },
  input: {
    flex: 1,
    ...typography.bodyStrong,
    color: colors.textPrimary,
    paddingVertical: spacing.smPlus,
  },
  inputMultiline: { textAlignVertical: 'top' },
  toggle: { minWidth: 48, minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' },
  message: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  error: { ...typography.secondaryStrong, color: colors.errorText, flex: 1 },
  helper: { ...typography.secondary, color: colors.textSecondary },
});
