import type { TaskProgress } from '@fieldmate/shared';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  tabularNumbers,
  typography,
  type IconName,
} from '../../constants/theme';
import { formatTime } from '../../utils/format';

type Step = { label: string; icon: IconName; at: string | null };

/**
 * The worker's journey through one job, so both the worker and the manager can
 * see how far it has got and when each step happened. A step is only marked
 * done once the API has stamped it.
 */
export function WorkerJourney({ progress }: { progress: TaskProgress }) {
  const steps: Step[] = [
    { label: 'Accepted', icon: 'thumbs-up-outline', at: progress.acceptedAt },
    { label: 'On the way', icon: 'car-outline', at: progress.departedAt },
    { label: 'Arrived on site', icon: 'location-outline', at: progress.arrivedAt },
    { label: 'Work started', icon: 'construct-outline', at: progress.startedAt },
  ];

  const reached = steps.filter((step) => step.at !== null).length;
  if (reached === 0) return null;

  return (
    <Card style={styles.card} testID="worker-journey">
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={styles.heading}
        accessibilityRole="header"
      >
        Progress
      </Text>

      {steps.map((step, index) => {
        const done = step.at !== null;
        const last = index === steps.length - 1;

        return (
          <View key={step.label} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.node, done ? styles.nodeDone : styles.nodePending]}>
                <Icon
                  name={done ? 'checkmark' : step.icon}
                  size={14}
                  color={done ? colors.onAccent : colors.textDisabled}
                />
              </View>
              {!last ? (
                <View style={[styles.line, done ? styles.lineDone : styles.linePending]} />
              ) : null}
            </View>

            <View style={styles.text}>
              <Text
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                style={done ? styles.labelDone : styles.labelPending}
              >
                {step.label}
              </Text>
              {step.at ? (
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.time}>
                  {formatTime(step.at)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const NODE = 28;

const styles = StyleSheet.create({
  card: { gap: 0 },
  heading: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.smPlus },
  row: { flexDirection: 'row', gap: spacing.smPlus },
  rail: { alignItems: 'center', width: NODE },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: { backgroundColor: colors.accent },
  nodePending: { backgroundColor: colors.surfaceMuted },
  line: { width: 2, flex: 1, minHeight: spacing.md },
  lineDone: { backgroundColor: colors.accent },
  linePending: { backgroundColor: colors.border },
  text: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  labelDone: { ...typography.bodyStrong, color: colors.textPrimary },
  labelPending: { ...typography.body, color: colors.textDisabled },
  time: { ...typography.caption, ...tabularNumbers, color: colors.textSecondary },
});
