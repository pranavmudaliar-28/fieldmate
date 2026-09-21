import { useRouter } from 'expo-router';
import { TaskListScreen } from '../../../src/features/tasks/TaskListScreen';

/**
 * Admins hold every manager power, so they get their own tasks tab instead of
 * a button that drops them into the manager section. Opening a task still
 * pushes into the manager group; those screens are shared in the next step.
 */
export default function AdminTaskList() {
  const router = useRouter();

  return (
    <TaskListScreen
      onOpenTask={(taskId) => router.push(`/(manager)/tasks/${taskId}`)}
      onCreateTask={() => router.push('/(manager)/tasks/new')}
    />
  );
}
