import { NotificationInbox } from '../../src/features/notifications/NotificationInbox';

/** S-014 Notifications (docs/02 F-009). */
export default function ManagerNotifications() {
  return <NotificationInbox taskHref={(taskId) => `/(manager)/tasks/${taskId}`} />;
}
