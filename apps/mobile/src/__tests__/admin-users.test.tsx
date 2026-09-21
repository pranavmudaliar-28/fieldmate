import type { ManagedUser, Paginated, Role } from '@fieldmate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import UsersScreen from '../../app/(admin)/(tabs)/index';
import UserDetailsScreen from '../../app/(admin)/users/[userId]/index';
import { ToastProvider } from '../components/Toast';
import * as adminApi from '../features/admin/api';
import { useAuth } from '../features/auth/auth-context';
import { ApiError } from '../services/http';

jest.mock('../features/admin/api');
jest.mock('../features/auth/auth-context', () => ({
  ...jest.requireActual('../features/auth/auth-context'),
  useAuth: jest.fn(),
}));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ userId: 'user-2' }),
}));

const api = adminApi as jest.Mocked<typeof adminApi>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const ADMIN = { id: 'user-1', name: 'Root Admin', email: 'admin@x.co', role: 'ADMIN' as const };

function managed(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id: 'user-2',
    name: 'Priya Nair',
    email: 'priya@fieldmate.dev',
    role: 'FIELD_WORKER' as Role,
    isActive: true,
    hasHistory: false,
    createdAt: '2026-09-16T09:12:00.000Z',
    updatedAt: '2026-09-16T09:12:00.000Z',
    ...overrides,
  };
}

const page = (items: ManagedUser[]): Paginated<ManagedUser> => ({ items, nextCursor: null });

async function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    status: 'signedIn',
    user: ADMIN,
    bootstrapError: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    retryBootstrap: jest.fn(),
    sessionExpired: false,
    clearSessionExpired: jest.fn(),
  });
  api.fetchUsers.mockResolvedValue(
    page([
      managed({ id: 'user-1', name: 'Root Admin', email: 'admin@x.co', role: 'ADMIN' }),
      managed(),
    ]),
  );
  api.fetchUser.mockResolvedValue(managed());
});

describe('Users screen (S-011)', () => {
  it('lists users with their role', async () => {
    await renderScreen(<UsersScreen />);

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeTruthy());
    expect(screen.getByText('priya@fieldmate.dev')).toBeTruthy();
    expect(screen.getByText('Field worker')).toBeTruthy();
  });

  it('marks inactive users', async () => {
    api.fetchUsers.mockResolvedValue(page([managed({ isActive: false })]));
    await renderScreen(<UsersScreen />);

    await waitFor(() => expect(screen.getByText('Inactive')).toBeTruthy());
  });

  it('filters by role', async () => {
    await renderScreen(<UsersScreen />);
    await waitFor(() => expect(api.fetchUsers).toHaveBeenCalled());

    await userEvent.setup().press(screen.getByTestId('user-filter-MANAGER'));

    await waitFor(() =>
      expect(api.fetchUsers).toHaveBeenCalledWith(expect.objectContaining({ role: 'MANAGER' })),
    );
  });

  it('searches by name or email', async () => {
    await renderScreen(<UsersScreen />);
    await userEvent.setup().type(screen.getByTestId('user-search'), 'priya');

    await waitFor(() =>
      expect(api.fetchUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'priya' })),
    );
  });

  it('opens add user and a user', async () => {
    await renderScreen(<UsersScreen />);
    await waitFor(() => expect(screen.getByTestId('user-card-user-2')).toBeTruthy());

    const user = userEvent.setup();
    await user.press(screen.getByTestId('add-user'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(admin)/users/new');

    await user.press(screen.getByTestId('user-card-user-2'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(admin)/users/user-2');
  });

  it('offers a shortcut to the task screens', async () => {
    await renderScreen(<UsersScreen />);
    await userEvent.setup().press(screen.getByTestId('go-to-tasks'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(manager)/(tabs)');
  });
});

describe('User details (S-012)', () => {
  it('shows the account and its actions', async () => {
    await renderScreen(<UserDetailsScreen />);

    await waitFor(() => expect(screen.getByText('Priya Nair')).toBeTruthy());
    expect(screen.getByTestId('user-status')).toHaveTextContent('Active');
    expect(screen.getByTestId('edit-user')).toBeTruthy();
    expect(screen.getByTestId('deactivate-user')).toBeTruthy();
    expect(screen.getByTestId('force-signout')).toBeTruthy();
  });

  it('warns what deactivating does, then does it', async () => {
    api.updateUser.mockResolvedValue(managed({ isActive: false }));
    await renderScreen(<UserDetailsScreen />);
    await waitFor(() => expect(screen.getByTestId('deactivate-user')).toBeTruthy());

    const user = userEvent.setup();
    await user.press(screen.getByTestId('deactivate-user'));

    await waitFor(() => expect(screen.getByText(/will not be able to log in/)).toBeTruthy());
    expect(api.updateUser).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('user-2', { isActive: false }));
  });

  it('offers reactivation for an inactive user', async () => {
    api.fetchUser.mockResolvedValue(managed({ isActive: false }));
    await renderScreen(<UserDetailsScreen />);

    await waitFor(() => expect(screen.getByTestId('activate-user')).toBeTruthy());
    expect(screen.queryByTestId('deactivate-user')).toBeNull();
  });

  it('blocks deleting a user who appears in task history, and explains why', async () => {
    api.fetchUser.mockResolvedValue(managed({ hasHistory: true }));
    await renderScreen(<UserDetailsScreen />);

    await waitFor(() => expect(screen.getByTestId('delete-user')).toBeDisabled());
    expect(
      screen.getByText(/cannot be deleted. Deactivating keeps the record intact./),
    ).toBeTruthy();
  });

  it('does not let an admin deactivate or delete themselves', async () => {
    api.fetchUser.mockResolvedValue(
      managed({ id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: 'ADMIN' }),
    );
    await renderScreen(<UserDetailsScreen />);

    await waitFor(() => expect(screen.getByTestId('deactivate-user')).toBeDisabled());
    expect(screen.getByTestId('delete-user')).toBeDisabled();
    expect(screen.getByText(/your own account/)).toBeTruthy();
  });

  it('requires a long enough password before setting one', async () => {
    await renderScreen(<UserDetailsScreen />);
    await waitFor(() => expect(screen.getByTestId('set-password')).toBeTruthy());

    const user = userEvent.setup();
    expect(screen.getByTestId('set-password')).toBeDisabled();

    await user.type(screen.getByTestId('new-password'), 'LongEnough1');
    await waitFor(() => expect(screen.getByTestId('set-password')).toBeEnabled());

    await user.press(screen.getByTestId('set-password'));
    await waitFor(() => expect(screen.getByText(/signed out on all devices/)).toBeTruthy());
  });

  it('shows a server refusal, such as the last-admin guard', async () => {
    api.updateUser.mockRejectedValue(
      new ApiError('LAST_ADMIN', 'There must always be at least one active admin.', 409),
    );
    api.fetchUser.mockResolvedValue(managed({ role: 'ADMIN', name: 'Other Admin' }));
    await renderScreen(<UserDetailsScreen />);
    await waitFor(() => expect(screen.getByTestId('deactivate-user')).toBeTruthy());

    const user = userEvent.setup();
    await user.press(screen.getByTestId('deactivate-user'));
    await user.press(screen.getByRole('button', { name: 'Deactivate' }));

    // Shown inline and as a toast, so both are expected.
    await waitFor(() =>
      expect(
        screen.getAllByText('There must always be at least one active admin.').length,
      ).toBeGreaterThan(0),
    );
  });
});
