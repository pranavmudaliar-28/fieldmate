import type { CreateTaskInput } from '@fieldmate/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../src/components/States';
import { useToast } from '../../../../src/components/Toast';
import { layout } from '../../../../src/constants/theme';
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

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Edit task' }} />

      {task.isPending ? (
        <View style={{ padding: layout.screenPadding }}>
          <LoadingState variant="detail" />
        </View>
      ) : null}

      {task.isError ? (
        <ErrorState message="Couldn't load this task." onRetry={() => void task.refetch()} />
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
          submitting={updateTask.isPending}
          submitError={error}
          onSubmit={submit}
        />
      ) : null}
    </>
  );
}
