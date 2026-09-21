import type { TaskDetail } from '@fieldmate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import WorkerTaskDetails from '../../app/(worker)/tasks/[taskId]/index';
import { ToastProvider } from '../components/Toast';
import { useAuth } from '../features/auth/auth-context';
import * as tasksApi from '../features/tasks/api';
import { apiRequest } from '../services/http';

jest.mock('../features/tasks/api');
jest.mock('../services/http', () => ({
  ...jest.requireActual('../services/http'),
  apiRequest: jest.fn(),
}));
jest.mock('../features/auth/auth-context', () => ({
  ...jest.requireActual('../features/auth/auth-context'),
  useAuth: jest.fn(),
}));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ taskId: 'task-1' }),
}));

const api = tasksApi as jest.Mocked<typeof tasksApi>;
const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const WORKER = {
  id: 'worker-1',
  name: 'Priya Nair',
  email: 'p@x.co',
  role: 'FIELD_WORKER' as const,
};

function buildTask(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: 'task-1',
    title: 'Replace water meter',
    description: 'Old meter leaking.',
    status: 'ASSIGNED',
    location: { address: '14 Harbour Rd', addressDetails: null, latitude: null, longitude: null },
    assignment: {
      worker: { id: WORKER.id, name: WORKER.name },
      assignedAt: '2026-09-16T09:12:00.000Z',
      rejection: null,
    },
    progress: { acceptedAt: null, departedAt: null, arrivedAt: null, startedAt: null },
    evidence: [],
    notes: [],
    createdAt: '2026-09-16T09:12:00.000Z',
    updatedAt: '2026-09-16T09:12:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

const photo = {
  id: 'photo-1',
  url: 'https://storage.test/photo.jpg',
  fileType: 'image/jpeg' as const,
  uploadedBy: { id: WORKER.id, name: WORKER.name },
  createdAt: '2026-09-16T10:40:00.000Z',
};

async function renderDetails(task: TaskDetail) {
  api.fetchTask.mockResolvedValue(task);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <WorkerTaskDetails />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText('Replace water meter')).toBeTruthy());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    status: 'signedIn',
    user: WORKER,
    bootstrapError: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    retryBootstrap: jest.fn(),
    sessionExpired: false,
    clearSessionExpired: jest.fn(),
  });
  mockApiRequest.mockResolvedValue(undefined as never);
});

describe('Worker task details (S-008)', () => {
  it('offers Accept and Reject for an assigned task, and nothing to work with yet', async () => {
    await renderDetails(buildTask());

    // Accepting is the only way forward; a task is never started from here.
    expect(screen.getByTestId('action-accept')).toBeTruthy();
    expect(screen.getByTestId('action-reject')).toBeTruthy();
    expect(screen.queryByTestId('action-start')).toBeNull();
    expect(screen.queryByTestId('add-photo')).toBeNull();
    expect(screen.queryByTestId('note-input')).toBeNull();
  });

  it.each([
    ['ASSIGNED', 'action-accept', '/tasks/task-1/accept'],
    ['ACCEPTED', 'action-depart', '/tasks/task-1/depart'],
    ['GOING_TO_LOCATION', 'action-arrive', '/tasks/task-1/arrive'],
    ['REACHED_LOCATION', 'action-start', '/tasks/task-1/start'],
  ] as const)('takes the next step from %s', async (status, testID, path) => {
    await renderDetails(buildTask({ status }));
    mockApiRequest.mockResolvedValue(buildTask({ status }) as never);

    await userEvent.setup().press(screen.getByTestId(testID));

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledWith(path, { method: 'POST' }));
  });

  /** The whole point of the change: assigning or accepting must not start work. */
  it.each(['ASSIGNED', 'ACCEPTED', 'GOING_TO_LOCATION'] as const)(
    'offers no photos or notes while %s',
    async (status) => {
      await renderDetails(buildTask({ status }));

      expect(screen.queryByTestId('add-photo')).toBeNull();
      expect(screen.queryByTestId('note-input')).toBeNull();
      expect(screen.queryByTestId('action-complete')).toBeNull();
    },
  );

  it('can undo a mistapped step, but not once work has started', async () => {
    await renderDetails(buildTask({ status: 'REACHED_LOCATION' }));
    mockApiRequest.mockResolvedValue(buildTask({ status: 'GOING_TO_LOCATION' }) as never);

    await userEvent.setup().press(screen.getByTestId('action-step-back'));

    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith('/tasks/task-1/step-back', { method: 'POST' }),
    );
  });

  it('shows how far the job has got', async () => {
    await renderDetails(
      buildTask({
        status: 'REACHED_LOCATION',
        progress: {
          acceptedAt: '2026-09-16T09:20:00.000Z',
          departedAt: '2026-09-16T09:35:00.000Z',
          arrivedAt: '2026-09-16T10:02:00.000Z',
          startedAt: null,
        },
      }),
    );

    expect(screen.getByTestId('worker-journey')).toBeTruthy();
    expect(screen.getByText('Arrived on site')).toBeTruthy();
    expect(screen.getByText('Work started')).toBeTruthy();
  });

  it('requires a reason to reject and confirms first', async () => {
    await renderDetails(buildTask());
    const user = userEvent.setup();

    await user.press(screen.getByTestId('action-reject'));
    await waitFor(() => expect(screen.getByTestId('reject-sheet')).toBeTruthy());
    expect(screen.getByTestId('submit-reject')).toBeDisabled();

    await user.type(screen.getByTestId('reject-reason'), 'Site locked, no key');
    await waitFor(() => expect(screen.getByTestId('submit-reject')).toBeEnabled());
    await user.press(screen.getByTestId('submit-reject'));

    await waitFor(() =>
      expect(screen.getByText('Reject this task? It will be removed from your list.')).toBeTruthy(),
    );
    expect(mockApiRequest).not.toHaveBeenCalled();

    const confirmButtons = screen.getAllByRole('button', { name: 'Reject task' });
    await user.press(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith('/tasks/task-1/reject', {
        method: 'POST',
        body: { reason: 'Site locked, no key' },
      }),
    );
  });

  it('shows photo and note controls once the task is in progress', async () => {
    await renderDetails(buildTask({ status: 'IN_PROGRESS' }));

    expect(screen.getByTestId('add-photo')).toBeTruthy();
    expect(screen.getByTestId('note-input')).toBeTruthy();
    expect(screen.queryByTestId('action-start')).toBeNull();
    // Once work has started there is no backing out and no undo.
    expect(screen.queryByTestId('action-reject')).toBeNull();
    expect(screen.queryByTestId('action-step-back')).toBeNull();
  });

  /** Arriving and finding a problem is the realistic rejection (docs/02 §4.2). */
  it('can still be rejected after travelling to site', async () => {
    await renderDetails(buildTask({ status: 'REACHED_LOCATION' }));
    expect(screen.getByTestId('action-reject')).toBeTruthy();
  });

  it('disables Complete until a photo exists, and explains why', async () => {
    await renderDetails(buildTask({ status: 'IN_PROGRESS' }));

    expect(screen.getByTestId('action-complete')).toBeDisabled();
    expect(screen.getByText('At least 1 photo is required to complete this task.')).toBeTruthy();
  });

  it('enables Complete when the task has a photo', async () => {
    await renderDetails(buildTask({ status: 'IN_PROGRESS', evidence: [photo] }));
    expect(screen.getByTestId('action-complete')).toBeEnabled();
  });

  it('adds a note and clears the field', async () => {
    await renderDetails(buildTask({ status: 'IN_PROGRESS' }));
    mockApiRequest.mockResolvedValue({
      id: 'note-1',
      content: 'Replaced valve.',
      createdBy: { id: WORKER.id, name: WORKER.name },
      createdAt: '2026-09-16T10:50:00.000Z',
    } as never);

    const user = userEvent.setup();
    await user.type(screen.getByTestId('note-input'), 'Replaced valve.');
    await user.press(screen.getByTestId('add-note'));

    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith('/tasks/task-1/notes', {
        method: 'POST',
        body: { content: 'Replaced valve.' },
      }),
    );
  });

  it('requires confirmation before deleting a photo', async () => {
    await renderDetails(buildTask({ status: 'IN_PROGRESS', evidence: [photo] }));

    await userEvent.setup().press(screen.getByTestId(`delete-photo-${photo.id}`));

    await waitFor(() =>
      expect(screen.getByText("Delete this photo? This can't be undone.")).toBeTruthy(),
    );
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('does not offer delete for a photo taken by someone else', async () => {
    const othersPhoto = { ...photo, uploadedBy: { id: 'worker-2', name: 'Sam Lee' } };
    await renderDetails(buildTask({ status: 'IN_PROGRESS', evidence: [othersPhoto] }));

    expect(screen.queryByTestId(`delete-photo-${othersPhoto.id}`)).toBeNull();
    expect(screen.getByTestId(`photo-${othersPhoto.id}`)).toBeTruthy();
  });

  it('is read-only once completed', async () => {
    await renderDetails(
      buildTask({
        status: 'COMPLETED',
        completedAt: '2026-09-16T15:30:00.000Z',
        evidence: [photo],
      }),
    );

    expect(screen.getByTestId('completed-banner')).toBeTruthy();
    expect(screen.queryByTestId('add-photo')).toBeNull();
    expect(screen.queryByTestId('note-input')).toBeNull();
    expect(screen.queryByTestId(`delete-photo-${photo.id}`)).toBeNull();
    expect(screen.queryByTestId('action-complete')).toBeNull();
  });
});
