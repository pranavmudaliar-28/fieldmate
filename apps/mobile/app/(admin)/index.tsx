import type { ManagedUser, Role } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
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
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { DashboardHeader } from '../../src/components/DashboardHeader';
import { Input } from '../../src/components/Input';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/States';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  toneColors,
  typography,
} from '../../src/constants/theme';
import { ROLE_LABELS } from '../../src/features/admin/UserForm';
import { useUserList } from '../../src/features/admin/hooks';

const FILTERS: { label: string; value: Role | null }[] = [
  { label: 'All', value: null },
  { label: 'Admins', value: 'ADMIN' },
  { label: 'Managers', value: 'MANAGER' },
  { label: 'Workers', value: 'FIELD_WORKER' },
];

/** S-011 Users: the admin's home screen. */
export default function UsersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | null>(null);

  const query = useUserList({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(role ? { role } : {}),
  });
  const users = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <DashboardHeader />

      <View style={styles.controls}>
        <Input
          label="Search"
          testID="user-search"
          placeholder="Name or email"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map((filter) => {
            const selected = filter.value === role;
            return (
              <Pressable
                key={filter.label}
                onPress={() => setRole(filter.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`user-filter-${filter.value ?? 'ALL'}`}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                  style={[styles.chipLabel, selected && styles.chipLabelSelected]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <Button
            label="Add user"
            testID="add-user"
            onPress={() => router.push('/(admin)/users/new')}
            style={styles.action}
          />
          <Button
            label="Tasks"
            variant="secondary"
            testID="go-to-tasks"
            onPress={() => router.push('/(manager)')}
            style={styles.action}
          />
        </View>
      </View>

      {query.isPending ? (
        <View style={styles.padded}>
          <LoadingState variant="list" />
        </View>
      ) : null}

      {query.isError ? (
        <ErrorState message="Couldn't load users." onRetry={() => void query.refetch()} />
      ) : null}

      {query.isSuccess ? (
        <FlatList
          testID="user-list"
          data={users}
          keyExtractor={(user) => user.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
            />
          }
          renderItem={({ item }) => (
            <UserRow user={item} onPress={() => router.push(`/(admin)/users/${item.id}`)} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListFooterComponent={query.isFetchingNextPage ? <LoadingState variant="inline" /> : null}
          ListEmptyComponent={
            <EmptyState
              title="No users found"
              message={
                search || role ? 'Try a different search or filter.' : 'Add your first user.'
              }
            />
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

function UserRow({ user, onPress }: { user: ManagedUser; onPress: () => void }) {
  const label = `${user.name}, ${ROLE_LABELS[user.role]}${user.isActive ? '' : ', inactive'}`;

  return (
    <Card onPress={onPress} accessibilityLabel={label} testID={`user-card-${user.id}`}>
      <View style={styles.rowTop}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.name}
          numberOfLines={1}
        >
          {user.name}
        </Text>
        {user.isActive ? null : (
          <View style={styles.inactiveBadge}>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.inactiveLabel}>
              Inactive
            </Text>
          </View>
        )}
      </View>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.meta} numberOfLines={1}>
        {user.email}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.meta}>
        {ROLE_LABELS[user.role]}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controls: { padding: layout.screenPadding, gap: spacing.sm },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
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
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  list: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xl, gap: spacing.sm },
  padded: { paddingHorizontal: layout.screenPadding },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.body, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  meta: { ...typography.secondary, color: colors.textSecondary },
  inactiveBadge: {
    backgroundColor: toneColors.neutral.tint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inactiveLabel: { ...typography.caption, color: toneColors.neutral.text },
});
