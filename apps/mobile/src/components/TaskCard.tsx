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

  const label = [
    task.title,
    `status ${appearance.label}`,
    task.address,
    showWorker ? `assigned to ${task.worker.name}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card onPress={onPress} accessibilityLabel={label} testID={`task-card-${task.id}`}>
      <View style={styles.top}>
        <StatusBadge status={task.status} />
        {showWorker ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.timestamp}>
            {formatRelativeTime(task.updatedAt)}
          </Text>
        ) : (
          <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
        )}
      </View>

      <Text numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.title}>
        {task.title}
      </Text>

      <View style={styles.metaRow}>
        <Icon name="location-outline" size={16} color={colors.textSecondary} />
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.meta}
        >
          {task.address}
        </Text>
      </View>

      {showRejection && task.rejection ? (
        <View style={styles.rejection}>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejectionText}>
            “{task.rejection.reason}”
          </Text>
        </View>
      ) : null}

      {showWorker ? (
        <View style={styles.worker}>
          <Avatar name={task.worker.name} size="sm" />
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.workerName}
          >
            {task.worker.name}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/** Memoised: these are the rows of every list in the app. */
export const TaskCard = memo(TaskCardComponent);

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  timestamp: { ...typography.caption, color: colors.textSecondary },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  meta: { ...typography.secondary, color: colors.textSecondary, flex: 1 },
  worker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.smPlus,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  workerName: { ...typography.secondaryStrong, color: colors.textPrimary, flex: 1 },
  rejection: {
    backgroundColor: toneColors.error.tint,
    borderRadius: radius.control,
    paddingHorizontal: spacing.smPlus,
    paddingVertical: spacing.sm,
  },
  rejectionText: { ...typography.secondaryStrong, color: toneColors.error.text },
});
