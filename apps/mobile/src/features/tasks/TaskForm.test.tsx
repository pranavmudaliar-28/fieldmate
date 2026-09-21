import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as tasksApi from './api';
import { TaskForm } from './TaskForm';
import { setLocationProvider } from '../location/useAddressSearch';
import type { LocationProvider, PlaceSuggestion } from '../location/provider';

jest.mock('./api');
// The map itself is a web view; stand in for it so the field's own behaviour shows.
jest.mock('../location/MapPicker', () => {
  const { View } = jest.requireActual('react-native');
  return { MapPicker: ({ testID }: { testID?: string }) => <View testID={testID} /> };
});

const api = tasksApi as jest.Mocked<typeof tasksApi>;

const onSubmit = jest.fn();
const WORKER_1 = '11111111-1111-4111-8111-111111111111';
const WORKER_2 = '22222222-2222-4222-8222-222222222222';

const SUGGESTION: PlaceSuggestion = {
  id: 'p1',
  address: '14 Harbour Rd, Docklands, Sydney',
  primary: '14 Harbour Rd',
  secondary: 'Docklands, Sydney',
  latitude: -33.8688,
  longitude: 151.2093,
};

const search = jest.fn<Promise<PlaceSuggestion[]>, [string, AbortSignal | undefined]>();
const reverse = jest.fn<Promise<string | null>, [number, number, AbortSignal | undefined]>();

const provider: LocationProvider = {
  name: 'test',
  search: (query, signal) => search(query, signal),
  reverse: (lat, lng, signal) => reverse(lat, lng, signal),
};

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
  setLocationProvider(provider);
  search.mockResolvedValue([SUGGESTION]);
  reverse.mockResolvedValue('Corrected address, Sydney');
  api.fetchFieldWorkers.mockResolvedValue([
    { id: WORKER_1, name: 'Priya Nair' },
    { id: WORKER_2, name: 'Sam Lee' },
  ]);
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

  it('submits a complete task with the chosen worker and address', async () => {
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
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Replace water meter',
          workerId: WORKER_2,
          location: expect.objectContaining({ address: '14 Harbour Rd' }),
        }),
      ),
    );
  });

  it('fills address and coordinates from a chosen suggestion', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.type(screen.getByTestId('address-search'), '14 Harbour');
    await waitFor(() => expect(screen.getByTestId(`suggestion-${SUGGESTION.id}`)).toBeTruthy());
    expect(screen.getByText('14 Harbour Rd')).toBeTruthy();
    expect(screen.getByText('Docklands, Sydney')).toBeTruthy();

    await user.press(screen.getByTestId(`suggestion-${SUGGESTION.id}`));

    await waitFor(() =>
      expect(screen.getByTestId('task-address').props.value).toBe(SUGGESTION.address),
    );
    expect(screen.getByText(/Pin: -33.8688, 151.2093/)).toBeTruthy();
  });

  it('waits for a pause in typing, and does not search very short queries', async () => {
    await renderForm();
    await userEvent.setup().type(screen.getByTestId('address-search'), 'ab');

    await waitFor(() => expect(screen.queryByTestId('address-searching')).toBeNull());
    expect(search).not.toHaveBeenCalled();
  });

  it('lets the manager type an address when search is unavailable', async () => {
    search.mockRejectedValue(new Error('service down'));
    const user = userEvent.setup();
    await renderForm();

    await user.type(screen.getByTestId('address-search'), 'anything');
    await waitFor(() => expect(screen.getByTestId('search-unavailable')).toBeTruthy());

    // Typing still works, so a task can be created regardless.
    await user.type(screen.getByTestId('task-address'), 'Plot 7, behind the depot');
    expect(screen.getByTestId('task-address').props.value).toContain('Plot 7');
  });

  it('keeps the door-level details separate from the address', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.type(screen.getByTestId('task-title'), 'Meter swap');
    await user.type(screen.getByTestId('task-description'), 'Details matter.');
    await user.type(screen.getByTestId('task-address'), '14 Harbour Rd');
    await user.type(screen.getByTestId('task-address-details'), 'Flat 3B, rear gate');
    await user.press(screen.getByTestId('task-worker-select'));
    await waitFor(() => expect(screen.getByTestId(`worker-option-${WORKER_1}`)).toBeTruthy());
    await user.press(screen.getByTestId(`worker-option-${WORKER_1}`));
    await user.press(screen.getByTestId('task-submit'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({
            address: '14 Harbour Rd',
            addressDetails: 'Flat 3B, rear gate',
          }),
        }),
      ),
    );
  });

  it('shows the pin and allows removing it', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.type(screen.getByTestId('address-search'), '14 Harbour');
    await waitFor(() => expect(screen.getByTestId(`suggestion-${SUGGESTION.id}`)).toBeTruthy());
    await user.press(screen.getByTestId(`suggestion-${SUGGESTION.id}`));

    await waitFor(() => expect(screen.getByTestId('map-picker')).toBeTruthy());
    await user.press(screen.getByTestId('remove-pin'));

    await waitFor(() => expect(screen.queryByTestId('map-picker')).toBeNull());
    expect(screen.getByText(/No map pin yet/)).toBeTruthy();
  });

  it('hides the worker field in edit mode and disables save until something changes', async () => {
    await renderForm({
      mode: 'edit',
      defaultValues: {
        title: 'Existing task',
        description: 'Existing description',
        workerId: WORKER_1,
        workerName: 'Priya Nair',
        location: {
          address: 'Existing address',
          addressDetails: null,
          latitude: null,
          longitude: null,
        },
      },
    });

    expect(screen.queryByTestId('task-worker-select')).toBeNull();
    expect(screen.getByTestId('task-submit')).toBeDisabled();

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
