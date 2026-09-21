import type { CreateUserInput } from '@fieldmate/shared';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useToast } from '../../../src/components/Toast';
import { UserForm } from '../../../src/features/admin/UserForm';
import { useCreateUser } from '../../../src/features/admin/hooks';
import { ApiError } from '../../../src/services/http';

/** S-013 Add user. */
export default function AddUserScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const createUser = useCreateUser();
  const [error, setError] = useState<string | null>(null);

  const submit = (values: CreateUserInput) => {
    setError(null);
    createUser.mutate(values, {
      onSuccess: (user) => {
        showToast(`${user.name} added`);
        router.replace(`/(admin)/users/${user.id}`);
      },
      onError: (err) => {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Add user' }} />
      <UserForm
        mode="create"
        submitting={createUser.isPending}
        submitError={error}
        onSubmit={submit}
      />
    </>
  );
}
