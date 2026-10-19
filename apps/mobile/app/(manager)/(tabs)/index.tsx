import type { TaskListItem } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../src/components/AppHeader';
import { Avatar } from '../../../src/components/Avatar';
import { Button } from '../../../src/components/Button';
import { StatCard } from '../../../src/components/StatCard';
import { ErrorState, LoadingState, SectionHeader } from '../../../src/components/States';
import { useTabBarSpacing } from '../../../src/components/TabBar';
import { RowGroup, TaskRow } from '../../../src/components/TaskRow';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  statusAppearance,
  typography,
} from '../../../src/constants/theme';
import { useAuth } from '../../../src/features/auth/auth-context';
import { InboxBell } from '../../../src/features/notifications/InboxBell';
import { NotificationPrompt } from '../../../src/features/notifications/NotificationPrompt';
import {
  ACTIVE_STATUSES,
  TASK_PAGE_LIMIT,
  isCapped,
  type TaskFilter,
} from '../../../src/features/tasks/constants';
import { useTaskList } from '../../../src/features/tasks/hooks';
import { formatDayHeading, formatRelativeTime } from '../../../src/utils/format';

const VISIBLE_ROWS = 4;

/**
 * S-002 Manager Dashboard: what is waiting on the manager first — work to
 * review, then work handed back — and then the shape of the day.
 */
export default function ManagerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const tabBarSpacing = useTabBarSpacing();

  const review = useTaskList(['AWAITING_REVIEW'], TASK_PAGE_LIMIT);
  const rejected = useTaskList(['REJECTED'], TASK_PAGE_LIMIT);
  const assigned = useTaskList(['ASSIGNED'], TASK_PAGE_LIMIT);
  const active = useTaskList(ACTIVE_STATUSES, TASK_PAGE_LIMIT);
  const completed = useTaskList(['COMPLETED'], TASK_PAGE_LIMIT);

  const queries = [review, rejected, assigned, active, completed];
  const refreshing = queries.some((query) => query.isRefetching);
  const refresh = () => queries.forEach((query) => void query.refetch());

  const reviewTasks = review.data?.pages[0]?.items ?? [];
  const rejectedTasks = rejected.data?.pages[0]?.items ?? [];
  const completedTasks = completed.data?.pages[0]?.items ?? [];
  // Review outranks a rejection: the work is done and is waiting on the manager.
  const attention = [...reviewTasks, ...rejectedTasks];

  const counts = {
    assigned: countOf(assigned.data?.pages[0]),
    active: countOf(active.data?.pages[0]),
    review: countOf(review.data?.pages[0]),
    completed: countOf(completed.data?.pages[0]),
  };

  const openList = (status: TaskFilter) =>
    router.push({ pathname: '/(manager)/(tabs)/tasks', params: { status } });
  const openTask = (task: TaskListItem) => router.push(`/(manager)/tasks/${task.id}`);

  return (
    <View style={styles.screen}>
      <AppHeader
        size="large"
        eyebrow={formatDayHeading()}
        title={`Hello, ${user?.name.split(' ')[0] ?? 'there'}`}
        right={
          <View style={styles.headerActions}>
            <InboxBell href="/(manager)/notifications" />
            <Avatar name={user?.name ?? ''} variant="ink" size="md" style={styles.me} />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpacing }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Button
          label="Create task"
          icon="add"
          testID="create-task-button"
          onPress={() => router.push('/(manager)/tasks/new')}
        />

        <NotificationPrompt role="MANAGER" />

        {review.isError || rejected.isError ? (
          <ErrorState
            message="Couldn't load the tasks that need you."
            onRetry={() => {
              void review.refetch();
              void rejected.refetch();
            }}
          />
        ) : null}

        {review.isPending || rejected.isPending ? <LoadingState variant="list" /> : null}

        {attention.length > 0 ? (
          <View style={styles.section} testID="needs-attention">
            <SectionHeader title="Needs your attention" count={attention.length} />
            <RowGroup>
              {attention.slice(0, VISIBLE_ROWS + 1).map((task) => (
                <TaskRow
                  key={task.id}
                  title={task.title}
                  status={task.status}
                  detail={`${task.worker.name} · ${formatRelativeTime(task.updatedAt)}`}
                  onPress={() => openTask(task)}
                  testID={`attention-${task.id}`}
                />
              ))}
            </RowGroup>
          </View>
        ) : null}

        <View style={styles.stats}>
          <View style={styles.statsRow}>
            <StatCard
              label="Assigned"
              value={counts.assigned.value}
              capped={counts.assigned.capped}
              palette={statusAppearance.ASSIGNED}
              icon={statusAppearance.ASSIGNED.icon}
              testID="stat-assigned"
              onPress={() => openList('ASSIGNED')}
            />
            <StatCard
              label="In progress"
              value={counts.active.value}
              capped={counts.active.capped}
              palette={statusAppearance.IN_PROGRESS}
              icon={statusAppearance.IN_PROGRESS.icon}
              testID="stat-in-progress"
              onPress={() => openList('IN_PROGRESS')}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Awaiting review"
              value={counts.review.value}
              capped={counts.review.capped}
              palette={statusAppearance.AWAITING_REVIEW}
              icon={statusAppearance.AWAITING_REVIEW.icon}
              emphasis={counts.review.value > 0}
              testID="stat-awaiting-review"
              onPress={() => openList('AWAITING_REVIEW')}
            />
            <StatCard
              label="Completed"
              value={counts.completed.value}
              capped={counts.completed.capped}
              palette={statusAppearance.COMPLETED}
              icon={statusAppearance.COMPLETED.icon}
              testID="stat-completed"
              onPress={() => openList('COMPLETED')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Recently completed"
            actionLabel="View all"
            onAction={() => openList('COMPLETED')}
          />
          {completed.isPending ? <LoadingState variant="list" /> : null}
          {completed.isSuccess && completedTasks.length === 0 ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.quietEmpty}>
              No completed tasks yet.
            </Text>
          ) : null}
          {completedTasks.length > 0 ? (
            <RowGroup>
              {completedTasks.slice(0, VISIBLE_ROWS).map((task) => (
                <TaskRow
                  key={task.id}
                  title={task.title}
                  status={task.status}
                  detail={`${task.worker.name} · ${formatRelativeTime(task.updatedAt)}`}
                  onPress={() => openTask(task)}
                />
              ))}
            </RowGroup>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function countOf(page: { items: TaskListItem[]; nextCursor: string | null } | undefined) {
  const value = page?.items.length ?? 0;
  return { value, capped: isCapped(value, page?.nextCursor) };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  me: { width: 56, height: 56 },
  content: { padding: layout.screenPadding, gap: spacing.section, paddingTop: spacing.xs },
  section: { gap: spacing.smPlus },
  stats: { gap: spacing.smPlus },
  statsRow: { flexDirection: 'row', gap: spacing.smPlus },
  quietEmpty: { ...typography.secondary, color: colors.textSecondary },
});
