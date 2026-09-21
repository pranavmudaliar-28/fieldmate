import { Tabs } from 'expo-router/js-tabs';
import { FieldTabBar, type TabConfig } from '../../../src/components/TabBar';

const TABS: TabConfig[] = [
  { name: 'index', label: 'Users', icon: 'people-outline', activeIcon: 'people' },
  { name: 'tasks', label: 'Tasks', icon: 'list-outline', activeIcon: 'list' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

/** S-011 / tasks / Profile. User forms are pushed above these. */
export default function AdminTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FieldTabBar {...props} tabs={TABS} />}
      screenOptions={{ headerShown: false }}
    />
  );
}
