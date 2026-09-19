import type { TaskListItem } from '@fieldmate/shared';
import { render, screen, userEvent } from '@testing-library/react-native';
import { TaskCard } from './TaskCard';

const task: TaskListItem = {
  id: 'task-1',
  title: 'Replace water meter at Block C',
  status: 'IN_PROGRESS',
  address: '14 Harbour Rd, Unit 3',
  worker: { id: 'w1', name: 'Priya Nair' },
  rejection: null,
  createdAt: '2026-09-16T09:12:00.000Z',
  updatedAt: '2026-09-16T09:12:00.000Z',
  completedAt: null,
};

describe('TaskCard', () => {
  it('shows the title, status and address', async () => {
    await render(<TaskCard task={task} onPress={jest.fn()} />);

    expect(screen.getByText('Replace water meter at Block C')).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('14 Harbour Rd, Unit 3')).toBeTruthy();
  });

  it('hides the worker unless asked for', async () => {
    await render(<TaskCard task={task} onPress={jest.fn()} />);
    expect(screen.queryByText('Priya Nair')).toBeNull();
  });

  it('shows the worker for managers', async () => {
    await render(<TaskCard task={task} onPress={jest.fn()} showWorker />);
    expect(screen.getByText('Priya Nair')).toBeTruthy();
  });

  it('shows the rejection reason when asked', async () => {
    const rejected: TaskListItem = {
      ...task,
      status: 'REJECTED',
      rejection: { reason: 'Site locked, no key', rejectedAt: '2026-09-16T10:03:00.000Z' },
    };
    await render(<TaskCard task={rejected} onPress={jest.fn()} showWorker showRejection />);

    expect(screen.getByText(/Site locked, no key/)).toBeTruthy();
    expect(screen.getByText('Rejected')).toBeTruthy();
  });

  it('is a button that reads as one label for screen readers', async () => {
    const onPress = jest.fn();
    await render(<TaskCard task={task} onPress={onPress} showWorker />);

    const card = screen.getByRole('button', {
      name: 'Replace water meter at Block C, status In progress, 14 Harbour Rd, Unit 3, assigned to Priya Nair',
    });
    await userEvent.setup().press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
