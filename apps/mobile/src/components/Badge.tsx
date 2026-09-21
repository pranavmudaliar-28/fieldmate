import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  toneColors,
  typography,
  type IconName,
  type Tone,
} from '../constants/theme';
import { Icon } from './Icon';

export type BadgeProps = {
  label: string;
  tone?: Tone;
  /** A saturated dot, readable at a glance before the word is read. */
  dot?: boolean;
  icon?: IconName;
  /** Ink fill instead of a tint, for badges that must outrank a status. */
  emphasis?: 'tint' | 'inverse';
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A pill of state. Replaces the ad-hoc pills that were re-declared in the task
 * list, the user list and the user detail screen.
 */
export function Badge({
  label,
  tone = 'neutral',
  dot = false,
  icon,
  emphasis = 'tint',
  accessibilityLabel,
  testID,
  style,
}: BadgeProps) {
  const palette = toneColors[tone];
  const inverse = emphasis === 'inverse';
  const foreground = inverse ? colors.accent : palette.text;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: inverse ? colors.surfaceInverse : palette.tint },
        style,
      ]}
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      {dot ? (
        <View style={[styles.dot, { backgroundColor: inverse ? colors.accent : palette.dot }]} />
      ) : null}
      {icon ? <Icon name={icon} size={13} color={foreground} /> : null}
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.label, { color: foreground }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.smPlus,
    paddingVertical: spacing.xs + 2,
  },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  label: { ...typography.caption },
});
