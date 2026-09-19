import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { DashboardHeader } from '../../src/components/DashboardHeader';
import { ErrorState, LoadingState, SectionHeader } from '../../src/components/States';
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

/** S-002 Manager Dashboard (docs/04 §5): create, needs attention, recently completed. */
export default function ManagerDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const rejected = useTaskList(['REJECTED'], SECTION_LIMIT);
  const completed = useTaskList(['COMPLETED'], SECTION_LIMIT);

  const rejectedTasks = rejected.data?.pages[0]?.items ?? [];
  const completedTasks = completed.data?.pages[0]?.items ?? [];
  const refreshing = rejected.isRefetching || completed.isRefetching;

  const refresh = () => {
    void rejected.refetch();
    void completed.refetch();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <DashboardHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.greeting}
          accessibilityRole="header"
        >
          Hello, {user?.name.split(' ')[0] ?? 'there'}
        </Text>

        <NotificationPrompt role="MANAGER" />

        <Button
          label="Create task"
          testID="create-task-button"
          onPress={() => router.push('/(manager)/tasks/new')}
        />

        <View style={styles.section}>
          <SectionHeader title="Needs attention" />
          {rejected.isPending ? <LoadingState variant="list" /> : null}
          {rejected.isError ? (
            <ErrorState
              message="Couldn't load rejected tasks."
              onRetry={() => void rejected.refetch()}
            />
          ) : null}
          {rejected.isSuccess && rejectedTasks.length === 0 ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.emptyLine}>
              Nothing needs your attention.
            </Text>
          ) : null}
          {rejectedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              showWorker
              showRejection
              onPress={() => router.push(`/(manager)/tasks/${task.id}`)}
            />
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Recently completed"
            actionLabel="View all"
            onAction={() => router.push('/(manager)/tasks?status=COMPLETED')}
          />
          {completed.isPending ? <LoadingState variant="list" /> : null}
          {completed.isError ? (
            <ErrorState
              message="Couldn't load completed tasks."
              onRetry={() => void completed.refetch()}
            />
          ) : null}
          {completed.isSuccess && completedTasks.length === 0 ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.emptyLine}>
              No completed tasks yet.
            </Text>
          ) : null}
          {completedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              showWorker
              onPress={() => router.push(`/(manager)/tasks/${task.id}`)}
            />
          ))}
        </View>

        <Button
          label="View all tasks"
          variant="secondary"
          testID="view-all-tasks"
          onPress={() => router.push('/(manager)/tasks')}
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
  emptyLine: { ...typography.secondary, color: colors.textSecondary },
});
