import type { TaskDetail } from '@fieldmate/shared';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
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
  children,
}: {
  task: TaskDetail;
  /** Managers see who holds the task; a worker only sees that it is theirs. */
  showAssignment?: boolean;
  children?: ReactNode;
}) {
  const coordinates = formatCoordinates(task.location.latitude, task.location.longitude);

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.title}
          accessibilityRole="header"
        >
          {task.title}
        </Text>
        <StatusBadge status={task.status} />
      </View>

      <Section title="Description">
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
          {task.description}
        </Text>
      </Section>

      <Section title="Assignment">
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
          {showAssignment ? task.assignment.worker.name : 'Assigned to you'}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.caption}>
          Assigned {formatDateTime(task.assignment.assignedAt)}
        </Text>
        {task.assignment.rejection ? (
          <View style={styles.rejection} testID="task-rejection">
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejectionText}>
              Rejected {formatDateTime(task.assignment.rejection.rejectedAt)}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejectionText}>
              “{task.assignment.rejection.reason}”
            </Text>
          </View>
        ) : null}
      </Section>

      <Section title="Location">
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
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
        <Button
          label="Open in Maps"
          variant="ghost"
          size="md"
          fullWidth={false}
          testID="open-in-maps"
          onPress={() =>
            openInMaps(
              task.location.address,
              task.location.latitude !== null && task.location.longitude !== null
                ? { latitude: task.location.latitude, longitude: task.location.longitude }
                : null,
            )
          }
        />
      </Section>

      <Section title={`Photos (${task.evidence.length})`}>
        {task.evidence.length === 0 ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.caption}>
            No photos yet.
          </Text>
        ) : (
          task.evidence.map((photo) => (
            <Text
              key={photo.id}
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.caption}
            >
              Photo by {photo.uploadedBy.name} · {formatDateTime(photo.createdAt)}
            </Text>
          ))
        )}
      </Section>

      <Section title={`Notes (${task.notes.length})`}>
        {task.notes.length === 0 ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.caption}>
            No notes yet.
          </Text>
        ) : (
          task.notes.map((note) => (
            <View key={note.id} style={styles.note}>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.caption}>
                {note.createdBy.name} · {formatDateTime(note.createdAt)}
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
                {note.content}
              </Text>
            </View>
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
  headerBlock: { gap: spacing.sm },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textPrimary },
  addressDetails: { ...typography.body, color: colors.textSecondary },
  caption: { ...typography.caption, color: colors.textSecondary },
  note: { gap: 2, paddingVertical: spacing.xs },
  rejection: {
    backgroundColor: toneColors.error.tint,
    padding: spacing.sm,
    borderRadius: spacing.sm,
    gap: 2,
    marginTop: spacing.xs,
  },
  rejectionText: { ...typography.secondary, color: toneColors.error.text },
});
