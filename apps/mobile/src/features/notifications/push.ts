import type { PushPlatform } from '@fieldmate/shared';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsTypes from 'expo-notifications';
import { Platform } from 'react-native';
import { apiRequest } from '../../services/http';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/**
 * Expo Go dropped Android push notifications in SDK 53, and importing
 * expo-notifications there throws. Everything else in the app works in Expo Go,
 * so push is detected and skipped rather than being allowed to crash the app.
 */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * Pushes need a real device and a development or production build.
 *
 * A browser counts as a real device to expo-device, so web is excluded
 * explicitly: Expo's push service is native-only, and loading
 * expo-notifications there would fail at import.
 */
export function isPushSupported(): boolean {
  return Platform.OS !== 'web' && Device.isDevice && !isExpoGo();
}

// Type-only import: erased at build time, so the module is never loaded here.
type NotificationsModule = typeof NotificationsTypes;

let cached: NotificationsModule | null | undefined;

/**
 * Loaded on first use, so Expo Go never evaluates the module — importing it
 * there throws. A lazy require (rather than a dynamic import) keeps this
 * working under both Metro and Jest.
 */
export function loadNotifications(): NotificationsModule | null {
  if (!isPushSupported()) return null;
  if (cached !== undefined) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

export async function getPermissionState(): Promise<PermissionState> {
  const notifications = loadNotifications();
  if (!notifications) return 'unsupported';

  const { status, canAskAgain } = await notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  const notifications = loadNotifications();
  if (!notifications) return 'unsupported';

  const { status, canAskAgain } = await notifications.requestPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
}

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId
  );
}

/**
 * Registers this device with the API so the three approved triggers can reach
 * it (docs/02 §6.3). Failures are silent: pushes are a convenience, and the
 * app works without them.
 */
export async function registerDeviceForPush(): Promise<string | null> {
  const notifications = loadNotifications();
  if (!notifications) return null;
  if ((await getPermissionState()) !== 'granted') return null;

  try {
    const id = projectId();
    const { data: token } = await notifications.getExpoPushTokenAsync(id ? { projectId: id } : {});

    await apiRequest<void>('/users/me/push-tokens', {
      method: 'POST',
      body: { token, platform: (Platform.OS === 'ios' ? 'ios' : 'android') as PushPlatform },
      ignoreUnauthorized: true,
    });
    return token;
  } catch {
    return null;
  }
}

/** Android needs a channel before notifications appear with sound. */
export async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const notifications = loadNotifications();
  if (!notifications) return;

  await notifications.setNotificationChannelAsync('default', {
    name: 'Task updates',
    importance: notifications.AndroidImportance.DEFAULT,
  });
}
