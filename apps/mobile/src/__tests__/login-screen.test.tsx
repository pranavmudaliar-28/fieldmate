import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../app/(auth)/login';
import { SESSION_EXPIRED_MESSAGE, useAuth } from '../features/auth/auth-context';
import { useIsOnline } from '../hooks/use-network-status';
import { ApiError } from '../services/http';

jest.mock('../features/auth/auth-context', () => ({
  ...jest.requireActual('../features/auth/auth-context'),
  useAuth: jest.fn(),
}));
jest.mock('../hooks/use-network-status');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseIsOnline = useIsOnline as jest.MockedFunction<typeof useIsOnline>;

const signIn = jest.fn();
const clearSessionExpired = jest.fn();

function authState(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    status: 'signedOut' as const,
    user: null,
    bootstrapError: null,
    signIn,
    signOut: jest.fn(),
    retryBootstrap: jest.fn(),
    sessionExpired: false,
    clearSessionExpired,
    ...overrides,
  };
}

/** RNTL 14 requires awaited interactions, so every test drives the UI with userEvent. */
async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByTestId('login-email'), email);
  await user.type(screen.getByTestId('login-password'), password);
  await user.press(screen.getByTestId('login-submit'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseIsOnline.mockReturnValue(true);
  mockUseAuth.mockReturnValue(authState());
  signIn.mockResolvedValue({
    id: 'u2',
    name: 'Priya Nair',
    email: 'worker1@fieldmate.dev',
    role: 'FIELD_WORKER',
  });
});

describe('Login screen (S-001)', () => {
  it('shows the app name, welcome text and both fields', async () => {
    await render(<LoginScreen />);
    expect(screen.getByRole('header', { name: 'FieldMate' })).toBeTruthy();
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByTestId('login-email')).toBeTruthy();
    expect(screen.getByTestId('login-password')).toBeTruthy();
  });

  it('requires both fields', async () => {
    await render(<LoginScreen />);
    await userEvent.setup().press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.getByText('Email is required.')).toBeTruthy());
    expect(screen.getByText('Password is required.')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('validates the email format before calling the API', async () => {
    await render(<LoginScreen />);
    await fillAndSubmit('not-an-email', 'FieldMate-dev-1');

    await waitFor(() => expect(screen.getByText('Enter a valid email address.')).toBeTruthy());
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in with valid credentials', async () => {
    await render(<LoginScreen />);
    await fillAndSubmit('worker1@fieldmate.dev', 'FieldMate-dev-1');

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('worker1@fieldmate.dev', 'FieldMate-dev-1'),
    );
  });

  it('shows the server message for wrong credentials', async () => {
    signIn.mockRejectedValue(
      new ApiError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401),
    );
    await render(<LoginScreen />);
    await fillAndSubmit('worker1@fieldmate.dev', 'wrong-password');

    await waitFor(() =>
      expect(screen.getByTestId('login-error')).toHaveTextContent('Incorrect email or password.'),
    );
  });

  it('shows a readable message when the request cannot reach the server', async () => {
    signIn.mockRejectedValue(
      new ApiError('NETWORK_ERROR', "Couldn't connect. Check your connection and try again."),
    );
    await render(<LoginScreen />);
    await fillAndSubmit('worker1@fieldmate.dev', 'FieldMate-dev-1');

    await waitFor(() =>
      expect(screen.getByTestId('login-error')).toHaveTextContent(
        "Couldn't connect. Check your connection and try again.",
      ),
    );
  });

  it('disables login while offline and explains why', async () => {
    mockUseIsOnline.mockReturnValue(false);
    await render(<LoginScreen />);

    expect(screen.getByText('Connect to the internet to log in.')).toBeTruthy();
    await userEvent.setup().press(screen.getByTestId('login-submit'));
    expect(signIn).not.toHaveBeenCalled();
  });

  it('tells the user when their session expired', async () => {
    mockUseAuth.mockReturnValue(authState({ sessionExpired: true }));
    await render(<LoginScreen />);

    expect(screen.getByTestId('login-error')).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
  });
});
