import type { TaskListItem } from '@fieldmate/shared';
import { Stack, useRouter } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { TaskCard } from '../../../src/components/TaskCard';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../../src/constants/theme';
import { useTaskList } from '../../../src/features/tasks/hooks';

/** S-007 My Tasks: Active (in progress first) and Completed history. */
export default function MyTasks() {
  const router = useRouter();
  const active = useTaskList(['IN_PROGRESS', 'ASSIGNED']);
  const completed = useTaskList(['COMPLETED']);

  const activeTasks = (active.data?.pages.flatMap((page) => page.items) ?? []).sort((a, b) =>
    a.status === b.status ? 0 : a.status === 'IN_PROGRESS' ? -1 : 1,
  );
  const completedTasks = completed.data?.pages.flatMap((page) => page.items) ?? [];

  const sections: { title: string; data: TaskListItem[]; emptyMessage: string }[] = [
    { title: 'Active', data: activeTasks, emptyMessage: 'No active tasks.' },
    {
      title: 'Completed',
      data: completedTasks,
      emptyMessage: 'Completed tasks will appear here.',
    },
  ];

  const refresh = () => {
    void active.refetch();
    void completed.refetch();
  };

  if (active.isPending && completed.isPending) {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: true, title: 'My tasks' }} />
        <View style={styles.padded}>
          <LoadingState variant="list" />
        </View>
      </SafeAreaView>
    );
  }

  if (active.isError && completed.isError) {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: true, title: 'My tasks' }} />
        <ErrorState message="Couldn't load your tasks." onRetry={refresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'My tasks' }} />
      <SectionList
        sections={sections}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={active.isRefetching || completed.isRefetching}
            onRefresh={refresh}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            {section.title}
          </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: layout.screenPadding, gap: spacing.sm, paddingBottom: spacing.xl },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  empty: { ...typography.secondary, color: colors.textSecondary },
  padded: { padding: layout.screenPadding },
});
