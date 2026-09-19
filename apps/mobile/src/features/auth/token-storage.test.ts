import * as SecureStore from 'expo-secure-store';
import * as authApi from './api';
import { clearToken, loadToken, saveToken } from './token-storage';
import { apiRequest } from '../../services/http';

jest.mock('expo-secure-store');
jest.mock('../../services/http', () => ({
  ...jest.requireActual('../../services/http'),
  apiRequest: jest.fn(),
}));

const store = SecureStore as jest.Mocked<typeof SecureStore>;
const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

beforeEach(() => jest.clearAllMocks());

describe('token storage', () => {
  it('keeps the session token in the device keychain only', async () => {
    await saveToken('jwt-value');
    expect(store.setItemAsync).toHaveBeenCalledWith('fieldmate.session.token', 'jwt-value');
  });

  it('reads a stored token', async () => {
    store.getItemAsync.mockResolvedValue('jwt-value');
    await expect(loadToken()).resolves.toBe('jwt-value');
  });

  it('treats an unreadable keychain as signed out rather than crashing', async () => {
    store.getItemAsync.mockRejectedValue(new Error('keychain locked'));
    await expect(loadToken()).resolves.toBeNull();
  });

  it('clears the token, even if the keychain complains', async () => {
    store.deleteItemAsync.mockRejectedValue(new Error('nothing to delete'));
    await expect(clearToken()).resolves.toBeUndefined();
    expect(store.deleteItemAsync).toHaveBeenCalledWith('fieldmate.session.token');
  });
});

describe('auth api', () => {
  it('posts credentials to the login endpoint', async () => {
    mockApiRequest.mockResolvedValue({ token: 't', user: {} } as never);
    await authApi.login('a@b.co', 'secret');

    expect(mockApiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.co', password: 'secret' },
    });
  });

  it('reads the current user without triggering a sign-out on 401', async () => {
    mockApiRequest.mockResolvedValue({ id: 'u1' } as never);
    await authApi.getCurrentUser();

    expect(mockApiRequest).toHaveBeenCalledWith('/users/me', { ignoreUnauthorized: true });
  });

  it('posts a logout', async () => {
    mockApiRequest.mockResolvedValue(undefined as never);
    await authApi.logout();

    expect(mockApiRequest).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      ignoreUnauthorized: true,
    });
  });
});
