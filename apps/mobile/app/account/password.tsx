import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema } from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { ActionBar } from '../../src/components/ActionBar';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { FormError, errorMessage } from '../../src/components/FormError';
import { Input } from '../../src/components/Input';
import { useToast } from '../../src/components/Toast';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../src/constants/theme';
import { changePassword } from '../../src/features/auth/api';
import { useAuth } from '../../src/features/auth/auth-context';

const formSchema = changePasswordSchema
  .extend({ confirm: z.string() })
  .refine((values) => values.newPassword === values.confirm, {
    path: ['confirm'],
    message: 'The passwords don’t match.',
  });
type FormValues = z.input<typeof formSchema>;

/** Changing the password signs out every other device; this one stays signed in. */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { completeSignIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError(null);
    try {
      await completeSignIn(await changePassword(currentPassword, newPassword));
      showToast('Password changed. Other devices are signed out.');
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  });

  const field = (
    name: keyof FormValues,
    label: string,
    testID: string,
    extra: { helper?: string; current?: boolean } = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          label={label}
          icon="lock-closed-outline"
          testID={testID}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          {...(errors[name]?.message
            ? { error: errors[name]?.message }
            : extra.helper
              ? { helper: extra.helper }
              : {})}
          secure
          autoCapitalize="none"
          autoComplete={extra.current ? 'current-password' : 'new-password'}
          textContentType={extra.current ? 'password' : 'newPassword'}
          editable={!isSubmitting}
        />
      )}
    />
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="Change password" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {field('currentPassword', 'Current password', 'account-current-password', {
          current: true,
        })}
        {field('newPassword', 'New password', 'account-new-password', {
          helper: 'At least 8 characters.',
        })}
        {field('confirm', 'Confirm new password', 'account-confirm-password')}
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.note}>
          You stay signed in here. Any other phone signed in as you is signed out.
        </Text>
        <FormError message={error} testID="account-password-error" />
      </ScrollView>
      <ActionBar>
        <Button
          label="Change password"
          testID="account-password-save"
          loading={isSubmitting}
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
  note: { ...typography.secondary, color: colors.textSecondary },
  /** The action bar is a row: a lone button needs flex to span it. */
  barAction: { flex: 1 },
});
