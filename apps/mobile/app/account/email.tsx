import { zodResolver } from '@hookform/resolvers/zod';
import {
  changeEmailSchema,
  confirmEmailSchema,
  type ChangeEmailInput,
  type ConfirmEmailInput,
} from '@fieldmate/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { confirmEmailChange, requestEmailChange } from '../../src/features/auth/api';
import { useAuth } from '../../src/features/auth/auth-context';

/**
 * Two steps: the new address and the current password, then the code emailed
 * to the new address. The old address keeps working until the code is entered,
 * so a typo cannot lock anyone out.
 */
export default function ChangeEmailScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, updateUser } = useAuth();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const details = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: '', currentPassword: '' },
  });
  const confirmation = useForm<ConfirmEmailInput>({
    resolver: zodResolver(confirmEmailSchema),
    defaultValues: { code: '' },
  });

  const sendCode = details.handleSubmit(async ({ newEmail, currentPassword }) => {
    setError(null);
    try {
      await requestEmailChange(newEmail, currentPassword);
      setSentTo(newEmail);
    } catch (sendError) {
      setError(errorMessage(sendError));
    }
  });

  const confirm = confirmation.handleSubmit(async ({ code }) => {
    setError(null);
    try {
      updateUser(await confirmEmailChange(code));
      showToast('Email updated');
      router.back();
    } catch (confirmError) {
      setError(errorMessage(confirmError));
    }
  });

  const busy = details.formState.isSubmitting || confirmation.formState.isSubmitting;

  return (
    <View style={styles.screen}>
      <AppHeader title="Change email" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.lead}>
          {sentTo
            ? `We emailed a 6-digit code to ${sentTo}. Enter it to switch. Until then you keep signing in with ${user?.email ?? 'your current email'}.`
            : `You sign in with ${user?.email ?? 'your current email'}. We’ll send a code to the new address to check it’s yours.`}
        </Text>

        {sentTo ? (
          <Controller
            control={confirmation.control}
            name="code"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Code from the email"
                icon="keypad-outline"
                placeholder="123456"
                testID="account-email-code"
                value={value}
                onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
                onBlur={onBlur}
                {...(confirmation.formState.errors.code?.message
                  ? { error: confirmation.formState.errors.code.message }
                  : {})}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                style={styles.code}
                editable={!busy}
              />
            )}
          />
        ) : (
          <>
            <Controller
              control={details.control}
              name="newEmail"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="New work email"
                  icon="mail-outline"
                  placeholder="name@company.com"
                  testID="account-new-email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  {...(details.formState.errors.newEmail?.message
                    ? { error: details.formState.errors.newEmail.message }
                    : {})}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!busy}
                />
              )}
            />
            <Controller
              control={details.control}
              name="currentPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Current password"
                  icon="lock-closed-outline"
                  testID="account-email-password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  {...(details.formState.errors.currentPassword?.message
                    ? { error: details.formState.errors.currentPassword.message }
                    : {})}
                  secure
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  editable={!busy}
                />
              )}
            />
          </>
        )}

        <FormError message={error} testID="account-email-error" />
      </ScrollView>

      <ActionBar>
        {sentTo ? (
          <Button
            label="Confirm new email"
            testID="account-email-confirm"
            loading={confirmation.formState.isSubmitting}
            onPress={() => void confirm()}
            style={styles.barAction}
          />
        ) : (
          <Button
            label="Send code"
            testID="account-email-send"
            loading={details.formState.isSubmitting}
            onPress={() => void sendCode()}
            style={styles.barAction}
          />
        )}
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingTop: spacing.xs, gap: spacing.mdPlus },
  lead: { ...typography.body, color: colors.textSecondary },
  code: { fontFamily: typography.mono.fontFamily, fontSize: 22, letterSpacing: 6 },
  /** The action bar is a row: a lone button needs flex to span it. */
  barAction: { flex: 1 },
});
