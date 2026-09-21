import { useRouter } from 'expo-router';
import { TaskListScreen } from '../../../src/features/tasks/TaskListScreen';

/** S-003 for managers. The admin tab mounts the same screen in its own group. */
export default function ManagerTaskList() {
  const router = useRouter();

  return (
    <TaskListScreen
      onOpenTask={(taskId) => router.push(`/(manager)/tasks/${taskId}`)}
      onCreateTask={() => router.push('/(manager)/tasks/new')}
    />
  );
}
