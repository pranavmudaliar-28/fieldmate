import type { Notification, Paginated } from '@fieldmate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import WorkerNotifications from '../../app/(worker)/notifications';
import { NotificationBell } from '../components/NotificationBell';
import * as notificationApi from '../features/notifications/api';

jest.mock('../features/notifications/api');

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}));

const api = notificationApi as jest.Mocked<typeof notificationApi>;

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    type: 'TASK_ASSIGNED',
    taskId: 'task-1',
    title: 'New task assigned',
    body: 'Replace water meter',
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const page = (items: Notification[]): Paginated<Notification> => ({ items, nextCursor: null });

function renderScreen(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  api.fetchUnreadCount.mockResolvedValue({ unread: 0 });
  api.markNotificationRead.mockResolvedValue(undefined);
  api.markAllNotificationsRead.mockResolvedValue(undefined);
});

describe('the notification bell', () => {
  it('says how many are unread, for people who cannot see the badge', async () => {
    await render(<NotificationBell unread={3} onPress={jest.fn()} />);

    expect(screen.getByLabelText('Notifications, 3 unread')).toBeTruthy();
    expect(screen.getByTestId('notification-badge')).toBeTruthy();
  });

  it('shows no badge when there is nothing unread', async () => {
    await render(<NotificationBell unread={0} onPress={jest.fn()} />);

    expect(screen.getByLabelText('Notifications, nothing unread')).toBeTruthy();
    expect(screen.queryByTestId('notification-badge')).toBeNull();
  });

  it('caps the count rather than letting it stretch the badge', async () => {
    await render(<NotificationBell unread={250} onPress={jest.fn()} />);

    expect(screen.getByText('99+')).toBeTruthy();
    // The exact number still reaches a screen reader.
    expect(screen.getByLabelText('Notifications, 250 unread')).toBeTruthy();
  });
});

describe('the notification inbox (S-014)', () => {
  it('lists what happened', async () => {
    api.fetchNotifications.mockResolvedValue(
      page([
        notification(),
        notification({
          id: 'n-2',
          type: 'TASK_CANCELLED',
          title: 'Task cancelled',
          body: 'Fix light',
        }),
      ]),
    );

    await renderScreen(<WorkerNotifications />);

    await waitFor(() => expect(screen.getByText('New task assigned')).toBeTruthy());
    expect(screen.getByText('Replace water meter')).toBeTruthy();
    expect(screen.getByText('Task cancelled')).toBeTruthy();
  });

  it('opens the task and marks it read in one tap', async () => {
    api.fetchNotifications.mockResolvedValue(page([notification()]));

    await renderScreen(<WorkerNotifications />);
    await waitFor(() => expect(screen.getByTestId('notification-n-1')).toBeTruthy());
    await userEvent.setup().press(screen.getByTestId('notification-n-1'));

    expect(api.markNotificationRead.mock.calls[0]?.[0]).toBe('n-1');
    expect(mockRouter.push).toHaveBeenCalledWith('/(worker)/tasks/task-1');
  });

  it('does not mark an already-read notification again', async () => {
    api.fetchNotifications.mockResolvedValue(
      page([notification({ readAt: new Date().toISOString() })]),
    );

    await renderScreen(<WorkerNotifications />);
    await waitFor(() => expect(screen.getByTestId('notification-n-1')).toBeTruthy());
    await userEvent.setup().press(screen.getByTestId('notification-n-1'));

    expect(api.markNotificationRead).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/(worker)/tasks/task-1');
  });

  it('offers "mark all read" only while something is unread', async () => {
    api.fetchNotifications.mockResolvedValue(
      page([notification({ readAt: new Date().toISOString() })]),
    );

    await renderScreen(<WorkerNotifications />);

    await waitFor(() => expect(screen.getByText('New task assigned')).toBeTruthy());
    expect(screen.queryByTestId('mark-all-read')).toBeNull();
  });

  it('marks everything read on request', async () => {
    api.fetchNotifications.mockResolvedValue(page([notification()]));

    await renderScreen(<WorkerNotifications />);
    await waitFor(() => expect(screen.getByTestId('mark-all-read')).toBeTruthy());
    await userEvent.setup().press(screen.getByTestId('mark-all-read'));

    expect(api.markAllNotificationsRead).toHaveBeenCalled();
  });

  it('explains an empty inbox', async () => {
    api.fetchNotifications.mockResolvedValue(page([]));

    await renderScreen(<WorkerNotifications />);

    await waitFor(() => expect(screen.getByText('Nothing yet')).toBeTruthy());
  });

  it('offers a retry when it cannot load', async () => {
    api.fetchNotifications.mockRejectedValue(new Error('offline'));

    await renderScreen(<WorkerNotifications />);

    await waitFor(() => expect(screen.getByText("Couldn't load your notifications.")).toBeTruthy());
  });
});
