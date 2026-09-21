import { zodResolver } from '@hookform/resolvers/zod';
import { ROLES, createUserSchema, type CreateUserInput, type Role } from '@fieldmate/shared';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../../components/ActionBar';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  fontFamily,
  layout,
  radius,
  spacing,
  typography,
} from '../../constants/theme';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  FIELD_WORKER: 'Field worker',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Manages people and can do everything a manager can.',
  MANAGER: 'Creates and assigns tasks, and reviews completed work.',
  FIELD_WORKER: 'Carries out assigned tasks in the field.',
};

export type UserFormValues = CreateUserInput;

export type UserFormProps = {
  mode: 'create' | 'edit';
  defaultValues?: Partial<UserFormValues>;
  submitting?: boolean;
  submitError?: string | null;
  onSubmit: (values: UserFormValues) => void;
};

/** S-013 Add / edit user. In edit mode the password field is hidden. */
export function UserForm({
  mode,
  defaultValues,
  submitting = false,
  submitError = null,
  onSubmit,
}: UserFormProps) {
  // In edit mode the password has its own action, so it is not validated here.
  const schema =
    mode === 'create'
      ? createUserSchema
      : createUserSchema.extend({ password: z.string().optional() });

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema) as Resolver<UserFormValues>,
    defaultValues: {
      name: defaultValues?.name ?? '',
      email: defaultValues?.email ?? '',
      role: defaultValues?.role ?? 'FIELD_WORKER',
      password: '',
    },
    mode: 'onSubmit',
  });

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Name"
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
              label="Email"
              required
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

        <Controller
          control={control}
          name="role"
          render={({ field: { onChange, value } }) => (
            <View style={styles.field}>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
                Role *
              </Text>
              {ROLES.map((role) => {
                const selected = value === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => onChange(role)}
                    disabled={submitting}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={ROLE_LABELS[role]}
                    testID={`role-${role}`}
                    style={[styles.roleOption, selected && styles.roleOptionSelected]}
                  >
                    <Text
                      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                      style={[styles.roleName, selected && styles.roleNameSelected]}
                    >
                      {ROLE_LABELS[role]}
                    </Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.roleHint}>
                      {ROLE_DESCRIPTIONS[role]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />

        {mode === 'create' ? (
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Password"
                required
                testID="user-password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                {...(errors.password?.message ? { error: errors.password.message } : {})}
                helper="Share it with the user; they can keep using it until you change it."
                secure
                autoCapitalize="none"
                editable={!submitting}
              />
            )}
          />
        ) : null}

        {submitError ? (
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.error}
            accessibilityRole="alert"
            testID="user-form-error"
          >
            {submitError}
          </Text>
        ) : null}
      </ScrollView>

      <ActionBar>
        <Button
          label={mode === 'create' ? 'Create user' : 'Save changes'}
          testID="user-submit"
          onPress={() => void submit()}
          loading={submitting}
          disabled={mode === 'edit' && !isDirty}
        />
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: spacing.md },
  field: { gap: spacing.xs },
  label: { ...typography.secondary, color: colors.textPrimary },
  roleOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 2,
    minHeight: layout.minTouchTarget,
  },
  roleOptionSelected: { borderColor: colors.primary, borderWidth: 2 },
  roleName: { ...typography.body, color: colors.textPrimary },
  roleNameSelected: { color: colors.primary, fontFamily: fontFamily.semibold },
  roleHint: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.secondary, color: colors.errorText },
});
