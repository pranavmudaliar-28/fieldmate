import { zodResolver } from '@hookform/resolvers/zod';
import { updateMeSchema, type UpdateMeInput } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActionBar } from '../../src/components/ActionBar';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { FormError, errorMessage } from '../../src/components/FormError';
import { Input } from '../../src/components/Input';
import { useToast } from '../../src/components/Toast';
import { colors, layout, spacing } from '../../src/constants/theme';
import { updateMe } from '../../src/features/auth/api';
import { useAuth } from '../../src/features/auth/auth-context';

/** The user's own name, as managers and admins see it on tasks. */
export default function EditNameScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, updateUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateMeInput>({
    resolver: zodResolver(updateMeSchema),
    defaultValues: { name: user?.name ?? '' },
  });

  const submit = handleSubmit(async ({ name }) => {
    setError(null);
    try {
      updateUser(await updateMe(name));
      showToast('Name updated');
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  });

  return (
    <View style={styles.screen}>
      <AppHeader title="Your name" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Full name"
              required
              testID="account-name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              {...(errors.name?.message ? { error: errors.name.message } : {})}
              autoComplete="name"
              textContentType="name"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              editable={!isSubmitting}
            />
          )}
        />
        <FormError message={error} testID="account-name-error" />
      </ScrollView>
      <ActionBar>
        <Button
          label="Save"
          testID="account-name-save"
          loading={isSubmitting}
          disabled={!isDirty}
          onPress={() => void submit()}
          style={styles.barAction}
        />
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingTop: spacing.xs, gap: spacing.mdPlus },
  /** The action bar is a row: a lone button needs flex to span it. */
  barAction: { flex: 1 },
});
