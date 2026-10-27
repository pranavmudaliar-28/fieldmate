import type { LoginResponse, User } from '@fieldmate/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, NETWORK_ERROR_MESSAGE, configureHttp } from '../../services/http';
import * as authApi from './api';
import { clearToken, loadToken, saveToken } from './token-storage';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'bootstrapFailed';

type AuthState = {
  status: SessionStatus;
  user: User | null;
  /** True when the stored session could not be checked because the device is offline. */
  bootstrapError: string | null;
};

export type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<User>;
  /** Adopts a session the API already issued (a code set the password, or it was changed). */
  completeSignIn: (response: LoginResponse) => Promise<User>;
  /** Reflects a change the user made to their own name or email. */
  updateUser: (user: User) => void;
  signOut: () => Promise<void>;
  retryBootstrap: () => void;
  /** Set when the session expired or was revoked while the app was open. */
  sessionExpired: boolean;
  clearSessionExpired: () => void;
};

/**
 * The launch screen waits on the session check, and a server that never
 * answers (a dev machine whose LAN address changed, a captive Wi-Fi) would
 * hold it there for good. Past this, the check counts as offline: the stored
 * token is kept and the user gets the retry screen.
 */
export const BOOTSTRAP_TIMEOUT_MS = 15_000;
const BOOTSTRAP_TIMEOUT_MESSAGE = 'The server took too long to answer. Check your connection.';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const tokenRef = useRef<string | null>(null);
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    bootstrapError: null,
  });
  const [sessionExpired, setSessionExpired] = useState(false);

  const forgetSession = useCallback(async () => {
    tokenRef.current = null;
    await clearToken();
    queryClient.clear();
    setState({ status: 'signedOut', user: null, bootstrapError: null });
  }, [queryClient]);

  // Any 401 from the API means the session is gone (expired or revoked elsewhere).
  useEffect(() => {
    configureHttp({
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        if (tokenRef.current === null) return;
        setSessionExpired(true);
        void forgetSession();
      },
    });
  }, [forgetSession]);

  const bootstrap = useCallback(async () => {
    setState({ status: 'loading', user: null, bootstrapError: null });
    const token = await loadToken();
    if (!token) {
      setState({ status: 'signedOut', user: null, bootstrapError: null });
      return;
    }

    tokenRef.current = token;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ApiError('NETWORK_ERROR', BOOTSTRAP_TIMEOUT_MESSAGE));
      }, BOOTSTRAP_TIMEOUT_MS);
    });
    try {
      const user = await Promise.race([authApi.getCurrentUser(controller.signal), timedOut]);
      setState({ status: 'signedIn', user, bootstrapError: null });
    } catch (error) {
      // Only the server saying the session is gone ends it. Anything else — no
      // signal, or a 502 while the API is being deployed — keeps the stored
      // token, which may still be valid on the next try.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await forgetSession();
        return;
      }
      setState({
        status: 'bootstrapFailed',
        user: null,
        bootstrapError: error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE,
      });
    } finally {
      clearTimeout(timer);
    }
  }, [forgetSession]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const completeSignIn = useCallback(async ({ token, user }: LoginResponse) => {
    tokenRef.current = token;
    await saveToken(token);
    setSessionExpired(false);
    setState({ status: 'signedIn', user, bootstrapError: null });
    return user;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => completeSignIn(await authApi.login(email, password)),
    [completeSignIn],
  );

  const updateUser = useCallback((user: User) => {
    setState((current) => (current.status === 'signedIn' ? { ...current, user } : current));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Sign out locally even if the server call fails.
    }
    await forgetSession();
  }, [forgetSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      completeSignIn,
      updateUser,
      signOut,
      retryBootstrap: () => void bootstrap(),
      sessionExpired,
      clearSessionExpired: () => setSessionExpired(false),
    }),
    [state, signIn, completeSignIn, updateUser, signOut, bootstrap, sessionExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
