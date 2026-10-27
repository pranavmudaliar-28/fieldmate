import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, setPasswordWithCodeSchema } from '@fieldmate/shared';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
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
import { requestPasswordCode, setPasswordWithCode } from '../../src/features/auth/api';
import { useAuth } from '../../src/features/auth/auth-context';
import { homeRouteFor } from '../../src/features/auth/home-route';

const formSchema = setPasswordWithCodeSchema
  .extend({ confirm: z.string() })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'The passwords don’t match.',
  });
type FormValues = z.input<typeof formSchema>;

/**
 * Sets a password from an emailed code. One screen for both ways in:
 * "Forgot password?" first asks where to send the code, while an invitation
 * already has one waiting in the inbox. Either way the user ends up signed in.
 */
export default function SetPasswordScreen() {
  const params = useLocalSearchParams<{ mode?: string; email?: string }>();
  const invite = params.mode === 'invite';
  const router = useRouter();
  const { showToast } = useToast();
  const { status, user, completeSignIn } = useAuth();

  // A reset starts by asking where to send the code; an invitation has one already.
  const [step, setStep] = useState<'email' | 'code'>(invite ? 'code' : 'email');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: params.email ?? '', code: '', password: '', confirm: '' },
    mode: 'onSubmit',
  });

  if (status === 'signedIn' && user) return <Redirect href={homeRouteFor(user.role)} />;

  const sendCode = async () => {
    setError(null);
    if (!(await trigger('email'))) return;
    const { email } = forgotPasswordSchema.parse({ email: getValues('email') });
    setSending(true);
    try {
      await requestPasswordCode(email);
      setStep('code');
      showToast(`If ${email} has an account, a code is on its way.`);
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setSending(false);
    }
  };

  const submit = handleSubmit(async ({ email, code, password }) => {
    setError(null);
    try {
      const signedIn = await completeSignIn(await setPasswordWithCode(email, code, password));
      router.replace(homeRouteFor(signedIn.role));
    } catch (submitError) {
      setError(errorMessage(submitError));
    }
  });

  const busy = isSubmitting || sending;
  const email = getValues('email');

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader
        title={invite ? 'Set up your account' : 'Reset password'}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.lead}>
          {step === 'email'
            ? 'Enter your work email and we’ll send you a 6-digit code.'
            : invite
              ? 'Enter your email, the 6-digit code from your invitation, and a password of your choice.'
              : `Enter the 6-digit code we sent to ${email} and choose a new password.`}
        </Text>

        {step === 'email' || invite ? (
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Work email"
                icon="mail-outline"
                placeholder="name@company.com"
                testID="set-password-email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                {...(errors.email?.message ? { error: errors.email.message } : {})}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!busy}
              />
            )}
          />
        ) : null}

        {step === 'code' ? (
          <>
            <Controller
              control={control}
              name="code"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Code from the email"
                  icon="keypad-outline"
                  placeholder="123456"
                  testID="set-password-code"
                  value={value}
                  onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
                  onBlur={onBlur}
                  {...(errors.code?.message ? { error: errors.code.message } : {})}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  style={styles.code}
                  editable={!busy}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="New password"
                  icon="lock-closed-outline"
                  testID="set-password-password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  {...(errors.password?.message
                    ? { error: errors.password.message }
                    : { helper: 'At least 8 characters.' })}
                  secure
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!busy}
                />
              )}
            />
            <Controller
              control={control}
              name="confirm"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirm password"
                  icon="lock-closed-outline"
                  testID="set-password-confirm"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  {...(errors.confirm?.message ? { error: errors.confirm.message } : {})}
                  secure
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  editable={!busy}
                />
              )}
            />
            <Button
              label="Send a new code"
              variant="ghost"
              size="md"
              fullWidth={false}
              testID="set-password-resend"
              loading={sending}
              disabled={busy}
              onPress={() => void sendCode()}
              style={styles.resend}
            />
          </>
        ) : null}

        <FormError message={error} testID="set-password-error" />
      </ScrollView>

      <ActionBar>
        {step === 'email' ? (
          <Button
            label="Email me a code"
            testID="set-password-send"
            loading={sending}
            onPress={() => void sendCode()}
            style={styles.barAction}
          />
        ) : (
          <Button
            label="Set password and sign in"
            testID="set-password-submit"
            loading={isSubmitting}
            disabled={sending}
            onPress={() => void submit()}
            style={styles.barAction}
          />
        )}
      </ActionBar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingTop: spacing.xs, gap: spacing.mdPlus },
  lead: { ...typography.body, color: colors.textSecondary },
  code: { fontFamily: typography.mono.fontFamily, fontSize: 22, letterSpacing: 6 },
  resend: { alignSelf: 'flex-start' },
  /** The action bar is a row: a lone button needs flex to span it. */
  barAction: { flex: 1 },
});
