import { WORKER_PROGRESS_STATUSES, type TaskListItem } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../src/components/AppHeader';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { useTabBarSpacing } from '../../../src/components/TabBar';
import { TaskCard } from '../../../src/components/TaskCard';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../../src/constants/theme';
import { useTaskList } from '../../../src/features/tasks/hooks';

type Section = { title: string; data: TaskListItem[]; emptyMessage: string };

/** S-007 My Tasks: Active (in progress first) and Completed history. */
export default function MyTasks() {
  const router = useRouter();
  const tabBarSpacing = useTabBarSpacing();
  // Every step the worker has taken on but not finished.
  const active = useTaskList([...WORKER_PROGRESS_STATUSES]);
  const completed = useTaskList(['COMPLETED']);

  // Furthest along first: the job in hand sits above what is still waiting.
  const activeTasks = (active.data?.pages.flatMap((page) => page.items) ?? []).sort(
    (a, b) =>
      WORKER_PROGRESS_STATUSES.indexOf(b.status as never) -
      WORKER_PROGRESS_STATUSES.indexOf(a.status as never),
  );
  const completedTasks = completed.data?.pages.flatMap((page) => page.items) ?? [];

  const sections: Section[] = [
    { title: 'Active', data: activeTasks, emptyMessage: 'No active tasks.' },
    { title: 'Completed', data: completedTasks, emptyMessage: 'Completed tasks will appear here.' },
  ];

  const refresh = () => {
    void active.refetch();
    void completed.refetch();
  };

  if (active.isPending && completed.isPending) {
    return (
      <View style={styles.screen}>
        <AppHeader size="large" title="My tasks" />
        <View style={styles.padded}>
          <LoadingState variant="list" />
        </View>
      </View>
    );
  }

  if (active.isError && completed.isError) {
    return (
      <View style={styles.screen}>
        <AppHeader size="large" title="My tasks" />
        <View style={styles.padded}>
          <ErrorState message="Couldn't load your tasks." onRetry={refresh} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader size="large" title="My tasks" />
      <SectionList
        sections={sections}
        keyExtractor={(task) => task.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarSpacing }]}
        // Sticky headers keep the section visible while a long history scrolls.
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl
            refreshing={active.isRefetching || completed.isRefetching}
            onRefresh={refresh}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.sectionTitle}
              accessibilityRole="header"
            >
              {section.title}
            </Text>
            <View style={styles.rule} />
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.sectionCount}>
              {section.data.length}
            </Text>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.empty}>
              {section.emptyMessage}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TaskCard task={item} onPress={() => router.push(`/(worker)/tasks/${item.id}`)} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (completed.hasNextPage && !completed.isFetchingNextPage)
            void completed.fetchNextPage();
        }}
        ListFooterComponent={
          completed.isFetchingNextPage ? <LoadingState variant="inline" /> : null
        }
        ListEmptyComponent={
          <EmptyState title="No tasks yet" message="Tasks assigned to you will appear here." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: layout.screenPadding, gap: spacing.smPlus },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  sectionCount: { ...typography.label, color: colors.textDisabled },
  empty: { ...typography.secondary, color: colors.textSecondary, paddingVertical: spacing.sm },
  padded: { padding: layout.screenPadding },
});
