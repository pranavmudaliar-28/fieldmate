import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../app/(auth)/login';
import { useAuth } from '../features/auth/auth-context';
import { useIsOnline } from '../hooks/use-network-status';
import { ApiError } from '../services/http';

jest.mock('../features/auth/auth-context', () => ({
  ...jest.requireActual('../features/auth/auth-context'),
  useAuth: jest.fn(),
}));
jest.mock('../hooks/use-network-status');

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => mockRouter,
}));

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
    completeSignIn: jest.fn(),
    updateUser: jest.fn(),
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
  it('shows the app name, the sign-in title and both fields', async () => {
    await render(<LoginScreen />);
    expect(screen.getByRole('header', { name: 'FieldMate' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByTestId('forgot-password')).toBeTruthy();
    expect(screen.getByTestId('set-up-account')).toBeTruthy();
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

  it('says the email or password is wrong and marks the password field', async () => {
    signIn.mockRejectedValue(
      new ApiError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401),
    );
    await render(<LoginScreen />);
    await fillAndSubmit('worker1@fieldmate.dev', 'wrong-password');

    await waitFor(() =>
      expect(screen.getByTestId('login-error')).toHaveTextContent('Email or password is incorrect'),
    );
    expect(screen.getByText(/use “Forgot password\?” to choose a new one/)).toBeTruthy();
    expect(screen.getByTestId('login-password')).toHaveProp('aria-invalid', true);
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

    expect(screen.getByText('Connect to the internet to sign in.')).toBeTruthy();
    await userEvent.setup().press(screen.getByTestId('login-submit'));
    expect(signIn).not.toHaveBeenCalled();
  });

  it('tells the user when their session expired', async () => {
    mockUseAuth.mockReturnValue(authState({ sessionExpired: true }));
    await render(<LoginScreen />);

    expect(screen.getByTestId('login-error')).toHaveTextContent('Session expired');
    expect(screen.getByText('Sign in again to keep working.')).toBeTruthy();
  });

  it('opens the reset and set-up flows with the email already typed', async () => {
    await render(<LoginScreen />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('login-email'), ' worker1@fieldmate.dev ');

    await user.press(screen.getByTestId('forgot-password'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(auth)/set-password',
      params: { mode: 'reset', email: 'worker1@fieldmate.dev' },
    });

    await user.press(screen.getByTestId('set-up-account'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(auth)/set-password',
      params: { mode: 'invite', email: 'worker1@fieldmate.dev' },
    });
  });
});
