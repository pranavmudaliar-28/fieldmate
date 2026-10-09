import type { Notification, NotificationType } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  toneColors,
  typography,
  type IconName,
  type Tone,
} from '../../constants/theme';
import { formatRelativeTime } from '../../utils/format';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './hooks';

/** How each event reads at a glance, before the words are. */
const APPEARANCE: Record<NotificationType, { icon: IconName; tone: Tone }> = {
  TASK_ASSIGNED: { icon: 'clipboard-outline', tone: 'info' },
  TASK_UPDATED: { icon: 'create-outline', tone: 'neutral' },
  TASK_COMPLETED: { icon: 'checkmark-circle-outline', tone: 'success' },
  TASK_REJECTED: { icon: 'close-circle-outline', tone: 'error' },
  TASK_CANCELLED: { icon: 'ban-outline', tone: 'error' },
  TASK_REOPENED: { icon: 'refresh-outline', tone: 'warning' },
};

export type NotificationInboxProps = {
  /** Where a notification leads, which differs per role group. */
  taskHref: (taskId: string) => string;
};

/**
 * The inbox (docs/02 F-009). One screen body, used by each role's route: the
 * list is identical, only the task it opens differs.
 */
export function NotificationInbox({ taskHref }: NotificationInboxProps) {
  const router = useRouter();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const hasUnread = items.some((item) => item.readAt === null);

  const open = (item: Notification) => {
    // Opening it is the acknowledgement; no separate "mark read" to remember.
    if (item.readAt === null) markRead.mutate(item.id);
    router.push(taskHref(item.taskId) as Parameters<typeof router.push>[0]);
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        size="large"
        title="Notifications"
        onBack={() => router.back()}
        right={
          hasUnread ? (
            <Pressable
              onPress={() => markAllRead.mutate()}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
              testID="mark-all-read"
              style={styles.markAll}
            >
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.markAllText}>
                Mark all read
              </Text>
            </Pressable>
          ) : null
        }
      />

      {query.isPending ? (
        <View style={styles.padded}>
          <LoadingState variant="list" />
        </View>
      ) : query.isError ? (
        <View style={styles.padded}>
          <ErrorState
            message="Couldn't load your notifications."
            onRetry={() => void query.refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          testID="notification-list"
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListFooterComponent={query.isFetchingNextPage ? <LoadingState variant="inline" /> : null}
          ListEmptyComponent={
            <EmptyState title="Nothing yet" message="Updates about your tasks will appear here." />
          }
          renderItem={({ item }) => <Row item={item} onPress={() => open(item)} />}
        />
      )}
    </View>
  );
}

function Row({ item, onPress }: { item: Notification; onPress: () => void }) {
  const { icon, tone } = APPEARANCE[item.type];
  const unread = item.readAt === null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // Unread is a colour and a dot; a screen reader needs it said.
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}, ${item.body}, ${formatRelativeTime(item.createdAt)}`}
      testID={`notification-${item.id}`}
      style={({ pressed }) => [
        styles.row,
        unread && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.emblem, { backgroundColor: toneColors[tone].tint }]}>
        <Icon name={icon} size={18} color={toneColors[tone].text} />
      </View>

      <View style={styles.body}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.title}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.message}
          numberOfLines={2}
        >
          {item.body}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.time}>
          {formatRelativeTime(item.createdAt)}
        </Text>
      </View>

      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  padded: { padding: layout.screenPadding },
  list: { padding: layout.screenPadding, gap: spacing.smPlus },
  markAll: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  markAllText: { ...typography.secondaryStrong, color: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.smPlus,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceMuted,
  },
  rowUnread: { backgroundColor: colors.surface },
  rowPressed: { opacity: 0.7 },
  emblem: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  message: { ...typography.secondary, color: colors.textSecondary },
  time: { ...typography.caption, color: colors.textDisabled, marginTop: 2 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    marginTop: spacing.sm,
  },
});
