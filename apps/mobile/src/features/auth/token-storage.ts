import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'fieldmate.session.token';

/** The session token lives only in the device keychain/keystore (docs/03 §7). */
export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    // A corrupted or unreadable keychain entry just means "signed out".
    return null;
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Nothing to do; the user is signed out locally either way.
  }
}
