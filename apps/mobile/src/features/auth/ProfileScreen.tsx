import type { Role } from '@fieldmate/shared';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { Icon } from '../../components/Icon';
import { useTabBarSpacing } from '../../components/TabBar';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  radius,
  spacing,
  typography,
  type IconName,
} from '../../constants/theme';
import { NotificationPrompt } from '../notifications/NotificationPrompt';
import { useAuth } from './auth-context';

const LOGOUT_CONFIRMATION =
  "You'll need to sign in again on this device. This signs you out on all your devices.";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  FIELD_WORKER: 'Field worker',
};

/** What each role can do, said once where the person can check it. */
const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Admin · manages users and access',
  MANAGER: 'Manager · can create and review tasks',
  FIELD_WORKER: 'Field worker · accepts tasks and submits work',
};

const ROLE_ICONS: Record<Role, IconName> = {
  ADMIN: 'key-outline',
  MANAGER: 'people-outline',
  FIELD_WORKER: 'construct-outline',
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
  const version = Constants.expoConfig?.version;

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
        <View style={styles.identity}>
          <Avatar name={user?.name ?? ''} size="lg" variant="accent" />
          <View style={styles.identityText}>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.name}
              testID="profile-name"
            >
              {user?.name ?? ''}
            </Text>
            {user ? (
              <Badge
                label={ROLE_LABELS[user.role]}
                icon={ROLE_ICONS[user.role]}
                palette={{ text: colors.textOnInverse, tint: colors.surfaceInverseRaised }}
                testID="header-role"
              />
            ) : null}
          </View>
        </View>

        {user ? (
          <View style={styles.details}>
            <DetailRow icon="mail-outline" label="Email" value={user.email} />
            <View style={styles.divider} />
            <DetailRow icon="shield-outline" label="Role" value={ROLE_DESCRIPTIONS[user.role]} />
          </View>
        ) : null}

        <View style={styles.details}>
          <LinkRow
            icon="person-outline"
            label="Edit name"
            href="/account/name"
            testID="account-edit-name"
          />
          <View style={styles.divider} />
          <LinkRow
            icon="mail-outline"
            label="Change email"
            href="/account/email"
            testID="account-edit-email"
          />
          <View style={styles.divider} />
          <LinkRow
            icon="lock-closed-outline"
            label="Change password"
            href="/account/password"
            testID="account-edit-password"
          />
        </View>

        {/* Managers bring in their own field workers; admins do it from Users. */}
        {user?.role === 'MANAGER' ? (
          <View style={styles.details}>
            <LinkRow
              icon="person-add-outline"
              label="Invite a field worker"
              href="/(manager)/invite"
              testID="invite-worker"
            />
          </View>
        ) : null}

        {user ? <NotificationPrompt role={user.role} /> : null}

        <Button
          label="Log out"
          variant="destructiveOutline"
          icon="log-out-outline"
          testID="logout-button"
          onPress={() => setConfirming(true)}
        />

        {version ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.version}>
            FieldMate {version}
          </Text>
        ) : null}
      </ScrollView>

      <ConfirmationDialog
        visible={confirming}
        title="Log out?"
        message={LOGOUT_CONFIRMATION}
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        icon="log-out-outline"
        loading={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

function LinkRow({
  icon,
  label,
  href,
  testID,
}: {
  icon: IconName;
  label: string;
  href: Href;
  testID: string;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
    >
      <Icon name={icon} size={22} color={colors.textPrimary} />
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.linkLabel}>
        {label}
      </Text>
      <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function DetailRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.detailRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={22} color={colors.textSecondary} />
      <View style={styles.detailText}>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.detailLabel}>
          {label}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.detailValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingTop: spacing.xs, gap: spacing.mdPlus },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.sheet,
    backgroundColor: colors.surfaceInverse,
    ...elevation.floating,
  },
  identityText: { flex: 1, gap: spacing.sm, alignItems: 'flex-start' },
  name: {
    ...typography.sectionTitle,
    fontFamily: typography.display.fontFamily,
    color: colors.textOnInverse,
  },
  details: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.border },
  detailRow: { flexDirection: 'row', gap: spacing.smPlus, paddingVertical: spacing.md },
  detailText: { flex: 1, gap: 2 },
  detailLabel: { ...typography.secondary, color: colors.textSecondary },
  detailValue: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    minHeight: 56,
    paddingVertical: spacing.smPlus,
  },
  linkRowPressed: { opacity: 0.6 },
  linkLabel: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary, flex: 1 },
  version: { ...typography.mono, color: colors.textSecondary, textAlign: 'center' },
});
