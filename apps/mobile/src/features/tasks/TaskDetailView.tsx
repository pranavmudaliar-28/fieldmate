import type { Note, TaskDetail } from '@fieldmate/shared';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { PhotoGrid } from '../../components/PhotoGrid';
import { StatusBadge } from '../../components/StatusBadge';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  tabularNumbers,
  toneColors,
  typography,
} from '../../constants/theme';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  formatTime,
} from '../../utils/format';
import { openInMaps } from '../location/open-in-maps';
import { WorkerJourney } from './WorkerJourney';

export type TaskDetailViewProps = {
  task: TaskDetail;
  /** Managers see who holds the task; a worker only sees that it is theirs. */
  perspective?: 'manager' | 'worker';
  /** Off where the screen renders its own photos and notes, with editing. */
  showWork?: boolean;
  /** Passed to the stepper: whether the last step can be taken yet. */
  canSubmit?: boolean;
  /** A screen's own message about the task, shown under the stepper. */
  notice?: ReactNode;
  /**
   * Passed only by the author's own screen, and only while the note can still
   * be changed; the controls are absent everywhere else (docs/02 F-007).
   */
  onEditNote?: (note: Note) => void;
  onDeleteNote?: (note: Note) => void;
  /** The screen's editable work, between the notices and the place. */
  children?: ReactNode;
};

/**
 * The body of S-005 and S-008: status and title, who and when, the stepper,
 * anything the reader must act on, the work so far, then where and what.
 * Each screen adds its own actions.
 */
export function TaskDetailView({
  task,
  perspective = 'manager',
  showWork = true,
  canSubmit = true,
  notice,
  onEditNote,
  onDeleteNote,
  children,
}: TaskDetailViewProps) {
  const manager = perspective === 'manager';
  const changesRequested = task.status === 'IN_PROGRESS' && task.review.note !== null;
  const subline = sublineFor(task, perspective);

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <StatusBadge
          status={task.status}
          {...(changesRequested ? { label: 'In progress · Changes requested' } : {})}
        />
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.title}
          accessibilityRole="header"
        >
          {task.title}
        </Text>

        {/* A rejected task names its worker in the hand-back card instead. */}
        {manager && !task.assignment.rejection ? (
          <View style={styles.person}>
            <Avatar name={task.assignment.worker.name} />
            <View style={styles.personText}>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.personName}>
                {task.assignment.worker.name}
              </Text>
              {subline ? (
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.subline}>
                  {subline}
                </Text>
              ) : null}
            </View>
          </View>
        ) : subline && !manager ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.subline}>
            {subline}
          </Text>
        ) : null}
      </View>

      <WorkerJourney task={task} perspective={perspective} canSubmit={canSubmit} />

      {task.assignment.rejection ? (
        <View style={[styles.callout, styles.rejection]} testID="task-rejection">
          <View style={styles.calloutHead}>
            <Avatar name={task.assignment.worker.name} />
            <View style={styles.personText}>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejectionTitle}>
                {task.assignment.worker.name} handed this back
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.subline}>
                {formatDateTime(task.assignment.rejection.rejectedAt)} ·{' '}
                {formatRelativeTime(task.assignment.rejection.rejectedAt)}
              </Text>
            </View>
          </View>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejectionReason}>
            “{task.assignment.rejection.reason}”
          </Text>
          <View style={styles.calloutHead}>
            <Icon name="alert-circle-outline" size={18} color={toneColors.error.text} />
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejectionHint}>
              Still assigned to {firstName(task.assignment.worker.name)} until you reassign
            </Text>
          </View>
        </View>
      ) : null}

      {task.review.note ? (
        <View style={[styles.callout, styles.reviewNote]} testID="task-review-note">
          <View style={styles.calloutHead}>
            <Icon name="create-outline" size={18} color={toneColors.warning.text} />
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.reviewNoteTitle}>
              {task.review.reviewedBy
                ? `${firstName(task.review.reviewedBy.name)} requested changes`
                : 'Changes requested'}
              {task.review.reviewedAt ? ` · ${formatRelativeTime(task.review.reviewedAt)}` : ''}
            </Text>
          </View>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.reviewNoteBody}>
            {task.review.note}
          </Text>
        </View>
      ) : null}

      {notice}

      {children}

      {showWork ? (
        <>
          <Section title="Photos" count={task.evidence.length}>
            <PhotoGrid photos={task.evidence} />
          </Section>
          <Section title="Notes" count={task.notes.length}>
            <NoteList
              notes={task.notes}
              {...(onEditNote ? { onEditNote } : {})}
              {...(onDeleteNote ? { onDeleteNote } : {})}
            />
          </Section>
        </>
      ) : null}

      <LocationCard task={task} />

      {task.description ? (
        <Section title={manager ? 'Description' : 'What to do'}>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
            {task.description}
          </Text>
        </Section>
      ) : null}

      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.footnote}>
        Created {formatDateTime(task.createdAt)}
        {task.completedAt ? ` · Completed ${formatDateTime(task.completedAt)}` : ''}
      </Text>
    </View>
  );
}

/** Notes as cards: the words first, then who and when, and "edited" if so. */
export function NoteList({
  notes,
  onEditNote,
  onDeleteNote,
}: {
  notes: Note[];
  onEditNote?: (note: Note) => void;
  onDeleteNote?: (note: Note) => void;
}) {
  if (notes.length === 0) {
    return (
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.quiet}>
        No notes yet.
      </Text>
    );
  }

  return (
    <View style={styles.notes}>
      {notes.map((note) => (
        <Card key={note.id} style={styles.note} testID={`note-${note.id}`}>
          <View style={styles.noteRow}>
            <View style={styles.noteText}>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
                {note.content}
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.noteMeta}>
                {firstName(note.createdBy.name)} · {formatTime(note.createdAt)}
                {/* An edit is never silent: notes were append-only for this. */}
                {note.updatedAt ? ' · edited' : ''}
              </Text>
            </View>
            {onEditNote ? (
              <Pressable
                onPress={() => onEditNote(note)}
                accessibilityRole="button"
                accessibilityLabel="Edit your note"
                testID={`edit-note-${note.id}`}
                style={styles.noteAction}
              >
                <Icon name="pencil-outline" size={20} color={colors.textPrimary} />
              </Pressable>
            ) : null}
            {onDeleteNote ? (
              <Pressable
                onPress={() => onDeleteNote(note)}
                accessibilityRole="button"
                accessibilityLabel="Delete your note"
                testID={`delete-note-${note.id}`}
                style={styles.noteAction}
              >
                <Icon name="trash-outline" size={20} color={colors.errorText} />
              </Pressable>
            ) : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

/** A section heading with an optional "· n" count and an action on the right. */
export function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.sectionTitle}
          accessibilityRole="header"
        >
          {title}
          {count !== undefined ? <Text style={styles.sectionCount}> · {count}</Text> : null}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function LocationCard({ task }: { task: TaskDetail }) {
  const hasPin = task.location.latitude !== null && task.location.longitude !== null;

  return (
    <Card style={styles.location}>
      <View style={styles.locationRow}>
        <Icon name="location-outline" size={22} color={colors.textPrimary} />
        <View style={styles.locationText}>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.address}>
            {task.location.address}
          </Text>
          {task.location.addressDetails ? (
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.addressDetails}
              testID="address-details"
            >
              {task.location.addressDetails}
            </Text>
          ) : null}
        </View>
      </View>
      <Button
        label="Open in Maps"
        icon="open-outline"
        variant="secondary"
        size="md"
        fullWidth={false}
        testID="open-in-maps"
        onPress={() =>
          openInMaps(
            task.location.address,
            hasPin
              ? {
                  latitude: task.location.latitude as number,
                  longitude: task.location.longitude as number,
                }
              : null,
          )
        }
      />
    </Card>
  );
}

/** One line under the title that says where the task stands, from its own stamps. */
function sublineFor(task: TaskDetail, perspective: 'manager' | 'worker'): string | null {
  const { progress, review, assignment } = task;
  const relative = (iso: string | null) => (iso ? formatRelativeTime(iso) : '');

  if (perspective === 'worker') {
    switch (task.status) {
      case 'ASSIGNED':
        return `Assigned ${relative(assignment.assignedAt)}`;
      case 'ACCEPTED':
        return `Accepted ${relative(progress.acceptedAt)}`;
      case 'GOING_TO_LOCATION':
      case 'REACHED_LOCATION':
        return [task.location.address, task.location.addressDetails].filter(Boolean).join(' · ');
      case 'AWAITING_REVIEW':
        return review.submittedAt ? `Submitted ${formatDateTime(review.submittedAt)}` : null;
      case 'COMPLETED':
        return `Approved ${formatDate(task.completedAt ?? task.updatedAt)}`;
      default:
        return null;
    }
  }

  switch (task.status) {
    case 'ASSIGNED':
      return `Assigned ${relative(assignment.assignedAt)} · not accepted yet`;
    case 'ACCEPTED':
      return `Accepted ${relative(progress.acceptedAt)}`;
    case 'GOING_TO_LOCATION':
      return `Set off ${relative(progress.departedAt)}`;
    case 'REACHED_LOCATION':
      return `Arrived ${relative(progress.arrivedAt)}`;
    case 'IN_PROGRESS':
      return `Started work ${relative(progress.startedAt)}`;
    case 'AWAITING_REVIEW': {
      const onSite = formatDuration(progress.startedAt, review.submittedAt);
      return [`Submitted ${relative(review.submittedAt)}`, onSite ? `${onSite} on site` : null]
        .filter(Boolean)
        .join(' · ');
    }
    case 'COMPLETED':
      return review.reviewedBy && review.reviewedAt
        ? `Approved by ${review.reviewedBy.name} · ${formatDateTime(review.reviewedAt)}`
        : `Completed ${formatDateTime(task.completedAt ?? task.updatedAt)}`;
    case 'REJECTED':
      return assignment.rejection
        ? `Handed back ${relative(assignment.rejection.rejectedAt)}`
        : null;
    default:
      return null;
  }
}

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

const styles = StyleSheet.create({
  container: { gap: spacing.mdPlus },
  headerBlock: { gap: spacing.smPlus, alignItems: 'flex-start' },
  title: { ...typography.display, color: colors.textPrimary },
  subline: { ...typography.secondary, color: colors.textSecondary },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.smPlus },
  personText: { flexShrink: 1, gap: 2 },
  personName: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  callout: { padding: spacing.md, borderRadius: radius.card, borderWidth: 1.5, gap: spacing.sm },
  calloutHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rejection: { backgroundColor: colors.surface, borderColor: colors.error, gap: spacing.smPlus },
  rejectionTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  rejectionReason: { ...typography.body, fontSize: 18, lineHeight: 27, color: colors.textPrimary },
  rejectionHint: { ...typography.secondaryStrong, color: toneColors.error.text, flex: 1 },
  /**
   * What the manager asked to be put right. Warning rather than error: the work
   * was done, it just needs another pass.
   */
  reviewNote: { backgroundColor: colors.warningTint, borderColor: toneColors.warning.dot },
  reviewNoteTitle: { ...typography.secondaryStrong, color: toneColors.warning.text, flex: 1 },
  reviewNoteBody: { ...typography.body, color: colors.textPrimary },
  location: { gap: spacing.md, padding: spacing.mdPlus },
  locationRow: { flexDirection: 'row', gap: spacing.smPlus },
  locationText: { flex: 1, gap: 2 },
  address: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  addressDetails: { ...typography.secondary, color: colors.textSecondary },
  section: { gap: spacing.smPlus },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
  },
  sectionTitle: { ...typography.cardTitle, fontSize: 20, color: colors.textPrimary, flexShrink: 1 },
  sectionCount: { color: colors.textSecondary, ...tabularNumbers },
  body: { ...typography.body, color: colors.textPrimary },
  quiet: { ...typography.secondary, color: colors.textSecondary },
  footnote: { ...typography.caption, color: colors.textTertiary },
  notes: { gap: spacing.smPlus },
  note: { paddingVertical: spacing.smPlus },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  noteText: { flex: 1, gap: spacing.xs },
  noteMeta: { ...typography.mono, color: colors.textSecondary },
  noteAction: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    marginVertical: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
