const TOKEN_KEY = 'fieldmate.session.token';

/**
 * The browser has no keychain, so the session token lives in `sessionStorage`:
 * it is scoped to the tab and cleared when the tab closes, which keeps a shared
 * or forgotten desktop from staying signed in.
 *
 * This is a deliberate, narrower choice than `localStorage`. Any token readable
 * by JavaScript is exposed to script injection; the durable fix is an
 * httpOnly cookie issued by the API, which is a server change and a decision in
 * its own right (docs/03 §7). Flagged rather than assumed.
 */
function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    // Blocked storage (private mode, hardened settings) means "signed out".
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    storage()?.setItem(TOKEN_KEY, token);
  } catch {
    // The session simply will not survive a reload.
  }
}

export async function loadToken(): Promise<string | null> {
  try {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export async function clearToken(): Promise<void> {
  try {
    storage()?.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to do; the user is signed out locally either way.
  }
}
