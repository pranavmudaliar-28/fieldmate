import type { Role } from '@fieldmate/shared';
import { StyleSheet, Text, View } from 'react-native';
import { MAX_FONT_SIZE_MULTIPLIER, colors, layout, spacing, typography } from '../constants/theme';
import { LogoutButton } from '../features/auth/LogoutButton';
import { useAuth } from '../features/auth/auth-context';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  FIELD_WORKER: 'Field worker',
};

/** Dashboard chrome: app name and role on the left, log out on the right. */
export function DashboardHeader() {
  const { user } = useAuth();

  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.appName}>
          FieldMate
        </Text>
        {user ? (
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.role}
            testID="header-role"
          >
            {user.name} · {ROLE_LABELS[user.role]}
          </Text>
        ) : null}
      </View>
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
  identity: { flex: 1, gap: 2 },
  appName: { ...typography.sectionTitle, color: colors.textPrimary },
  role: { ...typography.caption, color: colors.textSecondary },
});
