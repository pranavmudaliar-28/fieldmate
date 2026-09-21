import type { Role } from '@fieldmate/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { useTabBarSpacing } from '../../components/TabBar';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../constants/theme';
import { NotificationPrompt } from '../notifications/NotificationPrompt';
import { useAuth } from './auth-context';
import { LOGOUT_CONFIRMATION } from './LogoutButton';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  FIELD_WORKER: 'Field worker',
};

/**
 * The account tab, shared by all three roles. It rehouses what used to live in
 * the dashboard header, so logging out is reachable from anywhere rather than
 * only from a dashboard.
 */
export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const tabBarSpacing = useTabBarSpacing();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader size="large" title="Profile" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarSpacing }]}>
        <Card style={styles.identity}>
          <Avatar name={user?.name ?? ''} size="lg" variant="accent" />
          <View style={styles.identityText}>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.name}
              testID="profile-name"
            >
              {user?.name ?? ''}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.email}>
              {user?.email ?? ''}
            </Text>
          </View>
          {user ? (
            <Badge
              label={ROLE_LABELS[user.role]}
              emphasis="inverse"
              testID="header-role"
              style={styles.role}
            />
          ) : null}
        </Card>

        {user ? <NotificationPrompt role={user.role} /> : null}

        <Button
          label="Log out"
          variant="secondary"
          icon="log-out-outline"
          testID="logout-button"
          onPress={() => setConfirming(true)}
        />
      </ScrollView>

      <ConfirmationDialog
        visible={confirming}
        title="Log out"
        message={LOGOUT_CONFIRMATION}
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        loading={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.md },
  identity: { alignItems: 'center', gap: spacing.smPlus, paddingVertical: spacing.lg },
  identityText: { alignItems: 'center', gap: spacing.xs },
  name: { ...typography.display, color: colors.textPrimary, textAlign: 'center' },
  email: { ...typography.secondary, color: colors.textSecondary },
  role: { alignSelf: 'center' },
});
