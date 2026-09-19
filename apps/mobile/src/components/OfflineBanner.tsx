import { StyleSheet, Text, View } from 'react-native';
import { MAX_FONT_SIZE_MULTIPLIER, colors, spacing, typography } from '../constants/theme';
import { useIsOnline } from '../hooks/use-network-status';

export const OFFLINE_MESSAGE = "You're offline. Some actions are unavailable.";

export function OfflineBanner() {
  const isOnline = useIsOnline();
  if (isOnline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.text}>
        {OFFLINE_MESSAGE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.neutralText,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: { ...typography.secondary, color: colors.onPrimary, textAlign: 'center' },
});
