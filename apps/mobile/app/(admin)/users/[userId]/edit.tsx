import type { CreateUserInput } from '@fieldmate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../../../src/components/AppHeader';
import { ErrorState, LoadingState } from '../../../../src/components/States';
import { useToast } from '../../../../src/components/Toast';
import { colors, layout } from '../../../../src/constants/theme';
import { UserForm } from '../../../../src/features/admin/UserForm';
import { useUpdateUser, useUser } from '../../../../src/features/admin/hooks';
import { ApiError } from '../../../../src/services/http';

/** S-013 in edit mode: name, email and role (the password has its own action). */
export default function EditUserScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const user = useUser(userId);
  const updateUser = useUpdateUser(userId);
  const [error, setError] = useState<string | null>(null);

  const submit = (values: CreateUserInput) => {
    setError(null);
    updateUser.mutate(
      { name: values.name, email: values.email, role: values.role },
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
    <View style={styles.screen}>
      <AppHeader title="Edit user" onBack={() => router.back()} backIcon="close" />

      {user.isPending ? (
        <View style={styles.padded}>
          <LoadingState variant="detail" />
        </View>
      ) : null}

      {user.isError ? (
        <View style={styles.padded}>
          <ErrorState message="Couldn't load this user." onRetry={() => void user.refetch()} />
        </View>
      ) : null}

      {user.data ? (
        <UserForm
          mode="edit"
          defaultValues={{
            name: user.data.name,
            email: user.data.email,
            role: user.data.role,
          }}
          submitting={updateUser.isPending}
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
