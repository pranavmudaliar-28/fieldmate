import { allowedActions, type Evidence } from '@fieldmate/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../../../../src/components/ActionBar';
import { BottomSheet } from '../../../../src/components/BottomSheet';
import { Button } from '../../../../src/components/Button';
import { ConfirmationDialog } from '../../../../src/components/ConfirmationDialog';
import { Input } from '../../../../src/components/Input';
import { PhotoGrid } from '../../../../src/components/PhotoGrid';
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
import { useAuth } from '../../../../src/features/auth/auth-context';
import { TaskDetailView } from '../../../../src/features/tasks/TaskDetailView';
import { useTask } from '../../../../src/features/tasks/hooks';
import {
  useAddNote,
  useDeleteEvidence,
  useRejectTask,
  useStartTask,
} from '../../../../src/features/tasks/worker-hooks';
import { ApiError } from '../../../../src/services/http';
import { formatDateTime } from '../../../../src/utils/format';

const EVIDENCE_HINT = 'At least 1 photo is required to complete this task.';

/** S-008 Worker Task Details: start, reject, photos, notes and completion. */
export default function WorkerTaskDetails() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const task = useTask(taskId);

  const start = useStartTask(taskId);
  const reject = useRejectTask(taskId);
  const addNote = useAddNote(taskId);
  const deleteEvidence = useDeleteEvidence(taskId);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);
  const [note, setNote] = useState('');
  const [photoToDelete, setPhotoToDelete] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (actionError: unknown) => {
    const message =
      actionError instanceof ApiError
        ? actionError.message
        : 'Something went wrong. Please try again.';
    setError(message);
    showToast(message, 'error');
    void task.refetch();
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
    const gone = task.error instanceof ApiError && [403, 404].includes(task.error.status ?? 0);
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Task details' }} />
        {gone ? (
          <EmptyState
            title="This task is no longer available"
            message="It may have been reassigned or cancelled."
            action={{ label: 'Go to dashboard', onPress: () => router.replace('/(worker)') }}
          />
        ) : (
          <ErrorState message="Couldn't load this task." onRetry={() => void task.refetch()} />
        )}
      </>
    );
  }

  const detail = task.data;
  const actions = allowedActions(detail.status, 'FIELD_WORKER');
  const inProgress = detail.status === 'IN_PROGRESS';
  const hasEvidence = detail.evidence.length > 0;
  const busy = start.isPending || reject.isPending || addNote.isPending || deleteEvidence.isPending;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: 'Task details' }} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={task.isRefetching} onRefresh={() => void task.refetch()} />
        }
      >
        <TaskDetailView task={detail} showAssignment={false} />

        <View style={styles.section}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            Your photos
          </Text>
          <PhotoGrid
            photos={detail.evidence}
            currentUserId={user?.id}
            {...(inProgress ? { onDelete: setPhotoToDelete } : {})}
          />
          {inProgress ? (
            <Button
              label="Add photo"
              variant="secondary"
              testID="add-photo"
              onPress={() => router.push(`/(worker)/tasks/${taskId}/evidence`)}
            />
          ) : null}
        </View>

        {inProgress ? (
          <View style={styles.section}>
            <Input
              label="Add a note"
              testID="note-input"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              style={styles.noteInput}
              editable={!addNote.isPending}
            />
            <Button
              label="Add note"
              variant="secondary"
              size="md"
              testID="add-note"
              disabled={note.trim().length === 0}
              loading={addNote.isPending}
              onPress={() =>
                addNote.mutate(note.trim(), {
                  onSuccess: () => {
                    setNote('');
                    setError(null);
                    showToast('Note added');
                  },
                  onError: fail,
                })
              }
            />
          </View>
        ) : null}

        {detail.status === 'COMPLETED' ? (
          <View style={styles.completedBanner} testID="completed-banner">
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.completedText}>
              You completed this task on {formatDateTime(detail.completedAt ?? detail.updatedAt)}.
            </Text>
          </View>
        ) : null}

        {error ? <ErrorState message={error} onRetry={() => void task.refetch()} /> : null}
      </ScrollView>

      {actions.length > 0 ? (
        <ActionBar hint={inProgress && !hasEvidence ? EVIDENCE_HINT : undefined}>
          {actions.includes('reject') ? (
            <Button
              label="Reject"
              variant="secondary"
              testID="action-reject"
              onPress={() => setRejectOpen(true)}
              disabled={busy}
              style={styles.action}
            />
          ) : null}

          {actions.includes('start') ? (
            <Button
              label="Start task"
              testID="action-start"
              loading={start.isPending}
              disabled={busy}
              onPress={() =>
                start.mutate(undefined, {
                  onSuccess: () => {
                    setError(null);
                    showToast('Task started');
                  },
                  onError: fail,
                })
              }
              style={styles.action}
            />
          ) : null}

          {actions.includes('complete') ? (
            <Button
              label="Complete task"
              testID="action-complete"
              disabled={!hasEvidence || busy}
              disabledReason={EVIDENCE_HINT}
              onPress={() => router.push(`/(worker)/tasks/${taskId}/complete`)}
              style={styles.action}
            />
          ) : null}
        </ActionBar>
      ) : null}

      <BottomSheet
        visible={rejectOpen}
        title="Reject task"
        onClose={() => setRejectOpen(false)}
        testID="reject-sheet"
      >
        <View style={styles.sheetContent}>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.sheetBody}>
            Tell your manager why you can&apos;t do this task.
          </Text>
          <Input
            label="Reason"
            required
            testID="reject-reason"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            style={styles.noteInput}
          />
          <Button
            label="Reject task"
            variant="destructive"
            testID="submit-reject"
            disabled={reason.trim().length === 0}
            onPress={() => {
              setRejectOpen(false);
              setConfirmReject(true);
            }}
          />
        </View>
      </BottomSheet>

      <ConfirmationDialog
        visible={confirmReject}
        title="Reject task"
        message="Reject this task? It will be removed from your list."
        confirmLabel="Reject task"
        cancelLabel="Keep task"
        destructive
        loading={reject.isPending}
        onConfirm={() =>
          reject.mutate(reason.trim(), {
            onSuccess: () => {
              setConfirmReject(false);
              showToast('Task rejected');
              router.replace('/(worker)');
            },
            onError: (rejectError) => {
              setConfirmReject(false);
              fail(rejectError);
            },
          })
        }
        onCancel={() => setConfirmReject(false)}
      />

      <ConfirmationDialog
        visible={photoToDelete !== null}
        title="Delete photo"
        message="Delete this photo? This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep photo"
        destructive
        loading={deleteEvidence.isPending}
        onConfirm={() =>
          photoToDelete &&
          deleteEvidence.mutate(photoToDelete.id, {
            onSuccess: () => {
              setPhotoToDelete(null);
              setError(null);
              showToast('Photo deleted');
            },
            onError: (deleteError) => {
              setPhotoToDelete(null);
              fail(deleteError);
            },
          })
        }
        onCancel={() => setPhotoToDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingBottom: spacing.xl, gap: spacing.lg },
  padded: { flex: 1, padding: layout.screenPadding, backgroundColor: colors.background },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  action: { flex: 1 },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.md },
  sheetBody: { ...typography.body, color: colors.textSecondary },
  completedBanner: {
    backgroundColor: toneColors.success.tint,
    padding: spacing.md,
    borderRadius: spacing.sm,
  },
  completedText: { ...typography.body, color: toneColors.success.text },
});
