import { StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  toneColors,
  typography,
} from '../constants/theme';
import { ApiError } from '../services/http';
import { Icon } from './Icon';

/** The API's own message when it sent one; otherwise a generic retry. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

/** A form-level error under the fields, announced to screen readers. */
export function FormError({ message, testID }: { message: string | null; testID?: string }) {
  if (!message) return null;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Icon name="alert-circle-outline" size={18} color={toneColors.error.text} />
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.text} testID={testID}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.action,
    backgroundColor: toneColors.error.tint,
  },
  text: { ...typography.secondaryStrong, color: colors.errorText, flex: 1 },
});
