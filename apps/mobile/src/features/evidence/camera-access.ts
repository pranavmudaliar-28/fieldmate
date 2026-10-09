import { Linking } from 'react-native';

/**
 * Why the camera cannot be opened at all here, or null when only the
 * permission stands in the way. A device always has a camera to ask for.
 */
export function unavailableReason(): string | null {
  return null;
}

/** What to tell a worker who has turned the permission off, and how to fix it. */
export const deniedHelp: { body: string; action: string | null } = {
  body: 'Camera access is off. Turn it on in Settings to add photos.',
  action: 'Open Settings',
};

export function openPermissionSettings(): void {
  void Linking.openSettings();
}
