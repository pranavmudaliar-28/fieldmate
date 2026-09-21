import { Tabs } from 'expo-router/js-tabs';
import { FieldTabBar, type TabConfig } from '../../../src/components/TabBar';

const TABS: TabConfig[] = [
  { name: 'index', label: 'Today', icon: 'home-outline', activeIcon: 'home' },
  { name: 'tasks', label: 'My tasks', icon: 'list-outline', activeIcon: 'list' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

/** S-006 / S-007 / Profile. Task details are pushed above these, without tabs. */
export default function WorkerTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FieldTabBar {...props} tabs={TABS} />}
      screenOptions={{ headerShown: false }}
    />
  );
}
