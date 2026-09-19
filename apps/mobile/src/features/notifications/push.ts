import type { PushPlatform } from '@fieldmate/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiRequest } from '../../services/http';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** Pushes only work on real devices and development builds, never in a simulator. */
export function isPushSupported(): boolean {
  return Device.isDevice;
}

export async function getPermissionState(): Promise<PermissionState> {
  if (!isPushSupported()) return 'unsupported';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  if (!isPushSupported()) return 'unsupported';
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
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
  if ((await getPermissionState()) !== 'granted') return null;

  try {
    const id = projectId();
    const { data: token } = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : {});

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
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Task updates',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}
