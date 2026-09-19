import type { TaskStatus } from '@fieldmate/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
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
import { useTaskList } from '../../../src/features/tasks/hooks';

const FILTERS: { label: string; value: TaskStatus | null }[] = [
  { label: 'All', value: null },
  ...(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'] as TaskStatus[]).map(
    (status) => ({ label: statusAppearance[status].label, value: status }),
  ),
];

/** S-003 Task List (docs/04 §5): status filter chips, newest update first. */
export default function ManagerTaskList() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const initial = FILTERS.find((f) => f.value === params.status)?.value ?? null;
  const [filter, setFilter] = useState<TaskStatus | null>(initial);

  const query = useTaskList(filter ? [filter] : undefined);
  const tasks = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'All tasks' }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((option) => {
          const selected = option.value === filter;
          return (
            <Pressable
              key={option.label}
              onPress={() => setFilter(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`filter-${option.value ?? 'ALL'}`}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                style={[styles.chipLabel, selected && styles.chipLabelSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {query.isPending ? (
        <View style={styles.padded}>
          <LoadingState variant="list" />
        </View>
      ) : null}

      {query.isError ? (
        <ErrorState message="Couldn't load tasks." onRetry={() => void query.refetch()} />
      ) : null}

      {query.isSuccess ? (
        <FlatList
          testID="manager-task-list"
          data={tasks}
          keyExtractor={(task) => task.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
            />
          }
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              showWorker
              showRejection
              onPress={() => router.push(`/(manager)/tasks/${item.id}`)}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListFooterComponent={query.isFetchingNextPage ? <LoadingState variant="inline" /> : null}
          ListEmptyComponent={
            <EmptyState
              title={filter ? 'No tasks with this status' : 'No tasks yet'}
              message={
                filter
                  ? 'Try a different filter.'
                  : 'Create your first task to assign work to the field.'
              }
              {...(filter
                ? {}
                : {
                    action: {
                      label: 'Create task',
                      onPress: () => router.push('/(manager)/tasks/new'),
                    },
                  })}
            />
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filters: { gap: spacing.sm, padding: layout.screenPadding },
  chip: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { ...typography.secondary, color: colors.textPrimary },
  chipLabelSelected: { color: colors.onPrimary, fontWeight: '600' },
  list: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xl, gap: spacing.sm },
  padded: { paddingHorizontal: layout.screenPadding },
});
