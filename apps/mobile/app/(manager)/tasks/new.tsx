import type { CreateTaskInput } from '@fieldmate/shared';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ConfirmationDialog } from '../../../src/components/ConfirmationDialog';
import { useToast } from '../../../src/components/Toast';
import { colors, layout, spacing, typography } from '../../../src/constants/theme';
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
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New task',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={leave}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="close-create-task"
              hitSlop={8}
              style={styles.headerButton}
            >
              <Text style={styles.headerLabel}>Close</Text>
            </Pressable>
          ),
        }}
      />

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
        message="Your new task will not be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          router.back();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerLabel: { ...typography.button, color: colors.primary },
});
