import type { TaskListItem } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../src/components/AppHeader';
import { Avatar } from '../../../src/components/Avatar';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Icon } from '../../../src/components/Icon';
import { StatCard } from '../../../src/components/StatCard';
import { ErrorState, LoadingState, SectionHeader } from '../../../src/components/States';
import { useTabBarSpacing } from '../../../src/components/TabBar';
import { TaskCard } from '../../../src/components/TaskCard';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../../../src/constants/theme';
import { useAuth } from '../../../src/features/auth/auth-context';
import { NotificationPrompt } from '../../../src/features/notifications/NotificationPrompt';
import { TASK_PAGE_LIMIT, isCapped } from '../../../src/features/tasks/constants';
import { useTaskList } from '../../../src/features/tasks/hooks';
import { formatDayHeading } from '../../../src/utils/format';

const VISIBLE_CARDS = 4;

/** S-002 Manager Dashboard: what went wrong first, then the shape of the day. */
export default function ManagerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const tabBarSpacing = useTabBarSpacing();

  const rejected = useTaskList(['REJECTED'], TASK_PAGE_LIMIT);
  const assigned = useTaskList(['ASSIGNED'], TASK_PAGE_LIMIT);
  const inProgress = useTaskList(['IN_PROGRESS'], TASK_PAGE_LIMIT);
  const completed = useTaskList(['COMPLETED'], TASK_PAGE_LIMIT);

  const queries = [rejected, assigned, inProgress, completed];
  const refreshing = queries.some((query) => query.isRefetching);
  const refresh = () => queries.forEach((query) => void query.refetch());

  const rejectedTasks = rejected.data?.pages[0]?.items ?? [];
  const completedTasks = completed.data?.pages[0]?.items ?? [];

  const counts = {
    assigned: countOf(assigned.data?.pages[0]),
    inProgress: countOf(inProgress.data?.pages[0]),
    rejected: countOf(rejected.data?.pages[0]),
    completed: countOf(completed.data?.pages[0]),
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        size="large"
        eyebrow={formatDayHeading()}
        title={`Hello, ${user?.name.split(' ')[0] ?? 'there'}`}
        right={<Avatar name={user?.name ?? ''} variant="ink" />}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpacing }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <NotificationPrompt role="MANAGER" />

        {rejected.isError ? (
          <ErrorState
            message="Couldn't load rejected tasks."
            onRetry={() => void rejected.refetch()}
          />
        ) : null}

        {rejected.isPending ? <LoadingState variant="list" /> : null}

        {rejectedTasks[0] ? (
          <NeedsAttentionCard
            task={rejectedTasks[0]}
            total={counts.rejected.value}
            onOpen={() => router.push(`/(manager)/tasks/${rejectedTasks[0]?.id ?? ''}`)}
          />
        ) : null}

        <View style={styles.stats}>
          <StatCard
            label="Assigned"
            value={counts.assigned.value}
            capped={counts.assigned.capped}
            tone="info"
            testID="stat-assigned"
            onPress={() =>
              router.push({ pathname: '/(manager)/(tabs)/tasks', params: { status: 'ASSIGNED' } })
            }
          />
          <StatCard
            label="In progress"
            value={counts.inProgress.value}
            capped={counts.inProgress.capped}
            tone="warning"
            testID="stat-in-progress"
            onPress={() =>
              router.push({
                pathname: '/(manager)/(tabs)/tasks',
                params: { status: 'IN_PROGRESS' },
              })
            }
          />
          <StatCard
            label="Completed"
            value={counts.completed.value}
            capped={counts.completed.capped}
            tone="success"
            testID="stat-completed"
            onPress={() =>
              router.push({ pathname: '/(manager)/(tabs)/tasks', params: { status: 'COMPLETED' } })
            }
          />
        </View>

        <Button
          label="Create task"
          icon="add"
          testID="create-task-button"
          onPress={() => router.push('/(manager)/tasks/new')}
        />

        {rejectedTasks.length > 1 ? (
          <View style={styles.section}>
            <SectionHeader title="Needs attention" />
            {rejectedTasks.slice(1, VISIBLE_CARDS + 1).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showWorker
                showRejection
                onPress={() => router.push(`/(manager)/tasks/${task.id}`)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="Recently completed"
            actionLabel="View all"
            onAction={() =>
              router.push({ pathname: '/(manager)/(tabs)/tasks', params: { status: 'COMPLETED' } })
            }
          />
          {completed.isPending ? <LoadingState variant="list" /> : null}
          {completed.isSuccess && completedTasks.length === 0 ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.quietEmpty}>
              No completed tasks yet.
            </Text>
          ) : null}
          {completedTasks.slice(0, VISIBLE_CARDS).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              showWorker
              onPress={() => router.push(`/(manager)/tasks/${task.id}`)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function countOf(page: { items: TaskListItem[]; nextCursor: string | null } | undefined) {
  const value = page?.items.length ?? 0;
  return { value, capped: isCapped(value, page?.nextCursor) };
}

/** The one thing a manager opens the app to find. */
function NeedsAttentionCard({
  task,
  total,
  onOpen,
}: {
  task: TaskListItem;
  total: number;
  onOpen: () => void;
}) {
  return (
    <Card variant="inverse" style={styles.attention} testID="needs-attention">
      <View style={styles.attentionTop}>
        <View style={styles.pulse} />
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.attentionLabel}
          accessibilityRole="header"
        >
          Needs attention
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.attentionCount}>
          {total}
        </Text>
      </View>

      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.attentionTitle}>
        {task.title}
      </Text>

      {task.rejection ? (
        <View style={styles.attentionReason}>
          <Avatar name={task.worker.name} size="sm" variant="muted" />
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.attentionReasonText}>
            {task.worker.name} rejected this — “{task.rejection.reason}”
          </Text>
        </View>
      ) : null}

      <View style={styles.attentionActions}>
        <Button label="Open task" testID="attention-open" onPress={onOpen} style={styles.grow} />
        <View style={styles.attentionIcon}>
          <Icon name="alert-circle-outline" size={22} color={colors.textOnInverseMuted} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.lg, paddingTop: spacing.sm },
  section: { gap: spacing.smPlus },
  stats: { flexDirection: 'row', gap: spacing.smPlus },
  quietEmpty: { ...typography.secondary, color: colors.textSecondary },
  attention: { padding: spacing.mdPlus, gap: spacing.md },
  attentionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pulse: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.error },
  attentionLabel: { ...typography.label, color: colors.errorTint, flex: 1 },
  attentionCount: { ...typography.sectionTitle, color: colors.textOnInverse },
  attentionTitle: { ...typography.display, color: colors.textOnInverse },
  attentionReason: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attentionReasonText: { ...typography.secondary, color: colors.textOnInverseMuted, flex: 1 },
  attentionActions: { flexDirection: 'row', gap: spacing.smPlus },
  grow: { flex: 1 },
  attentionIcon: {
    width: layout.buttonHeightLarge,
    height: layout.buttonHeightLarge,
    borderRadius: radius.action,
    backgroundColor: colors.surfaceInverseRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
