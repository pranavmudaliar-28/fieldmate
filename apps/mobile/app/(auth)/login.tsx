import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@fieldmate/shared';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../../src/components/BrandMark';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { Input } from '../../src/components/Input';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  toneColors,
  typography,
  type IconName,
  type Tone,
} from '../../src/constants/theme';
import { useAuth } from '../../src/features/auth/auth-context';
import { homeRouteFor } from '../../src/features/auth/home-route';
import { useIsOnline } from '../../src/hooks/use-network-status';
import { ApiError } from '../../src/services/http';

const OFFLINE_HINT = 'Connect to the internet to sign in.';

type Notice = { title: string; body?: string; tone: Tone; icon: IconName };

const SESSION_EXPIRED: Notice = {
  title: 'Session expired',
  body: 'Sign in again to keep working.',
  tone: 'info',
  icon: 'time-outline',
};

/** S-001 Sign in. The ink hero carries the brand; the paper sheet holds the form. */
export default function LoginScreen() {
  const { signIn, status, user, sessionExpired, clearSessionExpired } = useAuth();
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const [formError, setFormError] = useState<Notice | null>(null);

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
      setFormError(noticeFor(error));
    }
  });

  const notice = formError ?? (sessionExpired ? SESSION_EXPIRED : null);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* The hero is ink, so the clock and battery go light over it. */}
        <StatusBar style="light" />
        <View style={[styles.hero, { paddingTop: insets.top + spacing['2xl'] }]}>
          <View style={[styles.brandRow, notice ? styles.brandRowCompact : null]}>
            <BrandMark size={notice ? 56 : 72} style={styles.mark} />
            {notice ? (
              <Text
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                style={styles.brand}
                accessibilityRole="header"
              >
                FieldMate
              </Text>
            ) : null}
          </View>
          {notice ? null : (
            <>
              <Text
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                style={styles.brand}
                accessibilityRole="header"
              >
                FieldMate
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.headline}>
                Every job,{'\n'}one next step.
              </Text>
            </>
          )}
        </View>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.form}>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.title}
              accessibilityRole="header"
            >
              Sign in
            </Text>

            {notice ? (
              <View style={[styles.notice, noticeColours(notice.tone)]} accessibilityRole="alert">
                <Icon name={notice.icon} size={22} color={toneColors[notice.tone].text} />
                <View style={styles.noticeBody}>
                  <Text
                    maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                    style={[styles.noticeTitle, { color: toneColors[notice.tone].text }]}
                    testID="login-error"
                  >
                    {notice.title}
                  </Text>
                  {notice.body ? (
                    <Text
                      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                      style={[styles.noticeText, { color: toneColors[notice.tone].text }]}
                    >
                      {notice.body}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Work email"
                  icon="mail-outline"
                  placeholder="name@company.com"
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
                  icon="lock-closed-outline"
                  placeholder="Enter your password"
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

            {!isOnline ? (
              <View style={styles.hintRow}>
                <Icon name="cloud-offline-outline" size={18} color={colors.errorText} />
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.offlineHint}>
                  {OFFLINE_HINT}
                </Text>
              </View>
            ) : notice ? null : (
              <View style={styles.hintRow}>
                <Icon name="information-circle-outline" size={18} color={colors.textSecondary} />
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hint}>
                  Accounts are created by your admin. Ask them if you can’t sign in.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Button
              label={formError ? 'Try again' : 'Sign in'}
              testID="login-submit"
              {...(formError ? {} : { trailingIcon: 'arrow-forward' as const })}
              onPress={() => void onSubmit()}
              loading={isSubmitting}
              disabled={!isOnline}
              disabledReason={OFFLINE_HINT}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Wrong credentials get a hint of what to do next; anything else says what happened. */
function noticeFor(error: unknown): Notice {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') {
      return {
        title: error.message,
        body: 'Check both and try again. Ask your admin if you’ve forgotten your password.',
        tone: 'error',
        icon: 'alert-circle-outline',
      };
    }
    if (error.code === 'NETWORK_ERROR') {
      return { title: error.message, tone: 'error', icon: 'cloud-offline-outline' };
    }
    return { title: error.message, tone: 'error', icon: 'alert-circle-outline' };
  }
  return {
    title: 'Something went wrong. Please try again.',
    tone: 'error',
    icon: 'alert-circle-outline',
  };
}

/** An error is outlined as well as tinted; information is only tinted. */
function noticeColours(tone: Tone) {
  return {
    backgroundColor: toneColors[tone].tint,
    borderColor: tone === 'error' ? toneColors[tone].text : toneColors[tone].tint,
  };
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surfaceInverse },
  scroll: { flexGrow: 1 },
  hero: {
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: layout.screenPadding + spacing.sm,
    paddingBottom: spacing['2xl'] + spacing.lg,
    gap: spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandRowCompact: { marginBottom: -spacing.lg },
  mark: { marginBottom: spacing.sm },
  brand: { ...typography.label, fontSize: 16, lineHeight: 20, color: colors.accent },
  headline: { ...typography.hero, fontSize: 40, lineHeight: 46, color: colors.textOnInverse },
  sheet: {
    flex: 1,
    marginTop: -spacing.xl,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.screenPadding + spacing.sm,
    paddingTop: spacing.xl,
    gap: spacing.xl,
    justifyContent: 'space-between',
  },
  /**
   * A form field stops being easier to use the longer it gets, so the form
   * stops well short of the column on a wide window.
   */
  form: { width: '100%', maxWidth: layout.maxFormWidth, alignSelf: 'center', gap: spacing.mdPlus },
  footer: { width: '100%', maxWidth: layout.maxFormWidth, alignSelf: 'center' },
  title: {
    ...typography.sectionTitle,
    fontFamily: typography.display.fontFamily,
    color: colors.textPrimary,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.smPlus,
    padding: spacing.md,
    borderRadius: radius.action,
    borderWidth: 1,
  },
  noticeBody: { flex: 1, gap: 2 },
  noticeTitle: { ...typography.bodyStrong },
  noticeText: { ...typography.secondary },
  hintRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  hint: { ...typography.secondary, color: colors.textSecondary, flex: 1 },
  offlineHint: { ...typography.secondaryStrong, color: colors.errorText, flex: 1 },
});
