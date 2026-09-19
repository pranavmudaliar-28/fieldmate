import type { User } from '@fieldmate/shared';
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
import { ApiError, configureHttp } from '../../services/http';
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
  signOut: () => Promise<void>;
  retryBootstrap: () => void;
  /** Set when the session expired or was revoked while the app was open. */
  sessionExpired: boolean;
  clearSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

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
    try {
      const user = await authApi.getCurrentUser();
      setState({ status: 'signedIn', user, bootstrapError: null });
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError) {
        // Keep the stored token: the session may still be valid once back online.
        setState({ status: 'bootstrapFailed', user: null, bootstrapError: error.message });
        return;
      }
      await forgetSession();
    }
  }, [forgetSession]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password);
    tokenRef.current = token;
    await saveToken(token);
    setSessionExpired(false);
    setState({ status: 'signedIn', user, bootstrapError: null });
    return user;
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
      signOut,
      retryBootstrap: () => void bootstrap(),
      sessionExpired,
      clearSessionExpired: () => setSessionExpired(false),
    }),
    [state, signIn, signOut, bootstrap, sessionExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}

export { SESSION_EXPIRED_MESSAGE };
