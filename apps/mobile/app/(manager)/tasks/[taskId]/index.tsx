import { allowedActions, type TaskDetail, type UserSummary } from '@fieldmate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../../../../src/components/ActionBar';
import { AppHeader } from '../../../../src/components/AppHeader';
import { BottomSheet } from '../../../../src/components/BottomSheet';
import { Button } from '../../../../src/components/Button';
import { ConfirmationDialog } from '../../../../src/components/ConfirmationDialog';
import { Icon } from '../../../../src/components/Icon';
import { Input } from '../../../../src/components/Input';
import { OverflowMenu, type OverflowAction } from '../../../../src/components/OverflowMenu';
import { EmptyState, ErrorState, LoadingState } from '../../../../src/components/States';
import { useToast } from '../../../../src/components/Toast';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../../../../src/constants/theme';
import { WorkerPicker } from '../../../../src/features/assignments/WorkerPicker';
import { TaskDetailView } from '../../../../src/features/tasks/TaskDetailView';
import { useRequestChanges, useTask, useTaskAction } from '../../../../src/features/tasks/hooks';
import { ApiError } from '../../../../src/services/http';

type PendingAction = 'cancel' | 'reopen' | 'complete' | 'approve' | null;

const EVIDENCE_HINT = 'At least 1 photo is required to complete this task.';

const messageFor = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

/** S-005 Task Details for managers, with the actions allowed in each status. */
export default function ManagerTaskDetails() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const task = useTask(taskId);

  const [pending, setPending] = useState<PendingAction>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingWorker, setPendingWorker] = useState<UserSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  const cancel = useTaskAction(taskId, 'cancel');
  const reopen = useTaskAction(taskId, 'reopen');
  const complete = useTaskAction(taskId, 'complete');
  const reassign = useTaskAction(taskId, 'reassign');
  const approve = useTaskAction(taskId, 'approve');
  const requestChanges = useRequestChanges(taskId);

  const run = (mutation: typeof cancel, successMessage: string, workerId?: string) => {
    setActionError(null);
    mutation.mutate(workerId, {
      onSuccess: () => {
        showToast(successMessage);
        setPending(null);
        setPendingWorker(null);
      },
      onError: (error) => {
        const message = messageFor(error);
        setPending(null);
        setPendingWorker(null);
        setActionError(message);
        showToast(message, 'error');
        void task.refetch();
      },
    });
  };

  if (task.isPending) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Task details" onBack={() => router.back()} />
        <View style={styles.padded}>
          <LoadingState variant="detail" />
        </View>
      </View>
    );
  }

  if (task.isError) {
    const notAvailable =
      task.error instanceof ApiError && (task.error.status === 404 || task.error.status === 403);
    return (
      <View style={styles.screen}>
        <AppHeader title="Task details" onBack={() => router.back()} />
        <View style={styles.padded}>
          {notAvailable ? (
            <EmptyState
              icon="help-circle-outline"
              title="This task is no longer available"
              message="It may have been removed or reassigned."
              action={{
                label: 'Go to dashboard',
                onPress: () => router.replace('/(manager)/(tabs)'),
              }}
            />
          ) : (
            <ErrorState message="Couldn't load this task." onRetry={() => void task.refetch()} />
          )}
        </View>
      </View>
    );
  }

  const detail: TaskDetail = task.data;
  const actions = allowedActions(detail.status, 'MANAGER');
  const canComplete = actions.includes('complete');
  const canReview = actions.includes('approve');
  const hasEvidence = detail.evidence.length > 0;
  const busy =
    cancel.isPending ||
    reopen.isPending ||
    complete.isPending ||
    reassign.isPending ||
    approve.isPending ||
    requestChanges.isPending;

  /**
   * One action in the bar and the rest behind the overflow. Five buttons used
   * to share a single row, and the last of them ran off the screen edge.
   */
  const primary = canReview
    ? 'approve'
    : canComplete
      ? 'complete'
      : actions.includes('reopen')
        ? 'reopen'
        : actions.includes('reassign')
          ? 'reassign'
          : null;

  const secondary: OverflowAction[] = [];
  if (actions.includes('edit')) {
    secondary.push({
      label: 'Edit task',
      icon: 'create-outline',
      testID: 'action-edit',
      onPress: () => router.push(`/(manager)/tasks/${taskId}/edit`),
    });
  }
  if (actions.includes('reassign') && primary !== 'reassign') {
    secondary.push({
      label: 'Reassign',
      icon: 'swap-horizontal-outline',
      testID: 'action-reassign',
      onPress: () => setPickerOpen(true),
    });
  }
  if (actions.includes('cancel')) {
    secondary.push({
      label: 'Cancel task',
      icon: 'ban-outline',
      destructive: true,
      testID: 'action-cancel',
      onPress: () => setPending('cancel'),
    });
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Task details"
        onBack={() => router.back()}
        right={
          secondary.length > 0 ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="More actions"
              testID="header-overflow"
              style={styles.overflowButton}
            >
              <Icon name="ellipsis-horizontal" size={22} color={colors.onPrimary} />
            </Pressable>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={task.isRefetching} onRefresh={() => void task.refetch()} />
        }
      >
        <TaskDetailView task={detail}>
          {actionError ? (
            <ErrorState message={actionError} onRetry={() => void task.refetch()} />
          ) : null}
        </TaskDetailView>
      </ScrollView>

      {primary ? (
        <ActionBar hint={canComplete && !hasEvidence ? EVIDENCE_HINT : undefined}>
          {primary === 'approve' ? (
            <>
              <Button
                label="Approve"
                icon="checkmark"
                testID="action-approve"
                onPress={() => setPending('approve')}
                disabled={busy}
                style={styles.reviewAction}
              />
              <Button
                label="Request changes"
                variant="secondary"
                icon="arrow-undo-outline"
                testID="action-request-changes"
                onPress={() => setChangesOpen(true)}
                disabled={busy}
                style={styles.reviewAction}
              />
            </>
          ) : null}
          {primary === 'complete' ? (
            <Button
              label="Complete task"
              icon="checkmark"
              testID="action-complete"
              onPress={() => setPending('complete')}
              disabled={!hasEvidence || busy}
              disabledReason={EVIDENCE_HINT}
            />
          ) : null}
          {primary === 'reopen' ? (
            <Button
              label="Reopen task"
              icon="refresh"
              testID="action-reopen"
              onPress={() => setPending('reopen')}
              disabled={busy}
            />
          ) : null}
          {primary === 'reassign' ? (
            <Button
              label="Reassign"
              icon="swap-horizontal-outline"
              testID="action-reassign"
              onPress={() => setPickerOpen(true)}
              disabled={busy}
            />
          ) : null}
        </ActionBar>
      ) : null}

      <OverflowMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={secondary}
        testID="task-overflow-menu"
      />

      <ConfirmationDialog
        visible={pending === 'complete'}
        title="Complete task"
        message="Complete this task? The worker will no longer be able to add photos or notes."
        confirmLabel="Complete"
        loading={complete.isPending}
        onConfirm={() => run(complete, 'Task completed')}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'approve'}
        title="Approve work"
        message="Approve this work? The task will be marked complete."
        confirmLabel="Approve"
        loading={approve.isPending}
        onConfirm={() => run(approve, 'Work approved')}
        onCancel={() => setPending(null)}
      />

      <BottomSheet
        visible={changesOpen}
        title="Request changes"
        onClose={() => setChangesOpen(false)}
        testID="request-changes-sheet"
      >
        <View style={styles.sheetContent}>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.sheetBody}>
            Tell {detail.assignment.worker.name} what to put right. The task goes back to them as In
            progress.
          </Text>
          <Input
            label="What needs changing"
            required
            testID="review-note"
            value={reviewNote}
            onChangeText={setReviewNote}
            multiline
            numberOfLines={3}
            style={styles.noteInput}
          />
          <Button
            label="Send back"
            icon="arrow-undo-outline"
            testID="submit-request-changes"
            loading={requestChanges.isPending}
            disabled={reviewNote.trim().length === 0}
            onPress={() => {
              setActionError(null);
              requestChanges.mutate(reviewNote.trim(), {
                onSuccess: () => {
                  setChangesOpen(false);
                  setReviewNote('');
                  showToast('Sent back to the worker');
                },
                onError: (error: unknown) => {
                  setChangesOpen(false);
                  const message = messageFor(error);
                  setActionError(message);
                  showToast(message, 'error');
                },
              });
            }}
          />
        </View>
      </BottomSheet>

      <ConfirmationDialog
        visible={pending === 'reopen'}
        title="Reopen task"
        message={`Reopen this task? It will go back to ${detail.assignment.worker.name} as Assigned.`}
        confirmLabel="Reopen"
        loading={reopen.isPending}
        onConfirm={() => run(reopen, 'Task reopened')}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'cancel'}
        title="Cancel task"
        message="Cancel this task? This can't be undone."
        confirmLabel="Cancel task"
        cancelLabel="Keep task"
        destructive
        loading={cancel.isPending}
        onConfirm={() => run(cancel, 'Task cancelled')}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pendingWorker !== null}
        title="Reassign task"
        message={
          pendingWorker
            ? `Reassign to ${pendingWorker.name}? ${detail.assignment.worker.name} will lose access to this task.` +
              (detail.status === 'IN_PROGRESS' ? ' The task will go back to Assigned.' : '')
            : ''
        }
        confirmLabel="Reassign"
        loading={reassign.isPending}
        onConfirm={() =>
          pendingWorker &&
          run(reassign, `Task reassigned to ${pendingWorker.name}`, pendingWorker.id)
        }
        onCancel={() => setPendingWorker(null)}
      />

      <WorkerPicker
        visible={pickerOpen}
        title="Reassign to"
        disabledWorkerId={detail.status === 'REJECTED' ? null : detail.assignment.worker.id}
        onSelect={(worker) => {
          setPickerOpen(false);
          setPendingWorker(worker);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingBottom: spacing.xl, gap: spacing.md },
  padded: { flex: 1, padding: layout.screenPadding },
  // Approve and Request changes share the row: a review has two answers.
  reviewAction: { flex: 1 },
  sheetContent: { gap: spacing.md },
  sheetBody: { ...typography.secondary, color: colors.textSecondary },
  noteInput: { minHeight: 96 },
  overflowButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
