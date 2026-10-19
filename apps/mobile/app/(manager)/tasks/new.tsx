import type { CreateTaskInput } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../../src/components/AppHeader';
import { ConfirmationDialog } from '../../../src/components/ConfirmationDialog';
import { useToast } from '../../../src/components/Toast';
import { colors } from '../../../src/constants/theme';
import { TaskForm } from '../../../src/features/tasks/TaskForm';
import { useCreateTask } from '../../../src/features/tasks/hooks';
import { ApiError } from '../../../src/services/http';

/** S-004 Create Task. On success the screen is replaced by the new task's details. */
export default function CreateTaskScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const createTask = useCreateTask();
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (values: CreateTaskInput) => {
    setError(null);
    createTask.mutate(values, {
      onSuccess: (task) => {
        showToast('Task created');
        // Replace, so Back returns to the dashboard rather than an empty form.
        router.replace(`/(manager)/tasks/${task.id}`);
      },
      onError: (err) => {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      },
    });
  };

  const leave = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    router.back();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="New task" onBack={leave} backIcon="close" backTestID="close-create-task" />

      <TaskForm
        mode="create"
        submitting={createTask.isPending}
        submitError={error}
        onSubmit={submit}
        onDirtyChange={setDirty}
      />

      <ConfirmationDialog
        visible={confirmDiscard}
        title="Discard changes?"
        message="This task hasn’t been created yet. Everything you entered will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        icon="trash-outline"
        onConfirm={() => {
          setConfirmDiscard(false);
          router.back();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
