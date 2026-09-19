import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../../../../src/components/ActionBar';
import { Button } from '../../../../src/components/Button';
import { Card } from '../../../../src/components/Card';
import { EmptyState, ErrorState, LoadingState } from '../../../../src/components/States';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  toneColors,
  typography,
} from '../../../../src/constants/theme';
import { useTask, useTaskAction } from '../../../../src/features/tasks/hooks';
import { ApiError } from '../../../../src/services/http';

const EVIDENCE_HINT = 'At least 1 photo is required to complete this task.';

/** S-010 Task Completion: the summary is itself the confirmation (docs/04 §5). */
export default function CompleteTaskScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const task = useTask(taskId);
  const complete = useTaskAction(taskId, 'complete');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (task.isPending) {
    return (
      <View style={styles.padded}>
        <Stack.Screen options={{ headerShown: true, title: 'Complete task' }} />
        <LoadingState variant="detail" />
      </View>
    );
  }

  if (task.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Complete task' }} />
        <ErrorState message="Couldn't load this task." onRetry={() => void task.refetch()} />
      </>
    );
  }

  const detail = task.data;
  const photoCount = detail.evidence.length;
  const canComplete = photoCount > 0 && detail.status === 'IN_PROGRESS';

  if (done) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: true, title: 'Complete task' }} />
        <EmptyState
          title="Task completed"
          message="Your manager has been notified."
          action={{ label: 'Back to task', onPress: () => router.back() }}
          testID="completion-success"
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: 'Complete task' }} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.title}
          accessibilityRole="header"
        >
          {detail.title}
        </Text>

        <Card>
          <View style={styles.row}>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rowLabel}>
              Photos
            </Text>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={[styles.rowValue, photoCount === 0 && styles.rowValueMissing]}
              testID="summary-photos"
            >
              {photoCount === 0 ? 'Required' : photoCount}
            </Text>
          </View>
          <View style={styles.row}>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.rowLabel}>
              Notes
            </Text>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.rowValue}
              testID="summary-notes"
            >
              {detail.notes.length}
            </Text>
          </View>
        </Card>

        <View style={styles.infoBox}>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.infoText}>
            Once completed, you won&apos;t be able to add or delete photos or notes.
          </Text>
        </View>

        {error ? (
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.error}
            accessibilityRole="alert"
            testID="complete-error"
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <ActionBar hint={photoCount === 0 ? EVIDENCE_HINT : undefined}>
        <Button
          label="Back"
          variant="secondary"
          onPress={() => router.back()}
          disabled={complete.isPending}
          style={styles.action}
        />
        <Button
          label="Complete task"
          testID="confirm-complete"
          loading={complete.isPending}
          disabled={!canComplete}
          disabledReason={EVIDENCE_HINT}
          onPress={() =>
            complete.mutate(undefined, {
              onSuccess: () => {
                setError(null);
                setDone(true);
              },
              onError: (completeError) => {
                setError(
                  completeError instanceof ApiError
                    ? completeError.message
                    : 'Something went wrong. Please try again.',
                );
                void task.refetch();
              },
            })
          }
          style={styles.action}
        />
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.md },
  padded: { flex: 1, padding: layout.screenPadding, backgroundColor: colors.background },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  rowLabel: { ...typography.body, color: colors.textPrimary },
  rowValue: { ...typography.body, color: colors.textSecondary },
  rowValueMissing: { color: toneColors.error.text },
  infoBox: {
    backgroundColor: toneColors.info.tint,
    padding: spacing.md,
    borderRadius: spacing.sm,
  },
  infoText: { ...typography.secondary, color: toneColors.info.text },
  error: { ...typography.secondary, color: colors.errorText },
  action: { flex: 1 },
});
