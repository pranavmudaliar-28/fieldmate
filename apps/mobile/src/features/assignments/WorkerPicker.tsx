import type { UserSummary } from '@fieldmate/shared';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  spacing,
  typography,
} from '../../constants/theme';
import { useFieldWorkers } from '../tasks/hooks';

export type WorkerPickerProps = {
  visible: boolean;
  title?: string;
  selectedWorkerId?: string | null;
  /** Shown but not selectable, e.g. the task's current worker. */
  disabledWorkerId?: string | null;
  onSelect: (worker: UserSummary) => void;
  onClose: () => void;
};

export function WorkerPicker({
  visible,
  title = 'Assign to',
  selectedWorkerId = null,
  disabledWorkerId = null,
  onSelect,
  onClose,
}: WorkerPickerProps) {
  const workers = useFieldWorkers(visible);

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} testID="worker-picker">
      {workers.isPending ? <LoadingState variant="list" /> : null}

      {workers.isError ? (
        <ErrorState message="Couldn't load field workers." onRetry={() => void workers.refetch()} />
      ) : null}

      {workers.data?.length === 0 ? (
        <EmptyState
          title="No field workers yet"
          message="Ask your administrator to create worker accounts."
        />
      ) : null}

      <ScrollView>
        {workers.data?.map((worker) => {
          const disabled = worker.id === disabledWorkerId;
          const selected = worker.id === selectedWorkerId;
          return (
            <Pressable
              key={worker.id}
              onPress={() => onSelect(worker)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              testID={`worker-option-${worker.id}`}
              style={({ pressed }) => [styles.row, pressed && !disabled && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                  style={[styles.name, disabled && styles.disabled]}
                >
                  {worker.name}
                </Text>
                {disabled ? (
                  <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hint}>
                    Current
                  </Text>
                ) : null}
              </View>
              {selected ? (
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.check}>
                  Selected
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowText: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.body, color: colors.textPrimary },
  disabled: { color: colors.textDisabled },
  hint: { ...typography.caption, color: colors.textSecondary },
  check: { ...typography.secondary, color: colors.primary },
});
