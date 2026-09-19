import type { TaskListItem } from '@fieldmate/shared';
import { StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  spacing,
  statusAppearance,
  toneColors,
  typography,
} from '../constants/theme';
import { formatRelativeTime } from '../utils/format';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

export type TaskCardProps = {
  task: TaskListItem;
  onPress: () => void;
  /** Managers see who the task is assigned to. */
  showWorker?: boolean;
  showRejection?: boolean;
};

export function TaskCard({
  task,
  onPress,
  showWorker = false,
  showRejection = false,
}: TaskCardProps) {
  const label = [
    task.title,
    `status ${statusAppearance[task.status].label}`,
    task.address,
    showWorker ? `assigned to ${task.worker.name}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card onPress={onPress} accessibilityLabel={label} testID={`task-card-${task.id}`}>
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

      <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.meta}>
        {task.address}
      </Text>

      <View style={styles.footer}>
        {showWorker ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.meta}>
            {task.worker.name}
          </Text>
        ) : null}
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.timestamp}>
          Updated {formatRelativeTime(task.updatedAt)}
        </Text>
      </View>

      {showRejection && task.rejection ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rejection}>
          Rejected: “{task.rejection.reason}”
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.body, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  meta: { ...typography.secondary, color: colors.textSecondary },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timestamp: { ...typography.caption, color: colors.textSecondary },
  rejection: { ...typography.secondary, color: toneColors.error.text },
});
