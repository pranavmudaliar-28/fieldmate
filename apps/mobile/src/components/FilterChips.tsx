import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  tabularNumbers,
  typography,
  type Tone,
} from '../constants/theme';
import { Icon } from './Icon';

export type FilterChip<T> = {
  label: string;
  value: T;
  testID: string;
  /** Kept for callers; the chip itself no longer draws a status dot. */
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
 * One row of filters, shared by tasks and users. Chips draw at 40 but keep a
 * 48 hit area; the selected one is ink with a check, so it reads without colour.
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
            style={styles.hitArea}
          >
            <View style={[styles.chip, isSelected && styles.chipSelected]}>
              {isSelected ? <Icon name="checkmark" size={16} color={colors.textOnInverse} /> : null}
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
            </View>
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
    alignItems: 'center',
  },
  hitArea: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: layout.chipHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  label: { ...typography.secondaryStrong, fontSize: 15, color: colors.textPrimary },
  labelSelected: { color: colors.textOnInverse },
  count: { ...typography.secondaryStrong, ...tabularNumbers, color: colors.textTertiary },
});
