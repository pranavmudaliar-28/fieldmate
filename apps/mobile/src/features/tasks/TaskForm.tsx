import { zodResolver } from '@hookform/resolvers/zod';
import { createTaskSchema, type CreateTaskInput, type UserSummary } from '@fieldmate/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../../components/ActionBar';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
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
} from '../../constants/theme';
import { LocationField } from '../location/LocationField';
import { WorkerPicker } from '../assignments/WorkerPicker';

export type TaskFormValues = CreateTaskInput;

export type TaskFormProps = {
  mode: 'create' | 'edit';
  defaultValues?: Partial<TaskFormValues> & { workerName?: string };
  submitting?: boolean;
  submitError?: string | null;
  /** Who hears about the change, shown above the form when editing. */
  notice?: string | null;
  onSubmit: (values: TaskFormValues) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

/**
 * S-004 Create Task / Edit Task. In edit mode the worker is shown but not
 * changed here: reassigning is its own action with its own confirmation.
 */
export function TaskForm({
  mode,
  defaultValues,
  submitting = false,
  submitError = null,
  notice = null,
  onSubmit,
  onDirtyChange,
}: TaskFormProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [workerName, setWorkerName] = useState(defaultValues?.workerName ?? '');

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      workerId: defaultValues?.workerId ?? '',
      location: {
        address: defaultValues?.location?.address ?? '',
        addressDetails: defaultValues?.location?.addressDetails ?? null,
        latitude: defaultValues?.location?.latitude ?? null,
        longitude: defaultValues?.location?.longitude ?? null,
      },
    },
    mode: 'onSubmit',
  });

  const selectWorker = (worker: UserSummary) => {
    setValue('workerId', worker.id, { shouldDirty: true, shouldValidate: true });
    setWorkerName(worker.name);
    setPickerOpen(false);
    onDirtyChange?.(true);
  };

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => onDirtyChange?.(isDirty)}
      >
        {notice ? (
          <View style={styles.notice} testID="task-form-notice">
            <Icon name="notifications-outline" size={18} color={toneColors.warning.text} />
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.noticeText}>
              {notice}
            </Text>
          </View>
        ) : null}

        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Title"
              required
              testID="task-title"
              value={value}
              onChangeText={(text) => {
                onChange(text);
                onDirtyChange?.(true);
              }}
              onBlur={onBlur}
              {...(errors.title?.message ? { error: errors.title.message } : {})}
              editable={!submitting}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Description"
              required
              testID="task-description"
              value={value}
              onChangeText={(text) => {
                onChange(text);
                onDirtyChange?.(true);
              }}
              onBlur={onBlur}
              {...(errors.description?.message ? { error: errors.description.message } : {})}
              multiline
              numberOfLines={4}
              style={styles.textArea}
              editable={!submitting}
            />
          )}
        />

        {mode === 'create' ? (
          <View style={styles.field}>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
              Assign to
            </Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Assign to"
              accessibilityValue={{ text: workerName || 'No worker selected' }}
              testID="task-worker-select"
              disabled={submitting}
              style={[styles.select, errors.workerId ? styles.selectError : null]}
            >
              {workerName ? (
                <Avatar name={workerName} />
              ) : (
                <View style={styles.selectEmptyMark}>
                  <Icon name="person-add-outline" size={20} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.selectText}>
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                  style={workerName ? styles.selectValue : styles.selectPlaceholder}
                >
                  {workerName || 'Choose a field worker'}
                </Text>
                {workerName ? (
                  <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.selectHint}>
                    Field worker
                  </Text>
                ) : null}
              </View>
              <Icon name="chevron-down" size={22} color={colors.textPrimary} />
            </Pressable>
            {errors.workerId?.message ? (
              <View style={styles.errorRow} accessibilityRole="alert">
                <Icon name="alert-circle-outline" size={16} color={colors.errorText} />
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.error}>
                  {errors.workerId.message}
                </Text>
              </View>
            ) : null}
          </View>
        ) : workerName ? (
          <View style={styles.field}>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
              Assigned to
            </Text>
            <View style={styles.select} accessible accessibilityLabel={`Assigned to ${workerName}`}>
              <Avatar name={workerName} />
              <Text
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                style={[styles.selectValue, styles.selectText]}
              >
                {workerName}
              </Text>
            </View>
          </View>
        ) : null}

        <Controller
          control={control}
          name="location"
          render={({ field: { onChange, value } }) => (
            <LocationField
              value={{
                address: value?.address ?? '',
                addressDetails: value?.addressDetails ?? null,
                latitude: value?.latitude ?? null,
                longitude: value?.longitude ?? null,
              }}
              onChange={(next) => {
                onChange(next);
                onDirtyChange?.(true);
              }}
              {...(errors.location?.address?.message
                ? { addressError: errors.location.address.message }
                : {})}
              disabled={submitting}
            />
          )}
        />

        {submitError ? (
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.error}
            accessibilityRole="alert"
            testID="task-form-error"
          >
            {submitError}
          </Text>
        ) : null}
      </ScrollView>

      <ActionBar>
        <Button
          label={mode === 'create' ? 'Create and assign' : 'Save changes'}
          testID="task-submit"
          onPress={() => void submit()}
          loading={submitting}
          disabled={mode === 'edit' && !isDirty}
        />
      </ActionBar>

      <WorkerPicker
        visible={pickerOpen}
        selectedWorkerId={watch('workerId') || null}
        onSelect={selectWorker}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingTop: spacing.xs, gap: spacing.mdPlus },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.action,
    backgroundColor: toneColors.warning.tint,
  },
  noticeText: { ...typography.secondary, color: toneColors.warning.text, flex: 1 },
  field: { gap: spacing.sm },
  label: { ...typography.secondaryStrong, color: colors.textPrimary },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  select: {
    minHeight: layout.inputHeight + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectError: { borderColor: colors.error, borderWidth: 2 },
  selectEmptyMark: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectText: { flex: 1, gap: 2 },
  selectValue: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  selectHint: { ...typography.secondary, color: colors.textSecondary },
  selectPlaceholder: { ...typography.body, color: colors.textTertiary },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  error: { ...typography.secondary, color: colors.errorText, flex: 1 },
});
