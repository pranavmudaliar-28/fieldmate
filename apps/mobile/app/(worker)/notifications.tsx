import { NotificationInbox } from '../../src/features/notifications/NotificationInbox';

/** S-014 Notifications (docs/02 F-009). */
export default function WorkerNotifications() {
  return <NotificationInbox taskHref={(taskId) => `/(worker)/tasks/${taskId}`} />;
}
