import type { CreateUserInput } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../../src/components/AppHeader';
import { errorMessage } from '../../src/components/FormError';
import { useToast } from '../../src/components/Toast';
import { colors } from '../../src/constants/theme';
import { UserForm } from '../../src/features/admin/UserForm';
import { useInviteWorker } from '../../src/features/admin/hooks';

/** Managers bring their own crew in: field workers only, by email invitation. */
export default function InviteWorkerScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const invite = useInviteWorker();
  const [error, setError] = useState<string | null>(null);

  const submit = ({ name, email }: CreateUserInput) => {
    setError(null);
    invite.mutate(
      { name, email },
      {
        onSuccess: (user) => {
          showToast(`Invitation sent to ${user.email}`);
          router.back();
        },
        onError: (inviteError) => setError(errorMessage(inviteError)),
      },
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Invite a field worker" onBack={() => router.back()} backIcon="close" />
      <UserForm
        mode="create"
        roleChoice={false}
        submitting={invite.isPending}
        submitError={error}
        onSubmit={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
