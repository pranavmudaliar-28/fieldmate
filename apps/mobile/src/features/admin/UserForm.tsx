import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, type CreateUserInput, type Role } from '@fieldmate/shared';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../../components/ActionBar';
import { Button } from '../../components/Button';
import { ChoiceList } from '../../components/ChoiceList';
import { Icon } from '../../components/Icon';
import { Input } from '../../components/Input';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  toneColors,
  typography,
  type IconName,
} from '../../constants/theme';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  FIELD_WORKER: 'Field worker',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Manages users and access',
  MANAGER: 'Creates, assigns and reviews tasks',
  FIELD_WORKER: 'Accepts tasks and submits work',
};

export const ROLE_ICONS: Record<Role, IconName> = {
  ADMIN: 'shield-outline',
  MANAGER: 'people-outline',
  FIELD_WORKER: 'hammer-outline',
};

/** Workers first: they are most of the accounts an admin creates. */
const ROLE_ORDER: Role[] = ['FIELD_WORKER', 'MANAGER', 'ADMIN'];

export type UserFormValues = CreateUserInput;

export type UserFormProps = {
  mode: 'create' | 'edit';
  defaultValues?: Partial<UserFormValues>;
  submitting?: boolean;
  submitError?: string | null;
  /** Managers invite field workers only, so they get no role choice. */
  roleChoice?: boolean;
  onSubmit: (values: UserFormValues) => void;
};

/**
 * S-013 Add / edit user. Nobody types a password for someone else: a new user
 * is emailed an invitation code and chooses their own.
 */
export function UserForm({
  mode,
  defaultValues,
  submitting = false,
  submitError = null,
  roleChoice = true,
  onSubmit,
}: UserFormProps) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      email: defaultValues?.email ?? '',
      role: defaultValues?.role ?? 'FIELD_WORKER',
    },
    mode: 'onSubmit',
  });

  const submit = handleSubmit((values) => onSubmit(values));
  const firstName = watch('name').trim().split(/\s+/)[0] || 'them';

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Full name"
              required
              testID="user-name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              {...(errors.name?.message ? { error: errors.name.message } : {})}
              editable={!submitting}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Work email"
              required
              icon="mail-outline"
              testID="user-email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              {...(errors.email?.message ? { error: errors.email.message } : {})}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
          )}
        />

        {roleChoice ? (
          <Controller
            control={control}
            name="role"
            render={({ field: { onChange, value } }) => (
              <View style={styles.field}>
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
                  Role
                </Text>
                <ChoiceList
                  choices={ROLE_ORDER.map((role) => ({
                    value: role,
                    label: ROLE_LABELS[role],
                    description: ROLE_DESCRIPTIONS[role],
                    testID: `role-${role}`,
                  }))}
                  selected={value}
                  onSelect={onChange}
                  disabled={submitting}
                  accessibilityLabel="Role"
                />
              </View>
            )}
          />
        ) : null}

        <View style={styles.note}>
          <Icon name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.noteText}
            testID="user-form-note"
          >
            {mode === 'create'
              ? `We’ll email ${firstName} a code. They tap “Set up your account” on the sign-in screen and choose their own password.`
              : 'To reset the password, use Send password reset on the user’s details.'}
          </Text>
        </View>

        {submitError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Icon name="alert-circle-outline" size={18} color={toneColors.error.text} />
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.error}
              testID="user-form-error"
            >
              {submitError}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <ActionBar>
        <Button
          label={mode === 'create' ? 'Send invitation' : 'Save changes'}
          testID="user-submit"
          onPress={() => void submit()}
          loading={submitting}
          disabled={mode === 'edit' && !isDirty}
          style={styles.barAction}
        />
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  /** The action bar is a row: a lone button needs flex to span it. */
  barAction: { flex: 1 },
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingTop: spacing.xs, gap: spacing.mdPlus },
  field: { gap: spacing.sm },
  label: { ...typography.secondaryStrong, color: colors.textPrimary },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noteText: { ...typography.secondary, color: colors.textSecondary, flex: 1 },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.action,
    backgroundColor: toneColors.error.tint,
  },
  error: { ...typography.secondaryStrong, color: colors.errorText, flex: 1 },
});
