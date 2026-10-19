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

export type BadgePalette = { text: string; tint: string; outline?: string };

export type BadgeProps = {
  label: string;
  tone?: Tone;
  /** Overrides the tone, for colours outside the five families (task statuses). */
  palette?: BadgePalette;
  /** A saturated dot, readable at a glance before the word is read. */
  dot?: boolean;
  icon?: IconName;
  /** Ink fill instead of a tint, for badges that must outrank a status. */
  emphasis?: 'tint' | 'inverse';
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** A small tag of state: tinted fill, dark hue text, optional icon. */
export function Badge({
  label,
  tone = 'neutral',
  palette,
  dot = false,
  icon,
  emphasis = 'tint',
  accessibilityLabel,
  testID,
  style,
}: BadgeProps) {
  const toneColor = toneColors[tone];
  const fill = palette ?? toneColor;
  const inverse = emphasis === 'inverse';
  const foreground = inverse ? colors.accent : fill.text;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: inverse ? colors.surfaceInverse : fill.tint },
        palette?.outline ? [styles.outlined, { borderColor: palette.outline }] : null,
        style,
      ]}
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      {dot ? (
        <View style={[styles.dot, { backgroundColor: inverse ? colors.accent : toneColor.dot }]} />
      ) : null}
      {icon ? <Icon name={icon} size={14} color={foreground} /> : null}
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
    borderRadius: radius.badge,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  outlined: { borderWidth: 1, borderStyle: 'dashed' },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  label: { ...typography.caption, fontFamily: typography.secondaryStrong.fontFamily },
});
