import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as tasksApi from './api';
import { TaskForm } from './TaskForm';
import { useCurrentLocation } from '../location/use-current-location';

jest.mock('./api');
jest.mock('../location/use-current-location', () => ({
  ...jest.requireActual('../location/use-current-location'),
  useCurrentLocation: jest.fn(),
}));

const api = tasksApi as jest.Mocked<typeof tasksApi>;
const mockUseCurrentLocation = useCurrentLocation as jest.MockedFunction<typeof useCurrentLocation>;

const capture = jest.fn();
const onSubmit = jest.fn();
const WORKER_1 = '11111111-1111-4111-8111-111111111111';
const WORKER_2 = '22222222-2222-4222-8222-222222222222';

async function renderForm(props: Partial<Parameters<typeof TaskForm>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <TaskForm mode="create" onSubmit={onSubmit} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.fetchFieldWorkers.mockResolvedValue([
    { id: WORKER_1, name: 'Priya Nair' },
    { id: WORKER_2, name: 'Sam Lee' },
  ]);
  capture.mockResolvedValue({ latitude: -33.8688, longitude: 151.2093 });
  mockUseCurrentLocation.mockReturnValue({
    status: 'idle',
    capture,
    message: null,
    openSettings: jest.fn(),
  });
});

describe('TaskForm (S-004)', () => {
  it('requires title, description, worker and address', async () => {
    await renderForm();
    await userEvent.setup().press(screen.getByTestId('task-submit'));

    await waitFor(() => expect(screen.getByText('Title is required.')).toBeTruthy());
    expect(screen.getByText('Description is required.')).toBeTruthy();
    expect(screen.getByText('Select a worker.')).toBeTruthy();
    expect(screen.getByText('Address is required.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a complete task with the chosen worker', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.type(screen.getByTestId('task-title'), 'Replace water meter');
    await user.type(screen.getByTestId('task-description'), 'Old meter leaking.');
    await user.type(screen.getByTestId('task-address'), '14 Harbour Rd');
    await user.press(screen.getByTestId('task-worker-select'));

    await waitFor(() => expect(screen.getByTestId(`worker-option-${WORKER_2}`)).toBeTruthy());
    await user.press(screen.getByTestId(`worker-option-${WORKER_2}`));
    await user.press(screen.getByTestId('task-submit'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Replace water meter',
        description: 'Old meter leaking.',
        workerId: WORKER_2,
        location: { address: '14 Harbour Rd', latitude: null, longitude: null },
      }),
    );
  });

  it('captures coordinates with the location button', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.press(screen.getByTestId('task-capture-location'));

    await waitFor(() => expect(screen.getByText(/Coordinates captured/)).toBeTruthy());
    expect(capture).toHaveBeenCalled();
  });

  it('explains a denied location permission and still allows typing the address', async () => {
    mockUseCurrentLocation.mockReturnValue({
      status: 'denied',
      capture,
      message: 'Location access is off. You can still type the address.',
      openSettings: jest.fn(),
    });
    await renderForm();

    expect(screen.getByTestId('location-permission-message')).toBeTruthy();
    expect(screen.getByTestId('task-address')).toBeTruthy();
  });

  it('hides the worker field in edit mode and disables save until something changes', async () => {
    await renderForm({
      mode: 'edit',
      defaultValues: {
        title: 'Existing task',
        description: 'Existing description',
        workerId: WORKER_1,
        workerName: 'Priya Nair',
        location: { address: 'Existing address', latitude: null, longitude: null },
      },
    });

    expect(screen.queryByTestId('task-worker-select')).toBeNull();
    const save = screen.getByTestId('task-submit');
    expect(save).toBeDisabled();

    await userEvent.setup().type(screen.getByTestId('task-title'), ' updated');
    await waitFor(() => expect(screen.getByTestId('task-submit')).toBeEnabled());
  });

  it('shows a submit error from the server', async () => {
    await renderForm({ submitError: 'Select a field worker to assign this task to.' });
    expect(screen.getByTestId('task-form-error')).toHaveTextContent(
      'Select a field worker to assign this task to.',
    );
  });
});
