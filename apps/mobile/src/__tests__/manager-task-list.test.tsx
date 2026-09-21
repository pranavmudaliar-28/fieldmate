import type { Paginated, TaskListItem, TaskStatus } from '@fieldmate/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import ManagerTaskList from '../../app/(manager)/(tabs)/tasks';
import * as tasksApi from '../features/tasks/api';

jest.mock('../features/tasks/api');

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParams: { status?: string } = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

const api = tasksApi as jest.Mocked<typeof tasksApi>;

function task(id: string, title: string, status: TaskStatus = 'ASSIGNED'): TaskListItem {
  return {
    id,
    title,
    status,
    address: `${title} address`,
    worker: { id: 'w1', name: 'Priya Nair' },
    rejection: null,
    createdAt: '2026-09-16T09:12:00.000Z',
    updatedAt: '2026-09-16T09:12:00.000Z',
    completedAt: null,
  };
}

const page = (
  items: TaskListItem[],
  nextCursor: string | null = null,
): Paginated<TaskListItem> => ({
  items,
  nextCursor,
});

async function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <ManagerTaskList />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  delete mockParams.status;
  api.fetchTasks.mockResolvedValue(page([task('t1', 'First task'), task('t2', 'Second task')]));
});

describe('Manager task list (S-003)', () => {
  it('lists tasks with their worker', async () => {
    await renderList();

    await waitFor(() => expect(screen.getByText('First task')).toBeTruthy());
    expect(screen.getByText('Second task')).toBeTruthy();
    expect(screen.getAllByText('Priya Nair')).toHaveLength(2);
  });

  it('shows a filter chip for every status plus All', async () => {
    await renderList();

    for (const testId of [
      'filter-ALL',
      'filter-ASSIGNED',
      'filter-IN_PROGRESS',
      'filter-COMPLETED',
      'filter-REJECTED',
      'filter-CANCELLED',
    ]) {
      expect(screen.getByTestId(testId)).toBeTruthy();
    }
  });

  it('asks the server for the chosen status', async () => {
    await renderList();
    await waitFor(() => expect(api.fetchTasks).toHaveBeenCalled());

    await userEvent.setup().press(screen.getByTestId('filter-COMPLETED'));

    await waitFor(() =>
      expect(api.fetchTasks).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['COMPLETED'] }),
      ),
    );
  });

  it('starts on the status passed in the route', async () => {
    mockParams.status = 'COMPLETED';
    await renderList();

    await waitFor(() =>
      expect(api.fetchTasks).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['COMPLETED'] }),
      ),
    );
  });

  it('opens a task when its card is tapped', async () => {
    await renderList();
    await waitFor(() => expect(screen.getByText('First task')).toBeTruthy());

    await userEvent.setup().press(screen.getByTestId('task-card-t1'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(manager)/tasks/t1');
  });

  it('invites the manager to create the first task when there are none', async () => {
    api.fetchTasks.mockResolvedValue(page([]));
    await renderList();

    await waitFor(() => expect(screen.getByText('No tasks yet')).toBeTruthy());
    // The header offers the same action, so target the empty state's own button.
    const emptyState = within(screen.getByTestId('empty-state'));
    await userEvent.setup().press(emptyState.getByRole('button', { name: 'Create task' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/(manager)/tasks/new');
  });

  it('explains an empty filtered list differently', async () => {
    api.fetchTasks.mockResolvedValue(page([]));
    mockParams.status = 'REJECTED';
    await renderList();

    await waitFor(() => expect(screen.getByText('No tasks with this status')).toBeTruthy());
    // A filtered empty list offers no shortcut to create; the header still does.
    const emptyState = within(screen.getByTestId('empty-state'));
    expect(emptyState.queryByRole('button', { name: 'Create task' })).toBeNull();
  });

  it('shows a retry when the list cannot be loaded', async () => {
    api.fetchTasks.mockRejectedValue(new Error('offline'));
    await renderList();

    await waitFor(() => expect(screen.getByText("Couldn't load tasks.")).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows a loading state first', async () => {
    api.fetchTasks.mockImplementation(() => new Promise(() => {}));
    await renderList();

    expect(screen.getByTestId('loading-state')).toBeTruthy();
  });

  it('loads the next page when the cursor says there is more', async () => {
    api.fetchTasks.mockResolvedValueOnce(page([task('t1', 'First task')], 'cursor-1'));
    api.fetchTasks.mockResolvedValueOnce(page([task('t2', 'Second task')]));
    await renderList();
    await waitFor(() => expect(screen.getByText('First task')).toBeTruthy());

    // Simulate scrolling to the end of the list.
    fireEvent(screen.getByTestId('manager-task-list'), 'endReached');

    await waitFor(() =>
      expect(api.fetchTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: 'cursor-1' }),
      ),
    );
    await waitFor(() => expect(screen.getByText('Second task')).toBeTruthy());
  });
});
