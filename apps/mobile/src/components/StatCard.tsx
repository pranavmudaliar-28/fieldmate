import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  tabularNumbers,
  toneColors,
  typography,
  type IconName,
  type Tone,
} from '../constants/theme';
import type { BadgePalette } from './Badge';
import { Icon } from './Icon';

export type StatCardProps = {
  label: string;
  value: number;
  /** True when the real total is larger than the page we counted. */
  capped?: boolean;
  tone?: Tone;
  /** A status's own colours; wins over `tone`. */
  palette?: BadgePalette;
  icon?: IconName;
  /** Fills the tile with its colour, for the count that must be noticed. */
  emphasis?: boolean;
  onPress?: () => void;
  testID?: string;
};

/** A single count: the status icon and word on the left, the number on the right. */
export function StatCard({
  label,
  value,
  capped = false,
  tone = 'neutral',
  palette,
  icon,
  emphasis = false,
  onPress,
  testID,
}: StatCardProps) {
  const fill = palette ?? toneColors[tone];
  const shown = `${value}${capped ? '+' : ''}`;
  const description = `${shown} ${label}`;

  const body = (
    <>
      <View style={styles.labels}>
        {icon ? <Icon name={icon} size={20} color={fill.text} /> : null}
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={[styles.label, { color: fill.text }]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.value, emphasis && { color: fill.text }]}
      >
        {shown}
      </Text>
    </>
  );

  const containerStyle = [
    styles.card,
    emphasis ? { backgroundColor: fill.tint, borderColor: fill.text } : styles.plain,
  ];

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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 76,
    borderRadius: radius.tile,
    borderWidth: 1.5,
    padding: 14,
  },
  /** Flat on a line; the emphasised tile is the only one with a heavier edge. */
  plain: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  pressed: { opacity: 0.9 },
  labels: { flex: 1, gap: 6, alignSelf: 'stretch', justifyContent: 'space-between' },
  label: { ...typography.secondaryStrong },
  value: {
    ...typography.hero,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
    ...tabularNumbers,
    color: colors.textPrimary,
  },
});
