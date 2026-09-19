import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MAX_FONT_SIZE_MULTIPLIER, colors, layout, spacing, typography } from '../constants/theme';

/** Fixed bottom bar so the main action always sits in the same place (docs/04 §1). */
export function ActionBar({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bar}>
      {hint ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
      <View style={styles.actions}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md },
});
