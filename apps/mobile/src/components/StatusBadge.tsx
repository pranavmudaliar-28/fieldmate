import type { TaskStatus } from '@fieldmate/shared';
import { StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  radius,
  spacing,
  statusAppearance,
  toneColors,
  typography,
} from '../constants/theme';

/**
 * Status is always shown as text on a tint, never colour alone (docs/04 §2.2).
 * The icon glyph is rendered by the text label itself to avoid an icon font.
 */
export function StatusBadge({ status }: { status: TaskStatus }) {
  const appearance = statusAppearance[status];
  const tone = toneColors[appearance.tone];

  return (
    <View
      style={[styles.badge, { backgroundColor: tone.tint }]}
      accessible
      accessibilityLabel={`Status: ${appearance.label}`}
      testID={`status-badge-${status}`}
    >
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.label, { color: tone.text }]}
      >
        {appearance.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: { ...typography.caption },
});
