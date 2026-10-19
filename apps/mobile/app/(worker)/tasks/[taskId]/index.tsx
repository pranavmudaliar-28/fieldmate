import {
  FIELD_LIMITS,
  allowedActions,
  nextWorkerStep,
  type Evidence,
  type Note,
} from '@fieldmate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../../../../src/components/ActionBar';
import { AppHeader } from '../../../../src/components/AppHeader';
import { BottomSheet } from '../../../../src/components/BottomSheet';
import { Button } from '../../../../src/components/Button';
import { ChoiceList } from '../../../../src/components/ChoiceList';
import { ConfirmationDialog } from '../../../../src/components/ConfirmationDialog';
import { Icon } from '../../../../src/components/Icon';
import { Input } from '../../../../src/components/Input';
import { PhotoGrid } from '../../../../src/components/PhotoGrid';
import { EmptyState, ErrorState, LoadingState } from '../../../../src/components/States';
import { useToast } from '../../../../src/components/Toast';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  statusAppearance,
  toneColors,
  typography,
  type IconName,
} from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/features/auth/auth-context';
import { PendingWrites } from '../../../../src/features/offline/PendingWrites';
import { NoteList, Section, TaskDetailView } from '../../../../src/features/tasks/TaskDetailView';
import { useTask } from '../../../../src/features/tasks/hooks';
import {
  useAddNote,
  useAdvanceTask,
  useDeleteEvidence,
  useDeleteNote,
  useRejectTask,
  useStepBack,
  useUpdateNote,
} from '../../../../src/features/tasks/worker-hooks';
import { WORKER_STEP_UI } from '../../../../src/features/tasks/worker-steps';
import { ApiError } from '../../../../src/services/http';
import { formatTime } from '../../../../src/utils/format';

const EVIDENCE_HINT = 'Add at least 1 photo to submit for review.';

type RejectChoice = 'clash' | 'access' | 'parts' | 'skills' | 'other';

/**
 * The reasons a worker usually has. The API keeps one free-text reason, so
 * the choice and any details are joined into it.
 */
const REJECT_CHOICES: { value: RejectChoice; label: string; testID: string }[] = [
  { value: 'clash', label: 'Clashes with another job', testID: 'reject-choice-clash' },
  { value: 'access', label: 'Can’t get access to the site', testID: 'reject-choice-access' },
  { value: 'parts', label: 'Missing parts or tools', testID: 'reject-choice-parts' },
  { value: 'skills', label: 'Outside my skills', testID: 'reject-choice-skills' },
  { value: 'other', label: 'Other', testID: 'reject-choice-other' },
];

function rejectionReason(choice: RejectChoice | null, details: string): string {
  const preset = REJECT_CHOICES.find((option) => option.value === choice && choice !== 'other');
  const extra = details.trim();
  if (preset && extra) return `${preset.label}: ${extra}`;
  return preset?.label ?? extra;
}

/** S-008 Worker Task Details: the next step, photos, notes and submitting. */
export default function WorkerTaskDetails() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const task = useTask(taskId);

  const advance = useAdvanceTask(taskId);
  const stepBack = useStepBack(taskId);
  const reject = useRejectTask(taskId);
  const addNote = useAddNote(taskId);
  const updateNote = useUpdateNote(taskId);
  const deleteNote = useDeleteNote(taskId);
  const deleteEvidence = useDeleteEvidence(taskId);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectChoice, setRejectChoice] = useState<RejectChoice | null>(null);
  const [rejectDetails, setRejectDetails] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
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
      <View style={styles.screen}>
        <AppHeader title="" onBack={() => router.back()} />
        <View style={styles.padded}>
          <LoadingState variant="detail" />
        </View>
      </View>
    );
  }

  if (task.isError) {
    const gone = task.error instanceof ApiError && [403, 404].includes(task.error.status ?? 0);
    return (
      <View style={styles.screen}>
        <AppHeader title="" onBack={() => router.back()} />
        {gone ? (
          <EmptyState
            icon="help-circle-outline"
            title="This task is no longer available"
            message="It may have been reassigned or cancelled."
            action={{ label: 'Go to home', onPress: () => router.replace('/(worker)/(tabs)') }}
          />
        ) : (
          <View style={styles.padded}>
            <ErrorState message="Couldn't load this task." onRetry={() => void task.refetch()} />
          </View>
        )}
      </View>
    );
  }

  const detail = task.data;
  const actions = allowedActions(detail.status, 'FIELD_WORKER');
  // Only the author's own notes, and only while the task is still theirs to work on.
  const canEditNotes = actions.includes('editNote');
  const inProgress = detail.status === 'IN_PROGRESS';
  const hasEvidence = detail.evidence.length > 0;
  const step = nextWorkerStep(detail.status);
  const canStepBack = actions.includes('stepBack');
  const canReject = actions.includes('reject');
  const canSubmit = actions.includes('submitForReview');
  const finished = detail.status === 'AWAITING_REVIEW' || detail.status === 'COMPLETED';
  const busy =
    advance.isPending ||
    stepBack.isPending ||
    reject.isPending ||
    addNote.isPending ||
    deleteEvidence.isPending;
  const reason = rejectionReason(rejectChoice, rejectDetails);

  const takeStep = () => {
    if (!step) return;
    advance.mutate(step, {
      onSuccess: () => {
        setError(null);
        showToast(WORKER_STEP_UI[step].done);
      },
      onError: fail,
    });
  };

  const undo = () =>
    stepBack.mutate(undefined, {
      onSuccess: () => {
        setError(null);
        showToast('Step undone');
      },
      onError: fail,
    });

  const undoButton = canStepBack ? (
    <Button
      label="Undo last step"
      variant="ghost"
      size="md"
      icon="arrow-undo-outline"
      fullWidth={false}
      testID="action-step-back"
      disabled={busy}
      loading={stepBack.isPending}
      onPress={undo}
    />
  ) : null;

  return (
    <View style={styles.screen}>
      <AppHeader title="" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={task.isRefetching} onRefresh={() => void task.refetch()} />
        }
      >
        {/* Above the task itself: what is on this phone and not yet on the
            server changes how everything below it should be read. */}
        <PendingWrites taskId={taskId} />

        <TaskDetailView
          task={detail}
          perspective="worker"
          showWork={finished}
          canSubmit={hasEvidence}
          notice={
            <>
              {detail.status === 'REACHED_LOCATION' ? (
                <Callout icon="camera-outline" testID="before-photo-tip">
                  Tip: take a “before” photo once you start work. You need at least one photo to
                  submit.
                </Callout>
              ) : null}
              {detail.status === 'AWAITING_REVIEW' ? (
                <Callout
                  icon="lock-closed-outline"
                  title="Locked while your manager reviews"
                  palette={statusAppearance.AWAITING_REVIEW}
                  testID="awaiting-review-banner"
                >
                  Photos and notes can’t be changed. If changes are needed, the task comes back to
                  you.
                </Callout>
              ) : null}
              {detail.status === 'COMPLETED' ? (
                <View style={styles.approved} testID="completed-banner">
                  <View style={styles.approvedMark}>
                    <Icon name="checkmark" size={22} color={colors.onPrimary} />
                  </View>
                  <Text
                    maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                    style={styles.approvedText}
                  >
                    Your work was approved. Nothing left to do.
                  </Text>
                </View>
              ) : null}
              {error ? <ErrorState message={error} onRetry={() => void task.refetch()} /> : null}
            </>
          }
        >
          {inProgress ? (
            <>
              <Section
                title="Photos"
                count={detail.evidence.length}
                action={
                  hasEvidence ? (
                    <Button
                      label="Add photo"
                      icon="camera-outline"
                      size="md"
                      fullWidth={false}
                      testID="add-photo"
                      onPress={() => router.push(`/(worker)/tasks/${taskId}/evidence`)}
                    />
                  ) : null
                }
              >
                {hasEvidence ? (
                  <PhotoGrid
                    photos={detail.evidence}
                    currentUserId={user?.id}
                    onDelete={setPhotoToDelete}
                  />
                ) : (
                  <Pressable
                    onPress={() => router.push(`/(worker)/tasks/${taskId}/evidence`)}
                    accessibilityRole="button"
                    accessibilityLabel="Add your first photo, from the camera or gallery"
                    testID="add-photo"
                    style={({ pressed }) => [
                      styles.firstPhoto,
                      pressed && styles.firstPhotoPressed,
                    ]}
                  >
                    <View style={styles.firstPhotoMark}>
                      <Icon name="camera-outline" size={30} color={colors.onAccent} />
                    </View>
                    <Text
                      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                      style={styles.firstPhotoTitle}
                    >
                      Add your first photo
                    </Text>
                    <Text
                      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                      style={styles.firstPhotoHint}
                    >
                      Camera or gallery
                    </Text>
                  </Pressable>
                )}
              </Section>

              <Section
                title="Notes"
                count={detail.notes.length}
                action={
                  <Button
                    label="Add note"
                    icon="add"
                    variant="secondary"
                    size="md"
                    fullWidth={false}
                    testID="add-note"
                    onPress={() => setNoteOpen(true)}
                  />
                }
              >
                {detail.notes.length === 0 ? (
                  <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.quiet}>
                    No notes yet. Add anything the manager should know.
                  </Text>
                ) : (
                  <NoteList
                    notes={detail.notes}
                    {...(canEditNotes
                      ? {
                          onEditNote: (target: Note) => {
                            setEditDraft(target.content);
                            setEditingNote(target);
                          },
                          onDeleteNote: setDeletingNote,
                        }
                      : {})}
                  />
                )}
              </Section>
            </>
          ) : null}
        </TaskDetailView>
      </ScrollView>

      {step === 'accept' ? (
        <ActionBar>
          {canReject ? (
            <Button
              label="Reject"
              variant="destructiveOutline"
              testID="action-reject"
              onPress={() => setRejectOpen(true)}
              disabled={busy}
              style={styles.reject}
            />
          ) : null}
          <Button
            label={WORKER_STEP_UI.accept.label}
            icon={WORKER_STEP_UI.accept.icon}
            variant="signal"
            testID="action-accept"
            loading={advance.isPending}
            disabled={busy}
            onPress={takeStep}
            style={styles.grow}
          />
        </ActionBar>
      ) : null}

      {step && step !== 'accept' ? (
        <ActionBar>
          <View style={styles.stack}>
            <Button
              label={WORKER_STEP_UI[step].label}
              icon={WORKER_STEP_UI[step].icon}
              variant="signal"
              testID={`action-${step}`}
              loading={advance.isPending}
              disabled={busy}
              onPress={takeStep}
            />
            <View style={styles.secondaryRow}>
              {undoButton ?? <View />}
              {canReject ? (
                <Button
                  label="Reject task"
                  variant="destructiveGhost"
                  size="md"
                  fullWidth={false}
                  testID="action-reject"
                  disabled={busy}
                  onPress={() => setRejectOpen(true)}
                  style={styles.rejectLink}
                />
              ) : null}
            </View>
          </View>
        </ActionBar>
      ) : null}

      {canSubmit ? (
        <ActionBar {...(hasEvidence ? {} : { hint: EVIDENCE_HINT })}>
          <View style={styles.stack}>
            <Button
              label="Submit for review"
              icon={hasEvidence ? 'send-outline' : 'lock-closed-outline'}
              variant="signal"
              testID="action-complete"
              disabled={!hasEvidence || busy}
              disabledReason={EVIDENCE_HINT}
              onPress={() => router.push(`/(worker)/tasks/${taskId}/complete`)}
            />
            {undoButton ? <View style={styles.centerRow}>{undoButton}</View> : null}
          </View>
        </ActionBar>
      ) : null}

      <BottomSheet
        visible={noteOpen}
        title="Add note"
        onClose={() => setNoteOpen(false)}
        testID="add-note-sheet"
      >
        <View style={styles.sheetContent}>
          <Input
            label="Note for your manager"
            placeholder="What did you find or do?"
            testID="note-input"
            value={note}
            onChangeText={setNote}
            maxLength={FIELD_LIMITS.note}
            showCount
            multiline
            numberOfLines={4}
            style={styles.noteInput}
            editable={!addNote.isPending}
          />
          <Button
            label="Save note"
            testID="save-new-note"
            disabled={note.trim().length === 0}
            loading={addNote.isPending}
            onPress={() =>
              addNote.mutate(note.trim(), {
                onSuccess: () => {
                  setNote('');
                  setNoteOpen(false);
                  setError(null);
                  showToast('Note added');
                },
                onError: (noteError) => {
                  setNoteOpen(false);
                  fail(noteError);
                },
              })
            }
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={editingNote !== null}
        title="Edit note"
        onClose={() => setEditingNote(null)}
        testID="edit-note-sheet"
      >
        <View style={styles.sheetContent}>
          <Input
            label={editingNote ? `Note · added ${formatTime(editingNote.createdAt)}` : 'Note'}
            required
            helper="Saved changes show an “edited” label to your manager."
            testID="edit-note-input"
            value={editDraft}
            onChangeText={setEditDraft}
            maxLength={FIELD_LIMITS.note}
            multiline
            numberOfLines={4}
            style={styles.noteInput}
          />
          <Button
            label="Save changes"
            testID="save-note"
            loading={updateNote.isPending}
            disabled={editDraft.trim().length === 0}
            onPress={() => {
              const target = editingNote;
              if (!target) return;
              updateNote.mutate(
                { noteId: target.id, content: editDraft.trim() },
                {
                  onSuccess: () => {
                    setEditingNote(null);
                    showToast('Note updated');
                  },
                  onError: () => {
                    setEditingNote(null);
                    showToast("Couldn't update that note.", 'error');
                  },
                },
              );
            }}
          />
        </View>
      </BottomSheet>

      <ConfirmationDialog
        visible={deletingNote !== null}
        title="Delete this note?"
        message={deletingNote ? `“${snippet(deletingNote.content)}” This can't be undone.` : ''}
        confirmLabel="Delete note"
        cancelLabel="Keep note"
        destructive
        icon="trash-outline"
        loading={deleteNote.isPending}
        onConfirm={() => {
          const target = deletingNote;
          if (!target) return;
          deleteNote.mutate(target.id, {
            onSuccess: () => {
              setDeletingNote(null);
              showToast('Note deleted');
            },
            onError: () => {
              setDeletingNote(null);
              showToast("Couldn't delete that note.", 'error');
            },
          });
        }}
        onCancel={() => setDeletingNote(null)}
      />

      <BottomSheet
        visible={rejectOpen}
        title="Why can’t you take this?"
        onClose={() => setRejectOpen(false)}
        testID="reject-sheet"
      >
        <View style={styles.sheetContent}>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.sheetBody}>
            Your manager gets your reason and can reassign the task.
          </Text>
          <ChoiceList
            choices={REJECT_CHOICES}
            selected={rejectChoice}
            onSelect={setRejectChoice}
            accessibilityLabel="Reason"
          />
          <Input
            label={rejectChoice === 'other' ? 'Details' : 'Details · optional'}
            testID="reject-reason"
            value={rejectDetails}
            onChangeText={setRejectDetails}
            maxLength={FIELD_LIMITS.rejectionReason}
            multiline
            numberOfLines={2}
            style={styles.detailsInput}
          />
          <Button
            label="Reject and hand back"
            icon="arrow-undo-outline"
            variant="destructive"
            testID="submit-reject"
            disabled={reason.length === 0}
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
        icon="arrow-undo-outline"
        loading={reject.isPending}
        onConfirm={() =>
          reject.mutate(reason, {
            onSuccess: () => {
              setConfirmReject(false);
              showToast('Task rejected');
              router.replace('/(worker)/(tabs)');
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
        icon="trash-outline"
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

/** A quiet card with an icon: a tip, or why the task is locked. */
function Callout({
  icon,
  title,
  palette,
  children,
  testID,
}: {
  icon: IconName;
  title?: string;
  palette?: { text: string };
  children: string;
  testID?: string;
}) {
  const accent = palette?.text ?? colors.textPrimary;
  return (
    <View style={[styles.callout, palette ? { borderColor: accent } : null]} testID={testID}>
      <Icon name={icon} size={22} color={accent} />
      <View style={styles.calloutText}>
        {title ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.calloutTitle}>
            {title}
          </Text>
        ) : null}
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={title ? styles.calloutBody : styles.calloutBodyStrong}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

function snippet(text: string): string {
  return text.length > 80 ? `${text.slice(0, 80).trimEnd()}…` : text;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingTop: 0, paddingBottom: spacing.xl },
  padded: { flex: 1, padding: layout.screenPadding, backgroundColor: colors.background },
  quiet: { ...typography.secondary, color: colors.textSecondary },
  noteInput: { minHeight: 120, textAlignVertical: 'top' },
  detailsInput: { minHeight: 64, textAlignVertical: 'top' },
  grow: { flex: 1 },
  reject: { flex: 0.6 },
  stack: { flex: 1, gap: spacing.xs },
  secondaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  centerRow: { alignItems: 'center' },
  rejectLink: { marginRight: -spacing.md },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.md },
  sheetBody: { ...typography.body, color: colors.textSecondary },
  firstPhoto: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  firstPhotoPressed: { backgroundColor: colors.surfaceMuted },
  firstPhotoMark: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  firstPhotoTitle: { ...typography.cardTitle, color: colors.textPrimary },
  firstPhotoHint: { ...typography.secondary, color: colors.textSecondary },
  callout: {
    flexDirection: 'row',
    gap: spacing.smPlus,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  calloutText: { flex: 1, gap: 2 },
  calloutTitle: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  calloutBody: { ...typography.secondary, fontSize: 15, color: colors.textSecondary },
  calloutBodyStrong: { ...typography.body, color: colors.textPrimary },
  approved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: toneColors.success.tint,
  },
  approvedMark: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: toneColors.success.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvedText: { ...typography.bodyStrong, fontSize: 17, color: toneColors.success.text, flex: 1 },
});
