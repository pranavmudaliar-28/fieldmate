import type { Paginated, TaskDetail, TaskListItem, TaskStatus } from '@fieldmate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import WorkerDashboard from '../../app/(worker)/(tabs)/index';
import MyTasks from '../../app/(worker)/(tabs)/tasks';
import CompleteTaskScreen from '../../app/(worker)/tasks/[taskId]/complete';
import { ToastProvider } from '../components/Toast';
import * as offlineQueue from '../features/offline/offline-queue';
import { OfflineQueueProvider } from '../features/offline/offline-queue';
import { useAuth } from '../features/auth/auth-context';
import * as tasksApi from '../features/tasks/api';
import { ApiError } from '../services/http';

jest.mock('../features/tasks/api');
jest.mock('../features/auth/auth-context', () => ({
  ...jest.requireActual('../features/auth/auth-context'),
  useAuth: jest.fn(),
}));
jest.mock('../features/notifications/NotificationPrompt', () => ({
  NotificationPrompt: () => null,
}));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ taskId: 'task-1' }),
}));

const api = tasksApi as jest.Mocked<typeof tasksApi>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const WORKER = {
  id: 'worker-1',
  name: 'Priya Nair',
  email: 'p@x.co',
  role: 'FIELD_WORKER' as const,
};

function listItem(id: string, title: string, status: TaskStatus): TaskListItem {
  return {
    id,
    title,
    status,
    address: 'Site address',
    worker: { id: WORKER.id, name: WORKER.name },
    rejection: null,
    createdAt: '2026-09-16T09:12:00.000Z',
    updatedAt: '2026-09-16T09:12:00.000Z',
    completedAt: null,
  };
}

const page = (items: TaskListItem[]): Paginated<TaskListItem> => ({ items, nextCursor: null });

/** The screens ask for one status set per section, so answer per request. */
function respondByStatus(map: Partial<Record<TaskStatus, TaskListItem[]>>) {
  api.fetchTasks.mockImplementation(async (query = {}) => {
    const statuses = query.statuses ?? [];
    const items = statuses.flatMap((status) => map[status] ?? []);
    return page(items);
  });
}

function detail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: 'task-1',
    title: 'Replace water meter',
    description: 'Old meter leaking.',
    status: 'IN_PROGRESS',
    location: { address: '14 Harbour Rd', addressDetails: null, latitude: null, longitude: null },
    assignment: {
      worker: { id: WORKER.id, name: WORKER.name },
      assignedAt: '2026-09-16T09:12:00.000Z',
      rejection: null,
    },
    progress: { acceptedAt: null, departedAt: null, arrivedAt: null, startedAt: null },
    review: { submittedAt: null, reviewedAt: null, reviewedBy: null, note: null },
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
  url: 'https://storage.test/p.jpg',
  fileType: 'image/jpeg' as const,
  source: 'CAMERA' as const,
  uploadedBy: { id: WORKER.id, name: WORKER.name },
  createdAt: '2026-09-16T10:40:00.000Z',
};

async function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <OfflineQueueProvider>
        <ToastProvider>{ui}</ToastProvider>
      </OfflineQueueProvider>
    </QueryClientProvider>,
  );
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
    completeSignIn: jest.fn(),
    updateUser: jest.fn(),
  });
});

describe('Worker dashboard (S-006)', () => {
  it('greets the worker and shows in-progress work before new assignments', async () => {
    respondByStatus({
      IN_PROGRESS: [listItem('t1', 'Started task', 'IN_PROGRESS')],
      ASSIGNED: [listItem('t2', 'New task', 'ASSIGNED')],
    });
    await renderScreen(<WorkerDashboard />);

    await waitFor(() => expect(screen.getByText('Started task')).toBeTruthy());
    expect(screen.getByRole('header', { name: 'Hello, Priya' })).toBeTruthy();
    // The live job is raised out of the list into its own card, with its
    // status and the next thing to do.
    expect(screen.getByTestId('current-job-t1')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Current task' })).toBeTruthy();
    expect(screen.getByLabelText('Status: In progress')).toBeTruthy();
    expect(screen.getByTestId('hero-add-photo')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'New assignments, 1' })).toBeTruthy();
  });

  it('offers the next journey step on the current job', async () => {
    respondByStatus({ ACCEPTED: [listItem('t1', 'Accepted task', 'ACCEPTED')] });
    await renderScreen(<WorkerDashboard />);

    await waitFor(() => expect(screen.getByTestId('hero-action-depart')).toBeTruthy());
    expect(screen.getByText('Next: tell your manager you’re on your way')).toBeTruthy();
  });

  it('says there is nothing to do when both sections are empty', async () => {
    respondByStatus({});
    await renderScreen(<WorkerDashboard />);

    await waitFor(() => expect(screen.getByText('You’re all clear')).toBeTruthy());
    expect(screen.getByText(/No tasks right now\. When your manager assigns you one/)).toBeTruthy();
  });

  it('opens a task from the dashboard', async () => {
    respondByStatus({ ASSIGNED: [listItem('t2', 'New task', 'ASSIGNED')] });
    await renderScreen(<WorkerDashboard />);
    await waitFor(() => expect(screen.getByTestId('task-card-t2')).toBeTruthy());

    await userEvent.setup().press(screen.getByTestId('task-card-t2'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(worker)/tasks/t2');
  });

  it('offers a retry when the lists fail to load', async () => {
    api.fetchTasks.mockRejectedValue(new Error('offline'));
    await renderScreen(<WorkerDashboard />);

    await waitFor(() => expect(screen.getByText("Couldn't load your tasks.")).toBeTruthy());
  });
});

describe('My tasks (S-007)', () => {
  it('separates active work from completed history', async () => {
    respondByStatus({
      IN_PROGRESS: [listItem('t1', 'Started task', 'IN_PROGRESS')],
      ASSIGNED: [listItem('t2', 'Assigned task', 'ASSIGNED')],
      COMPLETED: [listItem('t3', 'Finished task', 'COMPLETED')],
    });
    await renderScreen(<MyTasks />);

    await waitFor(() => expect(screen.getByText('Started task')).toBeTruthy());
    expect(screen.getByRole('header', { name: 'Active' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Completed' })).toBeTruthy();
    expect(screen.getByText('Finished task')).toBeTruthy();
  });

  it('keeps work waiting on the manager apart from active work', async () => {
    respondByStatus({
      IN_PROGRESS: [listItem('t1', 'Started task', 'IN_PROGRESS')],
      AWAITING_REVIEW: [listItem('t4', 'Submitted task', 'AWAITING_REVIEW')],
    });
    await renderScreen(<MyTasks />);

    await waitFor(() => expect(screen.getByText('Submitted task')).toBeTruthy());
    expect(screen.getByRole('header', { name: 'Awaiting review' })).toBeTruthy();
  });

  it('explains each empty section', async () => {
    respondByStatus({});
    await renderScreen(<MyTasks />);

    await waitFor(() => expect(screen.getByText('No active tasks.')).toBeTruthy());
    expect(screen.getByText('Completed tasks will appear here.')).toBeTruthy();
  });
});

describe('Task completion (S-010)', () => {
  it('summarises photos and notes before completing', async () => {
    api.fetchTask.mockResolvedValue(
      detail({
        evidence: [photo],
        notes: [
          {
            id: 'n1',
            content: 'Done',
            createdBy: { id: WORKER.id, name: WORKER.name },
            createdAt: '2026-09-16T11:00:00.000Z',
            updatedAt: null,
          },
        ],
      }),
    );
    await renderScreen(<CompleteTaskScreen />);

    await waitFor(() => expect(screen.getByText('1 photo')).toBeTruthy());
    expect(screen.getByText('1 from camera, 0 from gallery')).toBeTruthy();
    expect(screen.getByTestId('summary-photos')).toHaveTextContent('Done');
    expect(screen.getByText('1 note')).toBeTruthy();
    expect(screen.getByTestId('summary-notes')).toHaveTextContent('Done');
    expect(screen.getByText('All photos uploaded')).toBeTruthy();
    expect(screen.getByTestId('summary-uploads')).toHaveTextContent('Done');
    expect(screen.getByText(/After you submit, photos and notes are locked/)).toBeTruthy();
  });

  it('says photos are still waiting to upload, without blocking the submit', async () => {
    const real = offlineQueue.useOfflineQueue;
    const spy = jest
      .spyOn(offlineQueue, 'useOfflineQueue')
      .mockImplementation(() => ({ ...real(), photosPendingFor: () => 2 }));
    api.fetchTask.mockResolvedValue(detail({ evidence: [photo] }));
    await renderScreen(<CompleteTaskScreen />);

    await waitFor(() => expect(screen.getByTestId('summary-uploads')).toHaveTextContent('Waiting'));
    expect(screen.getByText('2 photos waiting to upload')).toBeTruthy();
    expect(screen.getByTestId('confirm-complete')).toBeEnabled();
    spy.mockRestore();
  });

  it('marks photos as required and blocks completion when there are none', async () => {
    api.fetchTask.mockResolvedValue(detail());
    await renderScreen(<CompleteTaskScreen />);

    await waitFor(() => expect(screen.getByTestId('summary-photos')).toHaveTextContent('Required'));
    expect(screen.getByTestId('summary-notes')).toHaveTextContent('Optional');
    expect(screen.getByTestId('confirm-complete')).toBeDisabled();
    expect(screen.getByText('Add at least 1 photo to submit for review.')).toBeTruthy();
  });

  it('hands the work to the manager rather than closing the task', async () => {
    api.fetchTask.mockResolvedValue(detail({ evidence: [photo] }));
    api.completeTask.mockResolvedValue(detail({ status: 'AWAITING_REVIEW', evidence: [photo] }));
    await renderScreen(<CompleteTaskScreen />);
    await waitFor(() => expect(screen.getByTestId('confirm-complete')).toBeEnabled());

    await userEvent.setup().press(screen.getByTestId('confirm-complete'));

    await waitFor(() => expect(api.completeTask).toHaveBeenCalledWith('task-1'));
    await waitFor(() => expect(screen.getByTestId('completion-success')).toBeTruthy());
    // It is not finished, and the wording must not pretend otherwise.
    expect(screen.getByText('Sent for review')).toBeTruthy();
    expect(
      screen.getByText(/We’ll let you know when they approve it or ask for changes/),
    ).toBeTruthy();
  });

  it('shows the server message when completion is refused', async () => {
    api.fetchTask.mockResolvedValue(detail({ evidence: [photo] }));
    api.completeTask.mockRejectedValue(
      new ApiError('INVALID_STATUS_TRANSITION', 'This task can no longer be updated.', 409),
    );
    await renderScreen(<CompleteTaskScreen />);
    await waitFor(() => expect(screen.getByTestId('confirm-complete')).toBeEnabled());

    await userEvent.setup().press(screen.getByTestId('confirm-complete'));

    await waitFor(() =>
      expect(screen.getByTestId('complete-error')).toHaveTextContent(
        'This task can no longer be updated.',
      ),
    );
  });
});
