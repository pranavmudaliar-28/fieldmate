import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createLogger } from '../../config/logger.js';
import type { DeviceTokenRepository } from '../../modules/users/device-token.repository.js';
import { pushMessages } from './push.service.js';

type Ticket = { status: 'ok' } | { status: 'error'; details?: { error?: string } };

const sendMock = jest.fn<(messages: unknown[]) => Promise<Ticket[]>>();

jest.unstable_mockModule('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken(token: unknown): boolean {
      return typeof token === 'string' && token.startsWith('ExponentPushToken[');
    }
    chunkPushNotifications(messages: unknown[]): unknown[][] {
      return [messages];
    }
    sendPushNotificationsAsync = sendMock;
  },
}));

// Imported after the mock is registered, so the service uses the fake SDK.
const { createExpoPushService: createService } = await import('./expo-push.service.js');

const message = pushMessages.taskAssigned('task-1', 'Replace water meter');

function repository(devices: { userId: string; token: string }[]) {
  return {
    listByUsers: jest.fn(async () => devices),
    deleteByTokens: jest.fn(async () => {}),
    register: jest.fn(),
    listManagerIds: jest.fn(),
  } as unknown as DeviceTokenRepository & {
    listByUsers: jest.Mock;
    deleteByTokens: jest.Mock;
  };
}

const logger = createLogger('silent');

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue([{ status: 'ok' }]);
});

describe('ExpoPushService', () => {
  it('sends one message per registered device', async () => {
    const tokens = repository([
      { userId: 'u1', token: 'ExponentPushToken[a]' },
      { userId: 'u1', token: 'ExponentPushToken[b]' },
    ]);
    sendMock.mockResolvedValue([{ status: 'ok' }, { status: 'ok' }]);

    await createService({ tokens, logger }).send(['u1'], message);

    const sentMessages = sendMock.mock.calls[0]?.[0] as {
      to: string;
      title: string;
      data: unknown;
    }[];
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[0]).toMatchObject({
      to: 'ExponentPushToken[a]',
      title: 'New task assigned',
      body: 'Replace water meter',
      data: { type: 'TASK_ASSIGNED', taskId: 'task-1' },
    });
  });

  it('does nothing when nobody is listed or nobody has a device', async () => {
    const tokens = repository([]);
    const service = createService({ tokens, logger });

    await service.send([], message);
    expect(tokens.listByUsers).not.toHaveBeenCalled();

    await service.send(['u1'], message);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips tokens that are not valid Expo tokens', async () => {
    const tokens = repository([
      { userId: 'u1', token: 'not-an-expo-token' },
      { userId: 'u2', token: 'ExponentPushToken[good]' },
    ]);

    await createService({ tokens, logger }).send(['u1', 'u2'], message);

    const sentMessages = sendMock.mock.calls[0]?.[0] as { to: string }[];
    expect(sentMessages.map((m) => m.to)).toEqual(['ExponentPushToken[good]']);
  });

  it('removes tokens Expo reports as uninstalled, and keeps the rest', async () => {
    const tokens = repository([
      { userId: 'u1', token: 'ExponentPushToken[gone]' },
      { userId: 'u2', token: 'ExponentPushToken[fine]' },
    ]);
    sendMock.mockResolvedValue([
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok' },
    ]);

    await createService({ tokens, logger }).send(['u1', 'u2'], message);

    expect(tokens.deleteByTokens).toHaveBeenCalledWith(['ExponentPushToken[gone]']);
  });

  it('keeps a token when the error is something else', async () => {
    const tokens = repository([{ userId: 'u1', token: 'ExponentPushToken[a]' }]);
    sendMock.mockResolvedValue([{ status: 'error', details: { error: 'MessageRateExceeded' } }]);

    await createService({ tokens, logger }).send(['u1'], message);

    expect(tokens.deleteByTokens).not.toHaveBeenCalled();
  });

  it('swallows a failure from the push service', async () => {
    const tokens = repository([{ userId: 'u1', token: 'ExponentPushToken[a]' }]);
    sendMock.mockRejectedValue(new Error('Expo is unreachable'));

    await expect(createService({ tokens, logger }).send(['u1'], message)).resolves.toBeUndefined();
  });
});
