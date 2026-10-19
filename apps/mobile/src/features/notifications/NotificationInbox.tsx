import type { Notification, NotificationType } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  radius,
  spacing,
  statusAppearance,
  tabularNumbers,
  typography,
  type IconName,
} from '../../constants/theme';
import { formatRelativeTime } from '../../utils/format';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './hooks';

/** Each event borrows the colour and icon of the status it is about. */
const APPEARANCE: Record<NotificationType, { icon: IconName; text: string; tint: string }> = {
  TASK_ASSIGNED: statusAppearance.ASSIGNED,
  TASK_UPDATED: { ...statusAppearance.ASSIGNED, icon: 'pencil-outline' },
  TASK_COMPLETED: statusAppearance.COMPLETED,
  TASK_REJECTED: statusAppearance.REJECTED,
  TASK_CANCELLED: statusAppearance.CANCELLED,
  TASK_REOPENED: { ...statusAppearance.ACCEPTED, icon: 'refresh-outline' },
  TASK_AWAITING_REVIEW: statusAppearance.AWAITING_REVIEW,
  TASK_CHANGES_REQUESTED: { ...statusAppearance.IN_PROGRESS, icon: 'create-outline' },
};

export type NotificationInboxProps = {
  /** Where a notification leads, which differs per role group. */
  taskHref: (taskId: string) => string;
};

type Section = { title: string; data: Notification[] };

/**
 * The inbox (docs/02 F-009). One screen body, used by each role's route: the
 * list is identical, only the task it opens differs. Unread items are "New"
 * and sit apart from the rest.
 */
export function NotificationInbox({ taskHref }: NotificationInboxProps) {
  const router = useRouter();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const unread = items.filter((item) => item.readAt === null);
  const read = items.filter((item) => item.readAt !== null);
  const sections: Section[] = [
    ...(unread.length > 0 ? [{ title: 'New', data: unread }] : []),
    ...(read.length > 0 ? [{ title: 'Earlier', data: read }] : []),
  ];

  const open = (item: Notification) => {
    // Opening it is the acknowledgement; no separate "mark read" to remember.
    if (item.readAt === null) markRead.mutate(item.id);
    router.push(taskHref(item.taskId) as Parameters<typeof router.push>[0]);
  };

  const heading = (
    <View style={styles.titleRow}>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={styles.title}
        accessibilityRole="header"
      >
        Notifications
      </Text>
      {unread.length > 0 ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.newCount}>
          {unread.length} new
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader
        title=""
        onBack={() => router.back()}
        right={
          unread.length > 0 ? (
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
          {heading}
          <LoadingState variant="list" />
        </View>
      ) : query.isError ? (
        <View style={styles.padded}>
          {heading}
          <ErrorState
            message="Couldn't load your notifications."
            onRetry={() => void query.refetch()}
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          testID="notification-list"
          stickySectionHeadersEnabled={false}
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
          ListHeaderComponent={heading}
          ListFooterComponent={query.isFetchingNextPage ? <LoadingState variant="inline" /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="Nothing yet"
              message="When a task is submitted, rejected or updated, it shows up here."
            />
          }
          renderSectionHeader={({ section }) => (
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.sectionLabel}
              accessibilityRole="header"
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item, index, section }) => (
            <Row
              item={item}
              first={index === 0}
              last={index === section.data.length - 1}
              onPress={() => open(item)}
            />
          )}
        />
      )}
    </View>
  );
}

/** One row of a grouped card; the first and last round the group's corners. */
function Row({
  item,
  first,
  last,
  onPress,
}: {
  item: Notification;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const appearance = APPEARANCE[item.type];
  const unread = item.readAt === null;
  const when = shortTime(item.createdAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // Unread is a weight and a dot; a screen reader needs it said.
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}, ${item.body}, ${formatRelativeTime(item.createdAt)}`}
      testID={`notification-${item.id}`}
      style={({ pressed }) => [
        styles.row,
        unread ? styles.rowUnread : styles.rowRead,
        first && styles.rowFirst,
        last && styles.rowLast,
        !first && styles.rowDivided,
        pressed && styles.rowPressed,
      ]}
    >
      <View
        style={[styles.emblem, { backgroundColor: unread ? appearance.tint : colors.surfaceMuted }]}
      >
        <Icon
          name={appearance.icon}
          size={22}
          color={unread ? appearance.text : colors.textSecondary}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={[styles.rowTitle, unread && styles.rowTitleUnread]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={[styles.time, unread && styles.timeUnread]}
          >
            {when}
          </Text>
        </View>
        <View style={styles.messageLine}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.message}
            numberOfLines={2}
          >
            {item.body}
          </Text>
          {unread ? <View style={styles.dot} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** "2m", "3h", "Yesterday", "Thu": a column of times, not a column of sentences. */
function shortTime(iso: string): string {
  const relative = formatRelativeTime(iso);
  if (relative === 'just now') return 'now';
  if (relative.endsWith(' ago')) return relative.replace(' ago', '');
  if (relative === 'yesterday') return 'Yesterday';
  const date = new Date(iso);
  const days = (Date.now() - date.getTime()) / 86_400_000;
  return days < 7
    ? date.toLocaleDateString(undefined, { weekday: 'short' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  padded: { padding: layout.screenPadding, paddingTop: 0, gap: spacing.md },
  list: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xl, flexGrow: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.smPlus,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.hero, color: colors.textPrimary },
  newCount: { ...typography.bodyStrong, color: colors.textSecondary },
  markAll: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  markAllText: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    paddingTop: spacing.mdPlus,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.smPlus,
    padding: spacing.md,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: { backgroundColor: colors.surface, borderColor: colors.surface },
  rowRead: { backgroundColor: colors.background },
  rowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    ...elevation.card,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  rowPressed: { opacity: 0.75 },
  emblem: {
    width: 48,
    height: 48,
    borderRadius: radius.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing.xs },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  rowTitle: { ...typography.body, fontSize: 17, color: colors.textPrimary, flex: 1 },
  rowTitleUnread: { fontFamily: typography.bodyStrong.fontFamily },
  time: { ...typography.caption, ...tabularNumbers, color: colors.textSecondary },
  timeUnread: { color: colors.textPrimary, fontFamily: typography.secondaryStrong.fontFamily },
  messageLine: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  message: {
    ...typography.secondary,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    flex: 1,
  },
  /** Unread mark: ink in a signal ring, so it reads on white in sun and in greyscale. */
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.accent,
  },
});
