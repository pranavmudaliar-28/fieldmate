import { WORKER_PROGRESS_STATUSES, type TaskListItem, type TaskStatus } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../src/components/AppHeader';
import { Icon } from '../../../src/components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { useTabBarSpacing } from '../../../src/components/TabBar';
import { RowGroup, TaskRow } from '../../../src/components/TaskRow';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  tabularNumbers,
  typography,
  type IconName,
} from '../../../src/constants/theme';
import { useTaskList } from '../../../src/features/tasks/hooks';
import { formatRelativeTime } from '../../../src/utils/format';

type Section = {
  title: string;
  icon: IconName;
  /** One entry holding the whole group, so each section draws as one card. */
  data: TaskListItem[][];
  count: number;
  emptyMessage: string | null;
  detail: (task: TaskListItem) => string;
};

const ACTIVE: TaskStatus[] = [...WORKER_PROGRESS_STATUSES];

/** Short day for a finished job, e.g. "Thu, 8 Oct". */
function shortDay(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** S-007 My Tasks: what is active, what is with the manager, and what is done. */
export default function MyTasks() {
  const router = useRouter();
  const tabBarSpacing = useTabBarSpacing();
  const active = useTaskList(ACTIVE);
  const review = useTaskList(['AWAITING_REVIEW']);
  const completed = useTaskList(['COMPLETED']);

  // Furthest along first: the job in hand sits above what is still waiting.
  const activeTasks = (active.data?.pages.flatMap((page) => page.items) ?? []).sort(
    (a, b) => ACTIVE.indexOf(b.status) - ACTIVE.indexOf(a.status),
  );
  const reviewTasks = review.data?.pages.flatMap((page) => page.items) ?? [];
  const completedTasks = completed.data?.pages.flatMap((page) => page.items) ?? [];

  const sections: Section[] = [
    {
      title: 'Active',
      icon: 'flash-outline',
      data: activeTasks.length > 0 ? [activeTasks] : [],
      count: activeTasks.length,
      emptyMessage: 'No active tasks.',
      detail: (task) => task.address,
    },
    ...(reviewTasks.length > 0
      ? [
          {
            title: 'Awaiting review',
            icon: 'hourglass-outline' as IconName,
            data: [reviewTasks],
            count: reviewTasks.length,
            emptyMessage: null,
            detail: (task: TaskListItem) => `Sent ${formatRelativeTime(task.updatedAt)}`,
          },
        ]
      : []),
    {
      title: 'Completed',
      icon: 'checkmark-done-outline',
      data: completedTasks.length > 0 ? [completedTasks] : [],
      count: completedTasks.length,
      emptyMessage: 'Completed tasks will appear here.',
      detail: (task) => shortDay(task.completedAt ?? task.updatedAt),
    },
  ];

  const refresh = () => {
    void active.refetch();
    void review.refetch();
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
        keyExtractor={(group, index) => group[0]?.id ?? String(index)}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarSpacing }]}
        // Sticky headers keep the section visible while a long history scrolls.
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl
            refreshing={active.isRefetching || review.isRefetching || completed.isRefetching}
            onRefresh={refresh}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Icon name={section.icon} size={18} color={colors.textPrimary} />
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.sectionTitle}
              accessibilityRole="header"
            >
              {section.title}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.sectionCount}>
              {section.count}
            </Text>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.count === 0 && section.emptyMessage ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.empty}>
              {section.emptyMessage}
            </Text>
          ) : null
        }
        renderItem={({ item, section }) => (
          <RowGroup>
            {item.map((task) => (
              <TaskRow
                key={task.id}
                title={task.title}
                status={task.status}
                detail={section.detail(task)}
                onPress={() => router.push(`/(worker)/tasks/${task.id}`)}
                testID={`task-card-${task.id}`}
              />
            ))}
          </RowGroup>
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
  list: { paddingHorizontal: layout.screenPadding },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    paddingTop: spacing.mdPlus,
    paddingBottom: spacing.smPlus,
  },
  sectionTitle: { ...typography.label, fontSize: 15, color: colors.textPrimary },
  sectionCount: {
    ...typography.label,
    fontSize: 15,
    ...tabularNumbers,
    color: colors.textSecondary,
  },
  empty: { ...typography.secondary, color: colors.textSecondary, paddingVertical: spacing.sm },
  padded: { padding: layout.screenPadding },
});
