import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@fieldmate/shared';
import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../src/constants/theme';
import { SESSION_EXPIRED_MESSAGE, useAuth } from '../../src/features/auth/auth-context';
import { homeRouteFor } from '../../src/features/auth/home-route';
import { useIsOnline } from '../../src/hooks/use-network-status';
import { ApiError } from '../../src/services/http';

const OFFLINE_HINT = 'Connect to the internet to log in.';

/** S-001 Login (docs/04 §5). */
export default function LoginScreen() {
  const { signIn, status, user, sessionExpired, clearSessionExpired } = useAuth();
  const isOnline = useIsOnline();
  const passwordRef = useRef<TextInput>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  });

  if (status === 'signedIn' && user) {
    return <Redirect href={homeRouteFor(user.role)} />;
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    clearSessionExpired();
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
    }
  });

  const banner = formError ?? (sessionExpired ? SESSION_EXPIRED_MESSAGE : null);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.title}
            accessibilityRole="header"
          >
            FieldMate
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.subtitle}>
            Welcome back
          </Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email"
                testID="login-email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                {...(errors.email?.message ? { error: errors.email.message } : {})}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!isSubmitting}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                ref={passwordRef}
                label="Password"
                testID="login-password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                {...(errors.password?.message ? { error: errors.password.message } : {})}
                secure
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void onSubmit()}
                editable={!isSubmitting}
              />
            )}
          />

          {banner ? (
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.formError}
              accessibilityRole="alert"
              testID="login-error"
            >
              {banner}
            </Text>
          ) : null}

          {!isOnline ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.offlineHint}>
              {OFFLINE_HINT}
            </Text>
          ) : null}

          <Button
            label="Login"
            testID="login-submit"
            onPress={() => void onSubmit()}
            loading={isSubmitting}
            disabled={!isOnline}
            disabledReason={OFFLINE_HINT}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const centred = {
  width: '100%',
  maxWidth: layout.maxFormWidth,
  alignSelf: 'center',
} as const;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: layout.screenPadding,
    gap: spacing.xl,
  },
  // A form field stops being easier to read long before a list does, so both
  // blocks stop well short of the column on a wide window.
  header: { ...centred, alignItems: 'center', gap: spacing.xs },
  title: { ...typography.display, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { ...centred, gap: spacing.md },
  formError: { ...typography.secondary, color: colors.errorText },
  offlineHint: { ...typography.secondary, color: colors.textSecondary },
});
