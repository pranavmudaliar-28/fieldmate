import type { ManagedUser, Role } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppHeader } from '../../../src/components/AppHeader';
import { Avatar } from '../../../src/components/Avatar';
import { Badge } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { FilterChips, type FilterChip } from '../../../src/components/FilterChips';
import { Icon } from '../../../src/components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { useTabBarSpacing } from '../../../src/components/TabBar';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  radius,
  spacing,
  tabularNumbers,
  typography,
} from '../../../src/constants/theme';
import { ActiveMark } from '../../../src/features/admin/ActiveMark';
import { ROLE_ICONS, ROLE_LABELS } from '../../../src/features/admin/UserForm';
import { useUserList } from '../../../src/features/admin/hooks';
import { InboxBell } from '../../../src/features/notifications/InboxBell';

const FILTERS: FilterChip<Role | null>[] = [
  { label: 'All', value: null, testID: 'user-filter-ALL' },
  { label: 'Workers', value: 'FIELD_WORKER', testID: 'user-filter-FIELD_WORKER' },
  { label: 'Managers', value: 'MANAGER', testID: 'user-filter-MANAGER' },
  { label: 'Admins', value: 'ADMIN', testID: 'user-filter-ADMIN' },
];

/** S-011 Users: the admin's home screen. */
export default function UsersScreen() {
  const router = useRouter();
  const tabBarSpacing = useTabBarSpacing();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | null>(null);

  const query = useUserList({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(role ? { role } : {}),
  });
  const users = query.data?.pages.flatMap((page) => page.items) ?? [];
  const count = query.isSuccess ? `${users.length}${query.hasNextPage ? '+' : ''}` : null;

  return (
    <View style={styles.screen}>
      <AppHeader
        size="large"
        title="Users"
        right={
          <View style={styles.headerActions}>
            <InboxBell href="/(admin)/notifications" />
            <Button
              label="Add user"
              icon="add"
              size="md"
              fullWidth={false}
              testID="add-user"
              onPress={() => router.push('/(admin)/users/new')}
            />
          </View>
        }
      />

      <View style={styles.controls}>
        <View style={styles.search}>
          <Icon name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            testID="user-search"
            placeholder="Search name or email"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Search users"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.searchInput}
          />
          {count ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.count}>
              {count}
            </Text>
          ) : null}
        </View>
      </View>

      <FilterChips options={FILTERS} selected={role} onSelect={setRole} />

      {query.isPending ? (
        <View style={styles.padded}>
          <LoadingState variant="list" />
        </View>
      ) : null}

      {query.isError ? (
        <View style={styles.padded}>
          <ErrorState message="Couldn't load users." onRetry={() => void query.refetch()} />
        </View>
      ) : null}

      {query.isSuccess ? (
        <FlatList
          testID="user-list"
          data={users}
          keyExtractor={(user) => user.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarSpacing }]}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
            />
          }
          renderItem={({ item, index }) => (
            <UserRow
              user={item}
              first={index === 0}
              last={index === users.length - 1}
              onPress={() => router.push(`/(admin)/users/${item.id}`)}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListFooterComponent={query.isFetchingNextPage ? <LoadingState variant="inline" /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No users found"
              message={
                search || role ? 'Try a different search or filter.' : 'Add your first user.'
              }
            />
          }
        />
      ) : null}
    </View>
  );
}

/** One person: who, how to reach them, what they can do, and whether they can sign in. */
function UserRow({
  user,
  first,
  last,
  onPress,
}: {
  user: ManagedUser;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const label = `${user.name}, ${user.email}, ${ROLE_LABELS[user.role]}, ${
    user.isActive ? 'active' : 'inactive'
  }`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`user-card-${user.id}`}
      style={({ pressed }) => [
        styles.row,
        first && styles.rowFirst,
        last && styles.rowLast,
        !first && styles.rowDivided,
        pressed && styles.rowPressed,
      ]}
    >
      <Avatar
        name={user.name}
        size="md"
        variant={user.isActive ? 'person' : 'muted'}
        style={styles.avatar}
      />
      <View style={styles.rowText}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={[styles.name, !user.isActive && styles.nameInactive]}
          numberOfLines={1}
        >
          {user.name}
        </Text>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.email}
          numberOfLines={1}
        >
          {user.email}
        </Text>
        <View style={styles.tags}>
          <Badge label={ROLE_LABELS[user.role]} icon={ROLE_ICONS[user.role]} />
          <ActiveMark active={user.isActive} />
        </View>
      </View>
      <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  controls: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.inputHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  count: { ...typography.mono, ...tabularNumbers, color: colors.textSecondary },
  list: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm, flexGrow: 1 },
  padded: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  rowFirst: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  rowLast: {
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    ...elevation.card,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  avatar: { width: 52, height: 52 },
  rowText: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  nameInactive: { color: colors.textSecondary },
  email: { ...typography.secondary, color: colors.textSecondary },
  tags: { flexDirection: 'row', alignItems: 'center', gap: spacing.smPlus, marginTop: spacing.xs },
});
