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
  { label, error, helper, required = false, secure = false, testID, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.container}>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View
        style={[styles.field, focused && styles.fieldFocused, Boolean(error) && styles.fieldError]}
      >
        <TextInput
          ref={ref}
          testID={testID}
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          accessibilityLabel={label}
          accessibilityState={{ disabled: inputProps.editable === false }}
          aria-required={required}
          aria-invalid={Boolean(error)}
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
            <Text style={styles.toggleLabel}>{revealed ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.error}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : helper ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.helper}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.secondary, color: colors.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  fieldFocused: { borderColor: colors.primary, borderWidth: 2 },
  fieldError: { borderColor: colors.error },
  input: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: spacing.sm },
  toggle: { minWidth: 48, minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' },
  toggleLabel: { ...typography.secondary, color: colors.primary },
  error: { ...typography.secondary, color: colors.errorText },
  helper: { ...typography.secondary, color: colors.textSecondary },
});
