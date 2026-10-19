import type { CreateUserInput } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../../src/components/AppHeader';
import { useToast } from '../../../src/components/Toast';
import { colors } from '../../../src/constants/theme';
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
    <View style={styles.screen}>
      <AppHeader title="New user" onBack={() => router.back()} backIcon="close" />
      <UserForm
        mode="create"
        submitting={createUser.isPending}
        submitError={error}
        onSubmit={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
