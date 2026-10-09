import { NotificationInbox } from '../../src/features/notifications/NotificationInbox';

/**
 * S-014 Notifications (docs/02 F-009). Opens the manager task screens, which
 * is where the admin tasks tab already sends them — admins manage tasks with
 * the same screens, not a second copy of them.
 */
export default function AdminNotifications() {
  return <NotificationInbox taskHref={(taskId) => `/(manager)/tasks/${taskId}`} />;
}
