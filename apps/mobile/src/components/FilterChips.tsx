import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  tabularNumbers,
  toneColors,
  typography,
  type Tone,
} from '../constants/theme';

export type FilterChip<T> = {
  label: string;
  value: T;
  testID: string;
  /** Shows the status dot, so a chip reads the same way as a task card. */
  tone?: Tone;
  count?: number;
};

export type FilterChipsProps<T> = {
  options: FilterChip<T>[];
  selected: T;
  onSelect: (value: T) => void;
  testID?: string;
};

/**
 * One implementation for both lists. This markup previously existed twice,
 * once for tasks and once for users, with identical styles.
 */
export function FilterChips<T>({ options, selected, onSelect, testID }: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Without this the row claims the column's spare height and the chips,
      // which stretch on the cross axis by default, become tall ovals.
      style={styles.scroller}
      contentContainerStyle={styles.row}
      testID={testID}
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.testID}
            onPress={() => onSelect(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={
              option.count === undefined ? option.label : `${option.label}, ${option.count}`
            }
            testID={option.testID}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            {option.tone && !isSelected ? (
              <View style={[styles.dot, { backgroundColor: toneColors[option.tone].dot }]} />
            ) : null}
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={[styles.label, isSelected && styles.labelSelected]}
            >
              {option.label}
            </Text>
            {option.count !== undefined ? (
              <Text
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                style={[styles.count, isSelected && styles.labelSelected]}
              >
                {option.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0, flexShrink: 0 },
  row: {
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.surfaceInverse },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  label: { ...typography.secondaryStrong, color: colors.textPrimary },
  labelSelected: { color: colors.textOnInverse },
  count: { ...typography.secondaryStrong, ...tabularNumbers, color: colors.textDisabled },
});
