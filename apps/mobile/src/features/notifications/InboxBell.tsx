import { useRouter, type Href } from 'expo-router';
import { NotificationBell } from '../../components/NotificationBell';
import { useUnreadCount } from './hooks';

/**
 * The bell as a screen drops it into a header: count and navigation already
 * wired, so a dashboard adds one element rather than a hook and a handler.
 */
export function InboxBell({ href }: { href: Href }) {
  const router = useRouter();
  const unread = useUnreadCount();

  return <NotificationBell unread={unread} onPress={() => router.push(href)} />;
}
