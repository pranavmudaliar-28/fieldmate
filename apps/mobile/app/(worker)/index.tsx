import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { DashboardHeader } from '../../src/components/DashboardHeader';
import { EmptyState, ErrorState, LoadingState, SectionHeader } from '../../src/components/States';
import { TaskCard } from '../../src/components/TaskCard';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../src/constants/theme';
import { useAuth } from '../../src/features/auth/auth-context';
import { NotificationPrompt } from '../../src/features/notifications/NotificationPrompt';
import { useTaskList } from '../../src/features/tasks/hooks';

const SECTION_LIMIT = 10;

/** S-006 Worker Dashboard: in-progress work first, then new assignments. */
export default function WorkerDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const inProgress = useTaskList(['IN_PROGRESS'], SECTION_LIMIT);
  const assigned = useTaskList(['ASSIGNED'], SECTION_LIMIT);

  const inProgressTasks = inProgress.data?.pages[0]?.items ?? [];
  const assignedTasks = assigned.data?.pages[0]?.items ?? [];
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
    <SafeAreaView style={styles.screen} edges={['top']}>
      <DashboardHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={inProgress.isRefetching || assigned.isRefetching}
            onRefresh={refresh}
          />
        }
      >
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.greeting}
          accessibilityRole="header"
        >
          Hello, {user?.name.split(' ')[0] ?? 'there'}
        </Text>

        <NotificationPrompt role="FIELD_WORKER" />

        {loading ? <LoadingState variant="list" /> : null}
        {failed ? <ErrorState message="Couldn't load your tasks." onRetry={refresh} /> : null}

        {isEmpty ? (
          <EmptyState
            title="No tasks right now"
            message="New tasks assigned to you will appear here."
          />
        ) : null}

        {inProgressTasks.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="In progress" />
            {inProgressTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={() => router.push(`/(worker)/tasks/${task.id}`)}
              />
            ))}
          </View>
        ) : null}

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

        <Button
          label="View all my tasks"
          variant="secondary"
          testID="view-my-tasks"
          onPress={() => router.push('/(worker)/tasks')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.lg, paddingBottom: spacing.xl },
  greeting: { ...typography.screenTitle, color: colors.textPrimary },
  section: { gap: spacing.sm },
});
