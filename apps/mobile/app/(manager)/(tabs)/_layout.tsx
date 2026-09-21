import { Tabs } from 'expo-router/js-tabs';
import { FieldTabBar, type TabConfig } from '../../../src/components/TabBar';
import { TASK_PAGE_LIMIT } from '../../../src/features/tasks/constants';
import { useTaskList } from '../../../src/features/tasks/hooks';

const TABS: TabConfig[] = [
  { name: 'index', label: 'Overview', icon: 'grid-outline', activeIcon: 'grid' },
  { name: 'tasks', label: 'Tasks', icon: 'list-outline', activeIcon: 'list' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

/** S-002 / S-003 / Profile. Task details and forms are pushed above these. */
export default function ManagerTabsLayout() {
  // Shares a cache key with the overview, so the badge costs no extra request.
  const rejected = useTaskList(['REJECTED'], TASK_PAGE_LIMIT);
  const needsAttention = rejected.data?.pages[0]?.items.length ?? 0;

  return (
    <Tabs
      tabBar={(props) => <FieldTabBar {...props} tabs={TABS} badges={{ tasks: needsAttention }} />}
      screenOptions={{ headerShown: false }}
    />
  );
}
