import type { CreateTaskInput } from '@fieldmate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../../../src/components/AppHeader';
import { ErrorState, LoadingState } from '../../../../src/components/States';
import { useToast } from '../../../../src/components/Toast';
import { colors, layout } from '../../../../src/constants/theme';
import { TaskForm } from '../../../../src/features/tasks/TaskForm';
import { useTask, useUpdateTask } from '../../../../src/features/tasks/hooks';
import { ApiError } from '../../../../src/services/http';

/** S-004 in edit mode: title, description and location only (BR-009). */
export default function EditTaskScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const task = useTask(taskId);
  const updateTask = useUpdateTask(taskId);
  const [error, setError] = useState<string | null>(null);

  const submit = (values: CreateTaskInput) => {
    setError(null);
    updateTask.mutate(
      { title: values.title, description: values.description, location: values.location },
      {
        onSuccess: () => {
          showToast('Changes saved');
          router.back();
        },
        onError: (err) => {
          setError(
            err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
          );
        },
      },
    );
  };

  const worker = task.data?.assignment.worker;
  const firstName = worker?.name.split(' ')[0] ?? '';
  // The API tells the assignee about an edit, except on a task they handed back.
  const notice =
    task.data && worker && task.data.status !== 'REJECTED'
      ? `${firstName} is notified when you save.`
      : null;

  return (
    <View style={styles.screen}>
      <AppHeader title="Edit task" onBack={() => router.back()} backIcon="close" />

      {task.isPending ? (
        <View style={styles.padded}>
          <LoadingState variant="detail" />
        </View>
      ) : null}

      {task.isError ? (
        <View style={styles.padded}>
          <ErrorState message="Couldn't load this task." onRetry={() => void task.refetch()} />
        </View>
      ) : null}

      {task.data ? (
        <TaskForm
          mode="edit"
          defaultValues={{
            title: task.data.title,
            description: task.data.description,
            workerId: task.data.assignment.worker.id,
            workerName: task.data.assignment.worker.name,
            location: task.data.location,
          }}
          notice={notice}
          submitting={updateTask.isPending}
          submitError={error}
          onSubmit={submit}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  padded: { padding: layout.screenPadding },
});
