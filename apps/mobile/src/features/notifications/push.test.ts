import * as Notifications from 'expo-notifications';
import { apiRequest } from '../../services/http';
import {
  getPermissionState,
  isExpoGo,
  isPushSupported,
  registerDeviceForPush,
  requestPermission,
} from './push';

jest.mock('expo-notifications');

// Getters, so a test can switch to "simulator" or "Expo Go" after import.
const mockDeviceState = { isDevice: true };
jest.mock('expo-device', () => ({
  get isDevice() {
    return mockDeviceState.isDevice;
  },
}));

const mockEnvironment = { executionEnvironment: 'standalone' };
jest.mock('expo-constants', () => ({
  __esModule: true,
  ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
  default: {
    get executionEnvironment() {
      return mockEnvironment.executionEnvironment;
    },
    expoConfig: { extra: { eas: { projectId: 'test-project' } } },
    easConfig: undefined,
  },
}));

jest.mock('../../services/http', () => ({
  ...jest.requireActual('../../services/http'),
  apiRequest: jest.fn(),
}));

const notifications = Notifications as jest.Mocked<typeof Notifications>;
const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

const permissions = (status: string, canAskAgain: boolean) =>
  ({ status, canAskAgain }) as unknown as Notifications.NotificationPermissionsStatus;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeviceState.isDevice = true;
  mockEnvironment.executionEnvironment = 'standalone';
  mockApiRequest.mockResolvedValue(undefined as never);
  notifications.getExpoPushTokenAsync.mockResolvedValue({
    data: 'ExponentPushToken[abc123]',
  } as Notifications.ExpoPushToken);
});

describe('where push is supported', () => {
  it('works in a development or production build on a device', () => {
    expect(isPushSupported()).toBe(true);
    expect(isExpoGo()).toBe(false);
  });

  it('is unsupported in Expo Go, which cannot do Android push (SDK 53+)', async () => {
    mockEnvironment.executionEnvironment = 'storeClient';

    expect(isExpoGo()).toBe(true);
    expect(isPushSupported()).toBe(false);
    await expect(getPermissionState()).resolves.toBe('unsupported');
    await expect(registerDeviceForPush()).resolves.toBeNull();
    // The module is never touched, so it cannot throw at import time.
    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('is unsupported on a simulator, and never asks', async () => {
    mockDeviceState.isDevice = false;

    await expect(getPermissionState()).resolves.toBe('unsupported');
    await expect(requestPermission()).resolves.toBe('unsupported');
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('permission state', () => {
  it.each([
    ['granted', permissions('granted', false), 'granted'],
    ['first run', permissions('undetermined', true), 'undetermined'],
    ['permanently denied', permissions('denied', false), 'denied'],
  ])('maps %s', async (_case, response, expected) => {
    notifications.getPermissionsAsync.mockResolvedValue(response);
    await expect(getPermissionState()).resolves.toBe(expected);
  });

  it('asks the system when requesting permission', async () => {
    notifications.requestPermissionsAsync.mockResolvedValue(permissions('granted', false));
    await expect(requestPermission()).resolves.toBe('granted');
    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
  });
});

describe('registerDeviceForPush', () => {
  it('sends the Expo token and platform to the API', async () => {
    notifications.getPermissionsAsync.mockResolvedValue(permissions('granted', false));

    await expect(registerDeviceForPush()).resolves.toBe('ExponentPushToken[abc123]');
    expect(mockApiRequest).toHaveBeenCalledWith(
      '/users/me/push-tokens',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ token: 'ExponentPushToken[abc123]' }),
      }),
    );
  });

  it('does nothing without permission', async () => {
    notifications.getPermissionsAsync.mockResolvedValue(permissions('denied', false));

    await expect(registerDeviceForPush()).resolves.toBeNull();
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('stays silent when registration fails: the app works without pushes', async () => {
    notifications.getPermissionsAsync.mockResolvedValue(permissions('granted', false));
    mockApiRequest.mockRejectedValue(new Error('offline'));

    await expect(registerDeviceForPush()).resolves.toBeNull();
  });

  it('stays silent when the push token cannot be fetched', async () => {
    notifications.getPermissionsAsync.mockResolvedValue(permissions('granted', false));
    notifications.getExpoPushTokenAsync.mockRejectedValue(new Error('no project id'));

    await expect(registerDeviceForPush()).resolves.toBeNull();
  });
});
