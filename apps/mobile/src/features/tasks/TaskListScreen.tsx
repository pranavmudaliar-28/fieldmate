import type { TaskStatus } from '@fieldmate/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { FilterChips, type FilterChip } from '../../components/FilterChips';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useTabBarSpacing } from '../../components/TabBar';
import { TaskCard } from '../../components/TaskCard';
import { colors, layout, radius, spacing, statusAppearance } from '../../constants/theme';
import { useTaskList } from './hooks';

const FILTERS: FilterChip<TaskStatus | null>[] = [
  { label: 'All', value: null, testID: 'filter-ALL' },
  ...(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'] as TaskStatus[]).map(
    (status) => ({
      label: statusAppearance[status].label,
      value: status,
      testID: `filter-${status}`,
      tone: statusAppearance[status].tone,
    }),
  ),
];

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
  const [filter, setFilter] = useState<TaskStatus | null>(initial);

  const query = useTaskList(filter ? [filter] : undefined);
  const tasks = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View style={styles.screen}>
      <AppHeader
        size="large"
        title="All tasks"
        right={
          <Pressable
            onPress={onCreateTask}
            accessibilityRole="button"
            accessibilityLabel="Create task"
            testID="create-task-button"
            style={styles.create}
          >
            <Icon name="add" size={24} color={colors.onAccent} />
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
            <EmptyState
              icon={filter ? 'filter-outline' : 'clipboard-outline'}
              title={filter ? 'No tasks with this status' : 'No tasks yet'}
              message={
                filter
                  ? 'Try a different filter.'
                  : 'Create your first task to assign work to the field.'
              }
              {...(filter ? {} : { action: { label: 'Create task', onPress: onCreateTask } })}
            />
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  create: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: layout.screenPadding, gap: spacing.smPlus },
  padded: { paddingHorizontal: layout.screenPadding },
});
