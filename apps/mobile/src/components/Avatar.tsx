import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  fontFamily,
  radius,
  type Tone,
  toneColors,
} from '../constants/theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  name: string;
  size?: AvatarSize;
  /** `accent` marks the signed-in person; a tone tints a teammate. */
  variant?: 'accent' | 'ink' | 'muted' | Tone;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const DIMENSIONS: Record<AvatarSize, { box: number; text: number }> = {
  sm: { box: 24, text: 10 },
  md: { box: 40, text: 14 },
  lg: { box: 64, text: 22 },
};

/** Initials on a tinted circle: the data model has no profile photo field. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = 'md', variant = 'muted', testID, style }: AvatarProps) {
  const { box, text } = DIMENSIONS[size];
  const palette = paletteFor(variant);

  return (
    <View
      style={[
        styles.circle,
        { width: box, height: box, backgroundColor: palette.background },
        style,
      ]}
      testID={testID}
      // The name is always written beside the avatar, so it is not read twice.
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.initials, { fontSize: text, color: palette.foreground }]}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

function paletteFor(variant: NonNullable<AvatarProps['variant']>): {
  background: string;
  foreground: string;
} {
  if (variant === 'accent') return { background: colors.accent, foreground: colors.onAccent };
  if (variant === 'ink') return { background: colors.surfaceInverse, foreground: colors.accent };
  if (variant === 'muted')
    return { background: colors.surfaceMuted, foreground: colors.textSecondary };
  const tone = toneColors[variant];
  return { background: tone.tint, foreground: tone.text };
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fontFamily.extrabold },
});
