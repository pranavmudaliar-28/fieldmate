import type { UserSummary } from '@fieldmate/shared';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
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
  /** The confirm button's label for the chosen worker. */
  confirmLabel?: (worker: UserSummary) => string;
  onSelect: (worker: UserSummary) => void;
  onClose: () => void;
};

const firstName = (name: string) => name.split(' ')[0] ?? name;

/**
 * Pick one field worker: search, tap to choose, then confirm. Choosing and
 * committing are two taps so a slip in a long list costs nothing.
 */
export function WorkerPicker({
  visible,
  title = 'Assign to',
  selectedWorkerId = null,
  disabledWorkerId = null,
  confirmLabel = (worker) => `Assign to ${firstName(worker.name)}`,
  onSelect,
  onClose,
}: WorkerPickerProps) {
  const workers = useFieldWorkers(visible);
  const [query, setQuery] = useState('');
  const [chosenId, setChosenId] = useState<string | null>(selectedWorkerId);

  // Each opening starts from the task's current choice, not the last one tapped.
  useEffect(() => {
    if (visible) {
      setChosenId(selectedWorkerId);
      setQuery('');
    }
  }, [visible, selectedWorkerId]);

  const all = workers.data ?? [];
  const needle = query.trim().toLowerCase();
  const shown = needle ? all.filter((worker) => worker.name.toLowerCase().includes(needle)) : all;
  const chosen = all.find((worker) => worker.id === chosenId) ?? null;

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} testID="worker-picker">
      <View style={styles.search}>
        <Icon name="search-outline" size={20} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search workers"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Search workers"
          autoCorrect={false}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.searchInput}
          testID="worker-search"
        />
      </View>

      {workers.isPending ? <LoadingState variant="list" /> : null}

      {workers.isError ? (
        <ErrorState message="Couldn't load field workers." onRetry={() => void workers.refetch()} />
      ) : null}

      {workers.data?.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No field workers yet"
          message="Ask your administrator to create worker accounts."
        />
      ) : null}

      {all.length > 0 ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.groupLabel}>
          Field workers · {all.length}
        </Text>
      ) : null}

      <ScrollView style={styles.list}>
        {shown.map((worker) => {
          const disabled = worker.id === disabledWorkerId;
          const isCurrent = worker.id === disabledWorkerId || worker.id === selectedWorkerId;
          const isChosen = worker.id === chosenId;
          return (
            <Pressable
              key={worker.id}
              onPress={() => setChosenId(worker.id)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: isChosen, disabled }}
              accessibilityLabel={worker.name}
              testID={`worker-option-${worker.id}`}
              style={({ pressed }) => [
                styles.row,
                isChosen && styles.rowChosen,
                pressed && !disabled && styles.rowPressed,
              ]}
            >
              <Avatar name={worker.name} />
              <View style={styles.rowText}>
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                  style={[styles.name, disabled && styles.disabled]}
                >
                  {worker.name}
                </Text>
                <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hint}>
                  {isCurrent ? 'Currently assigned' : 'Field worker'}
                </Text>
              </View>
              <View style={[styles.radio, isChosen && styles.radioChosen]}>
                {isChosen ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
        {all.length > 0 && shown.length === 0 ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.noMatch}>
            No worker matches “{query.trim()}”.
          </Text>
        ) : null}
      </ScrollView>

      {chosen ? (
        <Button
          label={confirmLabel(chosen)}
          testID="worker-picker-confirm"
          onPress={() => onSelect(chosen)}
          style={styles.confirm}
        />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.buttonHeightMedium,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  groupLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  list: { flexGrow: 0, maxHeight: 360 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.smPlus,
    borderRadius: radius.action,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowChosen: { borderColor: colors.primary, backgroundColor: colors.background },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowText: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary },
  disabled: { color: colors.textDisabled },
  hint: { ...typography.secondary, color: colors.textSecondary },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChosen: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.primary },
  noMatch: { ...typography.secondary, color: colors.textSecondary, paddingVertical: spacing.md },
  confirm: { marginTop: spacing.md },
});
