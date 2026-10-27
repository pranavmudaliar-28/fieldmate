import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import SetPasswordScreen from '../../app/(auth)/set-password';
import ChangePasswordScreen from '../../app/account/password';
import { ToastProvider } from '../components/Toast';
import * as authApi from '../features/auth/api';
import { useAuth } from '../features/auth/auth-context';
import { ApiError } from '../services/http';

jest.mock('../features/auth/api');
jest.mock('../features/auth/auth-context', () => ({
  ...jest.requireActual('../features/auth/auth-context'),
  useAuth: jest.fn(),
}));

let mockParams: { mode?: string; email?: string } = {};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

const api = authApi as jest.Mocked<typeof authApi>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const completeSignIn = jest.fn();

const WORKER = {
  id: 'u2',
  name: 'Priya Nair',
  email: 'priya@fieldmate.dev',
  role: 'FIELD_WORKER' as const,
};

function authState(signedIn: boolean) {
  return {
    status: signedIn ? ('signedIn' as const) : ('signedOut' as const),
    user: signedIn ? WORKER : null,
    bootstrapError: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    retryBootstrap: jest.fn(),
    sessionExpired: false,
    clearSessionExpired: jest.fn(),
    completeSignIn,
    updateUser: jest.fn(),
  };
}

const renderWithToast = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockUseAuth.mockReturnValue(authState(false));
  completeSignIn.mockResolvedValue(WORKER);
});

describe('Set password from an emailed code', () => {
  it('asks where to send a reset code, then signs in with the code and a new password', async () => {
    mockParams = { mode: 'reset', email: 'priya@fieldmate.dev' };
    api.requestPasswordCode.mockResolvedValue(undefined);
    const response = { token: 't', user: WORKER };
    api.setPasswordWithCode.mockResolvedValue(response);
    await renderWithToast(<SetPasswordScreen />);

    const user = userEvent.setup();
    await user.press(screen.getByTestId('set-password-send'));
    await waitFor(() =>
      expect(api.requestPasswordCode).toHaveBeenCalledWith('priya@fieldmate.dev'),
    );

    await user.type(screen.getByTestId('set-password-code'), '12a3456');
    await user.type(screen.getByTestId('set-password-password'), 'NewPassword-1');
    await user.type(screen.getByTestId('set-password-confirm'), 'NewPassword-1');
    await user.press(screen.getByTestId('set-password-submit'));

    await waitFor(() =>
      expect(api.setPasswordWithCode).toHaveBeenCalledWith(
        'priya@fieldmate.dev',
        '123456',
        'NewPassword-1',
      ),
    );
    expect(completeSignIn).toHaveBeenCalledWith(response);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(worker)/(tabs)'));
  });

  it('goes straight to the code for an invitation, and checks the passwords match', async () => {
    mockParams = { mode: 'invite' };
    await renderWithToast(<SetPasswordScreen />);

    expect(screen.queryByTestId('set-password-send')).toBeNull();
    const user = userEvent.setup();
    await user.type(screen.getByTestId('set-password-email'), 'new@fieldmate.dev');
    await user.type(screen.getByTestId('set-password-code'), '123456');
    await user.type(screen.getByTestId('set-password-password'), 'NewPassword-1');
    await user.type(screen.getByTestId('set-password-confirm'), 'Different-1');
    await user.press(screen.getByTestId('set-password-submit'));

    await waitFor(() => expect(screen.getByText('The passwords don’t match.')).toBeTruthy());
    expect(api.setPasswordWithCode).not.toHaveBeenCalled();
  });

  it('shows the server’s answer to a wrong code', async () => {
    mockParams = { mode: 'invite', email: 'new@fieldmate.dev' };
    api.setPasswordWithCode.mockRejectedValue(
      new ApiError('INVALID_CODE', 'That code is not valid.', 422),
    );
    await renderWithToast(<SetPasswordScreen />);

    const user = userEvent.setup();
    await user.type(screen.getByTestId('set-password-code'), '999999');
    await user.type(screen.getByTestId('set-password-password'), 'NewPassword-1');
    await user.type(screen.getByTestId('set-password-confirm'), 'NewPassword-1');
    await user.press(screen.getByTestId('set-password-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('set-password-error')).toHaveTextContent('That code is not valid.'),
    );
    expect(completeSignIn).not.toHaveBeenCalled();
  });
});

describe('Change password', () => {
  it('keeps this device signed in with the token the API returns', async () => {
    mockUseAuth.mockReturnValue(authState(true));
    const response = { token: 'fresh', user: WORKER };
    api.changePassword.mockResolvedValue(response);
    await renderWithToast(<ChangePasswordScreen />);

    const user = userEvent.setup();
    await user.type(screen.getByTestId('account-current-password'), 'OldPassword-1');
    await user.type(screen.getByTestId('account-new-password'), 'NewPassword-1');
    await user.type(screen.getByTestId('account-confirm-password'), 'NewPassword-1');
    await user.press(screen.getByTestId('account-password-save'));

    await waitFor(() =>
      expect(api.changePassword).toHaveBeenCalledWith('OldPassword-1', 'NewPassword-1'),
    );
    expect(completeSignIn).toHaveBeenCalledWith(response);
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('says so when the current password is wrong', async () => {
    mockUseAuth.mockReturnValue(authState(true));
    api.changePassword.mockRejectedValue(
      new ApiError('INVALID_CREDENTIALS', 'Your current password is not correct.', 401),
    );
    await renderWithToast(<ChangePasswordScreen />);

    const user = userEvent.setup();
    await user.type(screen.getByTestId('account-current-password'), 'Wrong-1234');
    await user.type(screen.getByTestId('account-new-password'), 'NewPassword-1');
    await user.type(screen.getByTestId('account-confirm-password'), 'NewPassword-1');
    await user.press(screen.getByTestId('account-password-save'));

    await waitFor(() =>
      expect(screen.getByTestId('account-password-error')).toHaveTextContent(
        'Your current password is not correct.',
      ),
    );
    expect(completeSignIn).not.toHaveBeenCalled();
  });
});
