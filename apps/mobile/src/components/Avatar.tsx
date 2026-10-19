import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  fontFamily,
  radius,
  statusAppearance,
  type Tone,
  toneColors,
} from '../constants/theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  name: string;
  size?: AvatarSize;
  /**
   * `ink` marks the signed-in person; `person` gives a teammate a tint of
   * their own, so the same worker looks the same in every list.
   */
  variant?: 'person' | 'accent' | 'ink' | 'muted' | Tone;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const DIMENSIONS: Record<AvatarSize, { box: number; text: number }> = {
  sm: { box: 30, text: 12 },
  md: { box: 44, text: 15 },
  lg: { box: 72, text: 24 },
};

/** The status tints double as people colours; ink and grey are left out. */
const PEOPLE = [
  statusAppearance.GOING_TO_LOCATION,
  statusAppearance.IN_PROGRESS,
  statusAppearance.COMPLETED,
  statusAppearance.AWAITING_REVIEW,
  statusAppearance.REACHED_LOCATION,
  statusAppearance.ACCEPTED,
  statusAppearance.REJECTED,
];

/** Initials on a tinted circle: the data model has no profile photo field. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = 'md', variant = 'person', testID, style }: AvatarProps) {
  const { box, text } = DIMENSIONS[size];
  const palette = paletteFor(variant, name);

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

function paletteFor(
  variant: NonNullable<AvatarProps['variant']>,
  name: string,
): { background: string; foreground: string } {
  if (variant === 'person') {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    const person = PEOPLE[Math.abs(hash) % PEOPLE.length]!;
    return { background: person.tint, foreground: person.text };
  }
  if (variant === 'accent') return { background: colors.accent, foreground: colors.onAccent };
  if (variant === 'ink') return { background: colors.surfaceInverse, foreground: colors.accent };
  if (variant === 'muted')
    return { background: colors.surfaceMuted, foreground: colors.textSecondary };
  const tone = toneColors[variant];
  return { background: tone.tint, foreground: tone.text };
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fontFamily.bold },
});
