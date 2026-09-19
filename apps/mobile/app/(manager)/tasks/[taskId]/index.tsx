import { allowedActions, type TaskDetail, type UserSummary } from '@fieldmate/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActionBar } from '../../../../src/components/ActionBar';
import { Button } from '../../../../src/components/Button';
import { ConfirmationDialog } from '../../../../src/components/ConfirmationDialog';
import { EmptyState, ErrorState, LoadingState } from '../../../../src/components/States';
import { useToast } from '../../../../src/components/Toast';
import { colors, layout, spacing } from '../../../../src/constants/theme';
import { WorkerPicker } from '../../../../src/features/assignments/WorkerPicker';
import { TaskDetailView } from '../../../../src/features/tasks/TaskDetailView';
import { useTask, useTaskAction } from '../../../../src/features/tasks/hooks';
import { ApiError } from '../../../../src/services/http';

type PendingAction = 'cancel' | 'reopen' | 'complete' | null;

const EVIDENCE_HINT = 'At least 1 photo is required to complete this task.';

/** S-005 Task Details for managers, with the actions allowed in each status. */
export default function ManagerTaskDetails() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const task = useTask(taskId);

  const [pending, setPending] = useState<PendingAction>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingWorker, setPendingWorker] = useState<UserSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const cancel = useTaskAction(taskId, 'cancel');
  const reopen = useTaskAction(taskId, 'reopen');
  const complete = useTaskAction(taskId, 'complete');
  const reassign = useTaskAction(taskId, 'reassign');

  const run = (mutation: typeof cancel, successMessage: string, workerId?: string) => {
    setActionError(null);
    mutation.mutate(workerId, {
      onSuccess: () => {
        showToast(successMessage);
        setPending(null);
        setPendingWorker(null);
      },
      onError: (error) => {
        const message =
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
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
      <View style={styles.padded}>
        <Stack.Screen options={{ headerShown: true, title: 'Task details' }} />
        <LoadingState variant="detail" />
      </View>
    );
  }

  if (task.isError) {
    const notAvailable =
      task.error instanceof ApiError && (task.error.status === 404 || task.error.status === 403);
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Task details' }} />
        {notAvailable ? (
          <EmptyState
            title="This task is no longer available"
            message="It may have been removed or reassigned."
            action={{ label: 'Go to dashboard', onPress: () => router.replace('/(manager)') }}
          />
        ) : (
          <ErrorState message="Couldn't load this task." onRetry={() => void task.refetch()} />
        )}
      </>
    );
  }

  const detail: TaskDetail = task.data;
  const actions = allowedActions(detail.status, 'MANAGER');
  const canComplete = actions.includes('complete');
  const hasEvidence = detail.evidence.length > 0;
  const busy = cancel.isPending || reopen.isPending || complete.isPending || reassign.isPending;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: 'Task details' }} />

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

      {actions.length > 0 ? (
        <ActionBar hint={canComplete && !hasEvidence ? EVIDENCE_HINT : undefined}>
          {canComplete ? (
            <Button
              label="Complete task"
              testID="action-complete"
              onPress={() => setPending('complete')}
              disabled={!hasEvidence || busy}
              disabledReason={EVIDENCE_HINT}
              style={styles.action}
            />
          ) : null}

          {actions.includes('reopen') ? (
            <Button
              label="Reopen task"
              testID="action-reopen"
              onPress={() => setPending('reopen')}
              disabled={busy}
              style={styles.action}
            />
          ) : null}

          {actions.includes('reassign') ? (
            <Button
              label="Reassign"
              variant={canComplete ? 'secondary' : 'primary'}
              testID="action-reassign"
              onPress={() => setPickerOpen(true)}
              disabled={busy}
              style={styles.action}
            />
          ) : null}

          {actions.includes('edit') ? (
            <Button
              label="Edit"
              variant="secondary"
              testID="action-edit"
              onPress={() => router.push(`/(manager)/tasks/${taskId}/edit`)}
              disabled={busy}
              style={styles.action}
            />
          ) : null}

          {actions.includes('cancel') ? (
            <Button
              label="Cancel task"
              variant="destructive"
              testID="action-cancel"
              onPress={() => setPending('cancel')}
              disabled={busy}
              style={styles.action}
            />
          ) : null}
        </ActionBar>
      ) : null}

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
  padded: { flex: 1, padding: layout.screenPadding, backgroundColor: colors.background },
  action: { flex: 1, minWidth: 120 },
});
