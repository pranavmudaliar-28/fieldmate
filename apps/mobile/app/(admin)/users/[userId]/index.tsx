import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../../src/components/Button';
import { Card } from '../../../../src/components/Card';
import { ConfirmationDialog } from '../../../../src/components/ConfirmationDialog';
import { Input } from '../../../../src/components/Input';
import { EmptyState, ErrorState, LoadingState } from '../../../../src/components/States';
import { useToast } from '../../../../src/components/Toast';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  toneColors,
  typography,
} from '../../../../src/constants/theme';
import { ROLE_LABELS } from '../../../../src/features/admin/UserForm';
import {
  useDeleteUser,
  useRevokeUserSessions,
  useSetUserPassword,
  useUpdateUser,
  useUser,
} from '../../../../src/features/admin/hooks';
import { useAuth } from '../../../../src/features/auth/auth-context';
import { ApiError } from '../../../../src/services/http';
import { formatDateTime } from '../../../../src/utils/format';

type Pending = 'deactivate' | 'activate' | 'revoke' | 'delete' | 'password' | null;

/** S-012 User details: everything an admin can do to one account. */
export default function UserDetailsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user: signedInUser } = useAuth();
  const { showToast } = useToast();

  const user = useUser(userId);
  const updateUser = useUpdateUser(userId);
  const setPassword = useSetUserPassword(userId);
  const revokeSessions = useRevokeUserSessions(userId);
  const deleteUser = useDeleteUser(userId);

  const [pending, setPending] = useState<Pending>(null);
  const [newPassword, setNewPassword] = useState('');
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
      <View style={styles.padded}>
        <Stack.Screen options={{ headerShown: true, title: 'User' }} />
        <LoadingState variant="detail" />
      </View>
    );
  }

  if (user.isError) {
    const gone = user.error instanceof ApiError && user.error.status === 404;
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'User' }} />
        {gone ? (
          <EmptyState
            title="This user no longer exists"
            message="They may have been deleted."
            action={{ label: 'Back to users', onPress: () => router.replace('/(admin)/(tabs)') }}
          />
        ) : (
          <ErrorState message="Couldn't load this user." onRetry={() => void user.refetch()} />
        )}
      </>
    );
  }

  const managed = user.data;
  const isSelf = managed.id === signedInUser?.id;
  const busy =
    updateUser.isPending ||
    setPassword.isPending ||
    revokeSessions.isPending ||
    deleteUser.isPending;

  const setActive = (isActive: boolean) =>
    updateUser.mutate(
      { isActive },
      {
        onSuccess: () => {
          setPending(null);
          setError(null);
          showToast(isActive ? 'User reactivated' : 'User deactivated');
        },
        onError: fail,
      },
    );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: 'User' }} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={user.isRefetching} onRefresh={() => void user.refetch()} />
        }
      >
        <View style={styles.header}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.name}
            accessibilityRole="header"
          >
            {managed.name}
          </Text>
          <View
            style={[styles.badge, managed.isActive ? styles.activeBadge : styles.inactiveBadge]}
            testID="user-status"
          >
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={[
                styles.badgeLabel,
                { color: managed.isActive ? toneColors.success.text : toneColors.neutral.text },
              ]}
            >
              {managed.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        <Card>
          <Detail label="Email" value={managed.email} />
          <Detail label="Role" value={ROLE_LABELS[managed.role]} />
          <Detail label="Added" value={formatDateTime(managed.createdAt)} />
          {isSelf ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.selfNote}>
              This is your own account, so some actions are unavailable.
            </Text>
          ) : null}
        </Card>

        <Button
          label="Edit details"
          variant="secondary"
          testID="edit-user"
          onPress={() => router.push(`/(admin)/users/${managed.id}/edit`)}
          disabled={busy}
        />

        <View style={styles.section}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            Access
          </Text>

          <Input
            label="New password"
            testID="new-password"
            value={newPassword}
            onChangeText={setNewPassword}
            secure
            autoCapitalize="none"
            helper="Tell the user their new password; it signs them out everywhere."
            editable={!busy}
          />
          <Button
            label="Set password"
            variant="secondary"
            testID="set-password"
            disabled={newPassword.trim().length < 8 || busy}
            disabledReason="Passwords must be at least 8 characters."
            onPress={() => setPending('password')}
          />

          <Button
            label="Force sign-out"
            variant="secondary"
            testID="force-signout"
            disabled={busy}
            onPress={() => setPending('revoke')}
          />

          {managed.isActive ? (
            <Button
              label="Deactivate user"
              variant="destructive"
              testID="deactivate-user"
              disabled={busy || isSelf}
              disabledReason="You cannot deactivate your own account."
              onPress={() => setPending('deactivate')}
            />
          ) : (
            <Button
              label="Reactivate user"
              testID="activate-user"
              disabled={busy}
              onPress={() => setPending('activate')}
            />
          )}

          <Button
            label="Delete permanently"
            variant="destructive"
            testID="delete-user"
            disabled={busy || isSelf || managed.hasHistory}
            disabledReason={
              managed.hasHistory
                ? 'This user appears in task history. Deactivate them instead.'
                : 'You cannot delete your own account.'
            }
            onPress={() => setPending('delete')}
          />

          {managed.hasHistory ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hint}>
              This user appears in task history, so they cannot be deleted. Deactivating keeps the
              record intact.
            </Text>
          ) : null}
        </View>

        {error ? <ErrorState message={error} onRetry={() => void user.refetch()} /> : null}
      </ScrollView>

      <ConfirmationDialog
        visible={pending === 'password'}
        title="Set a new password"
        message={`Set a new password for ${managed.name}? They will be signed out on all devices.`}
        confirmLabel="Set password"
        loading={setPassword.isPending}
        onConfirm={() =>
          setPassword.mutate(newPassword.trim(), {
            onSuccess: () => {
              setPending(null);
              setNewPassword('');
              setError(null);
              showToast('Password updated');
            },
            onError: fail,
          })
        }
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'revoke'}
        title="Force sign-out"
        message={`Sign ${managed.name} out on all devices? Their password stays the same.`}
        confirmLabel="Sign out"
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
        title="Deactivate user"
        message={`${managed.name} will not be able to log in, and will receive no new tasks. Their existing tasks stay assigned until a manager reassigns them.`}
        confirmLabel="Deactivate"
        cancelLabel="Keep active"
        destructive
        loading={updateUser.isPending}
        onConfirm={() => setActive(false)}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'activate'}
        title="Reactivate user"
        message={`${managed.name} will be able to log in again.`}
        confirmLabel="Reactivate"
        loading={updateUser.isPending}
        onConfirm={() => setActive(true)}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'delete'}
        title="Delete user"
        message={`Delete ${managed.name} permanently? This can't be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep user"
        destructive
        loading={deleteUser.isPending}
        onConfirm={() =>
          deleteUser.mutate(undefined, {
            onSuccess: () => {
              setPending(null);
              showToast('User deleted');
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.detailLabel}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.md, paddingBottom: spacing.xl },
  padded: { flex: 1, padding: layout.screenPadding, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.screenTitle, color: colors.textPrimary, flex: 1 },
  badge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  activeBadge: { backgroundColor: toneColors.success.tint },
  inactiveBadge: { backgroundColor: toneColors.neutral.tint },
  badgeLabel: { ...typography.caption },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  detailLabel: { ...typography.secondary, color: colors.textSecondary },
  detailValue: { ...typography.body, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  selfNote: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary },
});
