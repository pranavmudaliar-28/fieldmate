import { StyleSheet, Text, View } from 'react-native';
import { MAX_FONT_SIZE_MULTIPLIER, colors, layout, spacing, typography } from '../constants/theme';
import { LogoutButton } from '../features/auth/LogoutButton';

/** Dashboard chrome: app name on the left, log out on the right (docs/04 §4). */
export function DashboardHeader() {
  return (
    <View style={styles.header}>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.appName}>
        FieldMate
      </Text>
      <LogoutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  appName: { ...typography.sectionTitle, color: colors.textPrimary },
});
