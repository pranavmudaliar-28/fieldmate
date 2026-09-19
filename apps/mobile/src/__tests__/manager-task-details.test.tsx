import type { TaskDetail, TaskStatus } from '@fieldmate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import ManagerTaskDetails from '../../app/(manager)/tasks/[taskId]/index';
import { ToastProvider } from '../components/Toast';
import * as tasksApi from '../features/tasks/api';

jest.mock('../features/tasks/api');

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ taskId: 'task-1' }),
}));

const api = tasksApi as jest.Mocked<typeof tasksApi>;

const WORKER = { id: '22222222-2222-4222-8222-222222222222', name: 'Priya Nair' };

function buildTask(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: 'task-1',
    title: 'Replace water meter',
    description: 'Old meter leaking.',
    status: 'ASSIGNED' as TaskStatus,
    location: { address: '14 Harbour Rd', latitude: null, longitude: null },
    assignment: { worker: WORKER, assignedAt: '2026-09-16T09:12:00.000Z', rejection: null },
    evidence: [],
    notes: [],
    createdAt: '2026-09-16T09:12:00.000Z',
    updatedAt: '2026-09-16T09:12:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

async function renderDetails(task: TaskDetail) {
  api.fetchTask.mockResolvedValue(task);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ManagerTaskDetails />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText('Replace water meter')).toBeTruthy());
}

beforeEach(() => jest.clearAllMocks());

describe('Manager task details (S-005)', () => {
  it('shows the task, its worker, status and location', async () => {
    await renderDetails(buildTask());

    expect(screen.getByText('Old meter leaking.')).toBeTruthy();
    expect(screen.getByText('Priya Nair')).toBeTruthy();
    expect(screen.getByText('Assigned')).toBeTruthy();
    expect(screen.getByText('14 Harbour Rd')).toBeTruthy();
    expect(screen.getByText('No photos yet.')).toBeTruthy();
  });

  it('offers edit, reassign and cancel for an assigned task', async () => {
    await renderDetails(buildTask());

    expect(screen.getByTestId('action-edit')).toBeTruthy();
    expect(screen.getByTestId('action-reassign')).toBeTruthy();
    expect(screen.getByTestId('action-cancel')).toBeTruthy();
    expect(screen.queryByTestId('action-complete')).toBeNull();
    expect(screen.queryByTestId('action-reopen')).toBeNull();
  });

  it('disables Complete until the task has a photo, and explains why', async () => {
    await renderDetails(buildTask({ status: 'IN_PROGRESS' }));

    expect(screen.getByTestId('action-complete')).toBeDisabled();
    expect(screen.getByText('At least 1 photo is required to complete this task.')).toBeTruthy();
  });

  it('completes an in-progress task with a photo after confirmation', async () => {
    const task = buildTask({
      status: 'IN_PROGRESS',
      evidence: [
        {
          id: 'e1',
          url: 'https://storage.test/photo.jpg',
          fileType: 'image/jpeg',
          uploadedBy: WORKER,
          createdAt: '2026-09-16T10:40:00.000Z',
        },
      ],
    });
    await renderDetails(task);
    api.completeTask.mockResolvedValue({ ...task, status: 'COMPLETED' });

    const user = userEvent.setup();
    await user.press(screen.getByTestId('action-complete'));

    await waitFor(() =>
      expect(
        screen.getByText(
          'Complete this task? The worker will no longer be able to add photos or notes.',
        ),
      ).toBeTruthy(),
    );
    await user.press(screen.getByRole('button', { name: 'Complete' }));

    await waitFor(() => expect(api.completeTask).toHaveBeenCalledWith('task-1'));
  });

  it('warns that cancelling cannot be undone', async () => {
    await renderDetails(buildTask());
    await userEvent.setup().press(screen.getByTestId('action-cancel'));

    await waitFor(() =>
      expect(screen.getByText("Cancel this task? This can't be undone.")).toBeTruthy(),
    );
    expect(api.cancelTask).not.toHaveBeenCalled();
  });

  it('offers only Reopen for a completed task', async () => {
    await renderDetails(
      buildTask({ status: 'COMPLETED', completedAt: '2026-09-16T15:30:00.000Z' }),
    );

    expect(screen.getByTestId('action-reopen')).toBeTruthy();
    expect(screen.queryByTestId('action-edit')).toBeNull();
    expect(screen.queryByTestId('action-cancel')).toBeNull();
  });

  it('offers no actions for a cancelled task', async () => {
    await renderDetails(buildTask({ status: 'CANCELLED' }));

    for (const action of ['edit', 'reassign', 'cancel', 'complete', 'reopen']) {
      expect(screen.queryByTestId(`action-${action}`)).toBeNull();
    }
  });

  it('shows the rejection reason on a rejected task', async () => {
    await renderDetails(
      buildTask({
        status: 'REJECTED',
        assignment: {
          worker: WORKER,
          assignedAt: '2026-09-16T09:12:00.000Z',
          rejection: { reason: 'Site locked, no key', rejectedAt: '2026-09-16T10:03:00.000Z' },
        },
      }),
    );

    expect(screen.getByTestId('task-rejection')).toBeTruthy();
    expect(screen.getByText(/Site locked, no key/)).toBeTruthy();
  });

  it('reassigns after confirming the chosen worker', async () => {
    const task = buildTask();
    await renderDetails(task);
    const other = { id: '33333333-3333-4333-8333-333333333333', name: 'Sam Lee' };
    api.fetchFieldWorkers.mockResolvedValue([WORKER, other]);
    api.reassignTask.mockResolvedValue({
      ...task,
      assignment: { ...task.assignment, worker: other },
    });

    const user = userEvent.setup();
    await user.press(screen.getByTestId('action-reassign'));
    await waitFor(() => expect(screen.getByTestId(`worker-option-${other.id}`)).toBeTruthy());
    await user.press(screen.getByTestId(`worker-option-${other.id}`));

    await waitFor(() =>
      expect(
        screen.getByText(/Reassign to Sam Lee\? Priya Nair will lose access to this task\./),
      ).toBeTruthy(),
    );
    // Both the action bar and the dialog have a "Reassign" button; confirm in the dialog.
    const confirmButtons = screen.getAllByRole('button', { name: 'Reassign' });
    await user.press(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => expect(api.reassignTask).toHaveBeenCalledWith('task-1', other.id));
  });

  it('marks the current worker as not selectable when reassigning', async () => {
    await renderDetails(buildTask());
    api.fetchFieldWorkers.mockResolvedValue([WORKER]);

    await userEvent.setup().press(screen.getByTestId('action-reassign'));

    await waitFor(() => expect(screen.getByTestId(`worker-option-${WORKER.id}`)).toBeDisabled());
    expect(screen.getByText('Current')).toBeTruthy();
  });
});
