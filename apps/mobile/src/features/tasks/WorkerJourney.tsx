import type { TaskDetail } from '@fieldmate/shared';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { colors, radius, spacing, typography, type IconName } from '../../constants/theme';
import { formatTime } from '../../utils/format';

type Step = { label: string; icon: IconName; at: string | null };

export type WorkerJourneyProps = {
  task: Pick<TaskDetail, 'status' | 'progress' | 'review'>;
  /**
   * The worker's next step is drawn in signal yellow — it is theirs to take.
   * A manager watching sees the same step as an ink ring instead.
   */
  perspective: 'worker' | 'manager';
  /** False while the task cannot be submitted yet, so the last step stays quiet. */
  canSubmit?: boolean;
};

/**
 * The job's five steps in a row, so the worker and the manager can see how far
 * it has got. A step is only marked done once the API has stamped it.
 */
export function WorkerJourney({ task, perspective, canSubmit = true }: WorkerJourneyProps) {
  if (task.status === 'REJECTED' || task.status === 'CANCELLED') return null;

  const submitted = task.status === 'AWAITING_REVIEW' || task.status === 'COMPLETED';
  const steps: Step[] = [
    { label: 'Accepted', icon: 'checkmark-circle-outline', at: task.progress.acceptedAt },
    { label: 'On the way', icon: 'navigate-outline', at: task.progress.departedAt },
    { label: 'Arrived', icon: 'location-outline', at: task.progress.arrivedAt },
    { label: 'In progress', icon: 'hammer-outline', at: task.progress.startedAt },
    {
      label: 'Submitted',
      icon: 'send-outline',
      at: submitted ? (task.review.submittedAt ?? task.progress.startedAt) : null,
    },
  ];

  const current = steps.findIndex((step) => step.at === null);
  const summary = steps
    .map((step) => (step.at ? `${step.label} ${formatTime(step.at)}` : `${step.label} not yet`))
    .join(', ');

  return (
    <Card flat style={styles.card} testID="worker-journey">
      <View style={styles.row} accessible accessibilityLabel={`Progress: ${summary}`}>
        {steps.map((step, index) => {
          const done = step.at !== null;
          const isCurrent = index === current;
          // The last step only lights up once there is something to submit.
          const signal =
            isCurrent && perspective === 'worker' && (index < steps.length - 1 || canSubmit);
          const ring = isCurrent && !signal && perspective === 'manager';
          const lineBeforeDone = done;
          const lineAfterDone = steps[index + 1]?.at != null;

          return (
            <View key={step.label} style={styles.step}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.line,
                    index === 0 && styles.lineHidden,
                    lineBeforeDone && styles.lineDone,
                  ]}
                />
                <View
                  style={[
                    styles.node,
                    done && styles.nodeDone,
                    signal && styles.nodeSignal,
                    ring && styles.nodeRing,
                  ]}
                >
                  <Icon
                    name={done ? 'checkmark' : step.icon}
                    size={done ? 18 : 16}
                    color={
                      done
                        ? colors.onPrimary
                        : signal || ring
                          ? colors.textPrimary
                          : colors.textSecondary
                    }
                  />
                </View>
                <View
                  style={[
                    styles.line,
                    index === steps.length - 1 && styles.lineHidden,
                    lineAfterDone && styles.lineDone,
                  ]}
                />
              </View>
              <Text
                maxFontSizeMultiplier={1.3}
                numberOfLines={2}
                // On a narrow phone "Submitted" is wider than its column. A
                // hyphen at the break reads as one word; a bare split does not.
                android_hyphenationFrequency="normal"
                style={[styles.label, done || isCurrent ? styles.labelStrong : null]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const NODE = 36;

const styles = StyleSheet.create({
  card: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  row: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: spacing.xs + 2 },
  track: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 3, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.primary },
  lineHidden: { backgroundColor: 'transparent' },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  /** The worker's next step: signal yellow with a soft halo, like a focused field. */
  nodeSignal: {
    backgroundColor: colors.accent,
    borderColor: 'rgba(255, 194, 26, 0.35)',
    borderWidth: 4,
  },
  nodeRing: { borderColor: colors.primary },
  label: {
    ...typography.caption,
    lineHeight: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    // Keeps a gap between neighbouring labels that each just fit their column.
    paddingHorizontal: 2,
  },
  labelStrong: { color: colors.textPrimary, fontFamily: typography.secondaryStrong.fontFamily },
});
