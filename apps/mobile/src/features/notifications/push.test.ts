import * as Notifications from 'expo-notifications';
import { apiRequest } from '../../services/http';
import {
  getPermissionState,
  isPushSupported,
  registerDeviceForPush,
  requestPermission,
} from './push';

jest.mock('expo-notifications');
// A getter, so a test can switch to "simulator" after the module is imported.
const mockDeviceState = { isDevice: true };
jest.mock('expo-device', () => ({
  get isDevice() {
    return mockDeviceState.isDevice;
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
  mockApiRequest.mockResolvedValue(undefined as never);
  notifications.getExpoPushTokenAsync.mockResolvedValue({
    data: 'ExponentPushToken[abc123]',
  } as Notifications.ExpoPushToken);
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

  it('reports simulators as unsupported and never asks', async () => {
    mockDeviceState.isDevice = false;
    await expect(getPermissionState()).resolves.toBe('unsupported');
    await expect(requestPermission()).resolves.toBe('unsupported');
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
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

  it('reports an unsupported device rather than registering', async () => {
    mockDeviceState.isDevice = false;
    await expect(registerDeviceForPush()).resolves.toBeNull();
    expect(mockApiRequest).not.toHaveBeenCalled();
  });
});

describe('isPushSupported', () => {
  it('follows the device check', () => {
    expect(isPushSupported()).toBe(true);
    mockDeviceState.isDevice = false;
    expect(isPushSupported()).toBe(false);
  });
});
