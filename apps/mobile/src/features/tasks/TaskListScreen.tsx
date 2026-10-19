import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { FilterChips, type FilterChip } from '../../components/FilterChips';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useTabBarSpacing } from '../../components/TabBar';
import { TaskCard } from '../../components/TaskCard';
import { colors, layout, radius, spacing, type IconName } from '../../constants/theme';
import { TASK_FILTERS, type TaskFilter } from './constants';
import { useTaskList } from './hooks';

const FILTERS: FilterChip<TaskFilter | null>[] = [
  { label: 'All', value: null, testID: 'filter-ALL' },
  ...TASK_FILTERS.map((filter) => ({
    label: filter.label,
    value: filter.value,
    testID: `filter-${filter.value}`,
  })),
];

/** What an empty filter means, said the way the manager would think it. */
const EMPTY: Partial<Record<TaskFilter, { icon: IconName; title: string; message: string }>> = {
  AWAITING_REVIEW: {
    icon: 'hourglass-outline',
    title: 'All caught up',
    message: 'Nothing is waiting for your review. We’ll notify you when a worker submits.',
  },
  REJECTED: {
    icon: 'arrow-undo-outline',
    title: 'Nothing handed back',
    message: 'No worker has rejected a task.',
  },
};

export type TaskListScreenProps = {
  /** Supplied by the route file so typed routes stay literal. */
  onOpenTask: (taskId: string) => void;
  onCreateTask: () => void;
};

/**
 * S-003 Task List. Shared by the manager and admin tabs so an admin stays in
 * their own area instead of being pushed into another role's section.
 */
export function TaskListScreen({ onOpenTask, onCreateTask }: TaskListScreenProps) {
  const params = useLocalSearchParams<{ status?: string }>();
  const tabBarSpacing = useTabBarSpacing();
  const initial = FILTERS.find((option) => option.value === params.status)?.value ?? null;
  const [filter, setFilter] = useState<TaskFilter | null>(initial);

  const statuses = TASK_FILTERS.find((option) => option.value === filter)?.statuses;
  const query = useTaskList(statuses);
  const tasks = query.data?.pages.flatMap((page) => page.items) ?? [];
  const empty = filter ? EMPTY[filter] : undefined;

  return (
    <View style={styles.screen}>
      <AppHeader
        size="large"
        title="Tasks"
        right={
          <Pressable
            onPress={onCreateTask}
            accessibilityRole="button"
            accessibilityLabel="Create task"
            testID="create-task-button"
            style={({ pressed }) => [styles.create, pressed && styles.createPressed]}
          >
            <Icon name="add" size={28} color={colors.onPrimary} />
          </Pressable>
        }
      />

      <FilterChips options={FILTERS} selected={filter} onSelect={setFilter} />

      {query.isPending ? (
        <View style={styles.padded}>
          <LoadingState variant="list" />
        </View>
      ) : null}

      {query.isError ? (
        <View style={styles.padded}>
          <ErrorState message="Couldn't load tasks." onRetry={() => void query.refetch()} />
        </View>
      ) : null}

      {query.isSuccess ? (
        <FlatList
          testID="manager-task-list"
          data={tasks}
          keyExtractor={(task) => task.id}
          style={styles.flex}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarSpacing }]}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
            />
          }
          renderItem={({ item }) => (
            <TaskCard task={item} showWorker showRejection onPress={() => onOpenTask(item.id)} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListFooterComponent={query.isFetchingNextPage ? <LoadingState variant="inline" /> : null}
          ListEmptyComponent={
            filter ? (
              <EmptyState
                icon={empty?.icon ?? 'filter-outline'}
                title={empty?.title ?? 'No tasks with this status'}
                message={empty?.message ?? 'Try a different filter.'}
                action={{ label: 'Show all tasks', onPress: () => setFilter(null) }}
              />
            ) : (
              <EmptyState
                icon="file-tray-outline"
                title="No tasks yet"
                message="Create one to get started."
                action={{ label: 'Create task', onPress: onCreateTask }}
              />
            )
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  create: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPressed: { backgroundColor: colors.primaryPressed },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.smPlus,
    gap: spacing.smPlus,
    flexGrow: 1,
  },
  padded: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.smPlus },
});
