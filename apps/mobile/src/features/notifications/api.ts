import type { Notification, Paginated, UnreadCount } from '@fieldmate/shared';
import { apiRequest } from '../../services/http';

export function fetchNotifications(cursor?: string): Promise<Paginated<Notification>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<Paginated<Notification>>(`/notifications${query}`);
}

export function fetchUnreadCount(): Promise<UnreadCount> {
  return apiRequest<UnreadCount>('/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiRequest<void>('/notifications/read-all', { method: 'POST' });
}
