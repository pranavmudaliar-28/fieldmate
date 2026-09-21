import type { TaskListItem } from '@fieldmate/shared';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  statusAppearance,
  toneColors,
  typography,
} from '../constants/theme';
import { formatRelativeTime } from '../utils/format';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Icon } from './Icon';
import { StatusBadge } from './StatusBadge';

export type TaskCardProps = {
  task: TaskListItem;
  onPress: () => void;
  /** Managers see who the task is assigned to. */
  showWorker?: boolean;
  showRejection?: boolean;
};

function TaskCardComponent({
  task,
  onPress,
  showWorker = false,
  showRejection = false,
}: TaskCardProps) {
  const appearance = statusAppearance[task.status];
  const tone = toneColors[appearance.tone];

  const label = [
    task.title,
    `status ${appearance.label}`,
    task.address,
    showWorker ? `assigned to ${task.worker.name}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card onPress={onPress} accessibilityLabel={label} testID={`task-card-${task.id}`} bleed>
      <View style={styles.row}>
        {/* A second, redundant channel for status, so a long list can be
            scanned at arm's length before any word is read. */}
        <View style={[styles.stripe, { backgroundColor: tone.dot }]} />

        <View style={styles.body}>
          <View style={styles.header}>
            <Text
              numberOfLines={2}
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.title}
            >
              {task.title}
            </Text>
            <StatusBadge status={task.status} />
          </View>

          <View style={styles.metaRow}>
            <Icon name="location-outline" size={15} color={colors.textSecondary} />
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.meta}
            >
              {task.address}
            </Text>
          </View>

          <View style={styles.footer}>
            {showWorker ? (
              <View style={styles.worker}>
                <Avatar name={task.worker.name} size="sm" variant={appearance.tone} />
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.workerName}>
                  {task.worker.name}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.timestamp}>
              Updated {formatRelativeTime(task.updatedAt)}
            </Text>
          </View>

          {showRejection && task.rejection ? (
            <View style={styles.rejection}>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejectionText}>
                Rejected: “{task.rejection.reason}”
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/** Memoised: these are the rows of every list in the app (docs/04 §10). */
export const TaskCard = memo(TaskCardComponent);

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  stripe: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, padding: spacing.md, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.cardTitle, color: colors.textPrimary, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  meta: { ...typography.secondary, color: colors.textSecondary, flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  worker: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  workerName: { ...typography.caption, color: colors.textSecondary },
  timestamp: { ...typography.caption, color: colors.textDisabled },
  rejection: {
    backgroundColor: toneColors.error.tint,
    borderRadius: radius.control,
    paddingHorizontal: spacing.smPlus,
    paddingVertical: spacing.sm,
  },
  rejectionText: { ...typography.secondaryStrong, color: toneColors.error.text },
});
