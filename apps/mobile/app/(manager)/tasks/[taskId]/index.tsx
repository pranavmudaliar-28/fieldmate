import { FIELD_LIMITS, allowedActions, type TaskDetail, type UserSummary } from '@fieldmate/shared';
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
  toneColors,
  typography,
} from '../../../../src/constants/theme';
import { WorkerPicker } from '../../../../src/features/assignments/WorkerPicker';
import { TaskDetailView } from '../../../../src/features/tasks/TaskDetailView';
import { useRequestChanges, useTask, useTaskAction } from '../../../../src/features/tasks/hooks';
import { ApiError } from '../../../../src/services/http';

type PendingAction = 'cancel' | 'reopen' | 'complete' | 'approve' | 'needsPhoto' | null;

/** Common reasons, added to the note with one tap rather than typed outside. */
const QUICK_NOTES = ['Photo is unclear', 'Missing readings'];

const messageFor = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

const firstName = (name: string) => name.split(' ')[0] ?? name;

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
        <AppHeader title="" onBack={() => router.back()} />
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
        <AppHeader title="" onBack={() => router.back()} />
        <View style={styles.padded}>
          {notAvailable ? (
            <EmptyState
              icon="help-circle-outline"
              title="This task is no longer available"
              message="It may have been removed or reassigned."
              action={{
                label: 'Go to overview',
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
  const worker = detail.assignment.worker;
  const actions = allowedActions(detail.status, 'MANAGER');
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
   * The bar holds a decision only: review, hand back a rejected task, or
   * reopen finished work. Everything else waits behind the overflow, so the
   * bar never fills with buttons that are not the point of the screen.
   */
  const primary = canReview
    ? 'approve'
    : detail.status === 'REJECTED' && actions.includes('reassign')
      ? 'reassign'
      : actions.includes('reopen')
        ? 'reopen'
        : null;

  const secondary: OverflowAction[] = [];
  if (actions.includes('edit')) {
    secondary.push({
      label: 'Edit task',
      icon: 'pencil-outline',
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
  if (actions.includes('complete')) {
    secondary.push({
      label: 'Mark as completed',
      icon: 'checkmark-done-outline',
      testID: 'action-complete',
      // Explained rather than greyed out: a disabled row says nothing about why.
      onPress: () => setPending(hasEvidence ? 'complete' : 'needsPhoto'),
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

  const addQuickNote = (text: string) =>
    setReviewNote((current) => (current.trim() ? `${current.trim()} ${text}.` : `${text}.`));

  return (
    <View style={styles.screen}>
      <AppHeader
        title=""
        onBack={() => router.back()}
        right={
          secondary.length > 0 ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="More actions"
              testID="header-overflow"
              style={({ pressed }) => [styles.overflowButton, pressed && styles.overflowPressed]}
            >
              <Icon name="ellipsis-horizontal" size={24} color={colors.textPrimary} />
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
        <TaskDetailView
          task={detail}
          perspective="manager"
          notice={
            actionError ? (
              <ErrorState message={actionError} onRetry={() => void task.refetch()} />
            ) : null
          }
        />
      </ScrollView>

      {primary ? (
        <ActionBar>
          {primary === 'approve' ? (
            <>
              <Button
                label="Request changes"
                variant="secondary"
                testID="action-request-changes"
                onPress={() => setChangesOpen(true)}
                disabled={busy}
                style={styles.reviewAction}
              />
              <Button
                label="Approve"
                icon="checkmark"
                testID="action-approve"
                onPress={() => setPending('approve')}
                disabled={busy}
                style={styles.reviewAction}
              />
            </>
          ) : null}
          {primary === 'reopen' ? (
            <Button
              label="Reopen task"
              icon="refresh"
              variant="secondary"
              testID="action-reopen"
              onPress={() => setPending('reopen')}
              disabled={busy}
              style={styles.barAction}
            />
          ) : null}
          {primary === 'reassign' ? (
            <Button
              label="Reassign"
              icon="swap-horizontal-outline"
              testID="action-reassign"
              onPress={() => setPickerOpen(true)}
              disabled={busy}
              style={styles.barAction}
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
        visible={pending === 'needsPhoto'}
        title="Can’t mark as completed yet"
        message="This task has no photos. A task needs at least one photo before it can be completed."
        confirmLabel="OK"
        cancelLabel="Close"
        icon="camera-outline"
        onConfirm={() => setPending(null)}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'complete'}
        title="Mark as completed without review?"
        message={`${firstName(worker.name)} hasn’t submitted this yet. The task moves straight to Completed and ${firstName(worker.name)} is notified. Photos and notes added so far are kept.`}
        confirmLabel="Mark as completed"
        icon="checkmark-done-outline"
        tone="success"
        loading={complete.isPending}
        onConfirm={() => run(complete, 'Task completed')}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'approve'}
        title="Approve this work?"
        message={`The task moves to Completed and ${firstName(worker.name)} is notified. You can reopen it later if something’s wrong.`}
        confirmLabel="Approve"
        confirmIcon="checkmark"
        icon="checkmark-done-outline"
        tone="success"
        loading={approve.isPending}
        onConfirm={() => run(approve, 'Task approved')}
        onCancel={() => setPending(null)}
      />

      <BottomSheet
        visible={changesOpen}
        title="Request changes"
        onClose={() => setChangesOpen(false)}
        testID="request-changes-sheet"
      >
        <View style={styles.sheetContent}>
          <View style={styles.sheetNotice}>
            <Icon name="hammer-outline" size={18} color={toneColors.warning.text} />
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.sheetNoticeText}>
              The task goes back to In progress. {firstName(worker.name)} sees your note at the top.
            </Text>
          </View>
          <Input
            label="What needs to change?"
            placeholder={`Tell ${firstName(worker.name)} what to fix or add`}
            required
            testID="review-note"
            value={reviewNote}
            onChangeText={setReviewNote}
            maxLength={FIELD_LIMITS.reviewNote}
            showCount
            multiline
            numberOfLines={4}
            style={styles.noteInput}
          />
          <View style={styles.quickNotes}>
            {QUICK_NOTES.map((text) => (
              <Pressable
                key={text}
                onPress={() => addQuickNote(text)}
                accessibilityRole="button"
                accessibilityLabel={`Add “${text}” to the note`}
                style={({ pressed }) => [styles.quickNote, pressed && styles.quickNotePressed]}
              >
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.quickNoteText}>
                  + {text}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            label={`Send to ${firstName(worker.name)}`}
            icon="send-outline"
            testID="submit-request-changes"
            loading={requestChanges.isPending}
            disabled={reviewNote.trim().length === 0}
            onPress={() => {
              setActionError(null);
              requestChanges.mutate(reviewNote.trim(), {
                onSuccess: () => {
                  setChangesOpen(false);
                  setReviewNote('');
                  showToast(`Sent back to ${firstName(worker.name)}`);
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
        title="Reopen this task?"
        message={`It goes back to ${firstName(worker.name)} as a new assignment and starts from the beginning.`}
        confirmLabel="Reopen task"
        icon="refresh"
        loading={reopen.isPending}
        onConfirm={() => run(reopen, 'Task reopened')}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pending === 'cancel'}
        title="Cancel this task?"
        message={
          detail.status === 'IN_PROGRESS'
            ? `${worker.name} is working on it right now. ${firstName(worker.name)} will be notified and the task will move to Cancelled. Photos and notes are kept. This can't be undone.`
            : `${firstName(worker.name)} will be notified and the task will move to Cancelled. This can't be undone.`
        }
        confirmLabel="Cancel task"
        cancelLabel="Keep task"
        destructive
        icon="ban-outline"
        loading={cancel.isPending}
        onConfirm={() => run(cancel, 'Task cancelled')}
        onCancel={() => setPending(null)}
      />

      <ConfirmationDialog
        visible={pendingWorker !== null}
        title={pendingWorker ? `Reassign to ${pendingWorker.name}?` : 'Reassign'}
        message={
          pendingWorker
            ? `${firstName(worker.name)} stops seeing this task. ${firstName(pendingWorker.name)} gets it as a new assignment.`
            : ''
        }
        confirmLabel="Reassign"
        icon="swap-horizontal-outline"
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
        disabledWorkerId={detail.status === 'REJECTED' ? null : worker.id}
        confirmLabel={(selected) => `Continue with ${firstName(selected.name)}`}
        onSelect={(selected) => {
          setPickerOpen(false);
          setPendingWorker(selected);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** The action bar is a row: a lone button needs flex to span it. */
  barAction: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingTop: 0, paddingBottom: spacing.xl },
  padded: { flex: 1, padding: layout.screenPadding },
  // Approve and Request changes share the row: a review has two answers.
  reviewAction: { flex: 1 },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.md },
  sheetNotice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.action,
    backgroundColor: toneColors.warning.tint,
  },
  sheetNoticeText: { ...typography.secondary, color: toneColors.warning.text, flex: 1 },
  noteInput: { minHeight: 120, textAlignVertical: 'top' },
  quickNotes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickNote: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickNotePressed: { backgroundColor: colors.surfaceMuted },
  quickNoteText: { ...typography.secondaryStrong, color: colors.textPrimary },
  overflowButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    marginRight: -spacing.smPlus,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowPressed: { backgroundColor: colors.surface },
});
