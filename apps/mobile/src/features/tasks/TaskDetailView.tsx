import type { TaskDetail } from '@fieldmate/shared';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { PhotoGrid } from '../../components/PhotoGrid';
import { StatusBadge } from '../../components/StatusBadge';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  toneColors,
  typography,
} from '../../constants/theme';
import { formatCoordinates, formatDateTime } from '../../utils/format';
import { openInMaps } from '../location/open-in-maps';

/** Read-only body of S-005 and S-008; each screen adds its own actions. */
export function TaskDetailView({
  task,
  showAssignment = true,
  showEvidence = true,
  children,
}: {
  task: TaskDetail;
  /** Managers see who holds the task; a worker only sees that it is theirs. */
  showAssignment?: boolean;
  /** Off where the screen renders its own grid with per-photo delete. */
  showEvidence?: boolean;
  children?: ReactNode;
}) {
  const coordinates = formatCoordinates(task.location.latitude, task.location.longitude);
  const hasPin = task.location.latitude !== null && task.location.longitude !== null;

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <StatusBadge status={task.status} />
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.title}
          accessibilityRole="header"
        >
          {task.title}
        </Text>
      </View>

      <Card style={styles.assignment}>
        <Avatar
          name={showAssignment ? task.assignment.worker.name : 'You'}
          variant={showAssignment ? 'muted' : 'accent'}
        />
        <View style={styles.assignmentText}>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.assignmentName}>
            {showAssignment ? task.assignment.worker.name : 'Assigned to you'}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.caption}>
            Assigned {formatDateTime(task.assignment.assignedAt)}
          </Text>
        </View>
      </Card>

      {task.assignment.rejection ? (
        <View style={styles.rejection} testID="task-rejection">
          <Icon name="close-circle" size={18} color={toneColors.error.text} />
          <View style={styles.rejectionText}>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejectionTitle}>
              Rejected {formatDateTime(task.assignment.rejection.rejectedAt)}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejectionReason}>
              “{task.assignment.rejection.reason}”
            </Text>
          </View>
        </View>
      ) : null}

      <Card style={styles.location}>
        <View style={styles.locationRow}>
          <View style={styles.locationIcon}>
            <Icon name="location-outline" size={19} color={colors.textPrimary} />
          </View>
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
            {coordinates ? (
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.caption}>
                {coordinates}
              </Text>
            ) : null}
          </View>
        </View>
        <Button
          label="Open in Maps"
          icon="navigate-outline"
          variant="secondary"
          size="md"
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

      <Section title="Description">
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
          {task.description}
        </Text>
      </Section>

      {showEvidence ? (
        <Section title={`Photos (${task.evidence.length})`}>
          <PhotoGrid photos={task.evidence} />
        </Section>
      ) : null}

      <Section title={`Notes (${task.notes.length})`}>
        {task.notes.length === 0 ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.quiet}>
            No notes yet.
          </Text>
        ) : (
          task.notes.map((note) => (
            <Card key={note.id} style={styles.note}>
              <View style={styles.noteHeader}>
                <Avatar name={note.createdBy.name} size="sm" variant="muted" />
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.caption}>
                  {note.createdBy.name} · {formatDateTime(note.createdAt)}
                </Text>
              </View>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
                {note.content}
              </Text>
            </Card>
          ))
        )}
      </Section>

      {children}

      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.caption}>
        Created {formatDateTime(task.createdAt)}
        {task.completedAt ? ` · Completed ${formatDateTime(task.completedAt)}` : ''}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={styles.sectionTitle}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  headerBlock: { gap: spacing.smPlus, alignItems: 'flex-start' },
  title: { ...typography.hero, color: colors.textPrimary },
  assignment: { flexDirection: 'row', alignItems: 'center', gap: spacing.smPlus },
  assignmentText: { flex: 1, gap: 2 },
  assignmentName: { ...typography.bodyStrong, color: colors.textPrimary },
  rejection: {
    flexDirection: 'row',
    gap: spacing.smPlus,
    backgroundColor: toneColors.error.tint,
    padding: spacing.md,
    borderRadius: radius.card,
  },
  rejectionText: { flex: 1, gap: 2 },
  rejectionTitle: { ...typography.caption, color: toneColors.error.text },
  rejectionReason: { ...typography.bodyStrong, color: toneColors.error.text },
  location: { gap: spacing.md },
  locationRow: { flexDirection: 'row', gap: spacing.smPlus },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: { flex: 1, gap: spacing.xs },
  address: { ...typography.bodyStrong, color: colors.textPrimary },
  addressDetails: { ...typography.secondary, color: colors.textSecondary },
  section: { gap: spacing.smPlus },
  sectionTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textPrimary },
  quiet: { ...typography.secondary, color: colors.textSecondary },
  caption: { ...typography.caption, color: colors.textSecondary },
  note: { gap: spacing.sm },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
