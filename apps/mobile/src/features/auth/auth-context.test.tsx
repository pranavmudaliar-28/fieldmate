import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ApiError } from '../../services/http';
import * as authApi from './api';
import { AuthProvider, BOOTSTRAP_TIMEOUT_MS, useAuth } from './auth-context';
import * as tokenStorage from './token-storage';

jest.mock('./api');
jest.mock('./token-storage');

const api = authApi as jest.Mocked<typeof authApi>;
const storage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const MANAGER = {
  id: 'u1',
  name: 'Anita Rao',
  email: 'manager@fieldmate.dev',
  role: 'MANAGER' as const,
};

let auth: ReturnType<typeof useAuth>;

function Probe() {
  auth = useAuth();
  return <Text testID="status">{`${auth.status}:${auth.user?.role ?? 'none'}`}</Text>;
}

async function renderAuth() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  storage.saveToken.mockResolvedValue();
  storage.clearToken.mockResolvedValue();
});

describe('AuthProvider bootstrap', () => {
  it('starts signed out when no token is stored', async () => {
    storage.loadToken.mockResolvedValue(null);
    await renderAuth();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none'));
    expect(api.getCurrentUser).not.toHaveBeenCalled();
  });

  it('restores the session from a stored token', async () => {
    storage.loadToken.mockResolvedValue('stored-token');
    api.getCurrentUser.mockResolvedValue(MANAGER);
    await renderAuth();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn:MANAGER'));
  });

  it('keeps the token when the server errors during a deploy', async () => {
    storage.loadToken.mockResolvedValue('stored-token');
    api.getCurrentUser.mockRejectedValue(new ApiError('INTERNAL_ERROR', 'Bad gateway', 502));
    await renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('bootstrapFailed:none'),
    );
    expect(storage.clearToken).not.toHaveBeenCalled();
  });

  it('clears a token the server rejects', async () => {
    storage.loadToken.mockResolvedValue('revoked-token');
    api.getCurrentUser.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'nope', 401));
    await renderAuth();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none'));
    expect(storage.clearToken).toHaveBeenCalled();
  });

  it('keeps the token and offers a retry when the device is offline', async () => {
    storage.loadToken.mockResolvedValue('stored-token');
    api.getCurrentUser.mockRejectedValue(new ApiError('NETWORK_ERROR', 'Offline'));
    await renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('bootstrapFailed:none'),
    );
    expect(storage.clearToken).not.toHaveBeenCalled();

    api.getCurrentUser.mockResolvedValue(MANAGER);
    await act(async () => auth.retryBootstrap());
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn:MANAGER'));
  });

  it('gives up on a server that never answers, so the splash cannot hang', async () => {
    jest.useFakeTimers();
    try {
      storage.loadToken.mockResolvedValue('stored-token');
      let signal: AbortSignal | undefined;
      api.getCurrentUser.mockImplementation((s) => {
        signal = s;
        return new Promise(() => {});
      });
      await renderAuth();
      expect(screen.getByTestId('status')).toHaveTextContent('loading:none');

      await act(async () => {
        jest.advanceTimersByTime(BOOTSTRAP_TIMEOUT_MS);
      });

      expect(screen.getByTestId('status')).toHaveTextContent('bootstrapFailed:none');
      expect(signal?.aborted).toBe(true);
      expect(storage.clearToken).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('sign in and out', () => {
  beforeEach(() => storage.loadToken.mockResolvedValue(null));

  it('stores the token and the user on sign in', async () => {
    api.login.mockResolvedValue({ token: 'new-token', user: MANAGER });
    await renderAuth();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none'));

    await act(async () => {
      await auth.signIn('manager@fieldmate.dev', 'FieldMate-dev-1');
    });

    expect(storage.saveToken).toHaveBeenCalledWith('new-token');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn:MANAGER'));
  });

  it('propagates a failed sign in and stays signed out', async () => {
    api.login.mockRejectedValue(
      new ApiError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401),
    );
    await renderAuth();

    await act(async () => {
      await expect(auth.signIn('a@b.co', 'wrong')).rejects.toBeInstanceOf(ApiError);
    });

    expect(storage.saveToken).not.toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none');
  });

  it('clears the session on sign out, even if the server call fails', async () => {
    api.login.mockResolvedValue({ token: 'new-token', user: MANAGER });
    api.logout.mockRejectedValue(new ApiError('NETWORK_ERROR', 'Offline'));
    await renderAuth();
    await act(async () => {
      await auth.signIn('manager@fieldmate.dev', 'FieldMate-dev-1');
    });

    await act(async () => {
      await auth.signOut();
    });

    expect(storage.clearToken).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut:none'));
  });
});
