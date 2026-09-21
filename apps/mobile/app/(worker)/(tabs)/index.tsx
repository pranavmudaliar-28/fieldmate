import { WORKER_PROGRESS_STATUSES, type TaskListItem, type TaskStatus } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../src/components/AppHeader';
import { Avatar } from '../../../src/components/Avatar';
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
import { NotificationPrompt } from '../../../src/features/notifications/NotificationPrompt';
import { useTaskList } from '../../../src/features/tasks/hooks';
import { formatDayHeading, formatRelativeTime } from '../../../src/utils/format';

const SECTION_LIMIT = 10;

/**
 * Everything the worker has taken on but not finished. Without this a task
 * would vanish from the dashboard the moment it was accepted, because it is
 * no longer ASSIGNED and not yet IN_PROGRESS.
 */
const UNDER_WAY = WORKER_PROGRESS_STATUSES.filter(
  (status) => status !== 'ASSIGNED',
) as TaskStatus[];

/** The job furthest along is the one to raise. */
function mostAdvanced(tasks: TaskListItem[]): TaskListItem | undefined {
  return [...tasks].sort(
    (a, b) =>
      WORKER_PROGRESS_STATUSES.indexOf(b.status as never) -
      WORKER_PROGRESS_STATUSES.indexOf(a.status as never),
  )[0];
}

/** S-006 Worker Dashboard: the live job first, then what is waiting. */
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
        right={<Avatar name={user?.name ?? ''} variant="accent" />}
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
            title="No tasks right now"
            message="New tasks assigned to you will appear here."
          />
        ) : null}

        {current ? <CurrentJobCard task={current} /> : null}

        {assignedTasks.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="New assignments" />
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

/** The one job being worked right now, raised above everything else. */
function CurrentJobCard({ task }: { task: TaskListItem }) {
  const router = useRouter();
  const open = () => router.push(`/(worker)/tasks/${task.id}`);

  return (
    <Card variant="inverse" style={styles.hero} testID={`current-job-${task.id}`}>
      <View style={styles.heroTop}>
        <View style={[styles.pulse, { backgroundColor: colors.accent }]} />
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.heroLabel}
          accessibilityRole="header"
        >
          {statusAppearance[task.status].label}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.heroUpdated}>
          {formatRelativeTime(task.updatedAt)}
        </Text>
      </View>

      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={task.title}>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.heroTitle}>
          {task.title}
        </Text>
      </Pressable>

      <View style={styles.heroMeta}>
        <Icon name="location-outline" size={15} color={colors.textOnInverseMuted} />
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.heroAddress}>
          {task.address}
        </Text>
      </View>

      <View style={styles.heroActions}>
        <Button
          label="Add photo"
          icon="camera-outline"
          testID="hero-add-photo"
          onPress={() => router.push(`/(worker)/tasks/${task.id}/evidence`)}
          style={styles.heroAction}
        />
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel="Open task"
          testID="hero-open-task"
          style={styles.heroOpen}
        >
          <Icon name="arrow-forward" size={22} color={colors.textOnInverse} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.lg, paddingTop: spacing.sm },
  section: { gap: spacing.smPlus },
  hero: { padding: spacing.mdPlus, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pulse: { width: 8, height: 8, borderRadius: radius.pill },
  heroLabel: { ...typography.label, color: colors.accent, flex: 1 },
  heroUpdated: { ...typography.caption, color: colors.textOnInverseMuted },
  heroTitle: { ...typography.display, color: colors.textOnInverse },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroAddress: { ...typography.secondary, color: colors.textOnInverseMuted, flex: 1 },
  heroActions: { flexDirection: 'row', gap: spacing.smPlus },
  heroAction: { flex: 1 },
  heroOpen: {
    width: layout.buttonHeightLarge,
    height: layout.buttonHeightLarge,
    borderRadius: radius.action,
    backgroundColor: colors.surfaceInverseRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
