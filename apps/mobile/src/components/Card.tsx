import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import type { ReactNode } from 'react';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Surface with a border rather than a shadow: easier to read in sunlight. */
export function Card({ children, onPress, accessibilityLabel, testID, style }: CardProps) {
  if (!onPress) {
    return (
      <View style={[styles.card, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
});
