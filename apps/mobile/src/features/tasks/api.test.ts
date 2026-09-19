import { apiRequest } from '../../services/http';
import {
  cancelTask,
  completeTask,
  createTask,
  fetchFieldWorkers,
  fetchTask,
  fetchTasks,
  reassignTask,
  reopenTask,
  updateTask,
} from './api';

jest.mock('../../services/http', () => ({
  ...jest.requireActual('../../services/http'),
  apiRequest: jest.fn(),
}));

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const path = () => mockApiRequest.mock.calls[0]?.[0];
const options = () => mockApiRequest.mock.calls[0]?.[1];

beforeEach(() => {
  jest.clearAllMocks();
  mockApiRequest.mockResolvedValue({ items: [], nextCursor: null } as never);
});

describe('task list query', () => {
  it('asks for everything when nothing is filtered', async () => {
    await fetchTasks();
    expect(path()).toBe('/tasks');
  });

  it('joins several statuses with a comma', async () => {
    await fetchTasks({ statuses: ['ASSIGNED', 'IN_PROGRESS'] });
    expect(path()).toBe('/tasks?status=ASSIGNED%2CIN_PROGRESS');
  });

  it('passes the page size and cursor', async () => {
    await fetchTasks({ statuses: ['COMPLETED'], limit: 10, cursor: 'abc123' });
    expect(path()).toBe('/tasks?status=COMPLETED&limit=10&cursor=abc123');
  });

  it('escapes a cursor safely', async () => {
    await fetchTasks({ cursor: 'a+b/c=' });
    expect(path()).toBe('/tasks?cursor=a%2Bb%2Fc%3D');
  });

  it('ignores an empty status list', async () => {
    await fetchTasks({ statuses: [] });
    expect(path()).toBe('/tasks');
  });
});

describe('task endpoints', () => {
  it('reads one task', async () => {
    await fetchTask('task-1');
    expect(path()).toBe('/tasks/task-1');
  });

  it('asks only for field workers', async () => {
    mockApiRequest.mockResolvedValue({ items: [{ id: 'w1', name: 'Priya' }] } as never);
    await expect(fetchFieldWorkers()).resolves.toEqual([{ id: 'w1', name: 'Priya' }]);
    expect(path()).toBe('/users?role=FIELD_WORKER');
  });

  it('creates a task with the form values', async () => {
    const input = {
      title: 'T',
      description: 'D',
      workerId: 'w1',
      location: { address: 'A', latitude: null, longitude: null },
    };
    await createTask(input);
    expect(path()).toBe('/tasks');
    expect(options()).toMatchObject({ method: 'POST', body: input });
  });

  it('updates with PATCH', async () => {
    await updateTask('task-1', { title: 'New' });
    expect(path()).toBe('/tasks/task-1');
    expect(options()).toMatchObject({ method: 'PATCH', body: { title: 'New' } });
  });

  it.each([
    ['reassign', () => reassignTask('task-1', 'w2'), '/tasks/task-1/assignment'],
    ['cancel', () => cancelTask('task-1'), '/tasks/task-1/cancel'],
    ['reopen', () => reopenTask('task-1'), '/tasks/task-1/reopen'],
    ['complete', () => completeTask('task-1'), '/tasks/task-1/complete'],
  ])('%s posts to its own path', async (_name, call, expected) => {
    await call();
    expect(path()).toBe(expected);
    expect(options()?.method).toBe('POST');
  });

  it('sends the chosen worker when reassigning', async () => {
    await reassignTask('task-1', 'w2');
    expect(options()).toMatchObject({ body: { workerId: 'w2' } });
  });
});
