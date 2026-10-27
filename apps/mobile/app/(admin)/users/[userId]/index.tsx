import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../../../../src/components/ActionBar';
import { AppHeader } from '../../../../src/components/AppHeader';
import { Avatar } from '../../../../src/components/Avatar';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { ConfirmationDialog } from '../../../../src/components/ConfirmationDialog';
import { Icon } from '../../../../src/components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../../../src/components/States';
import { useToast } from '../../../../src/components/Toast';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  radius,
  spacing,
  toneColors,
  typography,
  type IconName,
} from '../../../../src/constants/theme';
import { ActiveMark } from '../../../../src/features/admin/ActiveMark';
import { ROLE_ICONS, ROLE_LABELS } from '../../../../src/features/admin/UserForm';
import {
  useDeleteUser,
  useResendInvite,
  useRevokeUserSessions,
  useSendPasswordReset,
  useUpdateUser,
  useUser,
} from '../../../../src/features/admin/hooks';
import { useAuth } from '../../../../src/features/auth/auth-context';
import { ApiError } from '../../../../src/services/http';

type Pending = 'deactivate' | 'activate' | 'revoke' | 'delete' | 'cantDelete' | 'email' | null;

/** "12 March 2026": the day an account was made, not the minute. */
function longDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** S-012 User details: everything an admin can do to one account. */
export default function UserDetailsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user: signedInUser } = useAuth();
  const { showToast } = useToast();

  const user = useUser(userId);
  const updateUser = useUpdateUser(userId);
  const sendReset = useSendPasswordReset(userId);
  const resendInvite = useResendInvite(userId);
  const revokeSessions = useRevokeUserSessions(userId);
  const deleteUser = useDeleteUser(userId);

  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (actionError: unknown) => {
    const message =
      actionError instanceof ApiError
        ? actionError.message
        : 'Something went wrong. Please try again.';
    setPending(null);
    setError(message);
    showToast(message, 'error');
    void user.refetch();
  };

  if (user.isPending) {
    return (
      <View style={styles.screen}>
        <AppHeader title="" onBack={() => router.back()} />
        <View style={styles.padded}>
          <LoadingState variant="detail" />
        </View>
      </View>
    );
  }

  if (user.isError) {
    const gone = user.error instanceof ApiError && user.error.status === 404;
    return (
      <View style={styles.screen}>
        <AppHeader title="" onBack={() => router.back()} />
        {gone ? (
          <EmptyState
            icon="person-remove-outline"
            title="This user no longer exists"
            message="They may have been deleted."
            action={{ label: 'Back to users', onPress: () => router.replace('/(admin)/(tabs)') }}
          />
        ) : (
          <View style={styles.padded}>
            <ErrorState message="Couldn't load this user." onRetry={() => void user.refetch()} />
          </View>
        )}
      </View>
    );
  }

  const managed = user.data;
  const first = managed.name.split(' ')[0] ?? managed.name;
  const isSelf = managed.id === signedInUser?.id;
  const invited = managed.status === 'INVITED';
  // A pending invitee has no password yet, so "reset" means sending the invite again.
  const emailAction = invited ? resendInvite : sendReset;
  const busy =
    updateUser.isPending ||
    emailAction.isPending ||
    revokeSessions.isPending ||
    deleteUser.isPending;

  const setActive = (isActive: boolean) =>
    updateUser.mutate(
      { isActive },
      {
        onSuccess: () => {
          setPending(null);
          setError(null);
          showToast(isActive ? `${first} can sign in again` : `${first} deactivated`);
        },
        onError: fail,
      },
    );

  return (
    <View style={styles.screen}>
      <AppHeader title="" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={user.isRefetching} onRefresh={() => void user.refetch()} />
        }
      >
        <View style={styles.header}>
          <Avatar
            name={managed.name}
            size="lg"
            variant={managed.isActive ? 'person' : 'muted'}
            style={styles.avatar}
          />
          <View style={styles.headerText}>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.name}
              accessibilityRole="header"
            >
              {managed.name}
            </Text>
            <View style={styles.tags}>
              <Badge label={ROLE_LABELS[managed.role]} icon={ROLE_ICONS[managed.role]} />
              <ActiveMark active={managed.isActive} testID="user-status" />
              {invited ? (
                <Badge
                  label="Invited"
                  icon="mail-unread-outline"
                  tone="info"
                  testID="user-invited"
                />
              ) : null}
            </View>
          </View>
        </View>

        {!managed.isActive ? (
          <View style={styles.banner} testID="inactive-banner">
            <Icon name="ban-outline" size={22} color={colors.textPrimary} />
            <View style={styles.bannerText}>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.bannerTitle}>
                Sign-in turned off
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.bannerBody}>
                {first} can’t sign in. Task history is kept.
              </Text>
            </View>
          </View>
        ) : null}

        {isSelf ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.selfNote}>
            This is your own account, so some actions are unavailable.
          </Text>
        ) : null}

        <View style={styles.group}>
          <Detail label="Email" value={managed.email} />
          <Detail label="Role" value={ROLE_LABELS[managed.role]} divided />
          <Detail label="Date added" value={longDate(managed.createdAt)} divided />
        </View>

        <View style={styles.group}>
          {!managed.isActive ? (
            <ActionRow
              icon="pencil-outline"
              label="Edit user"
              testID="edit-user"
              disabled={busy}
              onPress={() => router.push(`/(admin)/users/${managed.id}/edit`)}
              chevron
            />
          ) : null}
          {/* An inactive user cannot sign in, so passwords, sessions and deletion
              wait until they are reactivated (A-Reactivate). */}
          {managed.isActive ? (
            <>
              <ActionRow
                icon={invited ? 'mail-unread-outline' : 'lock-closed-outline'}
                label={invited ? 'Resend invitation' : 'Send password reset'}
                detail={
                  invited
                    ? `${first} hasn’t set up their account yet`
                    : `Emails ${first} a code to choose a new password`
                }
                testID="email-user"
                disabled={busy}
                onPress={() => setPending('email')}
              />
              <ActionRow
                icon="log-out-outline"
                label="Force sign-out"
                detail="Signs out of all devices now"
                testID="force-signout"
                disabled={busy}
                onPress={() => setPending('revoke')}
                divided
              />
            </>
          ) : null}
          {managed.isActive ? (
            <ActionRow
              icon="ban-outline"
              label="Deactivate"
              detail={
                isSelf
                  ? 'You can’t deactivate your own account.'
                  : 'Blocks sign-in. You can reactivate later.'
              }
              tone="warning"
              testID="deactivate-user"
              disabled={busy || isSelf}
              onPress={() => setPending('deactivate')}
              divided
            />
          ) : null}
        </View>

        {managed.isActive ? (
          <Button
            label="Delete permanently"
            icon="trash-outline"
            variant="destructiveOutline"
            testID="delete-user"
            disabled={busy || isSelf}
            disabledReason="You cannot delete your own account."
            // A user with history is not refused silently: the dialog explains why.
            onPress={() => setPending(managed.hasHistory ? 'cantDelete' : 'delete')}
          />
        ) : null}

        {error ? <ErrorState message={error} onRetry={() => void user.refetch()} /> : null}
      </ScrollView>

      <ActionBar
        {...(managed.isActive
          ? {}
          : { hint: `${first} can sign in again with the existing password.` })}
      >
        {managed.isActive ? (
          <Button
            label="Edit user"
            icon="pencil-outline"
            testID="edit-user"
            onPress={() => router.push(`/(admin)/users/${managed.id}/edit`)}
            disabled={busy}
            style={styles.barAction}
          />
        ) : (
          <Button
            label="Reactivate"
            icon="refresh"
            testID="activate-user"
            disabled={busy}
            onPress={() => setPending('activate')}
            style={styles.barAction}
          />
        )}
      </ActionBar>

      <ConfirmationDialog
        visible={pending === 'email'}
        title={invited ? `Resend ${first}’s invitation?` : `Email ${first} a reset code?`}
        message={
          invited
            ? `A new code goes to ${managed.email}. The one sent before stops working.`
            : `A code goes to ${managed.email}. ${first} keeps their current password until they choose a new one, which signs them out on every device.`
        }
        confirmLabel={invited ? 'Resend invitation' : 'Send reset code'}
        icon="mail-outline"
        loading={emailAction.isPending}
        onConfirm={() =>
          emailAction.mutate(undefined, {
            onSuccess: () => {
              setPending(null);
              setError(null);
              showToast(`Email sent to ${managed.email}`);
            },
            onError: fail,
          })
        }
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'revoke'}
        title={`Sign ${first} out everywhere?`}
        message={`${first} is signed out on all devices right away and can sign back in with the current password.`}
        confirmLabel="Sign out everywhere"
        icon="log-out-outline"
        loading={revokeSessions.isPending}
        onConfirm={() =>
          revokeSessions.mutate(undefined, {
            onSuccess: () => {
              setPending(null);
              setError(null);
              showToast('Signed out on all devices');
            },
            onError: fail,
          })
        }
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'deactivate'}
        title={`Deactivate ${managed.name}?`}
        message={`${first} is signed out and can’t sign in. Past tasks and photos stay as they are, and open tasks stay assigned until a manager reassigns them. You can reactivate at any time.`}
        confirmLabel="Deactivate"
        destructive
        icon="ban-outline"
        loading={updateUser.isPending}
        onConfirm={() => setActive(false)}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'activate'}
        title={`Reactivate ${managed.name}?`}
        message={`${first} can sign in again with the existing password.`}
        confirmLabel="Reactivate"
        icon="refresh"
        tone="success"
        loading={updateUser.isPending}
        onConfirm={() => setActive(true)}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'cantDelete'}
        title={`${first} can’t be deleted`}
        message={`${first} has task history, so they can’t be deleted. ${
          managed.isActive
            ? 'Deactivating blocks sign-in and keeps every past task intact. You can reactivate any time.'
            : 'They are already deactivated, which keeps every past task intact.'
        }`}
        confirmLabel={managed.isActive ? 'Deactivate instead' : 'OK'}
        {...(managed.isActive ? { confirmIcon: 'ban-outline' as const } : {})}
        cancelLabel="Cancel"
        icon="lock-closed-outline"
        loading={updateUser.isPending}
        onConfirm={() => (managed.isActive ? setActive(false) : setPending(null))}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'delete'}
        title={`Delete ${managed.name}?`}
        message={`${first} has no task history. The account is removed permanently and can’t be restored.`}
        confirmLabel="Delete permanently"
        destructive
        icon="trash-outline"
        loading={deleteUser.isPending}
        onConfirm={() =>
          deleteUser.mutate(undefined, {
            onSuccess: () => {
              setPending(null);
              showToast(`${managed.name} deleted`);
              router.replace('/(admin)/(tabs)');
            },
            onError: fail,
          })
        }
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

function Detail({
  label,
  value,
  divided = false,
}: {
  label: string;
  value: string;
  divided?: boolean;
}) {
  return (
    <View
      style={[styles.detail, divided && styles.divided]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.detailLabel}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  tone,
  chevron = false,
  divided = false,
  disabled = false,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  detail?: ReactNode;
  tone?: 'warning';
  chevron?: boolean;
  divided?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const color = disabled
    ? colors.textDisabled
    : tone === 'warning'
      ? toneColors.warning.text
      : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={typeof detail === 'string' ? `${label}, ${detail}` : label}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.action,
        divided && styles.divided,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      <Icon name={icon} size={22} color={color} />
      <View style={styles.actionText}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={[styles.actionLabel, { color }]}
        >
          {label}
        </Text>
        {detail ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.actionDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {chevron ? <Icon name="chevron-forward" size={20} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** The action bar is a row: a lone button needs flex to span it. */
  barAction: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: layout.screenPadding,
    paddingTop: 0,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  padded: { flex: 1, padding: layout.screenPadding },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  avatar: { width: 80, height: 80 },
  headerText: { flex: 1, gap: spacing.sm },
  name: { ...typography.display, color: colors.textPrimary },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.smPlus },
  banner: {
    flexDirection: 'row',
    gap: spacing.smPlus,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceMuted,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  bannerBody: { ...typography.secondary, color: colors.textSecondary },
  selfNote: { ...typography.secondary, color: colors.textSecondary },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.card,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  detail: { paddingHorizontal: spacing.md, paddingVertical: spacing.smPlus, gap: 2 },
  detailLabel: { ...typography.secondary, color: colors.textSecondary },
  detailValue: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smPlus,
  },
  actionPressed: { backgroundColor: colors.surfaceMuted },
  actionText: { flex: 1, gap: 2 },
  actionLabel: { ...typography.bodyStrong, fontSize: 17 },
  actionDetail: { ...typography.secondary, color: colors.textSecondary },
});
