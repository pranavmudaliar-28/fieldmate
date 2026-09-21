import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, elevation, radius, spacing } from '../constants/theme';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  /** Ink surface, for the one card on a screen that outranks the rest. */
  variant?: 'surface' | 'inverse';
  /** Removes the inner padding so the child can run to the edges. */
  bleed?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A raised surface. The old rule was a 1px border and no shadow, which left
 * every screen on one flat plane; the ladder in `elevation` is wide and soft
 * so it still reads in direct sun.
 */
export function Card({
  children,
  onPress,
  variant = 'surface',
  bleed = false,
  accessibilityLabel,
  testID,
  style,
}: CardProps) {
  const base = [
    styles.card,
    variant === 'inverse' ? styles.inverse : styles.surface,
    bleed ? styles.bleed : null,
    style,
  ];

  if (!onPress) {
    return (
      <View style={base} testID={testID}>
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
      style={({ pressed }) => [...base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  surface: { backgroundColor: colors.surface, ...elevation.card },
  inverse: { backgroundColor: colors.surfaceInverse, ...elevation.floating },
  bleed: { padding: 0, overflow: 'hidden' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
});
