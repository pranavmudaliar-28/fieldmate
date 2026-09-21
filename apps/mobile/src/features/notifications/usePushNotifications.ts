import type { PushNotificationData, Role } from '@fieldmate/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { taskKeys } from '../tasks/hooks';
import {
  configureAndroidChannel,
  getPermissionState,
  loadNotifications,
  registerDeviceForPush,
  requestPermission,
  type PermissionState,
} from './push';

function isTaskNotification(data: unknown): data is PushNotificationData {
  const value = data as PushNotificationData | undefined;
  return typeof value?.taskId === 'string' && typeof value?.type === 'string';
}

/**
 * Registers the device, refreshes a task when a push about it arrives, and
 * opens that task when the notification is tapped (docs/02 §6.3, docs/04 §4).
 * Does nothing where push is unsupported, such as Expo Go.
 */
export function usePushNotifications(role: Role | undefined) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  const openTask = useCallback(
    (taskId: string) => {
      const group = role === 'MANAGER' ? '(manager)' : '(worker)';
      router.push(`/${group}/tasks/${taskId}`);
    },
    [role, router],
  );

  useEffect(() => {
    if (!role) return;
    let active = true;

    void (async () => {
      await configureAndroidChannel();
      const state = await getPermissionState();
      if (!active) return;
      setPermission(state);
      if (state === 'granted') await registerDeviceForPush();
    })();

    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (!role) return;
    let received: { remove: () => void } | undefined;
    let tapped: { remove: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      const notifications = loadNotifications();
      if (!notifications || cancelled) return;

      // A push about a task means its details may have changed.
      received = notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;
        if (isTaskNotification(data)) {
          void queryClient.invalidateQueries({ queryKey: taskKeys.detail(data.taskId) });
          void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        }
      });

      tapped = notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (isTaskNotification(data)) openTask(data.taskId);
      });

      // Opening the app from a notification while it was closed.
      const last = await notifications.getLastNotificationResponseAsync();
      const data = last?.notification.request.content.data;
      if (!cancelled && data && isTaskNotification(data)) openTask(data.taskId);
    })();

    return () => {
      cancelled = true;
      received?.remove();
      tapped?.remove();
    };
  }, [role, queryClient, openTask]);

  const enable = useCallback(async () => {
    const state = await requestPermission();
    setPermission(state);
    if (state === 'granted') await registerDeviceForPush();
    return state;
  }, []);

  return { permission, enable };
}
