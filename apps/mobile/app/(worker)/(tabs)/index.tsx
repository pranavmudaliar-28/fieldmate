import {
  WORKER_PROGRESS_STATUSES,
  nextStatus,
  nextWorkerStep,
  type TaskListItem,
  type TaskStatus,
} from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../src/components/AppHeader';
import { Badge } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Icon } from '../../../src/components/Icon';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
} from '../../../src/components/States';
import { useTabBarSpacing } from '../../../src/components/TabBar';
import { TaskCard } from '../../../src/components/TaskCard';
import { useToast } from '../../../src/components/Toast';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  statusAppearance,
  typography,
} from '../../../src/constants/theme';
import { useAuth } from '../../../src/features/auth/auth-context';
import { InboxBell } from '../../../src/features/notifications/InboxBell';
import { NotificationPrompt } from '../../../src/features/notifications/NotificationPrompt';
import { useTaskList } from '../../../src/features/tasks/hooks';
import { useAdvanceTask, useStepBack } from '../../../src/features/tasks/worker-hooks';
import { WORKER_STEP_UI } from '../../../src/features/tasks/worker-steps';
import { ApiError } from '../../../src/services/http';
import { formatDayHeading } from '../../../src/utils/format';

const SECTION_LIMIT = 10;

/**
 * Everything the worker has taken on but not finished. Without this a task
 * would vanish from the dashboard the moment it was accepted, because it is
 * no longer ASSIGNED and not yet IN_PROGRESS. Work waiting on review is
 * listed too, but never raised as the current job: there is nothing to do.
 */
const UNDER_WAY: TaskStatus[] = [
  ...WORKER_PROGRESS_STATUSES.filter((status) => status !== 'ASSIGNED'),
  'AWAITING_REVIEW',
];

/** Steps along the journey, for the five-segment bar on the current job. */
const STEPS_DONE: Partial<Record<TaskStatus, number>> = {
  ACCEPTED: 1,
  GOING_TO_LOCATION: 2,
  REACHED_LOCATION: 3,
  IN_PROGRESS: 4,
  AWAITING_REVIEW: 5,
};

/** The job furthest along is the one to raise. */
function mostAdvanced(tasks: TaskListItem[]): TaskListItem | undefined {
  return tasks
    .filter((task) => task.status !== 'AWAITING_REVIEW')
    .sort((a, b) => (STEPS_DONE[b.status] ?? 0) - (STEPS_DONE[a.status] ?? 0))[0];
}

/** S-006 Worker Home: the live job and its next step first, then what is waiting. */
export default function WorkerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const tabBarSpacing = useTabBarSpacing();

  const inProgress = useTaskList(UNDER_WAY, SECTION_LIMIT);
  const assigned = useTaskList(['ASSIGNED'], SECTION_LIMIT);

  const inProgressTasks = inProgress.data?.pages[0]?.items ?? [];
  const assignedTasks = assigned.data?.pages[0]?.items ?? [];
  const current = mostAdvanced(inProgressTasks);

  const loading = inProgress.isPending || assigned.isPending;
  const failed = inProgress.isError || assigned.isError;
  const isEmpty =
    inProgress.isSuccess &&
    assigned.isSuccess &&
    inProgressTasks.length === 0 &&
    assignedTasks.length === 0;

  const refresh = () => {
    void inProgress.refetch();
    void assigned.refetch();
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        size="large"
        eyebrow={formatDayHeading()}
        title={`Hello, ${user?.name.split(' ')[0] ?? 'there'}`}
        right={<InboxBell href="/(worker)/notifications" />}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpacing }]}
        refreshControl={
          <RefreshControl
            refreshing={inProgress.isRefetching || assigned.isRefetching}
            onRefresh={refresh}
          />
        }
      >
        <NotificationPrompt role="FIELD_WORKER" />

        {loading ? <LoadingState variant="list" /> : null}
        {failed ? <ErrorState message="Couldn't load your tasks." onRetry={refresh} /> : null}

        {isEmpty ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="You’re all clear"
            message="No tasks right now. When your manager assigns you one, it’ll show up here and you’ll get a notification."
            action={{
              label: 'See completed tasks',
              onPress: () => router.push('/(worker)/(tabs)/tasks'),
            }}
          />
        ) : null}

        {current ? <CurrentJobCard task={current} /> : null}

        {assignedTasks.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="New assignments" count={assignedTasks.length} countStyle="ink" />
            {assignedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={() => router.push(`/(worker)/tasks/${task.id}`)}
              />
            ))}
          </View>
        ) : null}

        {inProgressTasks
          .filter((task) => task.id !== current?.id)
          .map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => router.push(`/(worker)/tasks/${task.id}`)}
            />
          ))}
      </ScrollView>
    </View>
  );
}

/**
 * The one job being worked right now, on ink so it outranks everything else,
 * with its next step one tap away in signal yellow.
 */
function CurrentJobCard({ task }: { task: TaskListItem }) {
  const router = useRouter();
  const { showToast } = useToast();
  const advance = useAdvanceTask(task.id);
  const stepBack = useStepBack(task.id);
  const open = () => router.push(`/(worker)/tasks/${task.id}`);

  const appearance = statusAppearance[task.status];
  const step = nextWorkerStep(task.status);
  const done = STEPS_DONE[task.status] ?? 0;
  const next = step
    ? WORKER_STEP_UI[step].next
    : 'Next: add photos and notes, then submit for review';

  return (
    <Card variant="inverse" style={styles.hero} testID={`current-job-${task.id}`}>
      <View style={styles.heroTop}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.heroLabel}
          accessibilityRole="header"
        >
          Current task
        </Text>
        {/* The status hue, lifted for an ink background. */}
        <Badge
          label={appearance.label}
          icon={appearance.icon}
          palette={{ text: appearance.tint, tint: `${appearance.text}55` }}
          accessibilityLabel={`Status: ${appearance.label}`}
        />
      </View>

      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Open ${task.title}`}
        testID="hero-open-task"
        style={styles.heroBody}
      >
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.heroTitle}>
          {task.title}
        </Text>
        <View style={styles.heroMeta}>
          <Icon name="location-outline" size={18} color={colors.textOnInverseMuted} />
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.heroAddress}>
            {task.address}
          </Text>
        </View>
      </Pressable>

      <View style={styles.progress} accessible accessibilityLabel={`Step ${done} of 5. ${next}`}>
        <View style={styles.segments}>
          {[1, 2, 3, 4, 5].map((index) => (
            <View key={index} style={[styles.segment, index <= done && styles.segmentDone]} />
          ))}
        </View>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.next}>
          {next}
        </Text>
      </View>

      {step ? (
        <Button
          label={WORKER_STEP_UI[step].label}
          icon={WORKER_STEP_UI[step].icon}
          variant="signal"
          testID={`hero-action-${step}`}
          loading={advance.isPending}
          onPress={() =>
            advance.mutate(step, {
              onSuccess: () =>
                showToast(WORKER_STEP_UI[step].done, 'success', {
                  label: 'Undo',
                  onPress: () =>
                    stepBack.mutate(nextStatus(step) ?? undefined, {
                      onError: () =>
                        showToast('Couldn’t undo. Open the task to try again.', 'error'),
                    }),
                }),
              onError: (error) =>
                showToast(
                  error instanceof ApiError
                    ? error.message
                    : 'Couldn’t update status. Check your connection and try again.',
                  'error',
                ),
            })
          }
        />
      ) : (
        <Button
          label="Add photo"
          icon="camera-outline"
          variant="signal"
          testID="hero-add-photo"
          onPress={() => router.push(`/(worker)/tasks/${task.id}/evidence`)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.section, paddingTop: spacing.xs },
  section: { gap: spacing.smPlus },
  hero: { padding: spacing.mdPlus, gap: spacing.md, borderRadius: radius.sheet },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroLabel: { ...typography.label, color: colors.accent },
  heroBody: { gap: spacing.sm },
  heroTitle: { ...typography.display, color: colors.textOnInverse },
  heroMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  heroAddress: { ...typography.body, color: colors.textOnInverseMuted, flex: 1 },
  progress: { gap: spacing.sm },
  segments: { flexDirection: 'row', gap: spacing.xs + 2 },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderInverse,
  },
  segmentDone: { backgroundColor: colors.accent },
  next: { ...typography.secondary, color: colors.textOnInverseMuted },
});
