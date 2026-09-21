import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  radius,
  spacing,
  tabularNumbers,
  toneColors,
  typography,
  type Tone,
} from '../constants/theme';

export type StatCardProps = {
  label: string;
  value: number;
  /** True when the real total is larger than the page we counted. */
  capped?: boolean;
  tone?: Tone;
  /** Fills the card with the tone, for the count that must be noticed. */
  emphasis?: boolean;
  onPress?: () => void;
  testID?: string;
};

/** A single count. The dot repeats the status colour used in the lists. */
export function StatCard({
  label,
  value,
  capped = false,
  tone = 'neutral',
  emphasis = false,
  onPress,
  testID,
}: StatCardProps) {
  const palette = toneColors[tone];
  const shown = `${value}${capped ? '+' : ''}`;
  const description = `${shown} ${label}`;

  const body = (
    <>
      <View style={[styles.dot, { backgroundColor: palette.dot }]} />
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.value, emphasis && { color: palette.text }]}
      >
        {shown}
      </Text>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.label, emphasis && { color: palette.text }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </>
  );

  const containerStyle = [styles.card, emphasis ? { backgroundColor: palette.tint } : styles.plain];

  if (!onPress) {
    return (
      <View style={containerStyle} accessible accessibilityLabel={description} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={description}
      testID={testID}
      style={({ pressed }) => [...containerStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.card,
    paddingVertical: spacing.smPlus + 2,
    paddingHorizontal: spacing.smPlus,
    gap: spacing.xs + 2,
  },
  plain: { backgroundColor: colors.surface, ...elevation.card },
  pressed: { opacity: 0.9 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  value: {
    ...typography.display,
    ...tabularNumbers,
    color: colors.textPrimary,
  },
  label: { ...typography.caption, color: colors.textSecondary },
});
