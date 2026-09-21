import { zodResolver } from '@hookform/resolvers/zod';
import { createTaskSchema, type CreateTaskInput, type UserSummary } from '@fieldmate/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionBar } from '../../components/ActionBar';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
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
  onSubmit: (values: TaskFormValues) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

/** S-004 Create Task / Edit Task. In edit mode the worker field is hidden. */
export function TaskForm({
  mode,
  defaultValues,
  submitting = false,
  submitError = null,
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
              Assign to *
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
              <Text
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                style={workerName ? styles.selectValue : styles.selectPlaceholder}
              >
                {workerName || 'Select a worker'}
              </Text>
            </Pressable>
            {errors.workerId?.message ? (
              <Text
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                style={styles.error}
                accessibilityRole="alert"
              >
                {errors.workerId.message}
              </Text>
            ) : null}
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
          label={mode === 'create' ? 'Create task' : 'Save changes'}
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
  content: { padding: layout.screenPadding, gap: spacing.md },
  field: { gap: spacing.xs },
  label: { ...typography.secondary, color: colors.textPrimary },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  select: {
    minHeight: layout.inputHeight,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  selectError: { borderColor: colors.error },
  selectValue: { ...typography.body, color: colors.textPrimary },
  selectPlaceholder: { ...typography.body, color: colors.textSecondary },
  coordinates: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coordinatesText: { ...typography.secondary, color: colors.textSecondary, flex: 1 },
  permission: { gap: spacing.xs },
  permissionText: { ...typography.secondary, color: colors.textSecondary },
  error: { ...typography.secondary, color: colors.errorText },
});
