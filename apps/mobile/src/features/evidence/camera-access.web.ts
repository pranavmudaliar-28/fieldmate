/**
 * A browser exposes the camera only on a secure origin. The dev server is
 * served over plain http on the LAN address so phones can reach it, and there
 * `getUserMedia` is not denied but absent — the permission prompt could never
 * succeed. Say why instead of showing a prompt that leads nowhere.
 */
export function unavailableReason(): string | null {
  if (typeof window === 'undefined' || window.isSecureContext) return null;
  return 'The camera needs a secure connection. Open FieldMate at localhost on this machine, or use it on a phone.';
}

/**
 * There is no Settings app to send anyone to: a site permission is changed
 * from the padlock in the address bar. react-native-web has no
 * `Linking.openSettings`, so offering the button would throw.
 */
export const deniedHelp: { body: string; action: string | null } = {
  body: 'Camera access is blocked for this site. Allow it from the padlock in the address bar, then reload.',
  action: null,
};

export function openPermissionSettings(): void {
  // Nothing to open; `deniedHelp.action` is null so this is never called.
}
